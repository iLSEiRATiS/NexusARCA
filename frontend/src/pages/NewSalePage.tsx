import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  Upload, 
  ArrowLeft, 
  AlertTriangle, 
  Calendar, 
  Percent, 
  DollarSign, 
  FileCheck2,
  Loader2
} from 'lucide-react';

import { clientService } from '../services/clientService';
import { currencyService } from '../services/currencyService';
import api from '../services/api';
import { parseArgNumber } from '../utils/format';
import { SaleCartTable, type CartItem } from '../components/sales/SaleCartTable';
import { ClientSearchInput } from '../components/sales/ClientSearchInput';
import { QuickClientModal } from '../components/sales/QuickClientModal';

const NewSalePage = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [fechaVtoPago, setFechaVtoPago] = useState('');
  const [clientCuit, setClientCuit] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);

  const [tipoComprobante, setTipoComprobante] = useState('Factura A');
  const [percepcionIIBB, setPercepcionIIBB] = useState<number | string>(0);
  const [percepcionIVA, setPercepcionIVA] = useState<number | string>(0);
  const [cobroInterno, setCobroInterno] = useState<number | string>(0);

  // Quick Client Modal state
  const [isQuickClientModalOpen, setIsQuickClientModalOpen] = useState(false);

  const { data: clients, isLoading: isLoadingClients } = useQuery({ 
    queryKey: ['clients'], 
    queryFn: clientService.getAll 
  });
  
  const { data: dolar } = useQuery({ 
    queryKey: ['dolar'], 
    queryFn: currencyService.getDolarOficial 
  });

  const cotizacion = Number(dolar || 1);

  // Client search logic
  const cleanInputCuit = clientCuit.replace(/[-\s.]/g, '');
  const selectedClient = clients?.find((c: any) => {
    const cleanDbCuit = String(c.cuit || '').replace(/[-\s.]/g, '');
    return (cleanInputCuit && cleanDbCuit === cleanInputCuit) || c.cuit === clientCuit;
  });

  const filteredClients = useMemo(() => {
    if (!clients) return [];
    return clients.filter((c: any) => {
      const cleanDbCuit = String(c.cuit || '').replace(/[-\s.]/g, '');
      return (
        c.razon_social.toLowerCase().includes(clientCuit.toLowerCase()) || 
        (cleanInputCuit && cleanDbCuit.includes(cleanInputCuit)) ||
        c.cuit.includes(clientCuit)
      );
    });
  }, [clients, clientCuit, cleanInputCuit]);

  useEffect(() => {
    if (selectedClient) {
      if (['RESPONSABLE_INSCRIPTO', 'MONOTRIBUTO'].includes(selectedClient.condicion_iva)) {
        setTipoComprobante('Factura A');
      } else {
        setTipoComprobante('Factura B');
      }
    }
  }, [selectedClient]);

  const isFacturaADisabled = selectedClient && !['RESPONSABLE_INSCRIPTO', 'MONOTRIBUTO'].includes(selectedClient.condicion_iva);
  const isFacturaBDisabled = selectedClient && ['RESPONSABLE_INSCRIPTO', 'MONOTRIBUTO'].includes(selectedClient.condicion_iva);

  // Totals calculations
  const totalUsd = cart.reduce((acc, item) => acc + item.subtotal_usd, 0);
  const totalArs = totalUsd * cotizacion; // Subtotal neto original
  const totalIvaArs = cart.reduce((acc, item) => acc + (item.subtotal_usd * cotizacion * (parseArgNumber(item.iva_tasa) / 100)), 0);
  const percepcionesTotal = parseArgNumber(percepcionIIBB) + parseArgNumber(percepcionIVA);

  // Cobro interno / Split calculation (descontado del subtotal neto original)
  const cobroInternoNum = parseArgNumber(cobroInterno);
  const tieneCobroInterno = cobroInternoNum > 0 && tipoComprobante !== 'Remito';

  // Si hay cobro interno, se descuenta del NETO original
  const netoInterno = tieneCobroInterno ? Math.min(cobroInternoNum, totalArs) : 0;
  const netoOficial = tieneCobroInterno ? Math.max(0, totalArs - netoInterno) : totalArs;
  const ratioOficial = (totalArs > 0 && tieneCobroInterno) ? (netoOficial / totalArs) : 1;
  const ivaOficial = tipoComprobante === 'Remito' ? 0 : (totalIvaArs * ratioOficial);

  // Factura Oficial ARCA (lo que va a AFIP y CAE)
  const totalFacturaOficial = netoOficial + ivaOficial + percepcionesTotal;
  // Factura Remito / Gestión Comercial (lo que queda interno sin IVA)
  const totalRemitoInterno = netoInterno;
  // Total real de la operación (suma de oficial + interno)
  const totalOperacion = totalFacturaOficial + totalRemitoInterno;

  // Warning de tope para Consumidor Final sin identificar
  const isConsumidorFinalSinCuit = selectedClient?.condicion_iva === 'CONSUMIDOR_FINAL' && (!selectedClient.cuit || selectedClient.cuit === '0');
  const superaTopeCF = isConsumidorFinalSinCuit && totalFacturaOficial >= 10000000;
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
      id: Math.random().toString(36).substring(2, 9),
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
          id: Math.random().toString(36).substring(2, 9),
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
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      const sale = res.data;
      if (sale.cae) {
        toast.success(`FACTURA ${sale.tipo_comprobante} N° ${sale.nro_comprobante} AUTORIZADA POR ARCA (CAE: ${sale.cae})`, { duration: 6000 });
      } else {
        toast.success('OPERACIÓN REGISTRADA EXITOSAMENTE');
      }
      if (sale.remito_interno) {
        toast.info(`REMITO / GESTIÓN COMERCIAL N° ${sale.remito_interno.nro_comprobante} GENERADO POR $${Number(sale.remito_interno.total_real_ars).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, { duration: 6000 });
      }
      navigate('/facturacion');
    },
    onError: (err: any) => {
      toast.error('ERROR AL EMITIR: ' + (err.response?.data?.message || err.message), { duration: 8000 });
    }
  });

  const handleConfirmSale = () => {
    if (window.confirm('¿CONFIRMAR REGISTRO Y EMISIÓN DE OPERACIÓN?')) {
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
  };

  if (isLoadingClients) {
    return (
      <div className="p-16 text-center">
        <Loader2 className="animate-spin text-blue-600 inline-block mb-3" size={32} />
        <p className="font-bold uppercase tracking-widest text-xs text-slate-400">Cargando datos de clientes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-2 border-slate-900 pb-6 gap-4">
        <div>
          <Link 
            to="/facturacion"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 uppercase tracking-wider mb-2 transition-colors"
          >
            <ArrowLeft size={14} /> Volver a Facturación
          </Link>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight text-slate-900">
            Nueva Operación
          </h1>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">
            Carga de movimiento manual o importación de tirada CSV
          </p>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto justify-end">
          <label className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 cursor-pointer transition-all font-black text-xs uppercase tracking-widest rounded-sm flex items-center gap-2 shadow-sm">
            <Upload size={16} /> CARGAR CSV
            <input type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />
          </label>

          <div className="text-right hidden sm:block bg-blue-50/70 border border-blue-200 px-4 py-2 rounded-sm">
            <p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest flex items-center justify-end gap-1">
              <DollarSign size={10} /> Dólar BNA
            </p>
            <p className="text-xl font-mono font-black text-slate-900">
              ${cotizacion.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* STEP 1: CLIENT SELECTOR */}
          <ClientSearchInput 
            clientCuit={clientCuit}
            onClientCuitChange={setClientCuit}
            selectedClient={selectedClient}
            filteredClients={filteredClients}
            onSelectClient={(c) => setClientCuit(c.cuit)}
            onOpenQuickRegister={() => setIsQuickClientModalOpen(true)}
          />

          {/* STEP 2: CART ITEMS */}
          <SaleCartTable 
            cart={cart}
            cotizacion={cotizacion}
            onUpdateItem={updateItem}
            onRemoveItem={removeItem}
            onAddManualItem={addManualItem}
          />

          {/* STEP 3: COMPROBANTE CONFIGURATION */}
          <section className="bg-white border border-slate-200 p-6 sm:p-8 rounded-sm shadow-sm space-y-6">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
              <span className="w-5 h-5 bg-slate-900 text-white rounded flex items-center justify-center text-[10px] font-black">
                03
              </span>
              Tipo de Comprobante e Impuestos
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Type selector & Perceptions */}
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5">
                    Modalidad Fiscal
                  </label>
                  <div className="flex gap-2">
                    {['Factura A', 'Factura B', 'Remito'].map(t => {
                      const disabled = 
                        (t === 'Factura A' && isFacturaADisabled) ||
                        (t === 'Factura B' && isFacturaBDisabled);
                      return (
                        <button 
                          key={t} 
                          type="button"
                          onClick={() => !disabled && setTipoComprobante(t)} 
                          disabled={!!disabled}
                          className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-sm border transition-all ${
                            disabled 
                              ? 'border-slate-100 text-slate-300 bg-slate-50 cursor-not-allowed'
                              : tipoComprobante === t 
                                ? 'bg-slate-900 border-slate-900 text-white shadow-md' 
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900'
                          }`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                  {selectedClient && (
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-2">
                      Condición fiscal: {selectedClient.condicion_iva?.replace(/_/g, ' ')}
                    </p>
                  )}
                </div>

                {tipoComprobante.includes('Factura') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-sm">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                        <Percent size={10} /> Percepción IIBB
                      </p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 font-bold text-xs">$</span>
                        <input 
                          type="text" 
                          value={percepcionIIBB || ''}
                          onChange={(e) => setPercepcionIIBB(e.target.value)}
                          className="w-full bg-transparent font-mono font-bold text-slate-900 outline-none text-sm"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-sm">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                        <Percent size={10} /> Percepción IVA
                      </p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 font-bold text-xs">$</span>
                        <input 
                          type="text" 
                          value={percepcionIVA || ''}
                          onChange={(e) => setPercepcionIVA(e.target.value)}
                          className="w-full bg-transparent font-mono font-bold text-slate-900 outline-none text-sm"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Calendar size={12} /> Vencimiento para el Pago (Opcional)
                  </label>
                  <input 
                    type="date"
                    className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-blue-600 rounded-sm transition-all"
                    value={fechaVtoPago}
                    onChange={(e) => setFechaVtoPago(e.target.value)}
                  />
                </div>
              </div>

              {/* Tax calculation box */}
              <div className="bg-slate-50 border border-slate-200 p-6 rounded-sm flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider">
                    <span className="text-slate-500">Cotización Usada</span>
                    <span className="font-mono text-slate-900">${cotizacion.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider">
                    <span className="text-slate-500">Subtotal Neto ARS</span>
                    <span className="font-mono text-slate-900">${totalArs.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  {tieneCobroInterno && (
                    <>
                      <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-50/80 px-2.5 py-1.5 rounded">
                        <span>Cobro Interno (Remito)</span>
                        <span className="font-mono">-${totalRemitoInterno.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50/80 px-2.5 py-1.5 rounded">
                        <span>Neto Facturable ARCA</span>
                        <span className="font-mono">${netoOficial.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider">
                    <span className="text-slate-500">Total IVA ARS {tieneCobroInterno ? '(Oficial)' : ''}</span>
                    <span className="font-mono text-slate-900">${ivaOficial.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider">
                    <span className="text-slate-500">Percepciones</span>
                    <span className="font-mono text-slate-900">${percepcionesTotal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-900">
                      {tieneCobroInterno ? 'Oficial ARCA c/IVA' : 'Total Factura'}
                    </span>
                    <span className="text-2xl font-black font-mono text-blue-600 tracking-tight">
                      ${totalFacturaOficial.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  {tieneCobroInterno && (
                    <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-slate-500 pt-1.5 border-t border-dashed border-slate-200">
                      <span>Total Operación (+ Remito)</span>
                      <span className="font-mono font-black text-slate-900">${totalOperacion.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                </div>

                {superaTopeCF && (
                  <div className="mt-4 bg-amber-100/70 border border-amber-300 p-3.5 rounded-sm flex items-start gap-2.5">
                    <AlertTriangle className="text-amber-700 shrink-0 mt-0.5" size={16} />
                    <div>
                      <p className="text-[10px] font-black text-amber-900 uppercase tracking-wider">Tope CF Superado</p>
                      <p className="text-[9px] font-medium text-amber-800 leading-tight mt-0.5">
                        El monto supera el límite para Consumidor Final sin identificar. AFIP rechazará el comprobante.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* OPERATION SUMMARY SIDEBAR */}
        <div className="lg:pl-2">
          <section className="sticky top-24 space-y-6 bg-white border border-slate-900 p-6 sm:p-8 rounded-sm shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center gap-1.5">
                <FileCheck2 size={16} className="text-blue-600" /> Resumen de Operación
              </h2>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {cart.length} ítems
              </span>
            </div>
            
            {/* Items list */}
            <div className="space-y-4 max-h-[38vh] overflow-y-auto pr-2 custom-scrollbar">
              {cart.map(item => (
                <div key={item.id} className="border-b border-slate-100 pb-3 last:border-0 flex justify-between items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold uppercase text-[11px] text-slate-900 truncate">{item.descripcion}</p>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">
                      {item.cantidad} KG x {item.moneda === 'USD' ? 'U$D' : 'ARS'} {parseArgNumber(item.precio || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-slate-900 text-xs">
                      {item.moneda === 'USD' ? 'U$D' : 'ARS'} {(parseArgNumber(item.cantidad) * parseArgNumber(item.precio || 0)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              ))}
              {cart.length === 0 && (
                <div className="text-slate-300 font-bold text-xs uppercase tracking-widest text-center py-16 border-2 border-dashed border-slate-100 rounded">
                  Sin artículos cargados
                </div>
              )}
            </div>

            {/* Split / Cobro Interno */}
            <div className="space-y-5 pt-4 border-t-2 border-slate-900">
              {tipoComprobante !== 'Remito' && (
                <div className="bg-slate-900 p-4 rounded-sm">
                  <label className="text-slate-300 font-bold uppercase tracking-widest text-[9px] mb-1.5 block">
                    Cobro Interno Registrado (Opcional)
                  </label>
                  <input
                    type="text"
                    value={cobroInterno || ''}
                    onChange={e => setCobroInterno(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-800 border-b border-slate-700 text-white font-mono font-black text-base px-3 py-1.5 outline-none focus:border-blue-400 rounded-sm transition-all"
                  />
                  <div className="mt-2.5 space-y-1">
                    <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider">
                      <span className="text-slate-400">Oficial AFIP (c/IVA):</span>
                      <span className="text-emerald-400 font-mono">${totalFacturaOficial.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider">
                      <span className="text-slate-400">Remito Interno (s/IVA):</span>
                      <span className="text-amber-400 font-mono">${totalRemitoInterno.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    {tieneCobroInterno && (
                      <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider pt-1.5 border-t border-slate-800">
                        <span className="text-slate-300">Total Operación:</span>
                        <span className="text-white font-mono font-bold">${totalOperacion.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Subtotal figures */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">Subtotal Neto ARS</span>
                  <span className="text-base font-mono font-black text-slate-900">
                    ${totalArs.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider">Equivalente USD</span>
                  <span className="text-xs font-mono font-bold text-slate-500">
                    U$D {totalUsd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              
              <button 
                type="button"
                onClick={handleConfirmSale}
                disabled={createSaleMutation.isPending || cart.length === 0 || !clientCuit || cuitNoRegistrado || superaTopeCF}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 font-black text-xs uppercase tracking-widest rounded-sm transition-all disabled:bg-slate-200 disabled:text-slate-400 shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
              >
                {createSaleMutation.isPending ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    <span>Procesando...</span>
                  </>
                ) : (
                  <span>Confirmar Operación</span>
                )}
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* QUICK CLIENT MODAL */}
      <QuickClientModal 
        isOpen={isQuickClientModalOpen}
        initialQuery={clientCuit}
        onClose={() => setIsQuickClientModalOpen(false)}
        onClientCreated={(newClient) => {
          setClientCuit(newClient.cuit);
        }}
      />
    </div>
  );
};

export default NewSalePage;
