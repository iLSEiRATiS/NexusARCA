import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientService } from '../services/clientService';
import { currencyService } from '../services/currencyService';
import api from '../services/api';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, Plus, AlertTriangle, UserPlus, X } from 'lucide-react';

import { parseArgNumber } from '../utils/format';

interface CartItem {
  id: string;
  descripcion: string;
  cantidad: number | string;
  precio: number | string;
  moneda: 'USD' | 'ARS';
  iva_tasa: number | string;
  subtotal_usd: number;
}

const NewSalePage = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [fechaVtoPago, setFechaVtoPago] = useState('');
  const [clientCuit, setClientCuit] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [tipoComprobante, setTipoComprobante] = useState('Factura A');
  const [percepcionIIBB, setPercepcionIIBB] = useState<number | string>(0);
  const [percepcionIVA, setPercepcionIVA] = useState<number | string>(0);
  const [cobroInterno, setCobroInterno] = useState<number | string>(0);

  // Modal de Alta Rápida de Cliente
  const [isQuickClientModalOpen, setIsQuickClientModalOpen] = useState(false);
  const [quickClientForm, setQuickClientForm] = useState({
    razon_social: '',
    cuit: '',
    condicion_iva: 'RESPONSABLE_INSCRIPTO',
    direccion: '',
    telefono: '',
    email: ''
  });

  const { data: clients, isLoading: isLoadingClients } = useQuery({ 
    queryKey: ['clients'], 
    queryFn: clientService.getAll 
  });
  
  const { data: dolar } = useQuery({ 
    queryKey: ['dolar'], 
    queryFn: currencyService.getDolarOficial 
  });

  const quickCreateClientMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        cuit: data.cuit ? String(data.cuit).replace(/[-\s.]/g, '') : '',
        email: data.email ? data.email.trim() : null,
        direccion: data.direccion ? data.direccion.trim() : null,
        telefono: data.telefono ? data.telefono.trim() : null,
        saldo_blanco: 0,
        saldo_interno: 0
      };
      return clientService.create(payload);
    },
    onSuccess: (newClient) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setClientCuit(newClient.cuit);
      setIsQuickClientModalOpen(false);
      setShowClientDropdown(false);
      toast.success(`Cliente ${newClient.razon_social} registrado y seleccionado exitosamente`);
    },
    onError: (err: any) => {
      console.error('Error creating client:', err);
      const msg = err.response?.data?.message || err.message || 'Error al registrar cliente';
      toast.error(msg);
    }
  });

  const handleQuickClientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    quickCreateClientMutation.mutate(quickClientForm);
  };

  const cleanInputCuit = clientCuit.replace(/[-\s.]/g, '');
  const selectedClient = clients?.find((c: any) => {
    const cleanDbCuit = String(c.cuit || '').replace(/[-\s.]/g, '');
    return (cleanInputCuit && cleanDbCuit === cleanInputCuit) || c.cuit === clientCuit;
  });
  const filteredClients = clients?.filter((c: any) => {
    const cleanDbCuit = String(c.cuit || '').replace(/[-\s.]/g, '');
    return c.razon_social.toLowerCase().includes(clientCuit.toLowerCase()) || 
      (cleanInputCuit && cleanDbCuit.includes(cleanInputCuit)) ||
      c.cuit.includes(clientCuit);
  }) || [];
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

  const totalUsd = cart.reduce((acc, item) => acc + item.subtotal_usd, 0);
  const totalArs = totalUsd * cotizacion;
  
  const totalIvaArs = cart.reduce((acc, item) => acc + (item.subtotal_usd * cotizacion * (parseArgNumber(item.iva_tasa) / 100)), 0);
  
  const totalFactura = totalArs + totalIvaArs + parseArgNumber(percepcionIIBB) + parseArgNumber(percepcionIVA);

  // Warning de tope para Consumidor Final sin identificar
  const isConsumidorFinalSinCuit = selectedClient?.condicion_iva === 'CONSUMIDOR_FINAL' && (!selectedClient.cuit || selectedClient.cuit === '0');
  const superaTopeCF = isConsumidorFinalSinCuit && totalFactura >= 10000000;

  // CUIT ingresado pero no encontrado en la DB
  const cuitNoRegistrado = clientCuit.length >= 5 && !selectedClient;

  const updateItem = (id: string, field: keyof CartItem, value: any) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'cantidad' || field === 'precio' || field === 'moneda') {
          const priceInUsd = updated.moneda === 'USD' ? parseArgNumber(updated.precio) : parseArgNumber(updated.precio) / cotizacion;
          updated.subtotal_usd = parseArgNumber(updated.cantidad) * priceInUsd;
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
    mutationFn: async (payload: any) => {
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
            <p className="text-2xl font-black text-blue-600">${cotizacion.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
        <div className="lg:col-span-2 space-y-12">
          {/* CLIENTE */}
          <section className="bg-white border border-slate-200 p-8 shadow-sm relative group hover:border-blue-600 transition-all">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-all pointer-events-none overflow-hidden">
              <FileText size={100} />
            </div>
            <h2 className="text-[11px] font-black uppercase tracking-[0.3em] mb-8 text-slate-900 flex items-center gap-2">
              <span className="w-6 h-6 bg-slate-900 text-white flex items-center justify-center text-[10px]">01</span>
              Cliente (CUIT)
            </h2>
            <div className="relative">
              <input 
                type="text"
                placeholder="BUSQUE POR NOMBRE O INGRESE EL CUIT..."
                className="w-full bg-slate-50 border-b-2 border-slate-900 px-4 py-4 font-black text-slate-900 text-xl outline-none focus:border-blue-600 transition-all uppercase tracking-widest placeholder:text-slate-300 placeholder:text-sm placeholder:font-bold"
                value={clientCuit}
                onChange={(e) => {
                  setClientCuit(e.target.value);
                  setShowClientDropdown(true);
                }}
                onFocus={() => setShowClientDropdown(true)}
                onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
              />
              
              {showClientDropdown && !selectedClient && (
                <div className="absolute z-10 w-full bg-white border border-slate-200 mt-1 shadow-xl max-h-[300px] overflow-y-auto">
                  {filteredClients.length > 0 ? (
                    filteredClients.map((c: any) => (
                      <div 
                        key={c.id} 
                        className="p-4 border-b border-slate-100 hover:bg-slate-50 cursor-pointer flex justify-between items-center transition-colors"
                        onClick={() => { 
                          setClientCuit(c.cuit); 
                          setShowClientDropdown(false); 
                        }}
                      >
                        <span className="font-bold text-slate-900 text-sm">{c.razon_social}</span>
                        <span className="text-slate-500 text-xs font-mono bg-slate-100 px-2 py-1 rounded">{c.cuit}</span>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-slate-400 text-xs font-bold text-center">
                      NO SE ENCONTRARON CLIENTES
                    </div>
                  )}
                  <div 
                    className="p-4 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest cursor-pointer hover:bg-blue-600 transition-colors flex justify-center items-center gap-2"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      const isDigits = /^\d+$/.test(clientCuit.replace(/[-\s.]/g, ''));
                      setQuickClientForm({
                        razon_social: !isDigits ? clientCuit.toUpperCase() : '',
                        cuit: isDigits ? clientCuit : '',
                        condicion_iva: 'RESPONSABLE_INSCRIPTO',
                        direccion: '',
                        telefono: '',
                        email: ''
                      });
                      setIsQuickClientModalOpen(true);
                      setShowClientDropdown(false);
                    }}
                  >
                    <UserPlus size={14} /> + REGISTRAR CLIENTE EN ESTA PANTALLA
                  </div>
                </div>
              )}
            </div>
            
            {selectedClient ? (
              <div className="mt-6 flex flex-col sm:flex-row gap-4 sm:gap-8 text-[10px] font-bold uppercase tracking-widest border-t border-slate-100 pt-4">
                <span className="text-blue-600 font-black text-sm">{selectedClient.razon_social}</span>
                <span className="text-slate-400 self-end">Saldo Cartera: <span className={Number(selectedClient.saldo_deuda) < 0 ? 'text-red-600' : 'text-slate-900'}>${Math.abs(Number(selectedClient.saldo_deuda)).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></span>
              </div>
            ) : clientCuit ? (
              <div className="mt-6 p-4 bg-amber-50 border border-amber-300 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-amber-900 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                  <span>CLIENTE O CUIT NO REGISTRADO</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const isDigits = /^\d+$/.test(clientCuit.replace(/[-\s.]/g, ''));
                    setQuickClientForm({
                      razon_social: !isDigits ? clientCuit.toUpperCase() : '',
                      cuit: isDigits ? clientCuit : '',
                      condicion_iva: 'RESPONSABLE_INSCRIPTO',
                      direccion: '',
                      telefono: '',
                      email: ''
                    });
                    setIsQuickClientModalOpen(true);
                  }}
                  className="bg-slate-900 hover:bg-blue-600 text-white px-4 py-2 text-[9px] font-black uppercase tracking-widest transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <Plus size={12} /> Registrar Cliente Ahora
                </button>
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
                               type="text" 
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
                               type="text" 
                               value={item.precio || ''}
                               onChange={e => updateItem(item.id, 'precio', e.target.value)}
                               className="w-full bg-transparent border-b border-transparent focus:border-blue-600 outline-none text-right"
                             />
                           </td>
                           <td className="py-2 px-2">
                             <input 
                               type="text" 
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
                    <div className="flex-1 bg-slate-50 border border-slate-200 p-3 sm:p-4">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Percepción IIBB</p>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-bold">$</span>
                        <input 
                          type="text" 
                          value={percepcionIIBB || ''}
                          onChange={(e) => setPercepcionIIBB(e.target.value)}
                          className="w-full bg-transparent font-black text-slate-900 outline-none"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div className="flex-1 bg-slate-50 border border-slate-200 p-3 sm:p-4">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Percepción IVA</p>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-bold">$</span>
                        <input 
                          type="text" 
                          value={percepcionIVA || ''}
                          onChange={(e) => setPercepcionIVA(e.target.value)}
                          className="w-full bg-transparent font-black text-slate-900 outline-none"
                          placeholder="0.00"
                        />
                      </div>
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
                    <span className="text-slate-900">${cotizacion.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                 </div>
                 <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest mt-2">
                    <span className="text-slate-400">Subtotal ARS</span>
                    <span className="text-slate-900">${totalArs.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                 </div>
                 <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest mt-2">
                    <span className="text-slate-400">IVA ARS</span>
                    <span className="text-slate-900">${totalIvaArs.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                 </div>
                 <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest mt-2">
                    <span className="text-slate-400">Percepciones</span>
                    <span className="text-slate-900">${(parseArgNumber(percepcionIIBB) + parseArgNumber(percepcionIVA)).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                 </div>
                 <div className="pt-5 mt-5 border-t border-slate-200 flex justify-between items-center">
                     <span className="text-[11px] font-black uppercase tracking-widest text-slate-900">Total Factura</span>
                     <span className="text-3xl font-black text-blue-600 tracking-tighter">${totalFactura.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
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
            <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-900 border-b border-slate-100 pb-4">Resumen de Operación</h2>
            
            <div className="space-y-6 max-h-[45vh] overflow-y-auto pr-4 custom-scrollbar">
              {cart.map(item => (
                <div key={item.id} className="group border-b border-slate-50 pb-6 last:border-0 flex justify-between items-center">
                  <div className="min-w-0 pr-4">
                    <p className="font-black uppercase text-[10px] tracking-tight text-slate-900 mb-1 truncate">{item.descripcion}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">{item.cantidad} KG x {item.moneda === 'USD' ? 'U$D' : 'ARS'} {parseArgNumber(item.precio || 0).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-slate-900 text-sm">
                      {item.moneda === 'USD' ? 'U$D' : 'ARS'} {(parseArgNumber(item.cantidad) * parseArgNumber(item.precio || 0)).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </p>
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
              {/* Campo Cobro Interno */}
              {tipoComprobante !== 'Remito' && (
                <div className="bg-slate-900 p-4">
                  <label className="text-slate-400 font-bold uppercase tracking-widest text-[9px] mb-2 block">
                    Cobro Interno Registrado (Opcional)
                  </label>
                  <input
                    type="text"
                    value={cobroInterno || ''}
                    onChange={e => setCobroInterno(e.target.value)}
                    placeholder="0"
                    className="w-full bg-slate-800 border-b border-slate-600 text-white font-black text-lg px-3 py-2 outline-none focus:border-blue-400 transition-all"
                  />
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-[9px] font-black uppercase tracking-widest">
                      <span className="text-slate-400">✅ Oficial a AFIP:</span>
                      <span className="text-green-400">${Math.max(0, totalArs - parseArgNumber(cobroInterno)).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                    <div className="flex justify-between text-[9px] font-black uppercase tracking-widest">
                      <span className="text-slate-400">⬛ Interno:</span>
                      <span className="text-amber-400">${parseArgNumber(cobroInterno).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Subtotal (sin IVA) ARS</span>
                  <span className="text-lg font-black text-slate-900">${totalArs.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300 font-bold text-[9px] uppercase tracking-widest">Equivalente USD</span>
                  <span className="text-[10px] font-black text-slate-400">U$D {totalUsd.toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
              </div>
              
              <button 
                onClick={() => {
                  if(window.confirm('¿CONFIRMAR REGISTRO DE OPERACIÓN?')) {
                    const payload = {
                      cuit: selectedClient ? selectedClient.cuit : clientCuit.replace(/[-\s.]/g, ''),
                      client_id: selectedClient?.id,
                      items: cart.map(item => {
                        const precio_usd = item.moneda === 'USD' ? parseArgNumber(item.precio) : parseArgNumber(item.precio) / cotizacion;
                        
                        return {
                          descripcion: item.descripcion,
                          cantidad: parseArgNumber(item.cantidad),
                          precio_unitario_usd: precio_usd,
                          iva_tasa: parseArgNumber(item.iva_tasa)
                        };
                      }),
                      tipo_comprobante: tipoComprobante,
                      percepciones_iibb_ars: parseArgNumber(percepcionIIBB),
                      percepciones_iva_ars: parseArgNumber(percepcionIVA),
                      fecha_vto_pago: fechaVtoPago ? fechaVtoPago : undefined,
                      monto_interno: parseArgNumber(cobroInterno) > 0 ? parseArgNumber(cobroInterno) : undefined
                    };
                    createSaleMutation.mutate(payload);
                  }
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

      {/* MODAL ALTA RÁPIDA DE CLIENTE */}
      {isQuickClientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white border-2 border-slate-900 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="bg-slate-900 text-white p-6 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black uppercase tracking-widest">Alta Rápida de Cliente</h3>
                <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest mt-1">Registrar sin salir del facturador</p>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickClientModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleQuickClientSubmit} className="p-6 bg-slate-50 space-y-4">
              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                  Razón Social / Nombre Completo *
                </label>
                <input
                  required
                  type="text"
                  placeholder="EJ: DISTRIBUIDORA NORTE S.A."
                  value={quickClientForm.razon_social}
                  onChange={e => setQuickClientForm({ ...quickClientForm, razon_social: e.target.value })}
                  className="w-full bg-white border border-slate-200 p-3 font-bold text-slate-900 uppercase focus:border-blue-600 outline-none text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                    CUIT o DNI *
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="20-12345678-9 o DNI"
                    value={quickClientForm.cuit}
                    onChange={e => setQuickClientForm({ ...quickClientForm, cuit: e.target.value })}
                    className="w-full bg-white border border-slate-200 p-3 font-bold text-slate-900 focus:border-blue-600 outline-none text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                    Condición IVA *
                  </label>
                  <select
                    value={quickClientForm.condicion_iva}
                    onChange={e => setQuickClientForm({ ...quickClientForm, condicion_iva: e.target.value })}
                    className="w-full bg-white border border-slate-200 p-3 font-bold text-slate-900 focus:border-blue-600 outline-none text-xs"
                  >
                    <option value="RESPONSABLE_INSCRIPTO">Responsable Inscripto</option>
                    <option value="MONOTRIBUTO">Monotributo</option>
                    <option value="CONSUMIDOR_FINAL">Consumidor Final</option>
                    <option value="EXENTO">Exento</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                  Dirección Fiscal (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Calle, Número, Localidad"
                  value={quickClientForm.direccion}
                  onChange={e => setQuickClientForm({ ...quickClientForm, direccion: e.target.value })}
                  className="w-full bg-white border border-slate-200 p-3 font-bold text-slate-900 focus:border-blue-600 outline-none text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                    Teléfono (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="011-12345678"
                    value={quickClientForm.telefono}
                    onChange={e => setQuickClientForm({ ...quickClientForm, telefono: e.target.value })}
                    className="w-full bg-white border border-slate-200 p-3 font-bold text-slate-900 focus:border-blue-600 outline-none text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                    Email (Opcional)
                  </label>
                  <input
                    type="email"
                    placeholder="contacto@cliente.com"
                    value={quickClientForm.email}
                    onChange={e => setQuickClientForm({ ...quickClientForm, email: e.target.value })}
                    className="w-full bg-white border border-slate-200 p-3 font-bold text-slate-900 focus:border-blue-600 outline-none text-xs"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsQuickClientModalOpen(false)}
                  className="w-1/3 py-3 font-bold text-[10px] uppercase text-slate-400 hover:text-slate-600 tracking-widest"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={quickCreateClientMutation.isPending}
                  className="w-2/3 bg-blue-600 hover:bg-blue-700 text-white py-3 font-black text-[10px] uppercase tracking-widest transition-all disabled:bg-slate-300 shadow-md"
                >
                  {quickCreateClientMutation.isPending ? 'Guardando...' : 'Guardar y Seleccionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewSalePage;
