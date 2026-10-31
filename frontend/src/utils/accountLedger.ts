export interface DocumentClassification {
  title: string;
  caracter: 'FISCAL' | 'INTERNO' | 'MIXTO' | 'FAVOR';
  caracterLabel: string;
  subtitle: string;
  cae?: string | null;
  nroComprobante?: string | null;
}

export interface LedgerResult {
  transactions: any[];
  pendingDebts: any[];
  paidDebts: any[];
}

/**
 * Discrimina de forma unívoca el nombre y carácter (Fiscal ARCA vs Interno)
 * de cualquier comprobante, venta o movimiento de cuenta corriente.
 */
export function getDocumentClassification(item: any): DocumentClassification {
  if (!item) {
    return {
      title: 'Comprobante',
      caracter: 'MIXTO',
      caracterLabel: 'MIXTO',
      subtitle: '',
    };
  }

  const isVenta = item.type === 'venta';

  if (isVenta) {
    const nro = item.nro_comprobante ? String(item.nro_comprobante).trim() : '';
    const tipo = item.tipo_comprobante ? String(item.tipo_comprobante).trim() : 'Factura';
    const hasCae = Boolean(item.cae);

    const isBlanco =
      hasCae ||
      ['Factura A', 'Factura B', 'Factura C', 'Nota de Crédito A', 'Nota de Crédito B'].includes(tipo) ||
      item.tipo === 'BLANCO' ||
      (Number(item.monto_facturado_ars) > 0 && Number(item.monto_no_facturado_ars || 0) === 0);

    const isRemito =
      tipo.toLowerCase().includes('remito') ||
      nro.toLowerCase().startsWith('dif-') ||
      (Number(item.monto_no_facturado_ars) > 0 && Number(item.monto_facturado_ars || 0) === 0) ||
      item.tipo === 'INTERNO';

    if (isBlanco && !isRemito) {
      const displayNro = nro || (item.rawId || item.id ? String(item.rawId || item.id).replace(/\D/g, '').padStart(8, '0') : '');
      const title = displayNro ? `${tipo} N° ${displayNro}` : `${tipo} Fiscal`;
      return {
        title,
        caracter: 'FISCAL',
        caracterLabel: 'FISCAL ARCA',
        subtitle: 'Factura Electrónica Oficial ARCA',
        cae: item.cae || null,
        nroComprobante: nro || null,
      };
    }

    if (isRemito) {
      const displayNro = nro || (item.rawId || item.id ? String(item.rawId || item.id).replace(/\D/g, '').padStart(5, '0') : '');
      const title = displayNro ? `Remito Interno N° ${displayNro}` : 'Remito Interno';
      return {
        title,
        caracter: 'INTERNO',
        caracterLabel: 'INTERNO',
        subtitle: 'Comprobante de Gestión Interna',
        cae: null,
        nroComprobante: nro || null,
      };
    }

    // Caso mixto
    const displayNro = nro || (item.rawId || item.id ? String(item.rawId || item.id).replace(/\D/g, '').padStart(5, '0') : '');
    return {
      title: `${tipo} N° ${displayNro}`,
      caracter: 'MIXTO',
      caracterLabel: 'MIXTO',
      subtitle: 'Comprobante Mixto',
      cae: item.cae || null,
      nroComprobante: nro || null,
    };
  }


    // Saldo a Favor
  const isFavor = item.tipo === 'A_FAVOR' || item.metodo_pago === 'SALDO_A_FAVOR';
  const ref = item.referencia && item.referencia.trim() !== '' ? item.referencia : '';

  if (isFavor) {
    return {
      title: ref || 'Carga de Saldo a Favor',
      caracter: 'FAVOR',
      caracterLabel: 'A FAVOR',
      subtitle: 'Crédito a Favor del Cliente',
      cae: null,
      nroComprobante: null,
    };
  }

  // Ajustes de saldo manuales
  const isAjuste = ['SALDO_PREVIO', 'AJUSTE_SALDO'].includes(item.metodo_pago);

  if (isAjuste) {
    const isBlanco = item.tipo === 'BLANCO';
    const isInterno = item.tipo === 'INTERNO';
    const defaultName = item.metodo_pago === 'SALDO_PREVIO' ? 'Saldo Inicial' : 'Ajuste de Saldo';
    const title = ref || defaultName;

    return {
      title,
      caracter: isBlanco ? 'FISCAL' : isInterno ? 'INTERNO' : 'MIXTO',
      caracterLabel: isBlanco ? 'FISCAL (BLANCO)' : isInterno ? 'INTERNO' : 'MIXTO',
      subtitle: 'Ajuste de Cuenta Corriente',
      cae: null,
      nroComprobante: null,
    };
  }

  // Cobro recibido
  const isBlanco = item.tipo === 'BLANCO';
  const isInterno = item.tipo === 'INTERNO';
  const metodoRaw = item.metodo_pago || 'EFECTIVO';
  const metodoLabel = metodoRaw === 'CHEQUE_ELECTRONICO'
    ? 'Cheque Electrónico (E-Cheq)'
    : metodoRaw === 'CHEQUE'
    ? 'Cheque Físico'
    : metodoRaw === 'TRANSFERENCIA'
    ? 'Transferencia Bancaria'
    : metodoRaw;

  const title = ref || `Cobro Recibido (${metodoLabel})`;
  let subtitle = `Cobro en ${metodoLabel}`;
  if (item.nro_cheque) {
    subtitle += ` • N° ${item.nro_cheque}`;
  }
  if (item.fecha_vto_cheque) {
    subtitle += ` • Vto: ${new Date(item.fecha_vto_cheque).toLocaleDateString('es-AR')}`;
  }
  if (item.caja) {
    subtitle += ` • Caja: ${item.caja}`;
  }

  return {
    title,
    caracter: isBlanco ? 'FISCAL' : isInterno ? 'INTERNO' : 'MIXTO',
    caracterLabel: isBlanco ? 'FISCAL (BLANCO)' : isInterno ? 'INTERNO' : 'MIXTO',
    subtitle,
    cae: null,
    nroComprobante: item.nro_cheque ? `Cheque N° ${item.nro_cheque}` : null,
  };
}

