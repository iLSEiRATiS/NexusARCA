import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientService } from '../services/clientService';
import { productService } from '../services/productService';
import { currencyService } from '../services/currencyService';
import { quotationService } from '../services/quotationService';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const NewQuotationPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // State
  const [step, setStep] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [cart, setCart] = useState<{ 
    product_id: number; 
    nombre: string; 
    cantidad: number; 
    peso_kg: number; 
    precio_usd: number; 
    subtotal_usd: number;
  }[]>([]);
  const [validezDias, setValidezDias] = useState<number>(15);

  // Data Queries
  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: clientService.getAll });
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: productService.getAll });
  const { data: dolar } = useQuery({ queryKey: ['dolar'], queryFn: currencyService.getDolarOficial });

  const cotizacion = dolar?.cotizacion || 0;

  // Calculations
  const totalUsd = cart.reduce((acc, item) => acc + item.subtotal_usd, 0);
  const totalArs = totalUsd * cotizacion;

  // Actions
  const addToCart = (product: any) => {
    const existing = cart.find(item => item.product_id === product.id);
    const pesoKg = Number(product.peso_kg);
    const precioKg = Number(product.precio_usd);

    if (existing) {
      updateQuantity(product.id, existing.cantidad + 1);
    } else {
      setCart([...cart, { 
        product_id: product.id, 
        nombre: product.nombre, 
        cantidad: 1, 
        peso_kg: pesoKg,
        precio_usd: precioKg, 
        subtotal_usd: pesoKg * precioKg
      }]);
    }
    toast.success(`${product.nombre} AGREGADO`);
  };

  const updateQuantity = (productId: number, newCant: number) => {
    if (newCant <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev => prev.map(item => {
      if (item.product_id === productId) {
        return { 
          ...item, 
          cantidad: newCant, 
          subtotal_usd: newCant * item.peso_kg * item.precio_usd 
        };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: number) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  const createQuotationMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        client_id: selectedClientId!,
        items: cart.map(item => ({ 
          product_id: item.product_id, 
          cantidad: item.cantidad
        })),
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

  const filteredProducts = products?.filter((p: any) => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const preventInvalidChars = (e: React.KeyboardEvent) => {
    if (['e', 'E', '+', '-', '.'].includes(e.key)) {
      e.preventDefault();
    }
  };

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
                      Selección de Artículos
                    </h2>
                    <input 
                      type="text" placeholder="BUSCAR ARTÍCULO..." 
                      className="bg-slate-50 border border-slate-200 px-6 py-3 text-[10px] font-black uppercase outline-none focus:border-blue-600 transition-all tracking-widest w-full sm:w-80 text-slate-900"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[550px] overflow-y-auto pr-3 custom-scrollbar">
                    {filteredProducts?.map((p: any) => (
                      <button key={p.id} onClick={() => addToCart(p)} className="flex justify-between items-center p-6 border border-slate-100 hover:border-blue-600 hover:bg-slate-50 transition-all text-left group bg-white shadow-sm">
                        <div className="min-w-0">
                          <p className="font-black text-slate-900 uppercase text-xs truncate mb-1 group-hover:text-blue-600 transition-colors">{p.nombre}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{p.presentacion}</p>
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <p className="font-black text-slate-900 text-sm">USD {Number(p.precio_usd).toFixed(2)}</p>
                          <p className="text-[8px] font-bold text-slate-300 uppercase mt-1 tracking-widest">DISP: {p.stock_actual}</p>
                        </div>
                      </button>
                    ))}
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
                  <div key={item.product_id} className="flex justify-between items-start border-b border-slate-50 pb-6 last:border-0">
                    <div className="flex-1 min-w-0 pr-6">
                      <p className="font-black uppercase text-[11px] text-slate-900 mb-4 truncate tracking-tight">{item.nombre}</p>
                      <div className="flex items-center gap-4">
                         <div className="border border-slate-200 flex items-center bg-slate-50">
                            <button onClick={() => updateQuantity(item.product_id, item.cantidad - 1)} className="text-slate-400 hover:text-slate-900 font-black px-3 py-1.5 transition-all">−</button>
                            <input 
                              type="number"
                              min="1"
                              value={item.cantidad || ''}
                              onKeyDown={preventInvalidChars}
                              onChange={(e) => {
                                const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                updateQuantity(item.product_id, val);
                              }}
                              className="font-black text-xs w-12 text-center bg-transparent text-slate-900 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button onClick={() => updateQuantity(item.product_id, item.cantidad + 1)} className="text-slate-400 hover:text-slate-900 font-black px-3 py-1.5 transition-all">+</button>
                         </div>
                         <span className="text-[9px] text-slate-300 font-black uppercase tracking-tighter">({item.peso_kg * item.cantidad} KG)</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-slate-900 text-xs uppercase">USD {item.subtotal_usd.toFixed(2)}</p>
                      <button onClick={() => removeFromCart(item.product_id)} className="text-[8px] font-black text-slate-200 hover:text-red-600 uppercase tracking-widest mt-3 transition-all">Remover</button>
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
                  <span className="text-slate-500 font-black text-[9px] uppercase tracking-widest block mb-2">VALOR TOTAL ESTIMADO ARS</span>
                  <p className="text-4xl font-black tracking-tighter italic">${totalArs.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</p>
                </div>
              </div>
           </section>
        </div>
      </div>
    </div>
  );
};

export default NewQuotationPage;
