export interface LedgerResult {
  transactions: any[];
  pendingDebts: any[];
  paidDebts: any[];
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

  // 1. Unificar ventas y cobros para el historial cronológico
  const rawSales = (clientDetails.sales || []).map((s: any) => ({
    ...s,
    type: 'venta' as const,
  }));

  const rawPayments = (clientDetails.payments || []).map((p: any) => ({
    ...p,
    type: 'cobro' as const,
  }));

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

  // Paso 1: Matching directo por referencia (ej. "Cobro Factura N° 11112", "#00005", etc.)
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

    if (debtRemaining <= 0.01) {
      paidDebts.push({
        ...debt,
        isPaid: true,
        paymentInfo: lastPayingPayment,
      });
    } else {
      pendingDebts.push({
        ...debt,
        isPaid: false,
        saldoPendiente: debtRemaining,
        // Campos estandarizados para el modal de cobro y visualización
        id: isVenta ? `sale-${debt.id}` : `payment-${debt.id}`,
        rawId: debt.id,
        label: isVenta
          ? debt.nro_comprobante
            ? `${debt.tipo_comprobante || 'Factura'} ${debt.nro_comprobante}`
            : `Facturación #${String(debt.id).padStart(5, '0')}`
          : debt.referencia && debt.referencia.trim() !== ''
          ? debt.referencia
          : `Ajuste Deuda (${debt.tipo})`,
        monto: debtRemaining,
        tipo: isVenta
          ? Number(debt.monto_facturado_ars) > 0 && Number(debt.monto_no_facturado_ars) === 0
            ? 'BLANCO'
            : Number(debt.monto_no_facturado_ars) > 0 && Number(debt.monto_facturado_ars) === 0
            ? 'INTERNO'
            : 'MIXTO'
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
    });
  });

  return {
    transactions,
    pendingDebts: pendingDebts.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()),
    paidDebts: paidDebts.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()),
  };
}
