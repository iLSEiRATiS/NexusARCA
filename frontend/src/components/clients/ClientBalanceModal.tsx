import React, { useState, useEffect } from 'react';
import type { Client } from '../../services/clientService';
import { parseArgNumber } from '../../utils/format';
import { toast } from 'sonner';
import { FileText, Calendar, DollarSign, X, AlertCircle } from 'lucide-react';

interface ClientBalanceModalProps {
  isOpen: boolean;
  client: Client | null;
  onClose: () => void;
  onSubmit: (data: {
    saldo_blanco: number;
    saldo_interno: number;
    nro_factura?: string;
    fecha_factura?: string;
    nro_remito?: string;
    fecha_remito?: string;
  }) => void;
  isPending: boolean;
}

export const ClientBalanceModal: React.FC<ClientBalanceModalProps> = ({
  isOpen,
  client,
  onClose,
  onSubmit,
  isPending,
}) => {
  const [balanceData, setBalanceData] = useState({
    saldo_blanco: '' as string | number,
    saldo_interno: '' as string | number,
    nro_factura: '',
    fecha_factura: new Date().toISOString().split('T')[0],
    nro_remito: '',
    fecha_remito: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (isOpen) {
      setBalanceData({
        saldo_blanco: '',
        saldo_interno: '',
        nro_factura: '',
        fecha_factura: new Date().toISOString().split('T')[0],
        nro_remito: '',
        fecha_remito: new Date().toISOString().split('T')[0],
      });
    }
  }, [isOpen]);

  if (!isOpen || !client) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const addBlanco = parseArgNumber(balanceData.saldo_blanco);
    const addInterno = parseArgNumber(balanceData.saldo_interno);

    if (addBlanco === 0 && addInterno === 0) {
      toast.error('Ingrese un monto en Blanco y/o Interno');
      return;
    }

    // La deuda se guarda en negativo: nuevo saldo = saldo actual - monto agregado
    const newSaldoBlanco = Number(client.saldo_blanco || 0) - addBlanco;
    const newSaldoInterno = Number(client.saldo_interno || 0) - addInterno;

    onSubmit({
      saldo_blanco: newSaldoBlanco,
      saldo_interno: newSaldoInterno,
      nro_factura: balanceData.nro_factura.trim() || undefined,
      fecha_factura: balanceData.fecha_factura || undefined,
      nro_remito: balanceData.nro_remito.trim() || undefined,
      fecha_remito: balanceData.fecha_remito || undefined,
    });
  };

  const deudaBlancoActual = -Number(client.saldo_blanco || 0);
  const deudaInternoActual = -Number(client.saldo_interno || 0);

  return (
    <div className="bg-white border border-slate-200 shadow-sm animate-fade-in">
      {/* Header */}
      <div className="bg-slate-900 px-6 py-5 text-white flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <DollarSign size={18} className="text-blue-400" />
            <h2 className="text-lg font-black uppercase tracking-wider">Cargar Deuda</h2>
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
        {/* Resumen de deuda actual */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-white border border-slate-200">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Deuda actual Blanco</span>
            <span className="text-xl font-black text-slate-900">
              ${deudaBlancoActual.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="p-4 bg-white border border-slate-200">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Deuda actual Interno</span>
            <span className="text-xl font-black text-slate-900">
              ${deudaInternoActual.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Columnas Blanco e Interno */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Sector Blanco */}
          <div className="bg-white p-5 border border-slate-200 space-y-4">
            <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
              <span className="text-xs font-black text-blue-600 uppercase tracking-widest">Sector Blanco (Oficial)</span>
              <span className="text-[11px] font-bold text-slate-400 uppercase">Fiscal / ARCA</span>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Monto a sumar — Blanco (ARS)
              </label>
              <input
                type="text"
                value={balanceData.saldo_blanco}
                onChange={(e) => setBalanceData({ ...balanceData, saldo_blanco: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-none px-3 py-3 font-bold text-slate-900 focus:border-blue-600 outline-none text-lg"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <FileText size={13} className="text-slate-400" />
                Número de Factura
              </label>
              <input
                type="text"
                value={balanceData.nro_factura}
                onChange={(e) => setBalanceData({ ...balanceData, nro_factura: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-none px-3 py-2.5 font-bold text-slate-900 focus:border-blue-600 outline-none text-xs uppercase"
                placeholder="Ej: 0001-00001234"
              />
              <p className="text-[11px] text-slate-400 mt-1">N° de factura fiscal generada o pendiente de cobro</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar size={13} className="text-slate-400" />
                Fecha de la Factura
              </label>
              <input
                type="date"
                value={balanceData.fecha_factura}
                onChange={(e) => setBalanceData({ ...balanceData, fecha_factura: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-none px-3 py-2.5 font-bold text-slate-900 focus:border-blue-600 outline-none text-xs"
              />
              <p className="text-[11px] text-slate-400 mt-1">Fecha de emisión del comprobante fiscal</p>
            </div>
          </div>

          {/* Sector Interno */}
          <div className="bg-white p-5 border border-slate-200 space-y-4">
            <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
              <span className="text-xs font-black text-slate-600 uppercase tracking-widest">Sector Interno (Gestión)</span>
              <span className="text-[11px] font-bold text-slate-400 uppercase">Remitos / No Fiscal</span>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Monto a sumar — Interno (ARS)
              </label>
              <input
                type="text"
                value={balanceData.saldo_interno}
                onChange={(e) => setBalanceData({ ...balanceData, saldo_interno: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-none px-3 py-3 font-bold text-slate-900 focus:border-blue-600 outline-none text-lg"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <FileText size={13} className="text-slate-400" />
                N° de Remito / Comprobante
              </label>
              <input
                type="text"
                value={balanceData.nro_remito}
                onChange={(e) => setBalanceData({ ...balanceData, nro_remito: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-none px-3 py-2.5 font-bold text-slate-900 focus:border-blue-600 outline-none text-xs uppercase"
                placeholder="Ej: R-00452"
              />
              <p className="text-[11px] text-slate-400 mt-1">N° de remito, nota de entrega o presupuesto</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar size={13} className="text-slate-400" />
                Fecha del Comprobante
              </label>
              <input
                type="date"
                value={balanceData.fecha_remito}
                onChange={(e) => setBalanceData({ ...balanceData, fecha_remito: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-none px-3 py-2.5 font-bold text-slate-900 focus:border-blue-600 outline-none text-xs"
              />
              <p className="text-[11px] text-slate-400 mt-1">Fecha en que fue emitida la entrega de mercadería</p>
            </div>
          </div>
        </div>

        {/* Nota informativa */}
        <div className="flex items-start gap-2.5 p-3.5 bg-blue-50/70 border border-blue-200/60 text-blue-900 text-xs">
          <AlertCircle size={16} className="text-blue-600 shrink-0 mt-0.5" />
          <p>
            <strong>Nota operativa:</strong> El monto ingresado se <strong>SUMA</strong> a la deuda actual del cliente. Podés completar solo uno o ambos sectores. Si necesitás descontar deuda en lugar de sumar, ingresá el monto con signo negativo.
          </p>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-blue-600 text-white py-4 font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-md shadow-blue-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isPending ? 'Guardando cambios...' : 'Confirmar Carga de Deuda'}
        </button>
      </form>
    </div>
  );
};
