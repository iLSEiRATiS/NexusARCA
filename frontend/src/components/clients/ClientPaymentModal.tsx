import React, { useState, useEffect } from 'react';
import type { Client } from '../../services/clientService';
import { DollarSign, X, Calendar, FileText, CreditCard, Briefcase } from 'lucide-react';
import { usePrivacy } from '../../context/PrivacyContext';

export interface PaymentDataState {
  monto: number | string;
  metodo: string;
  referencia: string;
  imputacion: string;
  fecha: string;
  nro_cheque?: string;
  fecha_vto_cheque?: string;
  caja?: string;
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

  // En Modo Fiscal Oficial, sólo se muestran deudas fiscales
  const visibleDebts = isManagementUnlocked
    ? pendingDebts
    : pendingDebts.filter((d) => d.classification?.caracter === 'FISCAL' || d.tipo === 'BLANCO');

  const [selectedDebtId, setSelectedDebtId] = useState<string>('');

  // Sincronizar selección cuando cambia el cliente o la referencia
  useEffect(() => {
    if (visibleDebts.length === 0) {
      setSelectedDebtId('');
      return;
    }

    if (paymentData.referencia) {
      const matched = visibleDebts.find((d) => {
        const title = d.displayTitle || d.classification?.title || '';
        return title && paymentData.referencia.includes(title);
      });
      if (matched) {
        setSelectedDebtId(matched.id);
        return;
      }
    }
  }, [isOpen, client?.id, visibleDebts.length, paymentData.referencia]);

  if (!isOpen || !client) return null;

  const deudaTotal = Math.abs(Number(client.saldo_deuda || 0));
  const deudaInterno = Math.abs(Number(client.saldo_interno || 0));
  const saldoFiscalPendiente = Math.abs(Number(client.saldo_blanco || 0));

  const isCheque = paymentData.metodo === 'CHEQUE' || paymentData.metodo === 'CHEQUE_ELECTRONICO';

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

