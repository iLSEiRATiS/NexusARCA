import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientService } from '../services/clientService';
import { productService } from '../services/productService';
import { currencyService } from '../services/currencyService';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const NewSalePage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // State
  const [step, setStep] = useState(1); // 1: Client, 2: Items, 3: Review
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [cart, setCart] = useState<{ 
    product_id: number; 
    nombre: string; 
    cantidad: number; 
    peso_kg: number; 
    precio_usd: number; 
    subtotal_usd: number;
    batch_id?: number;
    batch_nro?: string;
  }[]>([]);
  const [tipoComprobante, setTipoComprobante] = useState('Factura B');
  const [splitOverride, setSplitOverride] = useState<number | null>(null);

  // Data Queries
  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: clientService.getAll });
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: productService.getAll });
  const { data: dolar } = useQuery({ queryKey: ['dolar'], queryFn: currencyService.getDolarOficial });

  const selectedClient = clients?.find((c: any) => c.id === selectedClientId);
  const cotizacion = dolar?.cotizacion || 0;

  // Sync split override with client default
  useEffect(() => {
    if (selectedClient && splitOverride === null) {
      setSplitOverride(Number(selectedClient.porcentaje_facturacion));
    }
  }, [selectedClient]);

  // Calculations
  const totalUsd = cart.reduce((acc, item) => acc + item.subtotal_usd, 0);
  const totalArs = totalUsd * cotizacion;
  const montoBlanco = totalArs * ((splitOverride ?? 80) / 100);
  const montoNegro = totalArs - montoBlanco;

  const getProductStock = (productId: number) => {
    return products?.find((p: any) => p.id === productId)?.stock_actual || 0;
  };

  const isCartValid = cart.length > 0 && cart.every(item => item.cantidad <= getProductStock(item.product_id));

  // Actions
  const addToCart = (product: any) => {
    if (product.stock_actual <= 0) {
      toast.error('Sin stock disponible');
      return;
    }
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
    toast.success('Agregado al carrito');
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

  const createSaleMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        client_id: selectedClientId!,
        items: cart.map(item => ({ 
          product_id: item.product_id, 
          cantidad: item.cantidad
        })),
        tipo_comprobante: tipoComprobante,
        porcentaje_split_override: splitOverride
      };
      return api.post('/sales', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('VENTA REALIZADA CON ÉXITO');
      navigate('/ventas');
    },
    onError: (err: any) => {
      toast.error('Error al procesar venta: ' + (err.response?.data?.message || err.message));
    }
  });

  const filteredProducts = products?.filter((p: any) => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 md:p-10 animate-fade-in max-w-[1400px] mx-auto">
      {/* Header & Steps Indicator */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div>
           <h1 className="text-3xl md:text-4xl font-bold text-slate-800 tracking-tight">Nueva Venta</h1>
           <div className="flex items-center gap-3 mt-3">
              {[1, 2, 3].map(s => (
                <div key={s} className="flex items-center gap-2">
                   <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-smooth ${step >= s ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      {s}
                   </div>
                   {s < 3 && <div className={`w-8 h-0.5 rounded-full ${step > s ? 'bg-emerald-200' : 'bg-slate-100'}`}></div>}
                </div>
              ))}
           </div>
        </div>
        <div className="bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-soft">
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Cotización Aplicada</p>
           <p className="text-xl font-bold text-emerald-600">${cotizacion} <span className="text-[10px] text-slate-300 font-medium ml-1">ARS/USD</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="xl:col-span-2 space-y-6">
          {/* STEP 1: CLIENT SELECTION */}
          {step === 1 && (
            <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-soft animate-slide-up">
              <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
                <span className="w-2 h-6 bg-sky-400 rounded-full"></span>
                Seleccionar Cliente
              </h2>
              <select 
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:border-sky-400 transition-smooth text-lg appearance-none shadow-inner"
                value={selectedClientId || ''}
                onChange={(e) => setSelectedClientId(Number(e.target.value))}
              >
                <option value="">-- BUSCAR EN CARTERA --</option>
                {clients?.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.razon_social} ({c.cuit})</option>
                ))}
              </select>
              
              {selectedClient && (
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
                  <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-100">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Split Oficial</p>
                    <p className="text-xl font-bold text-emerald-800">{selectedClient.porcentaje_facturacion}% Base</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-rose-50 border border-rose-100">
                    <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-1">Deuda Vigente</p>
                    <p className="text-xl font-bold text-rose-800">${Number(selectedClient.saldo_deuda).toLocaleString('es-AR')}</p>
                  </div>
                </div>
              )}

              <div className="mt-10 flex justify-end">
                <button 
                  disabled={!selectedClientId}
                  onClick={() => setStep(2)}
                  className="bg-slate-800 text-white px-10 py-4 rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-slate-900 transition-smooth disabled:opacity-20 shadow-lg shadow-slate-100"
                >
                  Siguiente paso
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: PRODUCT SELECTION */}
          {step === 2 && (
            <div className="space-y-6 animate-slide-up">
              <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-soft">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                    <span className="w-2 h-6 bg-emerald-400 rounded-full"></span>
                    Agregar Productos
                  </h2>
                  <input 
                    type="text" 
                    placeholder="Filtrar por nombre..." 
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-emerald-400 transition-smooth w-full sm:w-64"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {filteredProducts?.map((p: any) => (
                    <button 
                      key={p.id}
                      onClick={() => addToCart(p)}
                      className="flex justify-between items-center p-6 bg-slate-50 hover:bg-emerald-50 border border-slate-100 hover:border-emerald-200 rounded-[24px] transition-smooth text-left group"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-slate-700 uppercase text-md group-hover:text-emerald-800 truncate mb-1">{p.nombre}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{p.presentacion}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-slate-800">USD {Number(p.precio_usd).toFixed(2)}</div>
                        <div className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full mt-1.5 ${p.stock_actual > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          Stock: {p.stock_actual}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-between">
                <button onClick={() => setStep(1)} className="px-8 py-4 rounded-2xl font-bold text-sm uppercase text-slate-400 hover:bg-slate-50 transition-smooth">Volver</button>
                <button 
                  disabled={cart.length === 0}
                  onClick={() => setStep(3)}
                  className="bg-slate-800 text-white px-10 py-4 rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-slate-900 transition-smooth disabled:opacity-20 shadow-lg"
                >
                  Revisar Pedido
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: FINAL REVIEW & SETTINGS */}
          {step === 3 && (
            <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-soft animate-slide-up">
              <h2 className="text-xl font-bold text-slate-800 mb-8 flex items-center gap-3">
                <span className="w-2 h-6 bg-amber-400 rounded-full"></span>
                Configuración de Facturación
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                <div className="space-y-6">
                   <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Tipo de Comprobante</label>
                      <div className="grid grid-cols-2 gap-3">
                         {['Factura B', 'Factura A', 'Presupuesto'].map(t => (
                           <button key={t} onClick={() => setTipoComprobante(t)} className={`py-3 rounded-xl font-bold text-xs transition-smooth border ${tipoComprobante === t ? 'bg-slate-800 border-slate-800 text-white shadow-md' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                              {t}
                           </button>
                         ))}
                      </div>
                   </div>
                   <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Split Oficial (Override)</label>
                      <input 
                        type="range" min="0" max="100" 
                        value={splitOverride ?? 80} 
                        onChange={(e) => setSplitOverride(Number(e.target.value))}
                        className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                      <div className="flex justify-between mt-2">
                         <span className="text-[10px] font-bold text-slate-400 uppercase">Informal: {100 - (splitOverride ?? 80)}%</span>
                         <span className="text-[10px] font-bold text-emerald-600 uppercase">Oficial: {splitOverride ?? 80}%</span>
                      </div>
                   </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-[24px] border border-slate-100 space-y-4">
                   <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-2">Impacto en Cuenta Corriente</p>
                   <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-600">Saldo Blanco</span>
                      <span className="font-bold text-slate-800">${montoBlanco.toLocaleString('es-AR', {maximumFractionDigits: 0})}</span>
                   </div>
                   <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-600">Saldo Negro</span>
                      <span className="font-bold text-slate-800">${montoNegro.toLocaleString('es-AR', {maximumFractionDigits: 0})}</span>
                   </div>
                   <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                      <span className="text-sm font-bold text-slate-800">Carga Total</span>
                      <span className="text-lg font-bold text-emerald-600">${totalArs.toLocaleString('es-AR', {maximumFractionDigits: 0})}</span>
                   </div>
                </div>
              </div>

              <div className="flex justify-between items-center border-t border-slate-50 pt-8">
                <button onClick={() => setStep(2)} className="px-8 py-4 rounded-2xl font-bold text-sm uppercase text-slate-400 hover:bg-slate-50 transition-smooth">Atrás</button>
                <button 
                  onClick={() => {
                    if(window.confirm('¿Confirmar Venta y afectar stock?')) createSaleMutation.mutate();
                  }}
                  disabled={createSaleMutation.isPending || !isCartValid}
                  className="bg-emerald-600 text-white px-12 py-5 rounded-2xl font-bold text-md uppercase tracking-[0.1em] hover:bg-emerald-700 transition-smooth shadow-xl shadow-emerald-100 flex items-center gap-3 disabled:opacity-30 disabled:grayscale"
                >
                  {createSaleMutation.isPending ? 'Procesando...' : 'Finalizar Operación'}
                  <span>✓</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: Shopping Cart / Receipt Preview */}
        <div className="animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <section className="bg-slate-800 text-white rounded-[32px] p-8 shadow-2xl sticky top-24 border border-slate-700">
            <h2 className="font-bold text-[10px] tracking-[0.3em] uppercase text-emerald-400 mb-8">Items del Pedido</h2>
            
            <div className="space-y-6 mb-10 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
              {cart.map(item => {
                const availableStock = getProductStock(item.product_id);
                const isOverStock = item.cantidad > availableStock;

                return (
                  <div key={item.product_id} className={`flex justify-between items-start border-b border-slate-700/50 pb-6 group p-3 rounded-2xl transition-smooth ${isOverStock ? 'bg-rose-950/40 border-rose-500/50' : ''}`}>
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="font-bold uppercase text-sm tracking-tight text-white mb-2 truncate">{item.nombre}</p>
                      <div className="flex flex-wrap items-center gap-4">
                        <div className={`rounded-xl px-3 py-1.5 flex items-center gap-2 border ${isOverStock ? 'bg-rose-900 border-rose-400' : 'bg-slate-700 border-slate-600'}`}>
                            <button onClick={() => updateQuantity(item.product_id, item.cantidad - 1)} className="text-slate-400 hover:text-white font-bold px-1">−</button>
                            <span className="font-bold text-sm w-6 text-center">{item.cantidad}</span>
                            <button onClick={() => updateQuantity(item.product_id, item.cantidad + 1)} className="text-slate-400 hover:text-white font-bold px-1">+</button>
                        </div>
                        <span className="text-[10px] text-slate-500 font-bold uppercase">({item.peso_kg * item.cantidad} KG)</span>
                      </div>
                      {isOverStock && (
                        <p className="text-[10px] font-bold text-rose-400 uppercase mt-2 animate-pulse">
                          ⚠️ Supera stock disponible ({availableStock} Un)
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-emerald-400 text-md">USD {item.subtotal_usd.toFixed(2)}</p>
                      <button onClick={() => removeFromCart(item.product_id)} className="text-rose-400 font-bold text-[9px] uppercase tracking-widest hover:text-rose-300 mt-2">Quitar</button>
                    </div>
                  </div>
                );
              })}
              {cart.length === 0 && (
                <div className="text-slate-500 font-bold text-[10px] uppercase tracking-widest text-center py-16 border-2 border-dashed border-slate-700 rounded-3xl italic">
                  Carrito Vacío
                </div>
              )}
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-700">
              <div className="flex justify-between items-center px-2">
                <span className="text-slate-500 font-bold text-[10px] uppercase tracking-widest">Base Imponible</span>
                <span className="text-lg font-bold">USD {totalUsd.toFixed(2)}</span>
              </div>
              <div className="bg-emerald-600/10 p-6 rounded-2xl border border-emerald-600/20 mt-4">
                <span className="text-emerald-400 font-bold text-[10px] uppercase tracking-widest block mb-1">Total Estimado</span>
                <div className="flex items-baseline gap-2">
                   <span className="text-3xl font-bold text-white">${totalArs.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
                   <span className="text-[10px] text-emerald-400 font-bold uppercase italic">ARS</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default NewSalePage;
