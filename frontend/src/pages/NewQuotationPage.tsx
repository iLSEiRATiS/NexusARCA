import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientService } from '../services/clientService';
import { currencyService } from '../services/currencyService';
import { quotationService } from '../services/quotationService';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

interface QuotationCartItem {
  id: string;
  descripcion: string;
  cantidad: number;
  precio: number;
  moneda: 'USD' | 'ARS';
  iva_tasa: number;
  subtotal_usd: number;
}

const NewQuotationPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [step, setStep] = useState(1);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [cart, setCart] = useState<QuotationCartItem[]>([]);
  const [validezDias, setValidezDias] = useState<number>(15);

  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: clientService.getAll });
  const { data: dolar } = useQuery({ queryKey: ['dolar'], queryFn: currencyService.getDolarOficial });

  const cotizacion = Number(dolar || 1);

  const totalUsd = cart.reduce((acc, item) => acc + item.subtotal_usd, 0);
  const totalArs = totalUsd * cotizacion;
  const totalIvaArs = cart.reduce((acc, item) => acc + (item.subtotal_usd * cotizacion * (item.iva_tasa / 100)), 0);
  const totalFactura = totalArs + totalIvaArs;

  const updateItem = (id: string, field: keyof QuotationCartItem, value: any) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'cantidad' || field === 'precio' || field === 'moneda') {
          const priceInUsd = updated.moneda === 'USD' ? Number(updated.precio) : Number(updated.precio) / cotizacion;
          updated.subtotal_usd = Number(updated.cantidad) * priceInUsd;
        }
        return updated;
      }
      return item;
    }));
  };

  const removeItem = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const addManualItem = () => {
    setCart(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      descripcion: 'Ítem Manual',
      cantidad: 1,
      precio: 0,
      moneda: 'USD',
      iva_tasa: 21,
      subtotal_usd: 0
    }]);
  };

  const createQuotationMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        client_id: selectedClientId!,
        items: cart.map(item => {
          const precio_usd = item.moneda === 'USD' ? Number(item.precio) : Number(item.precio) / cotizacion;
          return { 
            descripcion: item.descripcion,
            cantidad: Number(item.cantidad),
            precio_unitario_usd: precio_usd,
            iva_tasa: Number(item.iva_tasa)
          };
        }),
        validez_dias: validezDias
      };
      return quotationService.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      toast.success('PRESUPUESTO GENERADO');
      navigate('/cotizaciones');
    },
    onError: (err: any) => {
      toast.error('Error al generar presupuesto: ' + (err.response?.data?.message || err.message));
    }
  });

  return (
    <div className="animate-fade-in max-w-[1400px] mx-auto space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-2 border-slate-900 pb-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter uppercase mb-2">Nueva Cotización</h1>
          <div className="flex items-center gap-4 mt-4">
              {[1, 2, 3].map(s => (
                <div key={s} className="flex items-center gap-2">
                   <div className={`w-10 h-10 flex items-center justify-center font-black text-xs transition-all border ${step >= s ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-300 border-slate-200'}`}>
                      {s}
                   </div>
                   {s < 3 && <div className={`w-10 h-[2px] ${step > s ? 'bg-blue-600' : 'bg-slate-100'}`}></div>}
                </div>
              ))}
           </div>
        </div>
        <div className="bg-white px-8 py-5 border border-slate-200 shadow-sm w-full sm:w-auto">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Dólar Oficial BNA</p>
          <p className="text-3xl font-black text-blue-600 tracking-tighter">${cotizacion}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
        <div className="xl:col-span-2 space-y-8">
           {step === 1 && (
             <div className="bg-white p-10 border border-slate-200 shadow-sm animate-fade-in">
                <h2 className="text-[11px] font-black text-slate-900 mb-10 uppercase tracking-[0.3em] flex items-center gap-2">
                  <span className="w-6 h-6 bg-slate-900 text-white flex items-center justify-center text-[10px]">01</span>
                  Selección de Cliente
                </h2>
                <div className="relative">
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-none px-6 py-5 font-black text-slate-900 outline-none focus:border-blue-600 transition-all text-xl appearance-none uppercase tracking-widest"
                    value={selectedClientId || ''}
                    onChange={(e) => setSelectedClientId(Number(e.target.value))}
                  >
                    <option value="">-- BUSCAR CLIENTE --</option>
                    {clients?.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.razon_social}</option>
                    ))}
                  </select>
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
                </div>
                <div className="mt-12 flex justify-end">
                  <button disabled={!selectedClientId} onClick={() => setStep(2)} className="w-full sm:w-auto bg-blue-600 text-white px-16 py-5 font-black text-xs uppercase tracking-[0.2em] hover:bg-blue-700 transition-all disabled:opacity-20 shadow-lg shadow-blue-100">Siguiente Paso</button>
                </div>
             </div>
           )}

           {step === 2 && (
             <div className="space-y-8 animate-fade-in">
                <div className="bg-white p-10 border border-slate-200 shadow-sm">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-6">
                    <h2 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em] flex items-center gap-2">
                      <span className="w-6 h-6 bg-slate-900 text-white flex items-center justify-center text-[10px]">02</span>
                      Definición de Artículos
                    </h2>
                    <button onClick={addManualItem} className="bg-slate-900 text-white px-6 py-3 text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all">
                      <Plus size={14}/> Agregar Ítem
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                     {cart.length === 0 ? (
                       <div className="text-center py-10 text-[10px] font-bold uppercase text-slate-400 tracking-widest border border-dashed border-slate-200">
                          Agregue ítems para cotizar
                       </div>
                     ) : (
                       <div className="overflow-x-auto">
                         <table className="w-full text-left text-[10px] font-bold uppercase tracking-widest text-slate-900">
                           <thead className="text-slate-400 border-b border-slate-100">
                             <tr>
                               <th className="pb-3 px-2">Descripción</th>
                               <th className="pb-3 px-2 w-20">Cant. (KG)</th>
                               <th className="pb-3 px-2 w-20">Moneda</th>
                               <th className="pb-3 px-2 w-28">P. Unit</th>
                               <th className="pb-3 px-2 w-20">% IVA</th>
                               <th className="pb-3 px-2 w-10"></th>
                             </tr>
                           </thead>
                           <tbody>
                             {cart.map((item) => (
                               <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                 <td className="py-2 px-2">
                                   <input 
                                     type="text" 
                                     value={item.descripcion}
                                     onChange={e => updateItem(item.id, 'descripcion', e.target.value)}
                                     className="w-full bg-transparent border-b border-transparent focus:border-blue-600 outline-none"
                                   />
                                 </td>
                                 <td className="py-2 px-2">
                                   <input 
                                     type="number" 
                                     value={item.cantidad || ''}
                                     onChange={e => updateItem(item.id, 'cantidad', e.target.value)}
                                     className="w-full bg-transparent border-b border-transparent focus:border-blue-600 outline-none text-center"
                                   />
                                 </td>
                                 <td className="py-2 px-2">
                                   <select
                                     value={item.moneda}
                                     onChange={e => updateItem(item.id, 'moneda', e.target.value)}
                                     className="w-full bg-transparent border-b border-transparent focus:border-blue-600 outline-none cursor-pointer"
                                   >
                                     <option value="USD">U$D</option>
                                     <option value="ARS">ARS</option>
                                   </select>
                                 </td>
                                 <td className="py-2 px-2">
                                   <input 
                                     type="number" 
                                     value={item.precio || ''}
                                     onChange={e => updateItem(item.id, 'precio', e.target.value)}
                                     className="w-full bg-transparent border-b border-transparent focus:border-blue-600 outline-none text-right"
                                   />
                                 </td>
                                 <td className="py-2 px-2">
                                   <input 
                                     type="number" 
                                     value={item.iva_tasa || ''}
                                     onChange={e => updateItem(item.id, 'iva_tasa', e.target.value)}
                                     className="w-full bg-transparent border-b border-transparent focus:border-blue-600 outline-none text-center"
                                   />
                                 </td>
                                 <td className="py-2 px-2 text-right">
                                   <button onClick={() => removeItem(item.id)} className="text-slate-300 hover:text-red-600">
                                     ✕
                                   </button>
                                 </td>
                               </tr>
                             ))}
                           </tbody>
                         </table>
                       </div>
                     )}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <button onClick={() => setStep(1)} className="order-2 sm:order-1 px-10 py-4 font-black text-[10px] uppercase text-slate-400 tracking-widest hover:text-slate-900 transition-all">Atrás</button>
                  <button disabled={cart.length === 0} onClick={() => setStep(3)} className="order-1 sm:order-2 bg-slate-900 text-white px-16 py-4 font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">Confirmar Selección</button>
                </div>
             </div>
           )}

           {step === 3 && (
             <div className="bg-white p-10 border border-slate-200 shadow-sm animate-fade-in">
                <h2 className="text-[11px] font-black text-slate-900 mb-12 uppercase tracking-[0.3em] flex items-center gap-2">
                  <span className="w-6 h-6 bg-slate-900 text-white flex items-center justify-center text-[10px]">03</span>
                  Condiciones de Validez
                </h2>
                <div className="max-w-md">
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Vigencia del Presupuesto (Días Corridos)</label>
                   <div className="flex flex-col sm:flex-row items-start sm:items-center gap-8">
                      <input 
                        type="number" min="1" max="90" 
                        value={validezDias} 
                        onChange={(e) => setValidezDias(Number(e.target.value))}
                        className="bg-slate-50 border-b-2 border-slate-900 rounded-none px-6 py-5 font-black text-4xl text-slate-900 outline-none w-full sm:w-40 focus:border-blue-600 transition-all"
                      />
                      <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest leading-relaxed">Este valor se reflejará en el pie del comprobante PDF generado.</p>
                   </div>
                </div>
                <div className="mt-16 flex flex-col sm:flex-row justify-between items-center border-t border-slate-100 pt-10 gap-6">
                  <button onClick={() => setStep(2)} className="order-2 sm:order-1 w-full sm:w-auto px-10 py-4 font-black text-[10px] uppercase text-slate-400 tracking-widest hover:text-slate-900 transition-all">Atrás</button>
                  <button 
                    onClick={() => createQuotationMutation.mutate()}
                    disabled={createQuotationMutation.isPending}
                    className="order-1 sm:order-2 w-full sm:w-auto bg-blue-600 text-white px-16 py-6 font-black text-xs uppercase tracking-[0.2em] hover:bg-blue-700 transition-all shadow-xl shadow-blue-100"
                  >
                    {createQuotationMutation.isPending ? 'PROCESANDO...' : 'FINALIZAR Y GENERAR PRESUPUESTO'}
                  </button>
                </div>
             </div>
           )}
        </div>

        <div className="animate-fade-in order-last xl:order-none">
           <section className="bg-white p-10 border border-slate-900 shadow-xl sticky top-24">
              <h2 className="font-black text-[10px] tracking-[0.3em] uppercase text-slate-400 mb-10 border-b border-slate-50 pb-4">Detalle de Cotización</h2>
              <div className="space-y-8 mb-12 max-h-[45vh] overflow-y-auto pr-3 custom-scrollbar">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between items-start border-b border-slate-50 pb-6 last:border-0">
                    <div className="flex-1 min-w-0 pr-6">
                      <p className="font-black uppercase text-[11px] text-slate-900 mb-2 truncate tracking-tight">{item.descripcion}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{item.cantidad} KG x {item.moneda === 'USD' ? 'U$D' : 'ARS'} {Number(item.precio || 0).toFixed(2)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-slate-900 text-xs uppercase">USD {item.subtotal_usd.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
                {cart.length === 0 && <p className="text-center py-20 text-slate-200 font-black uppercase text-[10px] tracking-widest border-2 border-dashed border-slate-50 italic">VACÍO</p>}
              </div>
              <div className="space-y-6 pt-8 border-t-2 border-slate-900">
                <div className="flex justify-between items-center px-2">
                  <span className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Base Imponible USD</span>
                  <span className="text-lg font-black text-slate-900">USD {totalUsd.toFixed(2)}</span>
                </div>
                <div className="bg-slate-900 p-8 text-white text-center shadow-lg">
                  <span className="text-slate-500 font-black text-[9px] uppercase tracking-widest block mb-2">VALOR TOTAL ESTIMADO ARS (C/IVA)</span>
                  <p className="text-4xl font-black tracking-tighter italic">${totalFactura.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</p>
                </div>
              </div>
           </section>
        </div>
      </div>
    </div>
  );
};

export default NewQuotationPage;
