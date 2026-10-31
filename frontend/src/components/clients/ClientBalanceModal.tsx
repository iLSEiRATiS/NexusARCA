import React, { useState, useEffect } from 'react';
import type { Client } from '../../services/clientService';
import { parseArgNumber, getLocalDateString } from '../../utils/format';
import { toast } from 'sonner';
import { FileText, Calendar, Pencil, PlusCircle, X, AlertCircle } from 'lucide-react';
import { usePrivacy } from '../../context/PrivacyContext';

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
  const { isManagementUnlocked } = usePrivacy();
  const [modalMode, setModalMode] = useState<'direct' | 'add'>('direct');

  // Modo directo: saldo pendiente final exacto deseado (en positivo, representa deuda)
  const [directBlanco, setDirectBlanco] = useState<string | number>('');
  const [directInterno, setDirectInterno] = useState<string | number>('');
  const [directMotivo, setDirectMotivo] = useState<string>('');

  // Modo sumar: monto a añadir con comprobante
  const [balanceData, setBalanceData] = useState({
    saldo_blanco: '' as string | number,
    saldo_interno: '' as string | number,
    nro_factura: '',
    fecha_factura: getLocalDateString(),
    nro_remito: '',
    fecha_remito: getLocalDateString(),
  });

  useEffect(() => {
    if (isOpen && client) {
      const curBlancoDebt = Math.abs(Number(client.saldo_blanco || 0));
      const curInternoDebt = Math.abs(Number(client.saldo_interno || 0));
      setDirectBlanco(curBlancoDebt > 0 ? curBlancoDebt.toString() : '0');
      setDirectInterno(curInternoDebt > 0 ? curInternoDebt.toString() : '0');
      setDirectMotivo('');

      setBalanceData({
        saldo_blanco: '',
        saldo_interno: '',
        nro_factura: '',
        fecha_factura: getLocalDateString(),
        nro_remito: '',
        fecha_remito: getLocalDateString(),
      });
      setModalMode('direct');
    }
  }, [isOpen, client]);

  if (!isOpen || !client) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (modalMode === 'direct') {
      const targetDebtBlanco = parseArgNumber(directBlanco);
      const targetDebtInterno = isManagementUnlocked ? parseArgNumber(directInterno) : Math.abs(Number(client.saldo_interno || 0));

      if (isNaN(targetDebtBlanco) || isNaN(targetDebtInterno)) {
        toast.error('Ingrese montos válidos');
        return;
      }

      // La deuda en sistema se almacena en negativo
      const newSaldoBlanco = -Math.abs(targetDebtBlanco);
      const newSaldoInterno = -Math.abs(targetDebtInterno);

      const motivoText = directMotivo.trim() || 'Modificación manual de saldo pendiente';

      onSubmit({
        saldo_blanco: newSaldoBlanco,
        saldo_interno: newSaldoInterno,
        nro_factura: motivoText,
        fecha_factura: getLocalDateString(),
        nro_remito: motivoText,
        fecha_remito: getLocalDateString(),
      });
    } else {
      const addBlanco = parseArgNumber(balanceData.saldo_blanco);
      const addInterno = isManagementUnlocked ? parseArgNumber(balanceData.saldo_interno) : 0;

      if (addBlanco === 0 && addInterno === 0) {
        toast.error(isManagementUnlocked ? 'Ingrese un monto en Blanco y/o Interno' : 'Ingrese un monto para el Saldo Fiscal');
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
    }
  };

  const deudaBlancoActual = Math.abs(Number(client.saldo_blanco || 0));
  const deudaInternoActual = Math.abs(Number(client.saldo_interno || 0));

  return (
    <div className="bg-white border border-slate-200 shadow-sm animate-fade-in">
      {/* Header */}
      <div className="bg-slate-900 px-6 py-5 text-white flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <Pencil size={18} className="text-blue-400" />
            <h2 className="text-lg font-black uppercase tracking-wider">Modificar Saldo Pendiente</h2>
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
            onClick={() => setModalMode('direct')}
            className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-sm transition-all flex items-center gap-1.5 cursor-pointer ${
              modalMode === 'direct'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Pencil size={13} />
            Establecer Saldo Directo
          </button>
          <button
            type="button"
            onClick={() => setModalMode('add')}
            className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-sm transition-all flex items-center gap-1.5 cursor-pointer ${
              modalMode === 'add'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PlusCircle size={13} />
            Sumar / Agregar Deuda
          </button>
        </div>

        {/* Resumen de saldo actual */}
        <div className={`grid grid-cols-1 ${isManagementUnlocked ? 'sm:grid-cols-2' : ''} gap-4`}>
          <div className="p-4 bg-white border border-slate-200 shadow-xs">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Deuda Fiscal Actual (Oficial ARCA)
            </span>
            <span className="text-xl font-black text-slate-900">
              ${deudaBlancoActual.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          {isManagementUnlocked && (
            <div className="p-4 bg-white border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Deuda Interna Actual (Remitos / Gestión)
              </span>
              <span className="text-xl font-black text-slate-900">
                ${deudaInternoActual.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>

        {/* MODO 1: ESTABLECER SALDO DIRECTO */}
        {modalMode === 'direct' && (
          <div className="space-y-5 animate-fade-in">
            <div className={`grid grid-cols-1 ${isManagementUnlocked ? 'md:grid-cols-2' : ''} gap-6 items-start`}>
              {/* Saldo Fiscal */}
              <div className="bg-white p-5 border border-slate-200 space-y-3 shadow-xs">
                <span className="text-xs font-black text-blue-600 uppercase tracking-widest block border-b border-slate-100 pb-2">
                  Saldo Fiscal (Oficial ARCA)
                </span>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Nuevo Saldo Pendiente de Deuda (ARS)
                </label>
                <input
                  type="text"
                  value={directBlanco}
                  onChange={(e) => setDirectBlanco(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-3 font-mono font-black text-2xl text-slate-900 focus:border-blue-600 outline-none"
                  placeholder="0.00"
                />
                <p className="text-[11px] text-slate-400">
                  Ingresá el importe final exacto que el cliente debe en blanco. (0 si queda saldado).
                </p>
              </div>

              {/* Saldo Interno */}
              {isManagementUnlocked && (
                <div className="bg-white p-5 border border-slate-200 space-y-3 shadow-xs">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-widest block border-b border-slate-100 pb-2">
                    Saldo Interno (Remitos / Gestión)
                  </span>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Nuevo Saldo Pendiente de Deuda (ARS)
                  </label>
                  <input
                    type="text"
                    value={directInterno}
                    onChange={(e) => setDirectInterno(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-3 font-mono font-black text-2xl text-slate-900 focus:border-blue-600 outline-none"
                    placeholder="0.00"
                  />
                  <p className="text-[11px] text-slate-400">
                    Ingresá el importe final exacto que el cliente debe en gestión interna. (0 si queda saldado).
                  </p>
                </div>
              )}
            </div>

            <div className="bg-white p-4 border border-slate-200 shadow-xs">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Motivo del Ajuste (Opcional)
              </label>
              <input
                type="text"
                value={directMotivo}
                onChange={(e) => setDirectMotivo(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 font-bold text-xs uppercase text-slate-900 focus:border-blue-600 outline-none"
                placeholder="Ej: Corrección de saldo contable / acuerdo comercial"
              />
            </div>
          </div>
        )}

        {/* MODO 2: SUMAR / AGREGAR DEUDA */}
        {modalMode === 'add' && (
          <div className={`grid grid-cols-1 ${isManagementUnlocked ? 'md:grid-cols-2' : ''} gap-6 items-start animate-fade-in`}>
            {/* Sector Blanco */}
            <div className="bg-white p-5 border border-slate-200 space-y-4 shadow-xs">
              <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
                <span className="text-xs font-black text-blue-600 uppercase tracking-widest">Sector Blanco (Oficial)</span>
                <span className="text-[11px] font-bold text-slate-400 uppercase">Fiscal / ARCA</span>
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
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 font-bold text-slate-900 focus:border-blue-600 outline-none text-xs uppercase"
                  placeholder="Ej: 0001-00001234"
                />
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
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 font-bold text-slate-900 focus:border-blue-600 outline-none text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Monto a sumar — Blanco (ARS)
                </label>
                <input
                  type="text"
                  value={balanceData.saldo_blanco}
                  onChange={(e) => setBalanceData({ ...balanceData, saldo_blanco: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 px-3 py-3 font-bold text-slate-900 focus:border-blue-600 outline-none text-lg"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Sector Interno */}
            {isManagementUnlocked && (
              <div className="bg-white p-5 border border-slate-200 space-y-4 shadow-xs">
                <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-widest">Sector Interno (Gestión)</span>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Remitos / No Fiscal</span>
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
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 font-bold text-slate-900 focus:border-blue-600 outline-none text-xs uppercase"
                    placeholder="Ej: R-00452"
                  />
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
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2.5 font-bold text-slate-900 focus:border-blue-600 outline-none text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Monto a sumar — Interno (ARS)
                  </label>
                  <input
                    type="text"
                    value={balanceData.saldo_interno}
                    onChange={(e) => setBalanceData({ ...balanceData, saldo_interno: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 px-3 py-3 font-bold text-slate-900 focus:border-blue-600 outline-none text-lg"
                    placeholder="0.00"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Nota informativa */}
        <div className="flex items-start gap-2.5 p-3.5 bg-blue-50/70 border border-blue-200/60 text-blue-900 text-xs">
          <AlertCircle size={16} className="text-blue-600 shrink-0 mt-0.5" />
          <p>
            {modalMode === 'direct' ? (
              <span>
                <strong>Modificación directa:</strong> Los montos ingresados se establecerán como el nuevo saldo pendiente exacto del cliente. El sistema calculará y registrará automáticamente el ajuste contable correspondiente.
              </span>
            ) : (
              <span>
                <strong>Carga aditiva:</strong> El monto ingresado se sumará a la deuda actual del cliente. Podés completar solo uno o ambos sectores.
              </span>
            )}
          </p>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-blue-600 text-white py-4 font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-md shadow-blue-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
        >
          <Pencil size={14} />
          {isPending ? 'Guardando cambios...' : modalMode === 'direct' ? 'Guardar Nuevo Saldo Pendiente' : 'Confirmar Carga de Deuda'}
        </button>
      </form>
    </div>
  );
};
