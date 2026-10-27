import React from 'react';
import type { Client } from '../../services/clientService';
import { 
  X, Pencil, Download, DollarSign, PackageOpen, 
  FileSpreadsheet, Mail, Phone, MapPin, Building2, Hash 
} from 'lucide-react';

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
  if (!isOpen || !client) return null;

  const saldoBlancoNum = Number(client.saldo_blanco || 0);
  const saldoInternoNum = Number(client.saldo_interno || 0);
  const saldoDeudaTotal = Math.abs(Number(client.saldo_deuda || 0));

  // Combinar ventas y cobros para historial
  const transactions = [
    ...(clientDetails?.sales || []).map((s: any) => ({ ...s, type: 'venta' })),
    ...(clientDetails?.payments || []).map((p: any) => ({ ...p, type: 'cobro' })),
  ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

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

        {/* Actividad Reciente */}
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b border-slate-200 pb-3">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">
              Actividad Reciente en Cuenta Corriente
            </h3>
            <span className="text-xs font-bold text-slate-400">
              {transactions.length} movimientos registrados
            </span>
          </div>

          {isLoadingDetails ? (
            <div className="text-center py-12 text-slate-400 font-bold uppercase text-xs tracking-widest">
              Cargando historial...
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.length === 0 && (
                <div className="bg-white border border-slate-200 p-8 text-center text-slate-400 font-bold uppercase text-xs tracking-widest">
                  Sin movimientos registrados
                </div>
              )}

              {transactions.map((item: any, idx: number) => {
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
                    key={idx}
                    className="bg-white border border-slate-200 overflow-hidden hover:border-blue-600 transition-all shadow-sm"
                  >
                    <div className="p-5 flex flex-col sm:flex-row justify-between items-center gap-4">
                      {/* Lado izquierdo: Concepto y Fecha */}
                      <div className="text-center sm:text-left">
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
                          {new Date(item.fecha).toLocaleDateString()} •{' '}
                          {item.tipo_comprobante ||
                            (['SALDO_PREVIO', 'AJUSTE_SALDO'].includes(item.metodo_pago)
                              ? item.tipo ? `Ajuste (${item.tipo})` : 'Ajuste Manual'
                              : item.metodo_pago)}
                        </p>
                      </div>

                      {/* Lado derecho: Monto y Acciones */}
                      <div className="flex items-center gap-5">
                        <div className="text-right">
                          <p className={`text-xl font-black ${isDebt ? 'text-slate-900' : 'text-blue-600'}`}>
                            <span className="font-black tracking-tight text-lg">
                              {isVenta
                                ? `-$${Number(item.total_real_ars || item.monto_ars).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : ['SALDO_PREVIO', 'AJUSTE_SALDO'].includes(item.metodo_pago)
                                ? `${Number(item.monto_ars) < 0 ? '-' : '+'}$${Math.abs(Number(item.monto_ars)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : `+$${Number(item.monto_ars || item.total_real_ars).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            </span>
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ARS</p>
                        </div>

                        {/* Botón rápido Cobrar */}
                        {isDebt && (
                          <button
                            type="button"
                            onClick={() => onQuickPay(item)}
                            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm shrink-0 cursor-pointer"
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
                            className="p-2.5 border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-600 transition-all cursor-pointer"
                            title="Descargar Comprobante PDF"
                          >
                            <Download size={15} />
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
                            className="p-2.5 border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-600 transition-all text-xs font-black cursor-pointer"
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
                      <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/70">
                        <div className="flex items-center gap-2 mb-2">
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
                              <span className="text-xs font-black text-slate-900 shrink-0">
                                {si.cantidad} KG
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
