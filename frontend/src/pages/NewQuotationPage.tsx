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

  return (
    <div className="p-4 sm:p-6 md:p-10 animate-fade-in max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 md:mb-10 gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-800 tracking-tight">Nuevo Presupuesto</h1>
          <div className="flex items-center gap-2 sm:gap-3 mt-3">
              {[1, 2, 3].map(s => (
                <div key={s} className="flex items-center gap-2">
                   <div className={`w-7 h-7 sm:w-8 h-8 rounded-full flex items-center justify-center font-bold text-[10px] sm:text-xs transition-smooth ${step >= s ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      {s}
                   </div>
                   {s < 3 && <div className={`w-6 sm:w-8 h-0.5 rounded-full ${step > s ? 'bg-sky-200' : 'bg-slate-100'}`}></div>}
                </div>
              ))}
           </div>
        </div>
        <div className="bg-white px-5 sm:px-6 py-3 rounded-2xl border border-slate-100 shadow-soft w-full sm:w-auto">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Cotización USD</p>
          <p className="text-xl font-bold text-sky-600">${cotizacion}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8">
        <div className="xl:col-span-2 space-y-6">
           {step === 1 && (
             <div className="bg-white rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 border border-slate-100 shadow-soft animate-slide-up">
                <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
                  <span className="w-2 h-6 bg-slate-400 rounded-full"></span>
                  Paso 1: Cliente interesado
                </h2>
                <div className="relative">
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 sm:px-6 py-4 font-bold text-slate-700 outline-none focus:border-sky-400 transition-smooth text-base sm:text-lg appearance-none shadow-inner"
                    value={selectedClientId || ''}
                    onChange={(e) => setSelectedClientId(Number(e.target.value))}
                  >
                    <option value="">-- BUSCAR CLIENTE --</option>
                    {clients?.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.razon_social}</option>
                    ))}
                  </select>
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
                </div>
                <div className="mt-8 sm:mt-10 flex justify-end">
                  <button disabled={!selectedClientId} onClick={() => setStep(2)} className="w-full sm:w-auto bg-slate-800 text-white px-10 py-4 rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-slate-900 transition-smooth disabled:opacity-20 shadow-lg">Continuar</button>
                </div>
             </div>
           )}

           {step === 2 && (
             <div className="space-y-6 animate-slide-up">
                <div className="bg-white rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 border border-slate-100 shadow-soft">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                      <span className="w-2 h-6 bg-emerald-400 rounded-full"></span>
                      Paso 2: Mercadería
                    </h2>
                    <input 
                      type="text" placeholder="Filtrar catálogo..." 
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400 transition-smooth w-full sm:w-64"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-h-[400px] sm:max-h-[500px] overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
                    {filteredProducts?.map((p: any) => (
                      <button key={p.id} onClick={() => addToCart(p)} className="flex justify-between items-center p-4 sm:p-6 bg-slate-50 hover:bg-sky-50 border border-slate-100 hover:border-sky-200 rounded-[20px] sm:rounded-[24px] transition-smooth text-left group">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-700 uppercase text-xs sm:text-sm truncate mb-1">{p.nombre}</p>
                          <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase">{p.presentacion}</p>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <p className="font-bold text-slate-800 text-xs sm:text-sm">USD {Number(p.precio_usd).toFixed(2)}</p>
                          <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase mt-1">Stock: {p.stock_actual}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row justify-between gap-3">
                  <button onClick={() => setStep(1)} className="order-2 sm:order-1 px-8 py-3 rounded-2xl font-bold text-sm uppercase text-slate-400 hover:bg-slate-50 transition-smooth">Atrás</button>
                  <button disabled={cart.length === 0} onClick={() => setStep(3)} className="order-1 sm:order-2 bg-slate-800 text-white px-10 py-4 rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-slate-900 shadow-lg">Finalizar</button>
                </div>
             </div>
           )}

           {step === 3 && (
             <div className="bg-white rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 border border-slate-100 shadow-soft animate-slide-up">
                <h2 className="text-xl font-bold text-slate-800 mb-8 flex items-center gap-3">
                  <span className="w-2 h-6 bg-sky-400 rounded-full"></span>
                  Paso 3: Validez y Confirmación
                </h2>
                <div className="max-w-md">
                   <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Vigencia del Presupuesto (Días)</label>
                   <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                      <input 
                        type="number" min="1" max="90" 
                        value={validezDias} 
                        onChange={(e) => setValidezDias(Number(e.target.value))}
                        className="bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-2xl text-sky-600 outline-none w-full sm:w-32 focus:border-sky-400 transition-smooth"
                      />
                      <p className="text-slate-400 text-xs sm:text-sm italic font-medium">Se indicará en el PDF que el precio es válido por este periodo.</p>
                   </div>
                </div>
                <div className="mt-10 sm:mt-12 flex flex-col sm:flex-row justify-between items-center border-t border-slate-50 pt-8 gap-4">
                  <button onClick={() => setStep(2)} className="order-2 sm:order-1 w-full sm:w-auto px-8 py-3 rounded-2xl font-bold text-sm uppercase text-slate-400 hover:bg-slate-50 transition-smooth">Atrás</button>
                  <button 
                    onClick={() => createQuotationMutation.mutate()}
                    disabled={createQuotationMutation.isPending}
                    className="order-1 sm:order-2 w-full sm:w-auto bg-sky-600 text-white px-10 sm:px-12 py-4 sm:py-5 rounded-2xl font-bold text-sm sm:text-md uppercase tracking-[0.1em] hover:bg-sky-700 transition-smooth shadow-xl shadow-sky-100"
                  >
                    {createQuotationMutation.isPending ? 'Procesando...' : 'Generar Presupuesto'}
                  </button>
                </div>
             </div>
           )}
        </div>

        <div className="animate-slide-up order-last xl:order-none" style={{ animationDelay: '0.3s' }}>
           <section className="bg-slate-50 rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 border border-slate-200 sticky top-24 shadow-sm">
              <h2 className="font-bold text-[10px] tracking-[0.3em] uppercase text-slate-400 mb-6 sm:mb-8">Resumen de Cotización</h2>
              <div className="space-y-4 sm:space-y-6 mb-8 sm:mb-10 max-h-[30vh] sm:max-h-[35vh] overflow-y-auto pr-2 custom-scrollbar">
                {cart.map(item => (
                  <div key={item.product_id} className="flex justify-between items-start border-b border-slate-200/60 pb-4 sm:pb-5">
                    <div className="flex-1 min-w-0 pr-2 sm:pr-4">
                      <p className="font-bold uppercase text-[11px] sm:text-[12px] text-slate-700 mb-2 truncate">{item.nombre}</p>
                      <div className="flex items-center gap-2 sm:gap-3">
                         <div className="bg-white rounded-lg px-1.5 sm:px-2 py-1 flex items-center gap-2 border border-slate-200">
                            <button onClick={() => updateQuantity(item.product_id, item.cantidad - 1)} className="text-slate-400 hover:text-slate-800 font-bold px-1">−</button>
                            <span className="font-bold text-[10px] sm:text-xs w-4 text-center">{item.cantidad}</span>
                            <button onClick={() => updateQuantity(item.product_id, item.cantidad + 1)} className="text-slate-400 hover:text-slate-800 font-bold px-1">+</button>
                         </div>
                         <span className="text-[8px] sm:text-[9px] text-slate-400 font-bold uppercase italic truncate">({item.peso_kg * item.cantidad} KG)</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-slate-800 text-[10px] sm:text-xs">USD {item.subtotal_usd.toFixed(2)}</p>
                      <button onClick={() => removeFromCart(item.product_id)} className="text-rose-400 font-bold text-[8px] uppercase tracking-widest hover:underline mt-2">Quitar</button>
                    </div>
                  </div>
                ))}
                {cart.length === 0 && <p className="text-center py-12 sm:py-16 text-slate-300 font-bold uppercase text-[10px] tracking-widest">Sin items</p>}
              </div>
              <div className="space-y-4 pt-4 border-t border-slate-200">
                <div className="flex justify-between items-center px-2">
                  <span className="text-slate-400 font-bold text-[8px] sm:text-[9px] uppercase tracking-widest">Suma USD</span>
                  <span className="text-sm sm:text-md font-bold text-slate-600">USD {totalUsd.toFixed(2)}</span>
                </div>
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm mt-4">
                  <span className="text-sky-500 font-bold text-[8px] sm:text-[9px] uppercase tracking-widest block mb-1 text-center">Presupuestado en ARS</span>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-800 text-center">${totalArs.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</p>
                </div>
              </div>
           </section>
        </div>
      </div>
    </div>
  );
};

export default NewQuotationPage;
