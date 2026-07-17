import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientService } from '../services/clientService';
import { currencyService } from '../services/currencyService';
import api from '../services/api';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, Plus, AlertTriangle } from 'lucide-react';

interface CartItem {
  id: string;
  descripcion: string;
  cantidad: number;
  precio: number;
  moneda: 'USD' | 'ARS';
  iva_tasa: number;
  subtotal_usd: number;
}

const NewSalePage = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const [submitting, setSubmitting] = useState(false);
  const [fechaVtoPago, setFechaVtoPago] = useState('');
  const [clientCuit, setClientCuit] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);

  const [tipoComprobante, setTipoComprobante] = useState('Factura A');
  const [percepcionIIBB, setPercepcionIIBB] = useState<number>(0);
  const [percepcionIVA, setPercepcionIVA] = useState<number>(0);

  const { data: clients, isLoading: isLoadingClients } = useQuery({ 
    queryKey: ['clients'], 
    queryFn: clientService.getAll 
  });
  
  const { data: dolar } = useQuery({ 
    queryKey: ['dolar'], 
    queryFn: currencyService.getDolarOficial 
  });

  const selectedClient = clients?.find((c: any) => c.cuit === clientCuit);
  const cotizacion = Number(dolar || 1);

  useEffect(() => {
    if (selectedClient) {
      if (['RESPONSABLE_INSCRIPTO', 'MONOTRIBUTO'].includes(selectedClient.condicion_iva)) {
        setTipoComprobante('Factura A');
      } else {
        setTipoComprobante('Factura B');
      }
    }
  }, [selectedClient]);

  // Determinar qué tipos de comprobante son válidos según condición IVA
  const isFacturaADisabled = selectedClient && !['RESPONSABLE_INSCRIPTO', 'MONOTRIBUTO'].includes(selectedClient.condicion_iva);
  const isFacturaBDisabled = selectedClient && ['RESPONSABLE_INSCRIPTO', 'MONOTRIBUTO'].includes(selectedClient.condicion_iva);

  // Warning de tope para Consumidor Final sin identificar
  const isConsumidorFinalSinCuit = selectedClient?.condicion_iva === 'CONSUMIDOR_FINAL' && (!selectedClient.cuit || selectedClient.cuit === '0');
  const superaTopeCF = isConsumidorFinalSinCuit && totalFactura >= 10000000;

  // CUIT ingresado pero no encontrado en la DB
  const cuitNoRegistrado = clientCuit.length >= 5 && !selectedClient;

  const totalUsd = cart.reduce((acc, item) => acc + item.subtotal_usd, 0);
  const totalArs = totalUsd * cotizacion;
  
  const totalIvaArs = cart.reduce((acc, item) => acc + (item.subtotal_usd * cotizacion * (item.iva_tasa / 100)), 0);
  
  const totalFactura = totalArs + totalIvaArs + percepcionIIBB + percepcionIVA;

  const updateItem = (id: string, field: keyof CartItem, value: any) => {
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

      rows.forEach((row, index) => {
        const columns = row.split(';');
        if (columns.length < 6) return;

        const [, , destino, , producto_nombre, cantidad] = columns;
        if (!foundDestino && destino) foundDestino = destino;
        
        const cantInt = parseInt(cantidad) || 1;
        const nombreItem = producto_nombre || `Ítem ${index + 1}`;

        newCart.push({
          id: Math.random().toString(36).substr(2, 9),
          descripcion: nombreItem,
          cantidad: cantInt,
          precio: 0,
          moneda: 'USD',
          iva_tasa: 21,
          subtotal_usd: 0
        });
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
    e.target.value = '';
  };

  const createSaleMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        cuit: clientCuit,
        items: cart.map(item => {
          const precio_usd = item.moneda === 'USD' ? Number(item.precio) : Number(item.precio) / cotizacion;
          return { 
            descripcion: item.descripcion,
            cantidad: Number(item.cantidad),
            precio_unitario_usd: precio_usd,
            iva_tasa: Number(item.iva_tasa)
          };
        }),
        tipo_comprobante: tipoComprobante,
        percepciones_iibb_ars: percepcionIIBB,
        percepciones_iva_ars: percepcionIVA,
        fecha_vto_pago: fechaVtoPago ? fechaVtoPago : undefined
      };
      return api.post('/sales', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      toast.success('OPERACIÓN REGISTRADA');
      navigate('/facturacion');
    },
    onError: (err: any) => {
      toast.error('ERROR: ' + (err.response?.data?.message || err.message));
    }
  });

  if (isLoadingClients) return <div className="p-10 font-bold uppercase tracking-widest text-xs text-slate-400">Cargando...</div>;

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
              <div className="mt-6 text-[10px] font-black uppercase tracking-widest border-t border-slate-100 pt-4 text-red-600 flex items-center gap-2">
                <AlertTriangle size={14} />
                CUIT NO REGISTRADO — CARGUE EL CLIENTE PRIMERO DESDE LA SECCIÓN DE CLIENTES
              </div>
            ) : null}
          </section>

          {/* EDICION DE CARRITO (Nuevo) */}
          <section className="bg-white border border-slate-200 p-8 shadow-sm">
            <div className="flex justify-between items-center mb-6">
               <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-900 flex items-center gap-2">
                 <span className="w-6 h-6 bg-slate-900 text-white flex items-center justify-center text-[10px]">02</span>
                 Artículos a Facturar
               </h2>
               <button onClick={addManualItem} className="text-[9px] font-black uppercase tracking-widest text-blue-600 hover:text-slate-900 flex items-center gap-1">
                 <Plus size={12}/> Agregar Manual
               </button>
            </div>
            
            <div className="space-y-4">
               {cart.length === 0 ? (
                 <div className="text-center py-10 text-[10px] font-bold uppercase text-slate-400 tracking-widest border border-dashed border-slate-200">
                    Cargue un CSV o agregue un ítem manual
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
                        {['Factura A', 'Factura B', 'Remito'].map(t => {
                          const disabled = 
                            (t === 'Factura A' && isFacturaADisabled) ||
                            (t === 'Factura B' && isFacturaBDisabled);
                          return (
                          <button 
                            key={t} 
                            onClick={() => !disabled && setTipoComprobante(t)} 
                            disabled={!!disabled}
                            className={`flex-1 py-4 text-[9px] font-black uppercase tracking-widest border transition-all ${
                              disabled 
                                ? 'border-slate-100 text-slate-200 cursor-not-allowed bg-slate-50'
                                : tipoComprobante === t 
                                  ? 'bg-slate-900 border-slate-900 text-white shadow-lg' 
                                  : 'border-slate-200 text-slate-400 hover:border-slate-900 hover:text-slate-900'
                            }`}
                          >
                             {t}
                          </button>
                          );
                        })}
                     </div>
                     {selectedClient && (
                       <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-3">
                         Tipo determinado por la condición IVA del cliente: {selectedClient.condicion_iva?.replace(/_/g, ' ')}
                       </p>
                     )}
                 </div>

                 {tipoComprobante.includes('Factura') && (
                 <div className="mt-8 flex gap-4">
                    <div className="flex-1">
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Perc. IIBB (ARS)</label>
                      <input 
                        type="number"
                        className="w-full bg-slate-50 border border-slate-200 px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-600 transition-all"
                        value={percepcionIIBB || ''}
                        onChange={(e) => setPercepcionIIBB(Number(e.target.value))}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Perc. IVA (ARS)</label>
                      <input 
                        type="number"
                        className="w-full bg-slate-50 border border-slate-200 px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-600 transition-all"
                        value={percepcionIVA || ''}
                        onChange={(e) => setPercepcionIVA(Number(e.target.value))}
                        placeholder="0.00"
                      />
                    </div>
                 </div>
                 )}
                 <div className="mt-8">
                   <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Vencimiento para el Pago (Opcional)</label>
                   <input 
                     type="date"
                     className="w-full max-w-[200px] bg-slate-50 border border-slate-200 px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-600 transition-all"
                     value={fechaVtoPago}
                     onChange={(e) => setFechaVtoPago(e.target.value)}
                   />
                 </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 p-8 flex flex-col justify-center">
                 <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-slate-400">Cotización Usada</span>
                    <span className="text-slate-900">${cotizacion.toFixed(2)}</span>
                 </div>
                 <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest mt-2">
                    <span className="text-slate-400">Subtotal ARS</span>
                    <span className="text-slate-900">${totalArs.toLocaleString('es-AR', {maximumFractionDigits: 0})}</span>
                 </div>
                 <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest mt-2">
                    <span className="text-slate-400">IVA ARS</span>
                    <span className="text-slate-900">${totalIvaArs.toLocaleString('es-AR', {maximumFractionDigits: 0})}</span>
                 </div>
                 <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest mt-2">
                    <span className="text-slate-400">Percepciones</span>
                    <span className="text-slate-900">${(percepcionIIBB + percepcionIVA).toLocaleString('es-AR', {maximumFractionDigits: 0})}</span>
                 </div>
                 <div className="pt-5 mt-5 border-t border-slate-200 flex justify-between items-center">
                     <span className="text-[11px] font-black uppercase tracking-widest text-slate-900">Total Factura</span>
                     <span className="text-3xl font-black text-blue-600 tracking-tighter">${totalFactura.toLocaleString('es-AR', {maximumFractionDigits: 0})}</span>
                  </div>
                  {superaTopeCF && (
                    <div className="mt-4 bg-amber-50 border border-amber-300 p-4 flex items-start gap-3">
                      <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={16} />
                      <div>
                        <p className="text-[9px] font-black text-amber-800 uppercase tracking-widest">Tope Consumidor Final Superado</p>
                        <p className="text-[8px] font-bold text-amber-600 uppercase tracking-widest mt-1">El monto supera el límite para Consumidor Final sin identificar. AFIP rechazará el comprobante. Asigne DNI o CUIT al cliente.</p>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          </section>
        </div>

        {/* CARRITO RESUMEN LATERAL */}
        <div className="lg:pl-8">
          <section className="sticky top-32 space-y-8 bg-white border border-slate-900 p-8 shadow-2xl">
            <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-900 border-b border-slate-100 pb-4">Resumen USD</h2>
            
            <div className="space-y-6 max-h-[45vh] overflow-y-auto pr-4 custom-scrollbar">
              {cart.map(item => (
                <div key={item.id} className="group border-b border-slate-50 pb-6 last:border-0 flex justify-between items-center">
                  <div className="min-w-0 pr-4">
                    <p className="font-black uppercase text-[10px] tracking-tight text-slate-900 mb-1 truncate">{item.descripcion}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">{item.cantidad} KG x {item.moneda === 'USD' ? 'U$D' : 'ARS'} {Number(item.precio || 0).toFixed(2)}</p>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <p className="font-black text-blue-600 text-[11px]">U$D {item.subtotal_usd.toFixed(2)}</p>
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
                <span className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Base Imponible USD</span>
                <span className="text-lg font-black text-slate-900">U$D {totalUsd.toFixed(2)}</span>
              </div>
              
              <button 
                onClick={() => {
                  if(window.confirm('¿CONFIRMAR REGISTRO DE OPERACIÓN?')) createSaleMutation.mutate();
                }}
                disabled={createSaleMutation.isPending || cart.length === 0 || !clientCuit || cuitNoRegistrado || superaTopeCF}
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
