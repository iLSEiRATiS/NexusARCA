import React, { useState, useEffect } from 'react';
import type { Client, LoadCreditPayload } from '../../services/clientService';
import { parseArgNumber, getLocalDateString } from '../../utils/format';
import { toast } from 'sonner';
import { Wallet, PlusCircle, Pencil, X, AlertCircle, Calendar, FileText, CreditCard } from 'lucide-react';

interface ClientCreditModalProps {
  isOpen: boolean;
  client: Client | null;
  onClose: () => void;
  onSubmit: (data: LoadCreditPayload) => void;
  isPending: boolean;
}

export const ClientCreditModal: React.FC<ClientCreditModalProps> = ({
  isOpen,
  client,
  onClose,
  onSubmit,
  isPending,
}) => {
  const [modalMode, setModalMode] = useState<'add' | 'direct'>('add');
  const [monto, setMonto] = useState<string | number>('');
  const [motivo, setMotivo] = useState<string>('');
  const [fecha, setFecha] = useState<string>(getLocalDateString());
  const [metodo, setMetodo] = useState<string>('TRANSFERENCIA');

  useEffect(() => {
    if (isOpen && client) {
      setModalMode('add');
      setMonto('');
      setMotivo('');
      setFecha(getLocalDateString());
      setMetodo('TRANSFERENCIA');
    }
  }, [isOpen, client]);

  if (!isOpen || !client) return null;

  const currentFavor = Math.max(0, Number(client.saldo_a_favor || 0));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parsedMonto = parseArgNumber(monto);
    if (isNaN(parsedMonto) || parsedMonto < 0) {
      toast.error('Ingrese un monto numérico válido mayor o igual a 0');
      return;
    }

    if (modalMode === 'add' && parsedMonto === 0) {
      toast.error('Ingrese un monto superior a 0 para acreditar saldo a favor');
      return;
    }

    onSubmit({
      monto: parsedMonto,
      motivo: motivo.trim() || (modalMode === 'direct' ? 'Ajuste directo de saldo a favor' : 'Carga de saldo a favor'),
      fecha: fecha || getLocalDateString(),
      metodo: metodo,
      modo: modalMode,
    });
  };

  return (
    <div className="bg-white border border-slate-200 shadow-sm animate-fade-in">
      {/* Header */}
      <div className="bg-slate-900 px-6 py-5 text-white flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <Wallet size={18} className="text-emerald-400" />
            <h2 className="text-lg font-black uppercase tracking-wider">Cargar Saldo a Favor</h2>
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

      <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6 bg-slate-50">
        {/* Selector de modo */}
        <div className="flex items-center gap-2 bg-slate-200/80 p-1 rounded-sm w-fit">
          <button
            type="button"
            onClick={() => {
              setModalMode('add');
              setMonto('');
            }}
            className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-sm transition-all flex items-center gap-1.5 cursor-pointer ${
              modalMode === 'add'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PlusCircle size={13} />
            Sumar a Saldo a Favor
          </button>
          <button
            type="button"
            onClick={() => {
              setModalMode('direct');
              setMonto(currentFavor > 0 ? currentFavor.toString() : '0');
            }}
            className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-sm transition-all flex items-center gap-1.5 cursor-pointer ${
              modalMode === 'direct'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Pencil size={13} />
            Establecer Saldo Directo
          </button>
        </div>

        {/* Resumen de saldo a favor actual */}
        <div className="p-4 bg-white border border-slate-200 shadow-xs flex justify-between items-center">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Saldo a Favor Actual
            </span>
            <span className="text-2xl font-black text-emerald-600">
              ${currentFavor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 uppercase">
            <Wallet size={13} /> Crédito Disponible
          </span>
        </div>

        {/* Campos del formulario */}
        <div className="bg-white p-5 border border-slate-200 space-y-4 shadow-xs">
          {/* Monto */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              {modalMode === 'add' ? 'Monto a Cargar / Acreditar (ARS)' : 'Nuevo Saldo a Favor Final (ARS)'}
            </label>
            <input
              type="text"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 px-4 py-3 font-mono font-black text-2xl text-slate-900 focus:border-emerald-600 outline-none"
              placeholder="0.00"
              autoFocus
            />
            <p className="text-[11px] text-slate-400 mt-1">
              {modalMode === 'add'
                ? 'Este monto se sumará al saldo a favor disponible del cliente.'
                : 'Este monto reemplazará directamente el saldo a favor actual del cliente.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            {/* Motivo / Referencia */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <FileText size={13} className="text-slate-400" />
                Motivo / Concepto
              </label>
              <input
                type="text"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 font-bold text-xs uppercase text-slate-900 focus:border-emerald-600 outline-none"
                placeholder="Ej: Anticipo de pago / Cobro a cuenta / Devolución"
              />
            </div>

            {/* Fecha */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar size={13} className="text-slate-400" />
                Fecha del Movimiento
              </label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 font-bold text-xs text-slate-900 focus:border-emerald-600 outline-none"
              />
            </div>
          </div>

          {/* Método */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <CreditCard size={13} className="text-slate-400" />
              Medio de Acreditación / Origen
            </label>
            <select
              value={metodo}
              onChange={(e) => setMetodo(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 font-bold text-xs uppercase text-slate-900 focus:border-emerald-600 outline-none cursor-pointer"
            >
              <option value="TRANSFERENCIA">Transferencia Bancaria</option>
              <option value="EFECTIVO">Efectivo</option>
              <option value="CHEQUE">Cheque Físico</option>
              <option value="CHEQUE_ELECTRONICO">Cheque Electrónico (E-Cheq)</option>
              <option value="SALDO_A_FAVOR">Compensación / Ajuste Interno</option>
            </select>
          </div>
        </div>

        {/* Nota informativa */}
        <div className="flex items-start gap-2.5 p-3.5 bg-emerald-50/70 border border-emerald-200/60 text-emerald-900 text-xs">
          <AlertCircle size={16} className="text-emerald-600 shrink-0 mt-0.5" />
          <p>
            {modalMode === 'add' ? (
              <span>
                <strong>Acreditación contable:</strong> El saldo a favor cargado quedará asentado en el historial de cuenta corriente del cliente como crédito disponible para futuras facturaciones o imputaciones.
              </span>
            ) : (
              <span>
                <strong>Modificación directa:</strong> Se ajustará el saldo a favor al valor especificado y se registrará la diferencia en el libro mayor del cliente.
              </span>
            )}
          </p>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-emerald-600 text-white py-4 font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
        >
          <Wallet size={14} />
          {isPending ? 'Guardando saldo...' : modalMode === 'add' ? 'Confirmar Carga de Saldo a Favor' : 'Guardar Nuevo Saldo a Favor'}
        </button>
      </form>
    </div>
  );
};
