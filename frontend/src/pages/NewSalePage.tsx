import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientService } from '../services/clientService';
import { productService } from '../services/productService';
import { currencyService } from '../services/currencyService';
import api from '../services/api';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface CartItem {
  product_id: number;
  nombre: string;
  cantidad: number;
  precio_usd: number;
  peso_kg: number;
  subtotal_usd: number;
}

const NewSalePage = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoComprobante, setTipoComprobante] = useState('Factura B');
  const [splitOverride, setSplitOverride] = useState<number | null>(null);

  const { data: clients, isLoading: isLoadingClients } = useQuery({ 
    queryKey: ['clients'], 
    queryFn: clientService.getAll 
  });
  
  const { data: products, isLoading: isLoadingProducts } = useQuery({ 
    queryKey: ['products'], 
    queryFn: productService.getAll 
  });

  const { data: dolar } = useQuery({ 
    queryKey: ['dolar'], 
    queryFn: currencyService.getDolarOficial 
  });

  const selectedClient = clients?.find((c: any) => c.id === selectedClientId);
  const cotizacion = Number(dolar?.cotizacion || 1);

  const totalUsd = cart.reduce((acc, item) => acc + item.subtotal_usd, 0);
  const totalArs = totalUsd * cotizacion;

  const currentSplit = splitOverride ?? (selectedClient?.porcentaje_facturacion || 80);
  const montoBlanco = (totalArs * currentSplit) / 100;
  const montoNegro = totalArs - montoBlanco;

  const addToCart = (product: any) => {
    if (product.stock_actual <= 0) {
      toast.error('SIN DISPONIBILIDAD');
      return;
    }
    const existing = cart.find(item => item.product_id === product.id);
    if (existing) {
      if (existing.cantidad >= product.stock_actual) {
        toast.warning('LIMITE DISPONIBLE');
        return;
      }
      updateQuantity(product.id, existing.cantidad + 1);
    } else {
      setCart([...cart, {
        product_id: product.id,
        nombre: product.nombre,
        cantidad: 1,
        precio_usd: Number(product.precio_usd),
        peso_kg: Number(product.peso_kg),
        subtotal_usd: Number(product.precio_usd) * Number(product.peso_kg)
      }]);
    }
  };

  const updateQuantity = (productId: number, newCant: number) => {
    if (newCant <= 0) {
      setCart(cart.filter(item => item.product_id !== productId));
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

  const createSaleMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        client_id: selectedClientId!,
        items: cart.map(item => ({ 
          product_id: item.product_id, 
          cantidad: item.cantidad
        })),
        tipo_comprobante: tipoComprobante,
        porcentaje_split_override: splitOverride ?? undefined
      };
      return api.post('/sales', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('OPERACIÓN REGISTRADA');
      navigate('/facturacion');
    },
    onError: (err: any) => {
      toast.error('ERROR: ' + (err.response?.data?.message || err.message));
    }
  });

  const filteredProducts = products?.filter((p: any) => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoadingClients || isLoadingProducts) return <div className="p-10 font-bold uppercase tracking-widest text-xs text-slate-400">Cargando...</div>;

  return (
    <div className="space-y-12 animate-fade-in">
      <div className="flex justify-between items-end border-b-2 border-slate-900 pb-6">
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-slate-900">Facturación Manual</h1>
        <div className="text-right">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dólar Operativo</p>
          <p className="text-2xl font-black text-blue-600">${cotizacion.toFixed(2)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
        <div className="lg:col-span-2 space-y-12">
          {/* CLIENTE */}
          <section className="bg-white border border-slate-200 p-8 shadow-sm">
            <h2 className="text-[11px] font-black uppercase tracking-[0.3em] mb-8 text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 bg-slate-900 text-white flex items-center justify-center text-[10px]">01</span>
              Seleccionar Cliente
            </h2>
            <select 
              className="w-full bg-slate-50 border border-slate-200 px-4 py-4 font-bold text-slate-900 outline-none focus:border-blue-600 transition-all appearance-none uppercase text-sm"
              value={selectedClientId || ''}
              onChange={(e) => setSelectedClientId(Number(e.target.value))}
            >
              <option value="">-- SELECCIONAR CLIENTE --</option>
              {clients?.map((c: any) => (
                <option key={c.id} value={c.id}>{c.razon_social} ({c.cuit})</option>
              ))}
            </select>
            
            {selectedClient && (
              <div className="mt-6 flex gap-8 text-[10px] font-bold uppercase tracking-widest border-t border-slate-100 pt-4">
                <span className="text-slate-400">Split Predef.: <span className="text-slate-900">{selectedClient.porcentaje_facturacion}%</span></span>
                <span className="text-slate-400">Saldo Cartera: <span className={Number(selectedClient.saldo_deuda) < 0 ? 'text-red-600' : 'text-slate-900'}>${Math.abs(Number(selectedClient.saldo_deuda)).toLocaleString('es-AR')}</span></span>
              </div>
            )}
          </section>

          {/* PRODUCTOS */}
          <section className="bg-white border border-slate-200 p-8 shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 bg-slate-900 text-white flex items-center justify-center text-[10px]">02</span>
                Catálogo de Artículos
              </h2>
              <input 
                type="text" 
                placeholder="BUSCAR ARTÍCULO..." 
                className="bg-slate-50 border border-slate-200 px-4 py-2 text-[10px] font-bold outline-none focus:border-blue-600 transition-all w-64 uppercase tracking-widest text-slate-900"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
              {filteredProducts?.map((p: any) => (
                <button 
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="flex justify-between items-center p-5 border border-slate-100 hover:border-blue-600 hover:bg-slate-50 transition-all text-left group bg-white shadow-sm"
                >
                  <div className="min-w-0">
                    <div className="font-black text-slate-900 uppercase text-xs truncate mb-1 group-hover:text-blue-600 transition-colors">{p.nombre}</div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{p.presentacion}</div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <div className="font-black text-slate-900 text-sm">U$D {Number(p.precio_usd).toFixed(2)}</div>
                    <div className="text-[9px] font-bold uppercase text-slate-300">DISP: {p.stock_actual}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* CONFIGURACION */}
          <section className="bg-white border border-slate-200 p-8 shadow-sm">
            <h2 className="text-[11px] font-black uppercase tracking-[0.3em] mb-10 text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 bg-slate-900 text-white flex items-center justify-center text-[10px]">03</span>
              Comprobante & Split Fiscal
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-8">
                 <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Tipo de Comprobante</label>
                    <div className="flex gap-2">
                       {['Factura B', 'Factura A', 'Presupuesto'].map(t => (
                         <button 
                           key={t} 
                           onClick={() => setTipoComprobante(t)} 
                           className={`flex-1 py-4 text-[9px] font-black uppercase tracking-widest border transition-all ${tipoComprobante === t ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-200 text-slate-400 hover:border-slate-900 hover:text-slate-900'}`}
                         >
                            {t}
                         </button>
                       ))}
                    </div>
                 </div>
                 <div>
                    <div className="flex justify-between items-center mb-4">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Override de Split (%)</label>
                      <span className="text-[11px] font-black text-blue-600 uppercase tracking-widest">{splitOverride ?? (selectedClient?.porcentaje_facturacion || 80)}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="100" 
                      value={splitOverride ?? (selectedClient?.porcentaje_facturacion || 80)} 
                      onChange={(e) => setSplitOverride(Number(e.target.value))}
                      className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                 </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 p-8 space-y-5">
                 <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-slate-400">Impacto Blanco</span>
                    <span className="text-slate-900">${montoBlanco.toLocaleString('es-AR', {maximumFractionDigits: 0})}</span>
                 </div>
                 <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-slate-400">Impacto Negro</span>
                    <span className="text-slate-900">${montoNegro.toLocaleString('es-AR', {maximumFractionDigits: 0})}</span>
                 </div>
                 <div className="pt-5 border-t border-slate-200 flex justify-between items-center">
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-900">Total en ARS</span>
                    <span className="text-2xl font-black text-slate-900">${totalArs.toLocaleString('es-AR', {maximumFractionDigits: 0})}</span>
                 </div>
              </div>
            </div>
          </section>
        </div>

        {/* CARRITO */}
        <div className="lg:pl-8">
          <section className="sticky top-32 space-y-8 bg-white border border-slate-900 p-8 shadow-xl">
            <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-900 border-b border-slate-100 pb-4">Resumen de Operación</h2>
            
            <div className="space-y-6 max-h-[45vh] overflow-y-auto pr-4 custom-scrollbar">
              {cart.map(item => (
                <div key={item.product_id} className="group border-b border-slate-50 pb-6 last:border-0">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="font-black uppercase text-[11px] tracking-tight text-slate-900 mb-1 truncate">{item.nombre}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">U$D {item.precio_usd.toFixed(2)} &bull; {(item.peso_kg * item.cantidad).toFixed(1)} KG</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-slate-900 text-xs">U$D {item.subtotal_usd.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4 bg-slate-50 px-3 py-1 border border-slate-100">
                      <button onClick={() => updateQuantity(item.product_id, item.cantidad - 1)} className="text-slate-400 hover:text-blue-600 font-black text-lg leading-none transition-colors">-</button>
                      <span className="font-black text-xs min-w-[20px] text-center text-slate-900">{item.cantidad}</span>
                      <button onClick={() => updateQuantity(item.product_id, item.cantidad + 1)} className="text-slate-400 hover:text-blue-600 font-black text-lg leading-none transition-colors">+</button>
                    </div>
                    <button onClick={() => updateQuantity(item.product_id, 0)} className="text-[8px] font-black text-slate-300 hover:text-red-600 uppercase tracking-widest transition-all">Remover</button>
                  </div>
                </div>
              ))}
              {cart.length === 0 && (
                <div className="text-slate-300 font-black text-[10px] uppercase tracking-[0.2em] text-center py-20 border-2 border-dashed border-slate-50 italic">
                  SIN ARTÍCULOS
                </div>
              )}
            </div>

            <div className="space-y-6 pt-8 border-t-2 border-slate-900">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Base de Operación</span>
                <span className="text-lg font-black text-slate-900">U$D {totalUsd.toFixed(2)}</span>
              </div>
              
              <button 
                onClick={() => {
                  if(window.confirm('¿CONFIRMAR REGISTRO DE OPERACIÓN?')) createSaleMutation.mutate();
                }}
                disabled={createSaleMutation.isPending || cart.length === 0 || !selectedClientId}
                className="w-full bg-blue-600 text-white py-6 text-[11px] font-black uppercase tracking-[0.3em] hover:bg-blue-700 transition-all disabled:bg-slate-100 disabled:text-slate-300 shadow-lg shadow-blue-100"
              >
                {createSaleMutation.isPending ? 'PROCESANDO...' : 'CONFIRMAR OPERACIÓN'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default NewSalePage;
