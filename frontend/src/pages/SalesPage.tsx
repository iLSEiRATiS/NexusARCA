import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { generateSalePDF } from '../services/pdfService';
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  FileText, Loader2, CheckCircle2, 
  ShieldCheck, FileQuestion, Calculator 
} from 'lucide-react';
import { currencyService } from '../services/currencyService';

const SalesPage = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchBar] = useState('');

  const [billingConfig, setBillingConfig] = useState<{ id: number | null, isOpen: boolean, sale: any | null }>({ 
    id: null, isOpen: false, sale: null 
  });
  
  const [billingParams, setBillingParams] = useState({ 
    mode: 'ARCA', 
    impactBalance: true,
    customPrices: {} as Record<number, { price: number, currency: 'USD' | 'ARS' }> 
  });

  const { data: dolarRate } = useQuery({ 
    queryKey: ['dolar-bna'], 
    queryFn: currencyService.getDolarOficial 
  });

  const { data, isLoading } = useQuery({
    queryKey: ['sales'],
    queryFn: async () => {
      const res = await api.get('/sales');
      return res.data;
    }
  });

  const billMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.post(`/sales/${id}/bill`, {
        ...billingParams,
        cotizacion_usada: dolarRate
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      toast.success(billingParams.mode === 'ARCA' ? 'FACTURA AUTORIZADA EXITOSAMENTE' : 'CONVERTIDO A PRESUPUESTO');
      setBillingConfig({ id: null, isOpen: false, sale: null });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al procesar comprobante');
    }
  });

  const creditNoteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.post(`/sales/${id}/credit-note`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      toast.success('NOTA DE CRÉDITO A EMITIDA EXITOSAMENTE');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al emitir nota de crédito');
    }
  });

  const sales = data?.data || [];

  const openProcessModal = (sale: any) => {
    const initialPrices: Record<number, { price: number, currency: 'USD' | 'ARS' }> = {};
    sale.items.forEach((item: any) => {
      initialPrices[item.id] = { 
        price: Number(item.precio_unitario_usd) || 0, 
        currency: item.precio_unitario_usd > 0 ? 'USD' : 'ARS' 
      };
    });

    setBillingParams(prev => ({ ...prev, customPrices: initialPrices }));
    setBillingConfig({ id: sale.id, isOpen: true, sale });
  };

  const calculateFinalTotal = useMemo(() => {
    if (!billingConfig.sale || !dolarRate) return 0;
    
    return billingConfig.sale.items.reduce((acc: number, item: any) => {
      const config = billingParams.customPrices[item.id];
      if (!config) return acc;

      const priceInArs = config.currency === 'USD' 
        ? config.price * Number(dolarRate) * (Number(item.product?.peso_kg) || 1)
        : config.price;
      
      const itemTotal = priceInArs * item.cantidad * (1 + Number(item.iva_tasa || 21) / 100);
      return acc + itemTotal;
    }, 0);
  }, [billingConfig.sale, billingParams.customPrices, dolarRate]);

  return (
    <div className="animate-fade-in relative space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-2 border-slate-900 pb-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter uppercase mb-1">Facturación</h1>
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em]">Gestión de Comprobantes y Movimientos</p>
        </div>
        <Link 
          to="/facturacion/nueva" 
          className="bg-blue-600 text-white px-8 py-3 font-black text-xs tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-3 group w-full md:w-auto uppercase shadow-lg shadow-blue-100"
        >
          + Facturar
        </Link>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <input 
            type="text" 
            placeholder="BUSCAR POR CLIENTE..." 
            value={searchTerm}
            onChange={(e) => setSearchBar(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 px-4 py-3 text-xs font-bold uppercase outline-none focus:border-blue-600 transition-all tracking-widest text-slate-900"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 shadow-sm rounded-none overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <th className="px-8 py-4 font-black text-[10px] uppercase tracking-widest">ID / Fecha</th>
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest">Cliente</th>
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-center">Tipo / Estado</th>
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-center">Total</th>
                <th className="px-8 py-4 font-black text-[10px] uppercase tracking-widest text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={5} className="p-10 text-center"><Loader2 className="animate-spin inline-block text-slate-300" /></td></tr>
              ) : (
                sales.filter((s:any) => s.client?.razon_social.toLowerCase().includes(searchTerm.toLowerCase())).map((sale: any) => (
                  <tr key={sale.id} className="group hover:bg-slate-50 transition-all">
                    <td className="px-8 py-6">
                      <div className="font-black text-slate-900 text-base uppercase">#{String(sale.id).padStart(5, '0')}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{new Date(sale.fecha).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="font-black text-slate-900 uppercase text-sm">{sale.client?.razon_social}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">CUIT: {sale.client?.cuit}</div>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`px-2 py-0.5 border text-[9px] font-black uppercase tracking-widest ${sale.cae ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                          {sale.tipo_comprobante || 'Comprobante'}
                        </span>
                        {sale.estado_factura === 'ANULADA' ? (
                          <div className="flex items-center gap-1 text-[8px] font-black text-red-600 uppercase tracking-tighter">
                            ANULADA
                          </div>
                        ) : sale.cae ? (
                          <div className="flex items-center gap-1 text-[8px] font-black text-blue-600 uppercase tracking-tighter">
                            <CheckCircle2 size={8} /> AUTORIZADA
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[8px] font-black text-slate-300 uppercase tracking-tighter italic">
                             PENDIENTE
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <div className="text-xl font-black text-slate-900 tracking-tighter">${Number(sale.total_real_ars).toLocaleString('es-AR')}</div>
                      <div className="text-[8px] text-slate-400 font-black uppercase tracking-widest">REAL ARS</div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-2">
                        {!sale.cae && sale.estado_factura !== 'ANULADA' && (
                          <button 
                            onClick={() => openProcessModal(sale)}
                            className="bg-slate-900 text-white px-4 py-1.5 font-black text-[9px] uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2"
                          >
                            <FileText size={12} /> PROCESAR
                          </button>
                        )}
                        {sale.cae && sale.tipo_comprobante === 'Factura A' && sale.estado_factura !== 'ANULADA' && (
                          <button 
                            onClick={() => { if(window.confirm('¿SEGURO DESEA ANULAR CON NOTA DE CRÉDITO?')) creditNoteMutation.mutate(sale.id); }}
                            disabled={creditNoteMutation.isPending}
                            className="bg-red-600 text-white px-4 py-1.5 font-black text-[9px] uppercase tracking-widest hover:bg-red-700 transition-all flex items-center gap-2"
                          >
                            ANULAR
                          </button>
                        )}
                        <button 
                          onClick={() => generateSalePDF(sale)}
                          className="bg-white border border-slate-200 text-slate-600 px-4 py-1.5 font-black text-[9px] uppercase tracking-widest hover:bg-slate-50 transition-all"
                        >
                          PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden divide-y divide-slate-100">
          {sales.filter((s:any) => s.client?.razon_social.toLowerCase().includes(searchTerm.toLowerCase())).map((sale: any) => (
            <div key={sale.id} className="p-5 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-black text-slate-900 text-base uppercase leading-tight">#{String(sale.id).padStart(5, '0')} - {sale.client?.razon_social}</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{new Date(sale.fecha).toLocaleDateString()}</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-black text-slate-900 tracking-tighter">${Number(sale.total_real_ars).toLocaleString('es-AR')}</div>
                </div>
              </div>
              <div className="flex gap-2">
                {!sale.cae && sale.estado_factura !== 'ANULADA' && (
                  <button 
                    onClick={() => openProcessModal(sale)}
                    className="flex-1 bg-slate-900 text-white py-3 font-black text-[10px] uppercase tracking-widest"
                  >
                    PROCESAR
                  </button>
                )}
                {sale.cae && sale.tipo_comprobante === 'Factura A' && sale.estado_factura !== 'ANULADA' && (
                  <button 
                    onClick={() => { if(window.confirm('¿SEGURO DESEA ANULAR CON NOTA DE CRÉDITO?')) creditNoteMutation.mutate(sale.id); }}
                    disabled={creditNoteMutation.isPending}
                    className="flex-1 bg-red-600 text-white py-3 font-black text-[10px] uppercase tracking-widest disabled:opacity-50"
                  >
                    ANULAR
                  </button>
                )}
                <button 
                  onClick={() => generateSalePDF(sale)}
                  className="flex-1 border border-slate-200 text-slate-600 py-3 font-black text-[10px] uppercase tracking-widest"
                >
                  PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL DE PROCESAMIENTO */}
      {billingConfig.isOpen && billingConfig.sale && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex items-center justify-center p-0 sm:p-4">
           <div className="bg-white rounded-none w-full max-w-4xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-fade-in">
              <div className="bg-slate-900 p-6 sm:p-8 text-white flex justify-between items-center shrink-0 border-b border-slate-800">
                 <div>
                    <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter">Facturar Movimiento</h2>
                    <p className="text-slate-400 text-[10px] font-bold uppercase mt-1 tracking-widest">
                      {billingConfig.sale.client?.razon_social}
                    </p>
                 </div>
                 <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                       <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">DÓLAR BNA OFICIAL</p>
                       <p className="text-lg font-black text-white">${Number(dolarRate).toFixed(2)}</p>
                    </div>
                    <button onClick={() => setBillingConfig({id: null, isOpen: false, sale: null})} className="text-white text-4xl font-light hover:text-slate-400 transition-colors">&times;</button>
                 </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-10 bg-slate-50">
                 <div className="space-y-6">
                    <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] border-b border-slate-200 pb-2 flex items-center gap-2">
                       <Calculator size={14} className="text-blue-600" /> Ajuste de Precios Finales
                    </h3>
                    <div className="grid grid-cols-1 gap-3">
                       {billingConfig.sale.items.map((item: any) => (
                          <div key={item.id} className="bg-white border border-slate-200 p-5 flex flex-col sm:flex-row justify-between items-center gap-6 hover:border-blue-600 transition-all shadow-sm">
                             <div className="flex-1 w-full sm:w-auto">
                                <p className="font-black text-slate-900 text-sm uppercase tracking-tight">{item.product?.nombre}</p>
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">CANT: {item.cantidad} UN &bull; {item.product?.peso_kg}KG/U</p>
                             </div>
                             <div className="flex items-center gap-4 w-full sm:w-auto">
                                <div className="flex border border-slate-200 bg-slate-50 overflow-hidden">
                                   <button 
                                     onClick={() => setBillingParams({
                                       ...billingParams, 
                                       customPrices: { ...billingParams.customPrices, [item.id]: { ...billingParams.customPrices[item.id], currency: 'USD' } }
                                     })}
                                     className={`px-4 py-2 text-[9px] font-black transition-all ${billingParams.customPrices[item.id]?.currency === 'USD' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-900'}`}
                                   >USD</button>
                                   <button 
                                     onClick={() => setBillingParams({
                                       ...billingParams, 
                                       customPrices: { ...billingParams.customPrices, [item.id]: { ...billingParams.customPrices[item.id], currency: 'ARS' } }
                                     })}
                                     className={`px-4 py-2 text-[9px] font-black transition-all ${billingParams.customPrices[item.id]?.currency === 'ARS' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-900'}`}
                                   >ARS</button>
                                </div>
                                <div className="relative flex-1 sm:w-44">
                                   <input 
                                     type="number"
                                     value={billingParams.customPrices[item.id]?.price}
                                     onChange={(e) => setBillingParams({
                                       ...billingParams, 
                                       customPrices: { ...billingParams.customPrices, [item.id]: { ...billingParams.customPrices[item.id], price: parseFloat(e.target.value) || 0 } }
                                     })}
                                     className="w-full bg-transparent border-b-2 border-slate-900 rounded-none px-2 py-3 font-black text-slate-900 text-xl outline-none focus:border-blue-600 transition-all"
                                   />
                                </div>
                             </div>
                          </div>
                       ))}
                    </div>
                 </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <button 
                      onClick={() => setBillingParams({...billingParams, mode: 'ARCA'})}
                      className={`p-8 border-2 transition-all text-center flex flex-col items-center gap-4 shadow-sm ${
                        billingParams.mode === 'ARCA' ? 'border-blue-600 bg-blue-600 text-white shadow-blue-100 shadow-lg' : 'border-slate-200 bg-white text-slate-400 hover:border-blue-600 hover:text-blue-600'
                      }`}
                    >
                       <ShieldCheck className={billingParams.mode === 'ARCA' ? 'text-white' : 'text-slate-200'} size={32} />
                       <div>
                          <p className={`font-black text-sm uppercase tracking-widest ${billingParams.mode === 'ARCA' ? 'text-white' : 'text-slate-900'}`}>Factura ARCA</p>
                          <p className={`text-[8px] font-bold uppercase mt-1 tracking-widest ${billingParams.mode === 'ARCA' ? 'text-blue-100' : 'text-slate-400'}`}>OFICIAL AFIP</p>
                       </div>
                    </button>
                    <button 
                      onClick={() => setBillingParams({...billingParams, mode: 'PRESUPUESTO'})}
                      className={`p-8 border-2 transition-all text-center flex flex-col items-center gap-4 shadow-sm ${
                        billingParams.mode === 'PRESUPUESTO' ? 'border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-200' : 'border-slate-200 bg-white text-slate-400 hover:border-slate-900 hover:text-slate-900'
                      }`}
                    >
                       <FileQuestion className={billingParams.mode === 'PRESUPUESTO' ? 'text-white' : 'text-slate-200'} size={32} />
                       <div>
                          <p className={`font-black text-sm uppercase tracking-widest ${billingParams.mode === 'PRESUPUESTO' ? 'text-white' : 'text-slate-900'}`}>Presupuesto</p>
                          <p className={`text-[8px] font-bold uppercase mt-1 tracking-widest ${billingParams.mode === 'PRESUPUESTO' ? 'text-slate-400' : 'text-slate-400'}`}>SISTEMA INTERNO</p>
                       </div>
                    </button>
                 </div>

                 <label className="flex items-center gap-6 bg-white border border-slate-200 p-8 cursor-pointer hover:border-blue-600 transition-all shadow-sm">
                    <input 
                      type="checkbox" 
                      checked={billingParams.impactBalance} 
                      onChange={(e) => setBillingParams({...billingParams, impactBalance: e.target.checked})}
                      className="w-6 h-6 border-2 border-slate-900 rounded-none appearance-none checked:bg-blue-600 checked:border-blue-600 transition-all"
                    />
                    <div>
                       <p className="font-black text-slate-900 text-sm uppercase tracking-tight">Impactar en Cuenta Corriente</p>
                       <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">EL SALDO DEL CLIENTE SE ACTUALIZARÁ POR EL TOTAL FINAL ARS</p>
                    </div>
                 </label>
              </div>

              <div className="bg-slate-900 p-8 sm:p-12 flex flex-col sm:flex-row justify-between items-center gap-8 shrink-0 border-t border-slate-800">
                 <div className="text-center sm:text-left">
                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Monto Final a Procesar (IVA INC.)</p>
                    <p className="text-5xl font-black text-white tracking-tighter">
                       ${calculateFinalTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </p>
                 </div>
                 <div className="flex flex-col gap-2 w-full sm:w-auto">
                    <button 
                      onClick={() => billMutation.mutate(billingConfig.id!)}
                      disabled={billMutation.isPending || calculateFinalTotal === 0}
                      className="px-12 py-5 bg-blue-600 text-white font-black text-xs uppercase tracking-[0.2em] transition-all hover:bg-blue-700 flex items-center justify-center gap-3 disabled:bg-slate-800 disabled:text-slate-600 shadow-xl shadow-blue-900/20"
                    >
                       {billMutation.isPending ? <Loader2 className="animate-spin" size={20} /> : 'FINALIZAR PROCESAMIENTO'}
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default SalesPage;