/**
 * Procesa y clasifica las transacciones de un cliente en:
 * - Pendientes de Pago (únicamente facturas y deudas que no fueron canceladas)
 * - Pagados (comprobantes liquidados o cobros efectivizados)
 * - Historial Completo (todas las transacciones cronológicas)
 */
export function processClientLedger(client: any, clientDetails: any): LedgerResult {
  const getFallbackDebts = (c: any) => {
    const list: any[] = [];
    if (!c) return list;
    const saldoBlancoNum = Math.abs(Number(c.saldo_blanco || 0));
    const saldoInternoNum = Math.abs(Number(c.saldo_interno || 0));

    if (saldoBlancoNum > 0.01) {
      list.push({
        id: `saldo-blanco-${c.id || 'general'}`,
        rawId: c.id,
        label: `[FISCAL (BLANCO)] Saldo Fiscal Pendiente`,
        displayTitle: 'Saldo Fiscal Pendiente',
        classification: {
          title: 'Saldo Fiscal Pendiente',
          caracter: 'FISCAL',
          caracterLabel: 'FISCAL (BLANCO)',
          subtitle: 'Saldo Oficial ARCA',
          cae: null,
          nroComprobante: null,
        },
        monto: saldoBlancoNum,
        saldoPendiente: saldoBlancoNum,
        tipo: 'BLANCO',
        fecha: c.updated_at || new Date().toISOString(),
        type: 'cobro',
        raw: c,
      });
    }

    if (saldoInternoNum > 0.01) {
      list.push({
        id: `saldo-interno-${c.id || 'general'}`,
        rawId: c.id,
        label: `[INTERNO] Saldo Remitos / Gestión Pendiente`,
        displayTitle: 'Saldo Remitos / Gestión Pendiente',
        classification: {
          title: 'Saldo Remitos / Gestión Pendiente',
          caracter: 'INTERNO',
          caracterLabel: 'INTERNO',
          subtitle: 'Saldo de Remitos y Gestión',
          cae: null,
          nroComprobante: null,
        },
        monto: saldoInternoNum,
        saldoPendiente: saldoInternoNum,
        tipo: 'INTERNO',
        fecha: c.updated_at || new Date().toISOString(),
        type: 'cobro',
        raw: c,
      });
    }
    return list;
  };

  if (!clientDetails) {
    return { transactions: [], pendingDebts: getFallbackDebts(client), paidDebts: [] };
  }

  // 1. Unificar ventas y cobros para el historial cronológico con su clasificación
  const rawSales = (clientDetails.sales || []).map((s: any) => {
    const saleItem = { ...s, type: 'venta' as const };
    return {
      ...saleItem,
      classification: getDocumentClassification(saleItem),
    };
  });

  const rawPayments = (clientDetails.payments || []).map((p: any) => {
    const payItem = { ...p, type: 'cobro' as const };
    return {
      ...payItem,
      classification: getDocumentClassification(payItem),
    };
  });

  const transactions = [...rawSales, ...rawPayments].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  );

  // 2. Extraer deudas activas (Descartando ventas ANULADAS por Nota de Crédito)
  const debtList = transactions.filter((item) => {
    if (item.type === 'venta') {
      return item.estado_factura !== 'ANULADA';
    }
    // Ajustes de saldo negativos (deuda cargada manualmente)
    return (
      ['SALDO_PREVIO', 'AJUSTE_SALDO'].includes(item.metodo_pago) &&
      Number(item.monto_ars) < 0
    );
  });

  // 3. Extraer cobros positivos recibidos
  const paymentList = transactions.filter((item) => {
    return item.type === 'cobro' && Number(item.monto_ars) > 0;
  });

  interface TrackedDebt {
    rawItem: any;
    isVenta: boolean;
    totalOriginal: number;
    saldoPendiente: number;
    totalPagado: number;
    pagosAplicados: Array<{ payment: any; monto: number }>;
  }

  const debts: TrackedDebt[] = debtList.map((item) => {
    const isVenta = item.type === 'venta';
    const totalOriginal = isVenta ? Number(item.total_real_ars) : Math.abs(Number(item.monto_ars));
    return {
      rawItem: item,
      isVenta,
      totalOriginal,
      saldoPendiente: totalOriginal,
      totalPagado: 0,
      pagosAplicados: [],
    };
  });

  interface TrackedPayment {
    rawItem: any;
    montoOriginal: number;
    remainingMonto: number;
    montoAsignado: number;
  }

  const payments: TrackedPayment[] = paymentList.map((item) => {
    const montoOriginal = Number(item.monto_ars);
    return {
      rawItem: item,
      montoOriginal,
      remainingMonto: montoOriginal,
      montoAsignado: 0,
    };
  });

  const isClientDebtFree = Number(client?.saldo_deuda || 0) >= 0;

  if (isClientDebtFree) {
    // Si la cartera del cliente no tiene deuda (saldo >= 0), todas las deudas históricas se consideran totalmente canceladas
    debts.forEach((d) => {
      d.saldoPendiente = 0;
      d.totalPagado = d.totalOriginal;
      if (payments.length > 0) {
        d.pagosAplicados.push({ payment: payments[0].rawItem, monto: d.totalOriginal });
      }
    });
    payments.forEach((p) => {
      p.remainingMonto = 0;
      p.montoAsignado = p.montoOriginal;
    });
  } else {
    // Paso 1: Matching directo por referencia específica (ej. "Cobro Factura A N° 00000036", "#00036", etc.)
    debts.forEach((d) => {
      if (d.saldoPendiente <= 0.01) return;

      for (const p of payments) {
        if (p.remainingMonto <= 0.01) continue;
        const ref = (p.rawItem.referencia || '').toLowerCase().trim();
        if (!ref) continue;

        let isMatch = false;

        if (d.isVenta) {
          const idStr = String(d.rawItem.id);
          const padId = idStr.padStart(5, '0');
          const nroComp = d.rawItem.nro_comprobante ? String(d.rawItem.nro_comprobante).toLowerCase().trim() : '';
          const cleanNroComp = nroComp.replace(/^0+/, '');

          if (
            ref.includes(`#${padId}`) ||
            ref.includes(`#${idStr}`) ||
            (nroComp && ref.includes(nroComp)) ||
            (cleanNroComp && cleanNroComp.length >= 2 && ref.includes(cleanNroComp))
          ) {
            isMatch = true;
          }
        } else {
          const debtRef = (d.rawItem.referencia || '').toLowerCase().trim();
          const numMatch = debtRef.match(/\d+/);

          if (numMatch && numMatch[0].length >= 2 && ref.includes(numMatch[0])) {
            isMatch = true;
          } else {
            const cleanRef = debtRef.replace(/ajuste|saldo/gi, '').trim();
            if (cleanRef.length >= 3 && ref.includes(cleanRef)) {
              isMatch = true;
            }
          }
        }

        if (isMatch) {
          const deduction = Math.min(d.saldoPendiente, p.remainingMonto);
          if (deduction > 0.001) {
            d.saldoPendiente -= deduction;
            d.totalPagado += deduction;
            p.remainingMonto -= deduction;
            p.montoAsignado += deduction;
            d.pagosAplicados.push({ payment: p.rawItem, monto: deduction });
          }
          if (d.saldoPendiente <= 0.01) {
            d.saldoPendiente = 0;
            break;
          }
        }
      }
    });

    // Paso 2: Imputación FIFO con pagos que aún tienen remanente sobre las deudas más antiguas
    const debtsSortedByAge = [...debts].sort(
      (a, b) => new Date(a.rawItem.fecha).getTime() - new Date(b.rawItem.fecha).getTime()
    );

    const paymentsSortedByAge = [...payments].sort(
      (a, b) => new Date(a.rawItem.fecha).getTime() - new Date(b.rawItem.fecha).getTime()
    );

    for (const p of paymentsSortedByAge) {
      if (p.remainingMonto <= 0.01) continue;

      for (const d of debtsSortedByAge) {
        if (d.saldoPendiente <= 0.01) continue;

        const deduction = Math.min(d.saldoPendiente, p.remainingMonto);
        if (deduction > 0.001) {
          d.saldoPendiente -= deduction;
          d.totalPagado += deduction;
          p.remainingMonto -= deduction;
          p.montoAsignado += deduction;
          d.pagosAplicados.push({ payment: p.rawItem, monto: deduction });
        }

        if (d.saldoPendiente <= 0.01) {
          d.saldoPendiente = 0;
        }

        if (p.remainingMonto <= 0.01) {
          p.remainingMonto = 0;
          break;
        }
      }
    }
  }

  // Paso 3: Clasificación estricta en Pagados vs Pendientes
  const paidDebts: any[] = [];
  const pendingDebts: any[] = [];

  debts.forEach((d) => {
    const item = d.rawItem;
    const info = item.classification || getDocumentClassification(item);

    // Solo si el saldo pendiente es 0 (o menos de 5 centavos por redondeos) va a Pagados
    if (d.saldoPendiente <= 0.05) {
      paidDebts.push({
        ...item,
        isPaid: true,
        isPartial: false,
        totalOriginal: d.totalOriginal,
        totalPagado: d.totalPagado,
        saldoPendiente: 0,
        pagosAplicados: d.pagosAplicados,
        paymentInfo: d.pagosAplicados[d.pagosAplicados.length - 1]?.payment || null,
        classification: info,
      });
    } else {
      // Tiene saldo pendiente: PERMANECE EN PENDIENTES DE PAGO CON SUS DATOS COMPLETOS
      const isPartial = d.totalPagado > 0.05;
      pendingDebts.push({
        ...item,
        isPaid: false,
        isPartial: isPartial,
        totalOriginal: d.totalOriginal,
        totalPagado: d.totalPagado,
        saldoPendiente: d.saldoPendiente,
        pagosAplicados: d.pagosAplicados,
        // Campos estandarizados para selector de cobro y visualización
        id: d.isVenta ? `sale-${item.id}` : `payment-${item.id}`,
        rawId: item.id,
        label: isPartial
          ? `[${info.caracterLabel}] ${info.title} (Resta: $${d.saldoPendiente.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} de $${d.totalOriginal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
          : `[${info.caracterLabel}] ${info.title}`,
        displayTitle: info.title,
        classification: info,
        monto: d.saldoPendiente, // Resta exacta a cobrar
        tipo: d.isVenta
          ? info.caracter === 'FISCAL' ? 'BLANCO' : info.caracter === 'INTERNO' ? 'INTERNO' : 'MIXTO'
          : item.tipo || 'MIXTO',
        raw: item,
      });
    }
  });

  // Paso 4: Agregar cobros en Pagados
  // Registramos cobros que no correspondan exclusivamente a comprobantes que ya figuran pagados
  const fullyPaidSalePaymentIds = new Set<number>();
  paidDebts.forEach((pd) => {
    if (pd.type === 'venta' && pd.pagosAplicados) {
      pd.pagosAplicados.forEach((pa: any) => {
        if (pa.payment && pa.payment.id) {
          fullyPaidSalePaymentIds.add(pa.payment.id);
        }
      });
    }
  });

  payments.forEach((p) => {
    // Si el cobro tiene saldo sin asignar o fue un cobro parcial, debe verse en la pestaña de Pagados
    if (!fullyPaidSalePaymentIds.has(p.rawItem.id) || p.remainingMonto > 0.01) {
      paidDebts.push({
        ...p.rawItem,
        isStandalonePayment: true,
        isPaid: true,
        montoAsignado: p.montoAsignado,
        remainingMonto: p.remainingMonto,
        classification: p.rawItem.classification || getDocumentClassification(p.rawItem),
      });
    }
  });

  // Si no hay comprobantes fiscales en pendingDebts pero el cliente tiene saldo fiscal deudor:
  const saldoBlancoNum = Math.abs(Number(client?.saldo_blanco || 0));
  const hasFiscalInPending = pendingDebts.some(
    (d) => d.classification?.caracter === 'FISCAL' || d.tipo === 'BLANCO'
  );
  if (!hasFiscalInPending && saldoBlancoNum > 0.01) {
    pendingDebts.push({
      id: `saldo-blanco-${client?.id || 'general'}`,
      rawId: client?.id,
      label: `[FISCAL (BLANCO)] Saldo Fiscal Pendiente`,
      displayTitle: 'Saldo Fiscal Pendiente',
      classification: {
        title: 'Saldo Fiscal Pendiente',
        caracter: 'FISCAL',
        caracterLabel: 'FISCAL (BLANCO)',
        subtitle: 'Saldo Oficial ARCA',
        cae: null,
        nroComprobante: null,
      },
      monto: saldoBlancoNum,
      saldoPendiente: saldoBlancoNum,
      tipo: 'BLANCO',
      fecha: client?.updated_at || new Date().toISOString(),
      type: 'cobro',
      raw: client,
    });
  }

  // Si no hay comprobantes internos en pendingDebts pero el cliente tiene saldo interno deudor:
  const saldoInternoNum = Math.abs(Number(client?.saldo_interno || 0));
  const hasInternoInPending = pendingDebts.some(
    (d) => d.classification?.caracter === 'INTERNO' || d.tipo === 'INTERNO'
  );
  if (!hasInternoInPending && saldoInternoNum > 0.01) {
    pendingDebts.push({
      id: `saldo-interno-${client?.id || 'general'}`,
      rawId: client?.id,
      label: `[INTERNO] Saldo Remitos / Gestión Pendiente`,
      displayTitle: 'Saldo Remitos / Gestión Pendiente',
      classification: {
        title: 'Saldo Remitos / Gestión Pendiente',
        caracter: 'INTERNO',
        caracterLabel: 'INTERNO',
        subtitle: 'Saldo de Remitos y Gestión',
        cae: null,
        nroComprobante: null,
      },
      monto: saldoInternoNum,
      saldoPendiente: saldoInternoNum,
      tipo: 'INTERNO',
      fecha: client?.updated_at || new Date().toISOString(),
      type: 'cobro',
      raw: client,
    });
  }

  return {
    transactions,
    pendingDebts: pendingDebts.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()),
    paidDebts: paidDebts.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()),
  };
}