        {/* ── 1. N° COMPROBANTE / RECIBO / REF & FECHA DEL COBRO ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={13} className="text-blue-600" />
                N° Comprobante / Recibo / Ref
              </label>
              {visibleDebts.length > 0 && (
                <span className="text-[10px] font-black text-blue-700 bg-blue-100 border border-blue-200 px-2 py-0.5 uppercase tracking-wide">
                  {visibleDebts.length} {visibleDebts.length === 1 ? 'Deuda disponible' : 'Deudas disponibles'}
                </span>
              )}
            </div>

            {/* Selector de comprobante / deuda pendiente */}
            {visibleDebts.length > 0 && (
              <div className="mb-2">
                <select
                  value={selectedDebtId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedDebtId(val);
                    if (!val) {
                      setPaymentData((prev) => ({
                        ...prev,
                        monto: '',
                        referencia: '',
                        imputacion: 'BLANCO',
                      }));
                      return;
                    }
                    const found = visibleDebts.find((d) => d.id === val);
                    if (found) {
                      onSelectDebt(found);
                    }
                  }}
                  className="w-full bg-blue-50/70 border-2 border-blue-500 rounded-none px-3 py-2.5 font-bold text-slate-900 focus:border-blue-700 outline-none uppercase text-xs cursor-pointer shadow-xs"
                >
                  <option value="">— Seleccionar Factura o Deuda a Pagar —</option>
                  {visibleDebts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label} — ${d.monto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Input de texto manual / editable para la referencia */}
            <div>
              <input
                type="text"
                value={paymentData.referencia}
                onChange={(e) => setPaymentData({ ...paymentData, referencia: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-none px-3 py-2.5 font-bold text-slate-900 focus:border-blue-600 outline-none text-xs"
                placeholder={
                  visibleDebts.length > 0
                    ? 'O escriba manualmente: Ej. Transf. 98124 / Recibo 001'
                    : 'Ej: Transf. 98124 / Recibo 001 / Factura A 0001-00001234'
                }
              />
              <p className="text-[11px] text-slate-500 mt-1">
                {visibleDebts.length > 0
                  ? 'Elija una factura del selector superior para autocompletar monto y referencia, o ingrese el dato manual aquí.'
                  : 'Identificador de la transferencia, recibo manual o referencia de pago.'}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Calendar size={13} className="text-slate-400" />
              Fecha del Cobro
            </label>
            <input
              type="date"
              value={paymentData.fecha}
              onChange={(e) => setPaymentData({ ...paymentData, fecha: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-none px-3 py-2.5 font-bold text-slate-900 focus:border-blue-600 outline-none text-xs"
            />
            <p className="text-[11px] text-slate-400 mt-1">Fecha en que fue acreditado el pago</p>
          </div>
        </div>

        {/* ── 2. MÉTODO DE PAGO E IMPUTACIÓN CONTABLE ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Método de Pago
            </label>
            <select
              value={paymentData.metodo}
              onChange={(e) => {
                const newMetodo = e.target.value;
                setPaymentData((prev) => {
                  let newCaja = prev.caja;
                  let newVto = prev.fecha_vto_cheque;
                  if (newMetodo === 'CHEQUE' && !newCaja) {
                    newCaja = 'Cartera de Cheques';
                  } else if (newMetodo === 'CHEQUE_ELECTRONICO' && (!newCaja || newCaja === 'Cartera de Cheques')) {
                    newCaja = 'Custodia E-Cheq';
                  }
                  if ((newMetodo === 'CHEQUE' || newMetodo === 'CHEQUE_ELECTRONICO') && !newVto) {
                    newVto = prev.fecha;
                  }
                  return {
                    ...prev,
                    metodo: newMetodo,
                    caja: newCaja,
                    fecha_vto_cheque: newVto,
                  };
                });
              }}
              className="w-full bg-white border border-slate-200 rounded-none px-3 py-3 font-bold text-slate-900 focus:border-blue-600 outline-none uppercase text-xs cursor-pointer"
            >
              <option value="EFECTIVO">Efectivo</option>
              <option value="TRANSFERENCIA">Transferencia Bancaria</option>
              <option value="CHEQUE">Cheque Físico</option>
              <option value="CHEQUE_ELECTRONICO">Cheque Electrónico (E-Cheq)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Imputación Contable
            </label>
            {isManagementUnlocked ? (
              <select
                value={paymentData.imputacion === 'INTERNO' ? 'INTERNO' : 'BLANCO'}
                onChange={(e) => setPaymentData({ ...paymentData, imputacion: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-none px-3 py-3 font-bold text-slate-900 focus:border-blue-600 outline-none uppercase text-xs cursor-pointer"
              >
                <option value="BLANCO">
                  Solo Fiscal (Oficial ARCA)
                </option>
                <option value="INTERNO">
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

        {/* ── SECCIÓN ESPECÍFICA PARA CHEQUES (FÍSICO O ELECTRÓNICO) ── */}
        {isCheque && (
          <div className="p-5 bg-amber-50/80 border-2 border-amber-300 rounded-sm space-y-4 animate-fade-in shadow-xs">
            <div className="flex items-center justify-between border-b border-amber-200 pb-2.5">
              <span className="text-xs font-black uppercase tracking-wider text-amber-950 flex items-center gap-2">
                <CreditCard size={15} className="text-amber-700" />
                {paymentData.metodo === 'CHEQUE_ELECTRONICO'
                  ? 'Datos del Cheque Electrónico (E-Cheq)'
                  : 'Datos del Cheque Físico'}
              </span>
              <span className="text-[10px] font-black text-amber-900 uppercase bg-amber-200 border border-amber-300 px-2 py-0.5 rounded">
                Registro de Valores
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Número de Cheque */}
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <FileText size={13} className="text-amber-700" />
                  Número de Cheque {paymentData.metodo === 'CHEQUE_ELECTRONICO' ? 'Electrónico' : ''} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required={isCheque}
                  value={paymentData.nro_cheque || ''}
                  onChange={(e) => setPaymentData({ ...paymentData, nro_cheque: e.target.value })}
                  className="w-full bg-white border border-amber-300 focus:border-amber-600 rounded-none px-3 py-2.5 font-bold text-slate-900 outline-none text-xs"
                  placeholder="Ej: 00489120"
                />
                <p className="text-[10px] text-slate-500 mt-1">Número identificatorio del cheque o E-Cheq</p>
              </div>

              {/* Fecha de Vencimiento / Cobro */}
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Calendar size={13} className="text-amber-700" />
                  Fecha de Vencimiento / Cobro <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required={isCheque}
                  value={paymentData.fecha_vto_cheque || ''}
                  onChange={(e) => setPaymentData({ ...paymentData, fecha_vto_cheque: e.target.value })}
                  className="w-full bg-white border border-amber-300 focus:border-amber-600 rounded-none px-3 py-2.5 font-bold text-slate-900 outline-none text-xs"
                />
                <p className="text-[10px] text-slate-500 mt-1">Fecha a partir de la cual el cheque es cobrable/depositado</p>
              </div>

              {/* Caja Destino */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Briefcase size={13} className="text-amber-700" />
                  Caja Destino <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  list="cajas-cheques-list"
                  required={isCheque}
                  value={paymentData.caja || ''}
                  onChange={(e) => setPaymentData({ ...paymentData, caja: e.target.value })}
                  className="w-full bg-white border border-amber-300 focus:border-amber-600 rounded-none px-3 py-2.5 font-bold text-slate-900 outline-none text-xs"
                  placeholder={paymentData.metodo === 'CHEQUE_ELECTRONICO' ? 'Ej: Custodia E-Cheq / Galicia' : 'Ej: Cartera de Cheques / Caja Principal'}
                />
                <datalist id="cajas-cheques-list">
                  <option value="Cartera de Cheques" />
                  <option value="Custodia E-Cheq" />
                  <option value="Caja Principal" />
                  <option value="Banco Galicia" />
                  <option value="Banco Santander" />
                  <option value="Banco Nación" />
                  <option value="Caja Chica" />
                </datalist>
                <p className="text-[10px] text-slate-500 mt-1">Caja o custodia bancaria donde queda asentado el valor</p>
              </div>
            </div>
          </div>
        )}

        {/* ── 3. MONTO A COBRAR ── */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            {isCheque ? 'Monto del Cheque / Cobro (ARS)' : 'Monto a Cobrar (ARS)'}
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
