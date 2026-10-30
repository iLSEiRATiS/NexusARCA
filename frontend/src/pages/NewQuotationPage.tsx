import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  ArrowRight,
  Upload, 
  DollarSign, 
  Check, 
  User, 
  ShoppingCart, 
  Loader2,
  FileCheck2
} from 'lucide-react';

import { clientService } from '../services/clientService';
import { currencyService } from '../services/currencyService';
import { quotationService } from '../services/quotationService';
import { parseArgNumber } from '../utils/format';
import { SaleCartTable, type CartItem } from '../components/sales/SaleCartTable';

const NewQuotationPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const validezDias = 0;

  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: clientService.getAll });
  const { data: dolar } = useQuery({ queryKey: ['dolar'], queryFn: currencyService.getDolarOficial });

  const cotizacion = Number(dolar || 1);

  const totalUsd = cart.reduce((acc, item) => acc + item.subtotal_usd, 0);
  const totalArs = totalUsd * cotizacion;
  const totalIvaArs = cart.reduce((acc, item) => acc + (item.subtotal_usd * cotizacion * (parseArgNumber(item.iva_tasa) / 100)), 0);
  const totalFactura = totalArs + totalIvaArs;

  const selectedClient = clients?.find((c: any) => c.id === selectedClientId);

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
          setSelectedClientId(matched.id);
          toast.info(`Cliente autodetectado: ${matched.razon_social}`);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const createQuotationMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        client_id: selectedClientId!,
        items: cart.map(item => {
          const precio_usd = item.moneda === 'USD' ? parseArgNumber(item.precio) : parseArgNumber(item.precio) / cotizacion;
          return { 
            descripcion: item.descripcion,
            cantidad: parseArgNumber(item.cantidad),
            precio_unitario_usd: precio_usd,
            iva_tasa: parseArgNumber(item.iva_tasa)
          };
        }),
        validez_dias: validezDias
      };
      return quotationService.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      toast.success('PRESUPUESTO GENERADO EXITOSAMENTE');
      navigate('/cotizaciones');
    },
    onError: (err: any) => {
      toast.error('Error al generar presupuesto: ' + (err.response?.data?.message || err.message));
    }
  });

  return (
    <div className="animate-fade-in max-w-[1400px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-2 border-slate-900 pb-6">
        <div>
          <Link 
            to="/cotizaciones"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 uppercase tracking-wider mb-2 transition-colors"
          >
            <ArrowLeft size={14} /> Volver a Presupuestos
          </Link>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight uppercase">
            Nueva Cotización
          </h1>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">
            Asistente para la emisión de presupuestos comerciales
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-3 bg-white border border-slate-200 px-4 py-2.5 rounded-sm shadow-sm">
          {[
            { num: 1, label: 'Cliente', icon: User },
            { num: 2, label: 'Artículos y Emisión', icon: ShoppingCart },
          ].map(({ num, label, icon: Icon }) => (
            <div key={num} className="flex items-center gap-2">
              <div 
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-black uppercase tracking-wider transition-all ${
                  step === num 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : step > num 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : 'text-slate-400 bg-slate-50'
                }`}
              >
                {step > num ? <Check size={12} /> : <Icon size={12} />}
                <span>{label}</span>
              </div>
              {num < 2 && <div className="w-4 h-[1px] bg-slate-200"></div>}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-6">
          {/* STEP 1: CLIENT SELECTION */}
          {step === 1 && (
            <div className="bg-white p-6 sm:p-8 border border-slate-200 rounded-sm shadow-sm animate-fade-in space-y-6">
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <span className="w-5 h-5 bg-slate-900 text-white rounded flex items-center justify-center text-[10px] font-black">
                  01
                </span>
                Seleccionar Cliente Destinatario
              </h2>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  Cliente Registrado
                </label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-sm px-4 py-3.5 font-bold text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all text-sm uppercase tracking-wider cursor-pointer"
                  value={selectedClientId || ''}
                  onChange={(e) => setSelectedClientId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">-- SELECCIONAR CLIENTE --</option>
                  {clients?.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.razon_social} — CUIT: {c.cuit} ({c.condicion_iva?.replace(/_/g, ' ')})
                    </option>
                  ))}
                </select>
              </div>

              {selectedClient && (
                <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-sm flex justify-between items-center">
                  <div>
                    <p className="font-bold text-slate-900 text-sm uppercase">{selectedClient.razon_social}</p>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">CUIT: {selectedClient.cuit} · {selectedClient.condicion_iva?.replace(/_/g, ' ')}</p>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-700 bg-white px-2.5 py-1 rounded border border-blue-100">
                    ID #{selectedClient.id}
                  </span>
                </div>
              )}

              <div className="pt-4 flex justify-end border-t border-slate-100">
                <button 
                  type="button"
                  disabled={!selectedClientId} 
                  onClick={() => setStep(2)} 
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 font-black text-xs uppercase tracking-widest rounded-sm transition-all disabled:bg-slate-200 disabled:text-slate-400 flex items-center justify-center gap-2 shadow-sm"
                >
                  <span>Continuar a Artículos</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: ITEMS */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-in">
              {/* CSV Upload bar */}
              <div className="bg-white border border-slate-200 p-4 rounded-sm shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Artículos para <strong className="text-blue-600">{selectedClient?.razon_social}</strong>
                </div>
                <label className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 cursor-pointer transition-all font-black text-[10px] uppercase tracking-widest rounded-sm flex items-center gap-1.5 shrink-0">
                  <Upload size={14} /> Importar CSV
                  <input type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />
                </label>
              </div>

              {/* Items Cart */}
              <SaleCartTable 
                cart={cart}
                cotizacion={cotizacion}
                onUpdateItem={updateItem}
                onRemoveItem={removeItem}
                onAddManualItem={addManualItem}
              />

              <div className="flex justify-between items-center gap-4 pt-2">
                <button 
                  type="button"
                  onClick={() => setStep(1)} 
                  className="px-6 py-3 font-bold text-xs uppercase text-slate-500 hover:text-slate-800 tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ArrowLeft size={14} /> Volver a Cliente
                </button>
                <button 
                  type="button"
                  onClick={() => createQuotationMutation.mutate()}
                  disabled={createQuotationMutation.isPending || cart.length === 0}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 font-black text-xs uppercase tracking-widest rounded-sm transition-all disabled:bg-slate-200 disabled:text-slate-400 flex items-center gap-2 shadow-lg shadow-blue-500/20 cursor-pointer"
                >
                  {createQuotationMutation.isPending ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      <span>Emitiendo...</span>
                    </>
                  ) : (
                    <span>Generar Presupuesto Final</span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* SIDEBAR SUMMARY */}
        <div>
          <section className="bg-white p-6 sm:p-8 border border-slate-900 rounded-sm shadow-xl sticky top-24 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center gap-1.5">
                <FileCheck2 size={16} className="text-blue-600" /> Resumen de Presupuesto
              </h2>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {cart.length} ítems
              </span>
            </div>

            <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
              {cart.map(item => (
                <div key={item.id} className="flex justify-between items-start border-b border-slate-100 pb-2.5 last:border-0 text-xs">
                  <div className="min-w-0 pr-3">
                    <p className="font-bold uppercase text-[11px] text-slate-900 truncate">{item.descripcion}</p>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">
                      {item.cantidad} KG x {item.moneda === 'USD' ? 'U$D' : 'ARS'} {parseArgNumber(item.precio || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <p className="font-mono font-bold text-slate-900 text-xs">
                      {item.moneda === 'USD' ? 'U$D' : 'ARS'} {(parseArgNumber(item.cantidad) * parseArgNumber(item.precio || 0)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              ))}
              {cart.length === 0 && (
                <p className="text-center py-12 text-slate-300 font-bold uppercase text-xs tracking-wider border-2 border-dashed border-slate-100 rounded">
                  Sin artículos cargados
                </p>
              )}
            </div>

            <div className="space-y-4 pt-4 border-t-2 border-slate-900">
              <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider">
                <span className="text-slate-400 flex items-center gap-1">
                  <DollarSign size={12} /> Base USD
                </span>
                <span className="font-mono font-black text-slate-900">
                  U$D {totalUsd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="bg-slate-900 p-6 rounded-sm text-white text-center shadow-lg">
                <span className="text-slate-400 font-bold text-[9px] uppercase tracking-widest block mb-1">
                  TOTAL ESTIMADO ARS (IVA INC.)
                </span>
                <p className="text-3xl font-black font-mono tracking-tight text-white">
                  ${totalFactura.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default NewQuotationPage;
