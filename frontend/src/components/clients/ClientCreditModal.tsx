import React, { useState, useEffect, useMemo } from 'react';
import type { Client, LoadCreditPayload } from '../../services/clientService';
import { parseArgNumber, getLocalDateString } from '../../utils/format';
import { toast } from 'sonner';
import { Wallet, PlusCircle, Pencil, X, AlertCircle, Calendar, FileText, CreditCard, Landmark, CheckCircle2, ArrowRight } from 'lucide-react';
import { usePrivacy } from '../../context/PrivacyContext';

interface ClientCreditModalProps {
  isOpen: boolean;
  client: Client | null;
  pendingDebts?: any[];
  initialMode?: 'add' | 'impute';
  onClose: () => void;
  onSubmit: (data: LoadCreditPayload) => void;
  isPending: boolean;
}

export const ClientCreditModal: React.FC<ClientCreditModalProps> = ({
  isOpen,
  client,
  pendingDebts = [],
  initialMode = 'add',
  onClose,
  onSubmit,
  isPending,
}) => {
  const { isManagementUnlocked } = usePrivacy();

  // 1. Selector de Sector: Fiscal o Interno
  const [tipo, setTipo] = useState<'BLANCO' | 'INTERNO'>('BLANCO');

  // 2. Destino del crédito: Dejar en cuenta o imputar a factura existente
  const [destino, setDestino] = useState<'CUENTA' | 'DEUDA'>('CUENTA');
  const [selectedDebtId, setSelectedDebtId] = useState<string>('');

  // 3. Modo de ajuste (para cuando queda en cuenta): Sumar o Directo
  const [modalMode, setModalMode] = useState<'add' | 'direct'>('add');

  // 4. Datos del movimiento
  const [monto, setMonto] = useState<string | number>('');
  const [motivo, setMotivo] = useState<string>('');
  const [fecha, setFecha] = useState<string>(getLocalDateString());
  const [metodo, setMetodo] = useState<string>('TRANSFERENCIA');

  useEffect(() => {
    if (isOpen && client) {
      setTipo('BLANCO');
      const startDestino = initialMode === 'impute' ? 'DEUDA' : 'CUENTA';
      setDestino(startDestino);
      setSelectedDebtId('');
      setModalMode('add');
      setMonto('');
      setMotivo('');
      setFecha(getLocalDateString());
      setMetodo('TRANSFERENCIA');
    }
  }, [isOpen, client, initialMode]);

  // Saldos actuales del cliente
  const currentFavorFiscal = Math.max(0, Number(client?.saldo_a_favor_blanco ?? client?.saldo_a_favor ?? 0));
  const currentFavorInterno = Math.max(0, Number(client?.saldo_a_favor_interno || 0));
  const currentFavorSector = tipo === 'BLANCO' ? currentFavorFiscal : currentFavorInterno;

  const rawBlancoVal = Number(client?.saldo_blanco || 0);
  const rawInternoVal = Number(client?.saldo_interno || 0);
  const currentDeudaFiscal = rawBlancoVal < -0.05 ? Math.abs(rawBlancoVal) : 0;
  const currentDeudaInterno = rawInternoVal < -0.05 ? Math.abs(rawInternoVal) : 0;

  // Filtrar deudas pendientes según el sector seleccionado (Fiscal o Interno)
  const sectorPendingDebts = useMemo(() => {
    if (!pendingDebts || pendingDebts.length === 0) return [];
    const sectorDebt = tipo === 'BLANCO' ? currentDeudaFiscal : currentDeudaInterno;
    if (sectorDebt <= 0.05) return [];

    return pendingDebts.filter((d: any) => {
      const isFiscal = d.tipo === 'BLANCO' || d.classification?.caracter === 'FISCAL';
      const inSector = tipo === 'BLANCO' ? isFiscal : !isFiscal;
      const saldo = Number(d.saldoPendiente ?? d.monto ?? 0);
      return inSector && saldo > 0.05 && !d.isPaid;
    });
  }, [pendingDebts, tipo, currentDeudaFiscal, currentDeudaInterno]);

  // Cambiar de sector
  const handleSelectTipo = (newTipo: 'BLANCO' | 'INTERNO') => {
    setTipo(newTipo);
    setSelectedDebtId('');
    setMonto('');
    setMotivo('');
  };

  // Mantener sincronizada la deuda seleccionada cuando cambian las deudas pendientes o el sector
  useEffect(() => {
    if (destino === 'DEUDA') {
      if (sectorPendingDebts.length > 0) {
        const currentStillValid = sectorPendingDebts.some((d: any) => String(d.id) === String(selectedDebtId));
        if (!currentStillValid) {
          const first = sectorPendingDebts[0];
          setSelectedDebtId(String(first.id));
          const debtVal = Number(first.saldoPendiente ?? first.totalOriginal ?? first.monto ?? 0);
          const aImputar = Math.min(currentFavorSector, debtVal);
          setMonto(aImputar > 0 ? aImputar.toString() : '');
          const refTitle = first.displayTitle || first.classification?.title || first.label || '';
          setMotivo(`Cobro ${refTitle} (Imputación Saldo a Favor)`);
        }
      } else {
        setSelectedDebtId('');
        setMonto('');
        setMotivo('');
      }
    }
  }, [destino, sectorPendingDebts, selectedDebtId, currentFavorSector]);

  if (!isOpen || !client) return null;

  const selectedDebt = sectorPendingDebts.find((d: any) => String(d.id) === String(selectedDebtId));
  const selectedDebtMonto = selectedDebt
    ? Number(selectedDebt.saldoPendiente ?? selectedDebt.totalOriginal ?? selectedDebt.monto ?? 0)
    : 0;

  const parsedMonto = parseArgNumber(monto);
  const isImputar = destino === 'DEUDA';

  // Validaciones de monto para imputación
  const exceedsAvailableCredit = isImputar && parsedMonto > currentFavorSector + 0.001;
  const exceedsDebtMonto = isImputar && selectedDebtMonto > 0 && parsedMonto > selectedDebtMonto + 0.001;
  const noCreditAvailable = isImputar && currentFavorSector <= 0.001;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isNaN(parsedMonto) || parsedMonto <= 0) {
      toast.error('Ingrese un monto numérico válido mayor a 0');
      return;
    }

    if (isImputar) {
      if (noCreditAvailable) {
        toast.error(`El cliente no cuenta con saldo a favor ${tipo === 'BLANCO' ? 'Fiscal' : 'Interno'} disponible.`);
        return;
      }
      if (!selectedDebt) {
        toast.error('Debe seleccionar la factura o comprobante que desea saldar.');
        return;
      }
      if (parsedMonto > currentFavorSector + 0.01) {
        toast.error(`El monto a imputar ($${parsedMonto.toLocaleString('es-AR')}) supera el saldo a favor disponible ($${currentFavorSector.toLocaleString('es-AR')}).`);
        return;
      }
      if (parsedMonto > selectedDebtMonto + 0.01) {
        toast.error(`El monto a imputar ($${parsedMonto.toLocaleString('es-AR')}) supera la deuda de la factura ($${selectedDebtMonto.toLocaleString('es-AR')}).`);
        return;
      }
    }

    const defaultMotivo = isImputar
      ? `Cobro ${selectedDebt?.displayTitle || selectedDebt?.label || 'Factura'} (Imputación Saldo a Favor)`
      : modalMode === 'direct'
      ? `Ajuste directo saldo a favor [${tipo === 'BLANCO' ? 'Fiscal' : 'Interno'}]`
      : `Carga saldo a favor [${tipo === 'BLANCO' ? 'Fiscal' : 'Interno'}]`;

    onSubmit({
      monto: parsedMonto,
      tipo: tipo,
      motivo: motivo.trim() || defaultMotivo,
      fecha: fecha || getLocalDateString(),
      metodo: isImputar ? 'SALDO_A_FAVOR' : metodo,
      modo: modalMode,
      imputar_a_deuda: isImputar,
      deuda_referencia: selectedDebt ? (selectedDebt.displayTitle || selectedDebt.label || selectedDebt.classification?.title) : undefined,
      deuda_id: selectedDebt ? selectedDebt.id : undefined,
      deuda_monto: selectedDebtMonto,
    });
  };

  return (
    <div className="bg-white border border-slate-200 shadow-sm animate-fade-in">
      {/* Header */}
      <div className="bg-slate-900 px-6 py-5 text-white flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <Wallet size={18} className="text-emerald-400" />
            <h2 className="text-lg font-black uppercase tracking-wider">
              {isImputar ? 'Imputar Saldo a Favor a Factura' : 'Añadir Saldo a Favor'}
            </h2>
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
        {/* ── PASO 1: ¿DÓNDE QUERÉS OPERAR EL SALDO A FAVOR? (Fiscal o Interno) ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[11px] font-black">
                1
              </span>
              ¿Dónde querés {isImputar ? 'utilizar' : 'añadir'} saldo a favor?
            </label>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Seleccione el sector contable
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Opción Fiscal (Oficial ARCA) */}
            <button
              type="button"
              onClick={() => handleSelectTipo('BLANCO')}
              className={`p-5 text-left border-2 transition-all relative cursor-pointer ${
                tipo === 'BLANCO'
                  ? 'border-blue-600 bg-blue-50/60 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300 text-slate-600'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-sm ${tipo === 'BLANCO' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <Landmark size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase text-slate-900 tracking-tight">
                      Fiscal (Oficial ARCA)
                    </h3>
                    <p className="text-[11px] font-semibold text-slate-500">
                      Facturas A, B y C oficiales
                    </p>
                  </div>
                </div>
                {tipo === 'BLANCO' && (
                  <CheckCircle2 size={18} className="text-blue-600 shrink-0" />
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200/70 flex justify-between items-end text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Crédito Fiscal Disponible</span>
                  <span className="font-mono font-black text-sm text-emerald-600">
                    ${currentFavorFiscal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                {currentDeudaFiscal > 0 && (
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Deuda Fiscal</span>
                    <span className="font-mono font-bold text-xs text-rose-600">
                      ${currentDeudaFiscal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>
            </button>

            {/* Opción Interno (Remitos / Gestión) */}
            <button
              type="button"
              onClick={() => {
                if (!isManagementUnlocked) {
                  toast.error('Desbloquee el Modo Gestión con su PIN para operar con el sector Interno');
                  return;
                }
                handleSelectTipo('INTERNO');
              }}
              className={`p-5 text-left border-2 transition-all relative cursor-pointer ${
                tipo === 'INTERNO'
                  ? 'border-amber-600 bg-amber-50/60 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300 text-slate-600'
              } ${!isManagementUnlocked ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-sm ${tipo === 'INTERNO' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase text-slate-900 tracking-tight">
                      Interno (Remitos / Gestión)
                    </h3>
                    <p className="text-[11px] font-semibold text-slate-500">
                      Remitos y entregas no fiscales
                    </p>
                  </div>
                </div>
                {tipo === 'INTERNO' && (
                  <CheckCircle2 size={18} className="text-amber-600 shrink-0" />
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200/70 flex justify-between items-end text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Crédito Interno Disponible</span>
                  <span className="font-mono font-black text-sm text-emerald-600">
                    ${currentFavorInterno.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                {currentDeudaInterno > 0 && (
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Deuda Interna</span>
                    <span className="font-mono font-bold text-xs text-rose-600">
                      ${currentDeudaInterno.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>
            </button>
          </div>
        </div>

        {/* ── PASO 2: ¿CÓMO QUERÉS OPERAR? (Cargar a cuenta o Imputar a factura existente) ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[11px] font-black">
                2
              </span>
              Operación a Realizar
            </label>
            {sectorPendingDebts.length > 0 && (
              <span className="text-[11px] font-black text-blue-700 bg-blue-100 border border-blue-200 px-2 py-0.5 uppercase tracking-wide">
                {sectorPendingDebts.length} {sectorPendingDebts.length === 1 ? 'Factura pendiente' : 'Facturas pendientes'} en {tipo === 'BLANCO' ? 'Fiscal' : 'Interno'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setDestino('CUENTA');
                setSelectedDebtId('');
                setMonto('');
                setMotivo('');
              }}
              className={`p-3.5 border text-left transition-all cursor-pointer flex items-center justify-between ${
                destino === 'CUENTA'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold shadow-xs'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Wallet size={16} className={destino === 'CUENTA' ? 'text-emerald-600' : 'text-slate-400'} />
                <div>
                  <span className="text-xs uppercase font-black block">Añadir / Sumar Saldo a Favor</span>
                  <span className="text-[11px] font-normal text-slate-500">Cargar dinero a la cuenta corriente del cliente</span>
                </div>
              </div>
              {destino === 'CUENTA' && <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />}
            </button>

            <button
              type="button"
              onClick={() => {
                setDestino('DEUDA');
                if (sectorPendingDebts.length > 0 && !selectedDebtId) {
                  const first = sectorPendingDebts[0];
                  setSelectedDebtId(String(first.id));
                  const debtMonto = Number(first.saldoPendiente ?? first.totalOriginal ?? first.monto ?? 0);
                  const aImputar = Math.min(currentFavorSector, debtMonto);
                  setMonto(aImputar > 0 ? aImputar.toString() : '');
                  const refTitle = first.displayTitle || first.classification?.title || first.label || '';
                  setMotivo(`Cobro ${refTitle} (Imputación Saldo a Favor)`);
                }
              }}
              className={`p-3.5 border text-left transition-all cursor-pointer flex items-center justify-between ${
                destino === 'DEUDA'
                  ? 'border-blue-600 bg-blue-50 text-blue-950 font-bold shadow-xs'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <ArrowRight size={16} className={destino === 'DEUDA' ? 'text-blue-600' : 'text-slate-400'} />
                <div>
                  <span className="text-xs uppercase font-black block">Imputar Saldo a Favor a Factura</span>
                  <span className="text-[11px] font-normal text-slate-500">Cobrar deuda usando el saldo a favor existente</span>
                </div>
              </div>
              {destino === 'DEUDA' && <CheckCircle2 size={16} className="text-blue-600 shrink-0" />}
            </button>
          </div>

          {/* Si eligió Imputar a Factura: Selector de comprobante pendiente y verificación de saldo disponible */}
          {destino === 'DEUDA' && (
            <div className="p-4 bg-blue-50/80 border-2 border-blue-400 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText size={14} className="text-blue-700" />
                  Seleccionar Factura / Comprobante a Saldar ({tipo === 'BLANCO' ? 'Fiscal' : 'Interno'}):
                </label>
                <span className="text-[11px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 uppercase">
                  Saldo a Favor Disponible: ${currentFavorSector.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {noCreditAvailable ? (
                <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold flex items-start gap-2">
                  <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
                  <p>
                    El cliente no tiene saldo a favor en el sector <strong>{tipo === 'BLANCO' ? 'Fiscal' : 'Interno'}</strong>. Primero debe cargar saldo a favor con la opción <em>"Añadir / Sumar Saldo a Favor"</em>.
                  </p>
                </div>
              ) : sectorPendingDebts.length > 0 ? (
                <div>
                  <select
                    value={selectedDebtId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedDebtId(id);
                      const debt = sectorPendingDebts.find((d: any) => String(d.id) === id);
                      if (debt) {
                        const debtVal = Number(debt.saldoPendiente ?? debt.totalOriginal ?? debt.monto ?? 0);
                        // CÁLCULO SEGURO: Sólo imputar hasta el saldo disponible
                        const aImputar = Math.min(currentFavorSector, debtVal);
                        setMonto(aImputar > 0 ? aImputar.toString() : '');
                        const refTitle = debt.displayTitle || debt.classification?.title || debt.label || '';
                        setMotivo(`Cobro ${refTitle} (Imputación Saldo a Favor)`);
                      }
                    }}
                    className="w-full bg-white border-2 border-blue-500 px-3 py-2.5 font-bold text-xs uppercase text-slate-900 focus:border-blue-700 outline-none cursor-pointer"
                  >
                    <option value="">— Seleccionar comprobante de la lista —</option>
                    {sectorPendingDebts.map((d: any) => {
                      const displayTitle = d.label || d.displayTitle || d.classification?.title || 'Comprobante';
                      const saldoVal = Number(d.saldoPendiente ?? d.totalOriginal ?? d.monto ?? 0);
                      return (
                        <option key={d.id} value={d.id}>
                          {displayTitle} — Saldo Pendiente: ${saldoVal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </option>
                      );
                    })}
                  </select>

                  {selectedDebt && (
                    <div className="mt-3 p-3 bg-white border border-blue-200 text-xs space-y-1.5">
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Total de la factura seleccionada:</span>
                        <span className="font-mono font-bold">${selectedDebtMonto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between items-center text-emerald-700">
                        <span>Saldo a favor disponible del cliente:</span>
                        <span className="font-mono font-bold">${currentFavorSector.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-100 pt-1.5 text-blue-900 font-bold">
                        <span>
                          {parsedMonto < selectedDebtMonto - 0.01 ? 'Pago Parcial (se imputará):' : 'Cancelación Total:'}
                        </span>
                        <span className="font-mono text-sm font-black text-blue-700">
                          ${parsedMonto > 0 ? parsedMonto.toLocaleString('es-AR', { minimumFractionDigits: 2 }) : '0,00'}
                        </span>
                      </div>
                      {parsedMonto > 0 && parsedMonto < selectedDebtMonto - 0.01 && (
                        <p className="text-[11px] text-amber-700 font-semibold pt-1 border-t border-amber-100">
                          ⚠️ Restarán <strong>${(selectedDebtMonto - parsedMonto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong> de deuda en esta factura.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-white border border-blue-200 text-xs text-blue-900 flex items-start gap-2">
                  <AlertCircle size={15} className="text-blue-600 shrink-0 mt-0.5" />
                  <p>
                    No se detectan comprobantes impagos en el sector <strong>{tipo === 'BLANCO' ? 'Fiscal' : 'Interno'}</strong>.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Si eligió Cargar a Cuenta: Selector de modo (Sumar o Directo) */}
          {destino === 'CUENTA' && (
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
                Sumar a Saldo a Favor Actual
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalMode('direct');
                  setMonto(currentFavorSector > 0 ? currentFavorSector.toString() : '0');
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
          )}
        </div>

        {/* ── PASO 3: CAMPOS DEL FORMULARIO (Monto, Concepto, Fecha, Medio) ── */}
        <div className="bg-white p-5 border border-slate-200 space-y-4 shadow-xs">
          {/* Monto */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                {isImputar
                  ? `Monto a Imputar con Saldo a Favor (${tipo === 'BLANCO' ? 'Fiscal' : 'Interno'}) (ARS)`
                  : modalMode === 'add'
                  ? `Monto a Sumar al Saldo a Favor — ${tipo === 'BLANCO' ? 'Fiscal' : 'Interno'} (ARS)`
                  : `Nuevo Saldo a Favor Final — ${tipo === 'BLANCO' ? 'Fiscal' : 'Interno'} (ARS)`}
              </label>
              {isImputar && currentFavorSector > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const maxVal = selectedDebtMonto > 0 ? Math.min(currentFavorSector, selectedDebtMonto) : currentFavorSector;
                    setMonto(maxVal.toString());
                  }}
                  className="text-[10px] font-black uppercase tracking-wide text-blue-700 hover:text-blue-900 cursor-pointer"
                >
                  Usar máximo disponible ($
                  {(selectedDebtMonto > 0 ? Math.min(currentFavorSector, selectedDebtMonto) : currentFavorSector).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  )
                </button>
              )}
            </div>

            <input
              type="text"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className={`w-full bg-slate-50 border px-4 py-3 font-mono font-black text-2xl text-slate-900 outline-none transition-all ${
                exceedsAvailableCredit || exceedsDebtMonto
                  ? 'border-rose-500 focus:border-rose-600 bg-rose-50/50'
                  : 'border-slate-300 focus:border-emerald-600'
              }`}
              placeholder="0.00"
              autoFocus
            />

            {/* Mensajes de validación en tiempo real */}
            {exceedsAvailableCredit && (
              <p className="text-xs font-bold text-rose-600 mt-1 flex items-center gap-1">
                <AlertCircle size={13} />
                El monto ingresado (${parsedMonto.toLocaleString('es-AR')}) supera el saldo a favor disponible (${currentFavorSector.toLocaleString('es-AR')}).
              </p>
            )}

            {exceedsDebtMonto && !exceedsAvailableCredit && (
              <p className="text-xs font-bold text-rose-600 mt-1 flex items-center gap-1">
                <AlertCircle size={13} />
                El monto ingresado (${parsedMonto.toLocaleString('es-AR')}) supera la deuda del comprobante (${selectedDebtMonto.toLocaleString('es-AR')}).
              </p>
            )}

            {!isImputar && parsedMonto > 0 && (
              <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 text-xs flex justify-between items-center text-slate-700">
                <span>
                  {modalMode === 'add'
                    ? `Saldo actual: $${currentFavorSector.toLocaleString('es-AR', { minimumFractionDigits: 2 })} + Monto a sumar: $${parsedMonto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                    : `Saldo actual: $${currentFavorSector.toLocaleString('es-AR', { minimumFractionDigits: 2 })} -> Nuevo saldo directo`}
                </span>
                <span className="font-mono font-black text-emerald-700 text-sm">
                  = ${ (modalMode === 'add' ? currentFavorSector + parsedMonto : parsedMonto).toLocaleString('es-AR', { minimumFractionDigits: 2 }) }
                </span>
              </div>
            )}
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
                placeholder={isImputar ? 'Cobro c/ Saldo a Favor' : 'Ej: Anticipo de pago / Cobro a cuenta / Devolución'}
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

          {/* Medio de acreditación (solo si es carga nueva a cuenta) */}
          {!isImputar && (
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
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending || (isImputar && (noCreditAvailable || exceedsAvailableCredit || exceedsDebtMonto || !selectedDebt))}
          className="w-full bg-emerald-600 text-white py-4 font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
        >
          <Wallet size={14} />
          {isPending
            ? 'Procesando...'
            : isImputar
            ? `Confirmar e Imputar Saldo a Favor ($${parsedMonto > 0 ? parsedMonto.toLocaleString('es-AR') : '0,00'})`
            : modalMode === 'add'
            ? `Confirmar y Sumar Saldo a Favor (${tipo === 'BLANCO' ? 'Fiscal' : 'Interno'})`
            : `Guardar Nuevo Saldo Directo (${tipo === 'BLANCO' ? 'Fiscal' : 'Interno'})`}
        </button>
      </form>
    </div>
  );
};
