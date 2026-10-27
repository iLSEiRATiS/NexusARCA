import React, { useState, useMemo } from 'react';
import type { Client } from '../../services/clientService';
import { 
  X, Pencil, Download, DollarSign, PackageOpen, 
  FileSpreadsheet, Mail, Phone, MapPin, Building2, Hash,
  Clock, CheckCircle2, History, AlertCircle
} from 'lucide-react';

import { processClientLedger } from '../../utils/accountLedger';

interface ClientDetailModalProps {
  isOpen: boolean;
  client: Client | null;
  clientDetails: any;
  isLoadingDetails: boolean;
  onClose: () => void;
  onEdit: (client: Client) => void;
  onOpenPayment: (client: Client) => void;
  onOpenBalance: (client: Client) => void;
  onQuickPay: (item: any) => void;
  onDeletePayment: (paymentId: number) => void;
  onDownloadSale: (sale: any) => void;
  onExportStatement: () => void;
  isDeletePending: boolean;
}

export const ClientDetailModal: React.FC<ClientDetailModalProps> = ({
  isOpen,
  client,
  clientDetails,
  isLoadingDetails,
  onClose,
  onEdit,
  onOpenPayment,
  onOpenBalance,
  onQuickPay,
  onDeletePayment,
  onDownloadSale,
  onExportStatement,
  isDeletePending,
}) => {
  const [activeTab, setActiveTab] = useState<'pendientes' | 'pagados' | 'historial'>('pendientes');

  // Procesar estado contable real: transacciones, pendientes y pagados (debe invocarse incondicionalmente por Reglas de Hooks)
  const { transactions, pendingDebts, paidDebts } = useMemo(() => {
    if (!isOpen || !client) {
      return { transactions: [], pendingDebts: [], paidDebts: [] };
    }
    return processClientLedger(client, clientDetails);
  }, [isOpen, client, clientDetails]);

  if (!isOpen || !client) return null;

  const saldoBlancoNum = Number(client.saldo_blanco || 0);
  const saldoInternoNum = Number(client.saldo_interno || 0);
  const saldoDeudaTotal = Math.abs(Number(client.saldo_deuda || 0));

  return (
    <div className="bg-white border border-slate-200 shadow-sm animate-fade-in">
      {/* Header */}
      <div className="bg-slate-900 px-6 sm:px-8 py-6 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-xs font-bold text-blue-400 uppercase tracking-widest block mb-1">
            Ficha de Cuenta Corriente
          </span>
          <h2 className="text-2xl font-black uppercase tracking-tight">{client.razon_social}</h2>
          <p className="text-xs font-bold text-slate-400 mt-0.5">CUIT/DNI: {client.cuit}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onExportStatement}
            className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border border-slate-700 transition-colors cursor-pointer"
            title="Descargar Estado de Cuenta PDF"
          >
            <FileSpreadsheet size={14} className="text-emerald-400" />
            Estado de Cuenta (PDF)
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-300 hover:text-white transition-colors text-xs font-bold uppercase tracking-wider border border-slate-700 px-4 py-2 hover:border-slate-500 flex items-center gap-1.5 cursor-pointer"
          >
            <X size={14} />
            Cerrar
          </button>
        </div>
      </div>

      <div className="p-6 sm:p-8 space-y-8 bg-slate-50/50">
        {/* Información fiscal y de contacto */}
        <div className="bg-white border border-slate-200 shadow-sm p-5 sm:p-6">
          <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">
              Información del Cliente
            </h3>
            <button
              onClick={() => onEdit(client)}
              className="text-blue-600 hover:text-blue-800 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Pencil size={12} />
              Modificar Datos
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                <Mail size={12} /> Email
              </p>
              <p className="text-xs font-black text-slate-900 truncate" title={client.email || 'S/D'}>
                {client.email || '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                <Phone size={12} /> Teléfono
              </p>
              <p className="text-xs font-black text-slate-900 uppercase">{client.telefono || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                <Building2 size={12} /> Condición IVA
              </p>
              <p className="text-xs font-black text-slate-900 uppercase">
                {client.condicion_iva ? client.condicion_iva.replace(/_/g, ' ') : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                <Hash size={12} /> Nro. IIBB
              </p>
              <p className="text-xs font-black text-slate-900 uppercase">{client.nro_iibb || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                <MapPin size={12} /> Dirección
              </p>
              <p className="text-xs font-black text-slate-900 uppercase truncate" title={client.direccion || 'S/D'}>
                {client.direccion || '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Tarjetas de Saldo y Acciones */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="p-6 bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">
                Saldo Blanco (Fiscal)
              </span>
              <p className="text-2xl font-black text-slate-900">
                ${saldoBlancoNum.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <p className="text-[11px] text-slate-400 mt-3">
              {saldoBlancoNum < 0 ? 'Deuda fiscal acumulada' : 'Al día / a favor'}
            </p>
          </div>

          <div className="p-6 bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">
                Saldo Interno (Gestión)
              </span>
              <p className="text-2xl font-black text-slate-900">
                ${saldoInternoNum.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <p className="text-[11px] text-slate-400 mt-3">
              {saldoInternoNum < 0 ? 'Remitos / Presupuestos pendientes' : 'Al día / a favor'}
            </p>
          </div>

          <div className="p-6 bg-blue-600 text-white flex flex-col justify-between shadow-lg shadow-blue-100">
            <div className="mb-4">
              <span className="text-xs font-bold text-blue-200 uppercase tracking-widest block mb-1">
                Total Adeudado
              </span>
              <p className="text-3xl font-black">
                ${saldoDeudaTotal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="flex flex-col gap-2 mt-auto">
              <button
                type="button"
                onClick={() => onOpenPayment(client)}
                className="w-full bg-white text-blue-600 py-3 font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm cursor-pointer"
              >
                Registrar Cobro
              </button>
              <button
                type="button"
                onClick={() => onOpenBalance(client)}
                className="w-full border border-blue-400 text-white py-2.5 font-black text-xs uppercase tracking-widest hover:bg-blue-500 transition-all cursor-pointer"
              >
                Cargar Deuda
              </button>
            </div>
          </div>
        </div>

        {/* ── ACTIVIDAD EN CUENTA CORRIENTE CON SOLAPAS / TABS ── */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-3">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">
              Actividad en Cuenta Corriente
            </h3>

            {/* Solapas de clasificación */}
            <div className="flex items-center gap-2 bg-slate-200/60 p-1 rounded-sm">
              <button
                type="button"
                onClick={() => setActiveTab('pendientes')}
                className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-sm transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'pendientes'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Clock size={13} className={pendingDebts.length > 0 ? 'text-amber-500' : 'text-slate-400'} />
                <span>Pendientes de Pago</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  pendingDebts.length > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'
                }`}>
                  {pendingDebts.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('pagados')}
                className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-sm transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'pagados'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <CheckCircle2 size={13} className="text-emerald-500" />
                <span>Pagados</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-emerald-100 text-emerald-800">
                  {paidDebts.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('historial')}
                className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-sm transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'historial'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <History size={13} className="text-blue-500" />
                <span>Historial Completo</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-100 text-slate-600">
                  {transactions.length}
                </span>
              </button>
            </div>
          </div>

          {isLoadingDetails ? (
            <div className="text-center py-12 text-slate-400 font-bold uppercase text-xs tracking-widest">
              Cargando movimientos...
            </div>
          ) : (
            <div className="space-y-3">
              {/* ──────────────── TAB 1: PENDIENTES DE PAGO ──────────────── */}
              {activeTab === 'pendientes' && (
                <>
                  {pendingDebts.length === 0 ? (
                    <div className="bg-white border border-slate-200 p-10 text-center rounded-sm">
                      <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                        <CheckCircle2 size={24} />
                      </div>
                      <p className="text-xs font-black uppercase text-slate-800 tracking-wider">
                        ¡Al día! No hay comprobantes pendientes de pago
                      </p>
                      <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                        Todas las facturas y deudas han sido canceladas o el cliente no registra deuda actual.
                      </p>
                    </div>
                  ) : (
                    pendingDebts.map((item: any, idx: number) => {
                      const isVenta = item.type === 'venta';
                      const title = isVenta
                        ? `Facturación #${String(item.id).padStart(5, '0')}`
                        : (item.referencia && item.referencia.trim() !== ''
                            ? item.referencia
                            : (item.metodo_pago === 'SALDO_PREVIO' ? 'Saldo Inicial' : 'Ajuste de Deuda'));
                      const montoNum = item.saldoPendiente !== undefined
                        ? Number(item.saldoPendiente)
                        : (isVenta ? Number(item.total_real_ars) : Math.abs(Number(item.monto_ars)));

                      return (
                        <div
                          key={`pending-${idx}`}
                          className="bg-white border border-amber-200/80 overflow-hidden hover:border-amber-500 transition-all shadow-xs"
                        >
                          <div className="p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-center gap-4">
                            {/* Lado izquierdo: Concepto y Estado Pendiente */}
                            <div className="text-center sm:text-left flex-1 min-w-0">
                              <div className="flex items-center gap-2 justify-center sm:justify-start">
                                <p className="font-black text-slate-900 text-sm uppercase tracking-tight">
                                  {title}
                                </p>
                                <span className="bg-amber-50 border border-amber-300 text-amber-800 text-[9px] font-black px-2 py-0.5 uppercase tracking-wider flex items-center gap-1 rounded">
                                  <Clock size={10} /> Pendiente de Cobro
                                </span>
                              </div>
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">
                                {new Date(item.fecha).toLocaleDateString('es-AR')} •{' '}
                                {item.tipo_comprobante || (item.tipo ? `Ajuste (${item.tipo})` : 'Deuda')}
                              </p>
                            </div>

                            {/* Lado derecho: Monto Adeudado y Botón Cobrar */}
                            <div className="flex items-center gap-4 shrink-0">
                              <div className="text-right">
                                <p className="text-xl font-black text-red-600 font-mono tracking-tight">
                                  -${montoNum.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">ARS PENDIENTE</p>
                              </div>

                              {/* Botón rápido Cobrar */}
                              <button
                                type="button"
                                onClick={() => onQuickPay(item)}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm shrink-0 cursor-pointer rounded-sm"
                                title="Cobrar este comprobante"
                              >
                                <DollarSign size={14} />
                                Cobrar
                              </button>

                              {/* Descargar Comprobante si es venta */}
                              {isVenta && (
                                <button
                                  type="button"
                                  onClick={() => onDownloadSale({ ...item, client })}
                                  className="p-2 border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-600 rounded transition-all cursor-pointer"
                                  title="Descargar Comprobante PDF"
                                >
                                  <Download size={14} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Detalle de Artículos si es venta */}
                          {isVenta && item.items && item.items.length > 0 && (
                            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/70">
                              <div className="flex items-center gap-2 mb-1.5">
                                <PackageOpen size={13} className="text-slate-400" />
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                  Artículos facturados
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
                                {item.items.map((si: any, sIdx: number) => (
                                  <div key={sIdx} className="flex justify-between items-center py-0.5">
                                    <span className="text-xs font-bold text-slate-600 uppercase truncate pr-4">
                                      {si.descripcion || si.product?.nombre}
                                    </span>
                                    <span className="text-xs font-black text-slate-900 shrink-0 font-mono">
                                      {si.cantidad} KG
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </>
              )}

              {/* ──────────────── TAB 2: PAGADOS ──────────────── */}
              {activeTab === 'pagados' && (
                <>
                  {paidDebts.length === 0 ? (
                    <div className="bg-white border border-slate-200 p-10 text-center rounded-sm">
                      <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                        <AlertCircle size={24} />
                      </div>
                      <p className="text-xs font-black uppercase text-slate-800 tracking-wider">
                        Sin comprobantes registrados como pagados
                      </p>
                      <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                        Al registrar cobros o cancelaciones se moverán aquí automáticamente.
                      </p>
                    </div>
                  ) : (
                    paidDebts.map((item: any, idx: number) => {
                      const isVenta = item.type === 'venta';
                      const isStandalone = item.isStandalonePayment;
                      const title = isVenta
                        ? `Facturación #${String(item.id).padStart(5, '0')}`
                        : (item.referencia && item.referencia.trim() !== ''
                            ? item.referencia
                            : (isStandalone ? 'Cobro Registrado' : 'Ajuste Liquidado'));
                      const montoNum = isVenta 
                        ? Number(item.total_real_ars) 
                        : Math.abs(Number(item.monto_ars));

                      return (
                        <div
                          key={`paid-${idx}`}
                          className="bg-white border border-emerald-200/80 overflow-hidden hover:border-emerald-500 transition-all shadow-xs"
                        >
                          <div className="p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-center gap-4">
                            {/* Lado izquierdo: Concepto y Estado Pagado */}
                            <div className="text-center sm:text-left flex-1 min-w-0">
                              <div className="flex items-center gap-2 justify-center sm:justify-start">
                                <p className="font-black text-slate-900 text-sm uppercase tracking-tight">
                                  {title}
                                </p>
                                <span className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-[9px] font-black px-2 py-0.5 uppercase tracking-wider flex items-center gap-1 rounded">
                                  <CheckCircle2 size={10} /> Pagado / Cancelado
                                </span>
                              </div>
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">
                                {item.paymentInfo ? (
                                  <>
                                    Cobrado el {new Date(item.paymentInfo.fecha).toLocaleDateString('es-AR')} •{' '}
                                    Método: {item.paymentInfo.metodo_pago}
                                    {item.paymentInfo.referencia ? ` (${item.paymentInfo.referencia})` : ''}
                                  </>
                                ) : (
                                  <>
                                    Fecha: {new Date(item.fecha).toLocaleDateString('es-AR')} •{' '}
                                    {item.metodo_pago ? `Cobro ${item.metodo_pago}` : (item.tipo_comprobante || 'Liquidado')}
                                    {item.tipo ? ` (${item.tipo})` : ''}
                                  </>
                                )}
                              </p>
                            </div>

                            {/* Lado derecho: Monto Pagado */}
                            <div className="flex items-center gap-4 shrink-0">
                              <div className="text-right">
                                <p className="text-xl font-black text-emerald-600 font-mono tracking-tight">
                                  +${montoNum.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">ARS COBRADO</p>
                              </div>

                              {/* Descargar Comprobante si es venta */}
                              {isVenta && (
                                <button
                                  type="button"
                                  onClick={() => onDownloadSale({ ...item, client })}
                                  className="p-2 border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-600 rounded transition-all cursor-pointer"
                                  title="Descargar Comprobante PDF"
                                >
                                  <Download size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </>
              )}

              {/* ──────────────── TAB 3: HISTORIAL COMPLETO ──────────────── */}
              {activeTab === 'historial' && (
                <>
                  {transactions.length === 0 ? (
                    <div className="bg-white border border-slate-200 p-8 text-center text-slate-400 font-bold uppercase text-xs tracking-widest">
                      Sin movimientos registrados
                    </div>
                  ) : (
                    transactions.map((item: any, idx: number) => {
                      const isVenta = item.type === 'venta';
                      const isDebt = isVenta || (['SALDO_PREVIO', 'AJUSTE_SALDO'].includes(item.metodo_pago) && Number(item.monto_ars) < 0);
                      const title = isVenta
                        ? `Facturación #${String(item.id).padStart(5, '0')}`
                        : (item.referencia && item.referencia.trim() !== ''
                            ? item.referencia
                            : (['SALDO_PREVIO', 'AJUSTE_SALDO'].includes(item.metodo_pago)
                                ? (item.metodo_pago === 'SALDO_PREVIO' ? 'Saldo Inicial' : 'Ajuste de Saldo')
                                : 'Cobro Recibido'));

                      return (
                        <div
                          key={`history-${idx}`}
                          className="bg-white border border-slate-200 overflow-hidden hover:border-blue-600 transition-all shadow-xs"
                        >
                          <div className="p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-center gap-4">
                            {/* Lado izquierdo: Concepto y Fecha */}
                            <div className="text-center sm:text-left flex-1 min-w-0">
                              <div className="flex items-center gap-2 justify-center sm:justify-start">
                                <p className="font-black text-slate-900 text-sm uppercase tracking-tight">
                                  {title}
                                </p>
                                {item.external_id && (
                                  <span className="bg-slate-50 border border-slate-200 text-slate-400 text-[9px] font-black px-1.5 py-0.5 uppercase tracking-tighter">
                                    Sincronizado
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">
                                {new Date(item.fecha).toLocaleDateString('es-AR')} •{' '}
                                {item.tipo_comprobante ||
                                  (['SALDO_PREVIO', 'AJUSTE_SALDO'].includes(item.metodo_pago)
                                    ? item.tipo ? `Ajuste (${item.tipo})` : 'Ajuste Manual'
                                    : item.metodo_pago)}
                              </p>
                            </div>

                            {/* Lado derecho: Monto y Acciones */}
                            <div className="flex items-center gap-4 shrink-0">
                              <div className="text-right">
                                <p className={`text-xl font-black font-mono ${isDebt ? 'text-slate-900' : 'text-blue-600'}`}>
                                  {isVenta
                                    ? `-$${Number(item.total_real_ars || item.monto_ars).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                    : ['SALDO_PREVIO', 'AJUSTE_SALDO'].includes(item.metodo_pago)
                                    ? `${Number(item.monto_ars) < 0 ? '-' : '+'}$${Math.abs(Number(item.monto_ars)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                    : `+$${Number(item.monto_ars || item.total_real_ars).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                </p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ARS</p>
                              </div>

                              {/* Botón rápido Cobrar para deudas en el historial */}
                              {isDebt && (
                                <button
                                  type="button"
                                  onClick={() => onQuickPay(item)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm shrink-0 cursor-pointer rounded-sm"
                                  title="Cobrar este comprobante"
                                >
                                  <DollarSign size={13} />
                                  Cobrar
                                </button>
                              )}

                              {/* Descargar Comprobante si es venta */}
                              {isVenta && (
                                <button
                                  type="button"
                                  onClick={() => onDownloadSale({ ...item, client })}
                                  className="p-2 border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-600 rounded transition-all cursor-pointer"
                                  title="Descargar Comprobante PDF"
                                >
                                  <Download size={14} />
                                </button>
                              )}

                              {/* Deshacer Movimiento si es cobro */}
                              {!isVenta && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (window.confirm('¿Estás seguro de deshacer este movimiento de pago/ajuste?')) {
                                      onDeletePayment(item.id);
                                    }
                                  }}
                                  className="p-2 border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-600 rounded transition-all text-xs font-black cursor-pointer"
                                  title="Deshacer Movimiento"
                                  disabled={isDeletePending}
                                >
                                  &times;
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Detalle de Artículos si es venta */}
                          {isVenta && item.items && item.items.length > 0 && (
                            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/70">
                              <div className="flex items-center gap-2 mb-1.5">
                                <PackageOpen size={13} className="text-slate-400" />
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                  Artículos facturados
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
                                {item.items.map((si: any, sIdx: number) => (
                                  <div key={sIdx} className="flex justify-between items-center py-0.5">
                                    <span className="text-xs font-bold text-slate-600 uppercase truncate pr-4">
                                      {si.descripcion || si.product?.nombre}
                                    </span>
                                    <span className="text-xs font-black text-slate-900 shrink-0 font-mono">
                                      {si.cantidad} KG
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
