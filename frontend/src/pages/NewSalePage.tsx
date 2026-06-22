import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientService } from '../services/clientService';
import { productService } from '../services/productService';
import { currencyService } from '../services/currencyService';
import api from '../services/api';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText } from 'lucide-react';

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
  
  const [clientCuit, setClientCuit] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoComprobante, setTipoComprobante] = useState('Factura A');

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

  // Detectar cliente si el CUIT coincide
  const selectedClient = clients?.find((c: any) => c.cuit === clientCuit);
  const cotizacion = Number(dolar?.cotizacion || 1);

  const totalUsd = cart.reduce((acc, item) => acc + item.subtotal_usd, 0);
  const totalArs = totalUsd * cotizacion;

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

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.trim().split('\n');
      if (lines.length < 2) return toast.error('El CSV está vacío o no tiene formato correcto');

      const rows = lines.slice(1);
      const newCart: CartItem[] = [];
      let foundDestino = '';

      rows.forEach(row => {
        const columns = row.split(';');
        if (columns.length < 6) return;

        const [, , destino, product_id, , cantidad] = columns;
        if (!foundDestino && destino) foundDestino = destino;

        const p = products?.find((prod: any) => prod.id === parseInt(product_id));
        if (p) {
          const existing = newCart.find(item => item.product_id === p.id);
          const cantInt = parseInt(cantidad);
          if (existing) {
            existing.cantidad += cantInt;
            existing.subtotal_usd = existing.cantidad * existing.peso_kg * existing.precio_usd;
          } else {
            newCart.push({
              product_id: p.id,
              nombre: p.nombre,
              cantidad: cantInt,
              precio_usd: Number(p.precio_usd),
              peso_kg: Number(p.peso_kg),
              subtotal_usd: Number(p.precio_usd) * Number(p.peso_kg) * cantInt
            });
          }
        }
      });

      setCart(newCart);
      toast.success('MOVIMIENTO CARGADO DESDE CSV');
      
      if (foundDestino) {
        const matched = clients?.find((c: any) => c.razon_social.toLowerCase().includes(foundDestino.toLowerCase()));
        if (matched) {
           setClientCuit(matched.cuit);
           toast.info(`Cliente autodetectado: ${matched.razon_social}`);
        }
      }
    };
    reader.readAsText(file);
    // Limpiar input
    e.target.value = '';
  };

  const createSaleMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        cuit: clientCuit,
        items: cart.map(item => ({ 
          product_id: item.product_id, 
          cantidad: item.cantidad
        })),
        tipo_comprobante: tipoComprobante
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
    <div className="space-y-12 animate-fade-in relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-2 border-slate-900 pb-6 gap-4">
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-slate-900">Facturación Manual</h1>
        <div className="flex items-end gap-6 w-full md:w-auto">
          <label className="bg-slate-900 text-white px-6 py-3 cursor-pointer hover:bg-slate-800 transition-all font-black text-[10px] uppercase tracking-[0.2em] flex items-center gap-2 shrink-0">
            <Upload size={16} /> CARGAR MOVIMIENTO (CSV)
            <input type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />
          </label>
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dólar Operativo</p>
            <p className="text-2xl font-black text-blue-600">${cotizacion.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
        <div className="lg:col-span-2 space-y-12">
          {/* CLIENTE */}
          <section className="bg-white border border-slate-200 p-8 shadow-sm relative overflow-hidden group hover:border-blue-600 transition-all">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-all pointer-events-none">
              <FileText size={100} />
            </div>
            <h2 className="text-[11px] font-black uppercase tracking-[0.3em] mb-8 text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 bg-slate-900 text-white flex items-center justify-center text-[10px]">01</span>
              Cliente (CUIT)
            </h2>
            <input 
              type="text"
              placeholder="INGRESE EL CUIT DEL CLIENTE..."
              className="w-full bg-slate-50 border-b-2 border-slate-900 px-4 py-4 font-black text-slate-900 text-xl outline-none focus:border-blue-600 transition-all uppercase tracking-widest placeholder:text-slate-300 placeholder:text-sm placeholder:font-bold"
              value={clientCuit}
              onChange={(e) => setClientCuit(e.target.value)}
            />
            
            {selectedClient ? (
              <div className="mt-6 flex flex-col sm:flex-row gap-4 sm:gap-8 text-[10px] font-bold uppercase tracking-widest border-t border-slate-100 pt-4">
                <span className="text-blue-600 font-black text-sm">{selectedClient.razon_social}</span>
                <span className="text-slate-400 self-end">Saldo Cartera: <span className={Number(selectedClient.saldo_deuda) < 0 ? 'text-red-600' : 'text-slate-900'}>${Math.abs(Number(selectedClient.saldo_deuda)).toLocaleString('es-AR')}</span></span>
              </div>
            ) : clientCuit ? (
              <div className="mt-6 text-[10px] font-bold uppercase tracking-widest border-t border-slate-100 pt-4 text-amber-600">
                CLIENTE NUEVO - SE REGISTRARÁ AUTOMÁTICAMENTE
              </div>
            ) : null}
          </section>

          {/* PRODUCTOS */}
          <section className="bg-white border border-slate-200 p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
              <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 bg-slate-900 text-white flex items-center justify-center text-[10px]">02</span>
                Catálogo de Artículos
              </h2>
              <input 
                type="text" 
                placeholder="BUSCAR ARTÍCULO..." 
                className="bg-slate-50 border border-slate-200 px-4 py-2 text-[10px] font-bold outline-none focus:border-blue-600 transition-all w-full sm:w-64 uppercase tracking-widest text-slate-900"
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
              Comprobante
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-8">
                 <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Tipo de Operación</label>
                    <div className="flex gap-2">
                       {['Factura A', 'Presupuesto'].map(t => (
                         <button 
                           key={t} 
                           onClick={() => setTipoComprobante(t)} 
                           className={`flex-1 py-4 text-[9px] font-black uppercase tracking-widest border transition-all ${tipoComprobante === t ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'border-slate-200 text-slate-400 hover:border-slate-900 hover:text-slate-900'}`}
                         >
                            {t}
                         </button>
                       ))}
                    </div>
                 </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 p-8 flex flex-col justify-center">
                 <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-slate-400">Cotización</span>
                    <span className="text-slate-900">${cotizacion.toFixed(2)}</span>
                 </div>
                 <div className="pt-5 mt-5 border-t border-slate-200 flex justify-between items-center">
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-900">Total en ARS</span>
                    <span className="text-3xl font-black text-blue-600 tracking-tighter">${totalArs.toLocaleString('es-AR', {maximumFractionDigits: 0})}</span>
                 </div>
              </div>
            </div>
          </section>
        </div>

        {/* CARRITO */}
        <div className="lg:pl-8">
          <section className="sticky top-32 space-y-8 bg-white border border-slate-900 p-8 shadow-2xl">
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
                disabled={createSaleMutation.isPending || cart.length === 0 || !clientCuit}
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
