import React from 'react';
import type { Client } from '../../services/clientService';
import { DollarSign, X, CheckCircle2, Calendar, FileText } from 'lucide-react';
import { usePrivacy } from '../../context/PrivacyContext';

interface PaymentDataState {
  monto: number | string;
  metodo: string;
  referencia: string;
  imputacion: string;
  fecha: string;
}

interface ClientPaymentModalProps {
  isOpen: boolean;
  client: Client | null;
  pendingDebts: any[];
  paymentData: PaymentDataState;
  setPaymentData: React.Dispatch<React.SetStateAction<PaymentDataState>>;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onSelectDebt: (debt: any) => void;
  isPending: boolean;
}

export const ClientPaymentModal: React.FC<ClientPaymentModalProps> = ({
  isOpen,
  client,
  pendingDebts,
  paymentData,
  setPaymentData,
  onClose,
  onSubmit,
  onSelectDebt,
  isPending,
}) => {
  const { isManagementUnlocked } = usePrivacy();

  if (!isOpen || !client) return null;

  const deudaTotal = Math.abs(Number(client.saldo_deuda || 0));
  const deudaInterno = Math.abs(Number(client.saldo_interno || 0));
  const saldoFiscalPendiente = Math.abs(Number(client.saldo_blanco || 0));

  // En Modo Fiscal Oficial, sólo se muestran deudas fiscales
  const visibleDebts = isManagementUnlocked
    ? pendingDebts
    : pendingDebts.filter((d) => d.classification?.caracter === 'FISCAL' || d.tipo === 'BLANCO');

  return (
    <div className="bg-white border border-slate-200 shadow-sm animate-fade-in">
      {/* Header */}
      <div className="bg-slate-900 px-6 py-5 text-white flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <DollarSign size={18} className="text-emerald-400" />
            <h2 className="text-lg font-black uppercase tracking-wider">Registrar Cobro</h2>
          </div>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-0.5">
            {client.razon_social} <span className="text-slate-500">({client.cuit})</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-300 hover:text-white transition-colors text-xs font-bold uppercase tracking-wider border border-slate-700 px-4 py-2 hover:border-slate-500 flex items-center gap-1.5 cursor-pointer"
        >
          <X size={14} />
          Cerrar y Volver
        </button>
      </div>

      <form onSubmit={onSubmit} className="p-6 sm:p-8 space-y-6 bg-slate-50">
        {/* Resumen de deuda */}
        <div className="p-4 bg-white border border-slate-200 flex justify-between items-center shadow-sm">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
              {isManagementUnlocked ? 'Deuda Total Consolidada' : 'Saldo Fiscal Pendiente'}
            </span>
            <span className="text-xl font-black text-slate-900">
              ${(isManagementUnlocked ? deudaTotal : saldoFiscalPendiente).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="text-right">
            {isManagementUnlocked ? (
              <>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Remitos / Gestión</span>
                <span className="text-xl font-black text-slate-900">
                  ${deudaInterno.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-black text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 uppercase">
                Modo Fiscal Oficial
              </span>
            )}
          </div>
        </div>

        {/* Selector de comprobante específico (Opcional) */}
        {visibleDebts.length > 0 && (
          <div className="p-4 bg-white border border-slate-200 space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 size={13} />
                {isManagementUnlocked ? 'Imputar a Factura / Remito Específico' : 'Imputar a Factura Fiscal Específica'}
              </label>
              <span className="text-[11px] text-slate-400 font-bold uppercase">Opcional</span>
            </div>
            <select
              onChange={(e) => {
                if (!e.target.value) {
                  setPaymentData((prev) => ({
                    ...prev,
                    monto: 0,
                    referencia: '',
                    imputacion: isManagementUnlocked ? 'MIXTO' : 'BLANCO',
                  }));
                  return;
                }
                const found = visibleDebts.find((d) => d.id === e.target.value);
                if (found) {
                  onSelectDebt(found);
                }
              }}
              defaultValue=""
              className="w-full bg-slate-50 border border-slate-200 px-3 py-3 font-bold text-slate-900 focus:border-blue-600 outline-none uppercase text-xs cursor-pointer"
            >
              <option value="">— Cobro Libre / Pago Global a Cuenta —</option>
              {visibleDebts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label} — ${d.monto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} • {new Date(d.fecha).toLocaleDateString('es-AR')}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Monto a cobrar */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Monto a Cobrar (ARS)
          </label>
          <input
            type="text"
            required
            value={paymentData.monto === 0 ? '' : paymentData.monto}
            onChange={(e) => setPaymentData({ ...paymentData, monto: e.target.value })}
            className="w-full bg-transparent border-b-2 border-slate-900 rounded-none px-2 py-3 font-black text-3xl sm:text-4xl text-slate-900 focus:border-blue-600 outline-none transition-all placeholder:text-slate-300"
            placeholder="0.00"
          />
        </div>

        {/* Método e Imputación */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Método de Pago
            </label>
            <select
              value={paymentData.metodo}
              onChange={(e) => setPaymentData({ ...paymentData, metodo: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded-none px-3 py-3 font-bold text-slate-900 focus:border-blue-600 outline-none uppercase text-xs cursor-pointer"
            >
              <option value="EFECTIVO">Efectivo</option>
              <option value="TRANSFERENCIA">Transferencia</option>
              <option value="CHEQUE">Cheque</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Imputación Contable
            </label>
            {isManagementUnlocked ? (
              <select
                value={paymentData.imputacion}
                onChange={(e) => setPaymentData({ ...paymentData, imputacion: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-none px-3 py-3 font-bold text-slate-900 focus:border-blue-600 outline-none uppercase text-xs cursor-pointer"
              >
                <option value="MIXTO">Mixto (Automático)</option>
                <option value="BLANCO" disabled={Number(client.saldo_blanco) >= 0 && paymentData.imputacion !== 'BLANCO'}>
                  Solo Fiscal (Oficial)
                </option>
                <option value="INTERNO" disabled={Number(client.saldo_interno) >= 0 && paymentData.imputacion !== 'INTERNO'}>
                  Solo Remitos / Gestión Comercial
                </option>
              </select>
            ) : (
              <select
                value="BLANCO"
                disabled
                className="w-full bg-slate-100 border border-slate-200 rounded-none px-3 py-3 font-bold text-slate-700 outline-none uppercase text-xs cursor-not-allowed"
              >
                <option value="BLANCO">Oficial / Fiscal (Cuenta Corriente)</option>
              </select>
            )}
          </div>
        </div>

        {/* N° Comprobante y Fecha */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <FileText size={13} className="text-slate-400" />
              N° Comprobante / Recibo / Ref
            </label>
            <input
              type="text"
              value={paymentData.referencia}
              onChange={(e) => setPaymentData({ ...paymentData, referencia: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded-none px-3 py-2.5 font-bold text-slate-900 focus:border-blue-600 outline-none text-xs"
              placeholder="Ej: Transf. 98124 / Recibo 001"
            />
            <p className="text-[11px] text-slate-400 mt-1">Identificador de la transferencia, cheque o recibo</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Calendar size={13} className="text-slate-400" />
              Fecha del Cobro
            </label>
            <input
              type="date"
              value={paymentData.fecha}
              onChange={(e) => setPaymentData({ ...paymentData, fecha: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded-none px-3 py-2.5 font-bold text-slate-900 focus:border-blue-600 outline-none text-xs"
            />
            <p className="text-[11px] text-slate-400 mt-1">Fecha en que fue acreditado el pago</p>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-emerald-600 text-white py-4 font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isPending ? 'Procesando cobro...' : 'Confirmar Cobro'}
        </button>
      </form>
    </div>
  );
};
