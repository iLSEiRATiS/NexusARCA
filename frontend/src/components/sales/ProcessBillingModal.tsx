import { useState, useMemo, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { toast } from 'sonner';
import { 
  ShieldCheck, 
  FileQuestion, 
  Calculator, 
  AlertTriangle, 
  Loader2, 
  X,
  DollarSign
} from 'lucide-react';

const CONDICION_IVA_LABELS: Record<string, string> = {
  RESPONSABLE_INSCRIPTO: 'Responsable Inscripto',
  MONOTRIBUTO: 'Monotributo',
  EXENTO: 'Exento',
  CONSUMIDOR_FINAL: 'Consumidor Final',
};

interface ProcessBillingModalProps {
  isOpen: boolean;
  sale: any | null;
  dolarRate: number | string | undefined;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ProcessBillingModal = ({
  isOpen,
  sale,
  dolarRate,
  onClose,
  onSuccess
}: ProcessBillingModalProps) => {
  const queryClient = useQueryClient();

  const [billingParams, setBillingParams] = useState({ 
    mode: 'ARCA', 
    impactBalance: true,
    customPrices: {} as Record<number, { price: number | ''; currency: 'USD' | 'ARS' }>,
    percepciones_iibb_ars: 0,
    percepciones_iva_ars: 0
  });

  useEffect(() => {
    if (!sale) return;

    const initialPrices: Record<number, { price: number; currency: 'USD' | 'ARS' }> = {};
    const splitRatio = sale.porcentaje_split !== undefined ? Number(sale.porcentaje_split) / 100 : 1;

    sale.items?.forEach((item: any) => {
      const precioUsd = Number(item.precio_unitario_usd) || 0;
      const basePrice = precioUsd > 0 ? precioUsd : Number(item.precio_unitario_ars) || 0;
      initialPrices[item.id] = { 
        price: basePrice * splitRatio, 
        currency: precioUsd > 0 ? 'USD' : 'ARS'
      };
    });

    setBillingParams({ 
      mode: 'ARCA',
      impactBalance: true,
      customPrices: initialPrices,
      percepciones_iibb_ars: Number(sale.percepciones_iibb_ars) || 0,
      percepciones_iva_ars: Number(sale.percepciones_iva_ars) || 0
    });
  }, [sale]);

  const billMutation = useMutation({
    mutationFn: async () => {
      if (!sale) return;
      const res = await api.post(`/sales/${sale.id}/bill`, {
        ...billingParams,
        cotizacion_usada: Number(dolarRate) || 1000
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      toast.success(billingParams.mode === 'ARCA' ? '✅ FACTURA AUTORIZADA EXITOSAMENTE' : 'CONVERTIDO A REMITO');
      onSuccess?.();
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al procesar comprobante');
    }
  });

  const calculateFinalTotal = useMemo(() => {
    if (!sale || !dolarRate) return 0;
    
    const dolar = Number(dolarRate);
    let total = (sale.items || []).reduce((acc: number, item: any) => {
      const config = billingParams.customPrices[item.id];
      if (!config || config.price === '') return acc;

      const priceInArs = config.currency === 'USD' 
        ? Number(config.price) * dolar
        : Number(config.price);
      
      const itemTotal = priceInArs * Number(item.cantidad) * (1 + Number(item.iva_tasa || 21) / 100);
      return acc + itemTotal;
    }, 0);

    total += (billingParams.percepciones_iibb_ars || 0) + (billingParams.percepciones_iva_ars || 0);
    return total;
  }, [sale, billingParams.customPrices, billingParams.percepciones_iibb_ars, billingParams.percepciones_iva_ars, dolarRate]);

  const tipoComprobanteAEmitir = useMemo(() => {
    if (!sale) return '';
    return sale.tipo_comprobante || 'Factura A';
  }, [sale]);

  const modalSuperaTopeCF = useMemo(() => {
    if (!sale?.client) return false;
    const client = sale.client;
    const esCFsinCuit = client.condicion_iva === 'CONSUMIDOR_FINAL' && (!client.cuit || client.cuit === '0');
    return esCFsinCuit && calculateFinalTotal >= 10000000;
  }, [sale, calculateFinalTotal]);

  if (!isOpen || !sale) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white border border-slate-200 shadow-2xl max-w-4xl w-full my-auto overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 p-6 sm:p-8 text-white flex justify-between items-center shrink-0 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight">Facturar Movimiento #{String(sale.id).padStart(5, '0')}</h2>
              <span className="px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest bg-blue-600 text-white rounded">
                {tipoComprobanteAEmitir}
              </span>
            </div>
            <p className="text-slate-400 text-xs font-bold uppercase mt-1 tracking-wider">
              {sale.client?.razon_social}
              {' · '}
              <span className="text-blue-400">{CONDICION_IVA_LABELS[sale.client?.condicion_iva] || sale.client?.condicion_iva}</span>
              {sale.client?.cuit ? ` · CUIT ${sale.client.cuit}` : ''}
            </p>
          </div>
          
          <div className="flex items-center gap-5">
            <div className="text-right hidden sm:block bg-slate-800/80 px-3.5 py-2 rounded border border-slate-700/60">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-end gap-1">
                <DollarSign size={10} className="text-emerald-400" /> Dólar BNA
              </p>
              <p className="text-sm font-black text-white font-mono">
                ${Number(dolarRate || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <button 
              onClick={onClose} 
              className="text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded transition-colors"
              title="Cerrar"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 bg-slate-50">
          {/* Info Banner */}
          <div className={`flex items-start gap-3.5 p-4 rounded border ${tipoComprobanteAEmitir.includes('A') ? 'border-blue-200 bg-blue-50/70' : 'border-slate-200 bg-white'}`}>
            <ShieldCheck className={tipoComprobanteAEmitir.includes('A') ? 'text-blue-600 shrink-0 mt-0.5' : 'text-slate-500 shrink-0 mt-0.5'} size={20} />
            <div>
              <p className="font-black text-slate-900 text-xs uppercase tracking-tight">
                Emisión configurada como <span className={tipoComprobanteAEmitir.includes('A') ? 'text-blue-600' : 'text-slate-700'}>{tipoComprobanteAEmitir}</span>
              </p>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
                Definido según la condición fiscal del cliente ante ARCA / AFIP
              </p>
            </div>
          </div>

          {/* Ajuste de Precios */}
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <Calculator size={14} className="text-blue-600" /> Ajuste de Precios Finales
              </h3>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {sale.items?.length || 0} {(sale.items?.length || 0) === 1 ? 'artículo' : 'artículos'}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {sale.items?.map((item: any) => {
                const config = billingParams.customPrices[item.id];
                const pArs = config?.currency === 'USD' 
                  ? Number(config?.price || 0) * Number(dolarRate || 0) 
                  : Number(config?.price || 0);
                const subtotalConIva = pArs * Number(item.cantidad) * (1 + Number(item.iva_tasa || 21) / 100);

                return (
                  <div key={item.id} className="bg-white border border-slate-200 p-4 rounded-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-blue-500 transition-all shadow-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-900 text-xs uppercase tracking-tight truncate">{item.descripcion}</p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">
                        <span>CANT: <strong className="text-slate-800">{item.cantidad}</strong></span>
                        <span>•</span>
                        <span>IVA: <strong className="text-slate-800">{Number(item.iva_tasa || 21).toFixed(0)}%</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                      {/* Currency toggle */}
                      <div className="flex border border-slate-200 rounded overflow-hidden bg-slate-100">
                        <button 
                          type="button"
                          onClick={() => {
                            const currentPrice = Number(billingParams.customPrices[item.id]?.price || 0);
                            const currentCurrency = billingParams.customPrices[item.id]?.currency || 'ARS';
                            let newPrice = currentPrice;
                            if (currentCurrency === 'ARS' && Number(dolarRate) > 0) {
                              newPrice = Number((currentPrice / Number(dolarRate)).toFixed(2));
                            }
                            setBillingParams({
                              ...billingParams, 
                              customPrices: { ...billingParams.customPrices, [item.id]: { currency: 'USD', price: newPrice } }
                            });
                          }}
                          className={`px-3 py-1.5 text-[9px] font-black transition-all ${billingParams.customPrices[item.id]?.currency === 'USD' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                          USD
                        </button>
                        <button 
                          type="button"
                          onClick={() => {
                            const currentPrice = Number(billingParams.customPrices[item.id]?.price || 0);
                            const currentCurrency = billingParams.customPrices[item.id]?.currency || 'ARS';
                            let newPrice = currentPrice;
                            if (currentCurrency === 'USD') {
                              newPrice = Number((currentPrice * Number(dolarRate)).toFixed(2));
                            }
                            setBillingParams({
                              ...billingParams, 
                              customPrices: { ...billingParams.customPrices, [item.id]: { currency: 'ARS', price: newPrice } }
                            });
                          }}
                          className={`px-3 py-1.5 text-[9px] font-black transition-all ${billingParams.customPrices[item.id]?.currency === 'ARS' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                          ARS
                        </button>
                      </div>

                      {/* Price input */}
                      <div className="relative w-32 sm:w-36">
                        <input 
                          type="number"
                          step="any"
                          value={billingParams.customPrices[item.id]?.price ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBillingParams({
                              ...billingParams, 
                              customPrices: { 
                                ...billingParams.customPrices, 
                                [item.id]: { 
                                  ...billingParams.customPrices[item.id], 
                                  price: val === '' ? '' : Number(val)
                                } 
                              }
                            });
                          }}
                          placeholder="0.00"
                          className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 font-mono font-bold text-slate-900 text-sm outline-none focus:border-blue-600 focus:bg-white transition-all text-right"
                        />
                      </div>

                      {/* Subtotal Preview */}
                      <div className="text-right w-28 shrink-0 hidden sm:block">
                        <p className="text-[8px] text-slate-400 font-bold uppercase">Subtotal c/IVA</p>
                        <p className="font-mono font-bold text-slate-900 text-xs">
                          ${subtotalConIva.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Percepciones */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-200 pb-2 flex items-center gap-2">
              <Calculator size={14} className="text-blue-600" /> Percepciones Tributarias (ARS)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 p-4 rounded-sm flex justify-between items-center shadow-sm">
                <div>
                  <p className="font-bold text-slate-900 text-xs uppercase">Percepción IIBB</p>
                  <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">Ingresos Brutos</p>
                </div>
                <div className="relative w-36">
                  <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">$</span>
                  <input 
                    type="number"
                    step="any"
                    value={billingParams.percepciones_iibb_ars || ''}
                    onChange={(e) => setBillingParams({...billingParams, percepciones_iibb_ars: parseFloat(e.target.value) || 0})}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded pl-6 pr-2.5 py-1.5 font-mono font-bold text-slate-900 text-sm text-right outline-none focus:border-blue-600 focus:bg-white transition-all"
                  />
                </div>
              </div>
              <div className="bg-white border border-slate-200 p-4 rounded-sm flex justify-between items-center shadow-sm">
                <div>
                  <p className="font-bold text-slate-900 text-xs uppercase">Percepción IVA</p>
                  <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">Impuesto Valor Agregado</p>
                </div>
                <div className="relative w-36">
                  <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">$</span>
                  <input 
                    type="number"
                    step="any"
                    value={billingParams.percepciones_iva_ars || ''}
                    onChange={(e) => setBillingParams({...billingParams, percepciones_iva_ars: parseFloat(e.target.value) || 0})}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded pl-6 pr-2.5 py-1.5 font-mono font-bold text-slate-900 text-sm text-right outline-none focus:border-blue-600 focus:bg-white transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Modalidad de Emisión */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button 
              type="button"
              onClick={() => setBillingParams({...billingParams, mode: 'ARCA'})}
              className={`p-5 rounded-sm border-2 transition-all text-left flex items-start gap-4 ${
                billingParams.mode === 'ARCA' 
                  ? 'border-blue-600 bg-blue-50/50 shadow-md' 
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className={`p-2.5 rounded ${billingParams.mode === 'ARCA' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                <ShieldCheck size={24} />
              </div>
              <div>
                <p className={`font-black text-sm uppercase tracking-tight ${billingParams.mode === 'ARCA' ? 'text-blue-900' : 'text-slate-900'}`}>
                  Factura Oficial ARCA
                </p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">
                  Obtención de CAE mediante WebService AFIP · {tipoComprobanteAEmitir}
                </p>
              </div>
            </button>

            <button 
              type="button"
              onClick={() => setBillingParams({...billingParams, mode: 'REMITO'})}
              className={`p-5 rounded-sm border-2 transition-all text-left flex items-start gap-4 ${
                billingParams.mode === 'REMITO' 
                  ? 'border-slate-900 bg-slate-100 shadow-md' 
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className={`p-2.5 rounded ${billingParams.mode === 'REMITO' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
                <FileQuestion size={24} />
              </div>
              <div>
                <p className={`font-black text-sm uppercase tracking-tight ${billingParams.mode === 'REMITO' ? 'text-slate-900' : 'text-slate-900'}`}>
                  Remito Interno
                </p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">
                  Documento operativo de entrega sin envío fiscal a AFIP
                </p>
              </div>
            </button>
          </div>

          {/* Impactar Cuenta Corriente */}
          <label className="flex items-center gap-4 bg-white border border-slate-200 p-5 rounded-sm cursor-pointer hover:border-blue-500 transition-all shadow-sm">
            <input 
              type="checkbox" 
              checked={billingParams.impactBalance} 
              onChange={(e) => setBillingParams({...billingParams, impactBalance: e.target.checked})}
              className="w-5 h-5 accent-blue-600 cursor-pointer rounded"
            />
            <div>
              <p className="font-bold text-slate-900 text-xs uppercase tracking-tight">Impactar en Cuenta Corriente</p>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
                El saldo del cliente se actualizará por el total final facturado en pesos
              </p>
            </div>
          </label>
        </div>

        {/* Footer / Total Action Bar */}
        <div className="bg-slate-900 p-6 sm:p-8 flex flex-col gap-4 shrink-0 border-t border-slate-800">
          {modalSuperaTopeCF && (
            <div className="bg-amber-950/80 border border-amber-600/70 p-4 rounded flex items-start gap-3">
              <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-xs font-black text-amber-300 uppercase tracking-wider">Tope Consumidor Final Superado</p>
                <p className="text-[10px] font-medium text-amber-200/90 uppercase tracking-wider mt-0.5">
                  El monto supera el límite para CF sin identificar. AFIP rechazará el comprobante. Asigne DNI o CUIT al cliente.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
            <div className="text-center sm:text-left">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Monto Final a Procesar (IVA e Impuestos Inc.)
              </p>
              <p className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight mt-0.5">
                ${calculateFinalTotal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="w-1/3 sm:w-auto px-5 py-3.5 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-bold uppercase tracking-widest rounded transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={() => billMutation.mutate()}
                disabled={billMutation.isPending || calculateFinalTotal === 0 || modalSuperaTopeCF}
                className="w-2/3 sm:w-auto px-8 py-3.5 bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded transition-all hover:bg-blue-700 flex items-center justify-center gap-2.5 disabled:bg-slate-800 disabled:text-slate-500 shadow-lg shadow-blue-900/30"
              >
                {billMutation.isPending ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    <span>Autorizando AFIP...</span>
                  </>
                ) : (
                  <span>Confirmar y Emitir</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
