export interface DocumentClassification {
  title: string;
  caracter: 'FISCAL' | 'INTERNO' | 'MIXTO';
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

  // Ajustes de saldo manuales
  const isAjuste = ['SALDO_PREVIO', 'AJUSTE_SALDO'].includes(item.metodo_pago);
  const ref = item.referencia && item.referencia.trim() !== '' ? item.referencia : '';

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
  const title = ref || `Cobro Recibido (${item.metodo_pago || 'Pago'})`;

  return {
    title,
    caracter: isBlanco ? 'FISCAL' : isInterno ? 'INTERNO' : 'MIXTO',
    caracterLabel: isBlanco ? 'FISCAL (BLANCO)' : isInterno ? 'INTERNO' : 'MIXTO',
    subtitle: `Cobro en ${item.metodo_pago || 'Efectivo'}`,
    cae: null,
    nroComprobante: null,
  };
}

/**
 * Procesa y clasifica las transacciones de un cliente en:
 * - Pendientes de Pago (únicamente facturas y deudas que no fueron canceladas)
 * - Pagados (comprobantes liquidados o cobros efectivizados)
 * - Historial Completo (todas las transacciones cronológicas)
 */
export function processClientLedger(client: any, clientDetails: any): LedgerResult {
  if (!clientDetails) {
    return { transactions: [], pendingDebts: [], paidDebts: [] };
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

  const paidDebts: any[] = [];
  const pendingDebts: any[] = [];
  const usedPaymentIds = new Set<number>();
  const unallocatedPayments: any[] = [];
  const remainingDebts: any[] = [];

  // Paso 1: Matching directo por referencia (ej. "Cobro Factura A 00000024", "DIF-32", etc.)
  debtList.forEach((debt) => {
    const isVenta = debt.type === 'venta';
    let matchedPayment: any = null;

    for (const p of paymentList) {
      if (usedPaymentIds.has(p.id)) continue;
      const ref = (p.referencia || '').toLowerCase().trim();
      if (!ref) continue;

      if (isVenta) {
        const idStr = String(debt.id);
        const padId = idStr.padStart(5, '0');
        const nroComp = debt.nro_comprobante ? String(debt.nro_comprobante).toLowerCase().trim() : '';

        if (
          ref.includes(`#${padId}`) ||
          ref.includes(`#${idStr}`) ||
          (nroComp && ref.includes(nroComp))
        ) {
          matchedPayment = p;
          usedPaymentIds.add(p.id);
          break;
        }
      } else {
        const debtRef = (debt.referencia || '').toLowerCase().trim();
        const numMatch = debtRef.match(/\d+/);

        if (numMatch && numMatch[0].length >= 2 && ref.includes(numMatch[0])) {
          matchedPayment = p;
          usedPaymentIds.add(p.id);
          break;
        }

        const cleanRef = debtRef.replace(/ajuste|saldo/gi, '').trim();
        if (cleanRef.length >= 3 && ref.includes(cleanRef)) {
          matchedPayment = p;
          usedPaymentIds.add(p.id);
          break;
        }
      }
    }

    if (matchedPayment) {
      paidDebts.push({
        ...debt,
        isPaid: true,
        paymentInfo: matchedPayment,
        classification: debt.classification || getDocumentClassification(debt),
      });
    } else {
      remainingDebts.push(debt);
    }
  });

  // Paso 2: Recolectar pagos que no fueron asignados por referencia específica
  paymentList.forEach((p) => {
    if (!usedPaymentIds.has(p.id)) {
      unallocatedPayments.push({
        ...p,
        remainingMonto: Number(p.monto_ars),
      });
    }
  });

  // Paso 3: Aplicación FIFO (los pagos cubren las deudas restantes más antiguas)
  const debtsByAge = [...remainingDebts].sort(
    (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
  );

  const isClientDebtFree = Number(client?.saldo_deuda || 0) >= 0;

  debtsByAge.forEach((debt) => {
    const isVenta = debt.type === 'venta';
    const debtMonto = isVenta ? Number(debt.total_real_ars) : Math.abs(Number(debt.monto_ars));
    let debtRemaining = debtMonto;
    let lastPayingPayment: any = null;

    if (isClientDebtFree) {
      // Si el cliente no debe nada en su cuenta, todas las deudas históricas están saldadas
      debtRemaining = 0;
      lastPayingPayment = paymentList[0] || null;
    } else {
      for (const unalloc of unallocatedPayments) {
        if (unalloc.remainingMonto <= 0) continue;
        const deduction = Math.min(debtRemaining, unalloc.remainingMonto);
        debtRemaining -= deduction;
        unalloc.remainingMonto -= deduction;
        lastPayingPayment = unalloc;
        if (debtRemaining <= 0.01) break;
      }
    }

    const info = debt.classification || getDocumentClassification(debt);

    if (debtRemaining <= 0.01) {
      paidDebts.push({
        ...debt,
        isPaid: true,
        paymentInfo: lastPayingPayment,
        classification: info,
      });
    } else {
      pendingDebts.push({
        ...debt,
        isPaid: false,
        saldoPendiente: debtRemaining,
        // Campos estandarizados para el modal de cobro y visualización
        id: isVenta ? `sale-${debt.id}` : `payment-${debt.id}`,
        rawId: debt.id,
        label: `[${info.caracterLabel}] ${info.title}`,
        displayTitle: info.title,
        classification: info,
        monto: debtRemaining,
        tipo: isVenta
          ? info.caracter === 'FISCAL' ? 'BLANCO' : info.caracter === 'INTERNO' ? 'INTERNO' : 'MIXTO'
          : debt.tipo || 'MIXTO',
        raw: debt,
      });
    }
  });

  // Paso 4: Añadir pagos sueltos a "Pagados" para que el usuario pueda verlos
  unallocatedPayments.forEach((p) => {
    paidDebts.push({
      ...p,
      isStandalonePayment: true,
      isPaid: true,
      classification: p.classification || getDocumentClassification(p),
    });
  });

  return {
    transactions,
    pendingDebts: pendingDebts.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()),
    paidDebts: paidDebts.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()),
  };
}
