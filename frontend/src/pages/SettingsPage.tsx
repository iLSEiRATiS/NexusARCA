import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { toast } from 'sonner';
import { 
  ShieldCheck, 
  ShieldOff, 
  Save, 
  AlertTriangle, 
  Building2, 
  Receipt, 
  FileKey, 
  Upload, 
  Loader2,
  Calendar,
  MapPin,
  Clock
} from 'lucide-react';

interface SystemConfig {
  id: number;
  razon_social: string;
  cuit_emisor: string;
  domicilio_fiscal: string;
  condicion_iva_emisor: string;
  inicio_actividades: string;
  punto_venta: number;
  modo_produccion: boolean;
  cotizacion_dolar_actual: number;
  updatedAt: string;
  cert_file?: string | ArrayBuffer | null;
  key_file?: string | ArrayBuffer | null;
}

const fetchConfig = async (): Promise<SystemConfig> => {
  const res = await api.get('/config');
  return res.data;
};

const SettingsPage = () => {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['config'],
    queryFn: fetchConfig,
  });

  const [form, setForm] = useState<Partial<SystemConfig>>({});
  const [certFileName, setCertFileName] = useState<string>('');
  const [keyFileName, setKeyFileName] = useState<string>('');

  useEffect(() => {
    if (config) setForm(config);
  }, [config]);

  const set = (key: keyof SystemConfig, value: any) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        razon_social:         form.razon_social,
        cuit_emisor:          form.cuit_emisor,
        domicilio_fiscal:     form.domicilio_fiscal,
        condicion_iva_emisor: form.condicion_iva_emisor,
        inicio_actividades:   form.inicio_actividades,
        punto_venta:          Number(form.punto_venta),
        modo_produccion:      form.modo_produccion,
      };
      const res = await api.put('/config', payload);
      return res.data;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      
      if ((form as any).cert_file && (form as any).key_file) {
        try {
          await api.post('/config/certificates', {
            cert: (form as any).cert_file,
            key: (form as any).key_file,
            isTest: !form.modo_produccion
          });
          toast.success('Configuración y certificados guardados correctamente.');
        } catch (err: any) {
          toast.error('Configuración guardada, pero hubo un error al subir los certificados: ' + (err.response?.data?.message || err.message));
        }
      } else {
        toast.success('Configuración guardada correctamente.');
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al guardar la configuración.');
    },
  });

  if (isLoading) {
    return (
      <div className="p-16 text-center">
        <Loader2 className="animate-spin text-blue-600 inline-block mb-3" size={32} />
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
          Cargando configuración del emisor...
        </p>
      </div>
    );
  }

  const isConfigured =
    form.razon_social !== 'EMISOR SIN CONFIGURAR' &&
    form.cuit_emisor !== '00-00000000-0' &&
    Boolean(form.domicilio_fiscal);

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-2 border-slate-900 pb-6 gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight text-slate-900">
            Configuración Fiscal
          </h1>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">
            Datos del emisor, credenciales ARCA / AFIP y punto de venta
          </p>
        </div>

        <div className="flex items-center gap-3">
          {form.modo_produccion ? (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3.5 py-2 rounded-sm shadow-xs">
              <ShieldCheck size={16} className="text-emerald-600" />
              <div>
                <p className="text-emerald-800 font-black text-[10px] uppercase tracking-wider leading-none">
                  Modo Producción
                </p>
                <p className="text-emerald-600 font-semibold text-[8px] uppercase tracking-widest mt-0.5">
                  Facturación real AFIP
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3.5 py-2 rounded-sm shadow-xs">
              <ShieldOff size={16} className="text-amber-600" />
              <div>
                <p className="text-amber-800 font-black text-[10px] uppercase tracking-wider leading-none">
                  Modo Homologación
                </p>
                <p className="text-amber-600 font-semibold text-[8px] uppercase tracking-widest mt-0.5">
                  Ambiente de pruebas
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Warning if not configured */}
      {!isConfigured && (
        <div className="flex items-start gap-4 bg-amber-50 border border-amber-200 p-5 rounded-sm shadow-xs">
          <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-black text-amber-900 text-xs uppercase tracking-wide">
              Datos del emisor incompletos o sin configurar
            </p>
            <p className="text-amber-800 text-xs font-medium mt-1 leading-relaxed">
              Complete los datos a continuación para que aparezcan correctamente en los comprobantes fiscales y remitos emitidos.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ── DATOS DEL EMISOR ──────────────────────────────── */}
        <section className="bg-white border border-slate-200 p-6 sm:p-8 rounded-sm shadow-sm space-y-6">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-200">
            <Building2 size={16} className="text-blue-600" />
            Datos de la Razón Social Emisora
          </h2>

          <div className="space-y-5">
            {/* Razón Social */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                Razón Social (exacta según constancia AFIP)
              </label>
              <input
                type="text"
                value={form.razon_social || ''}
                onChange={e => set('razon_social', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3.5 py-2.5 font-bold text-slate-900 text-xs outline-none focus:border-blue-600 focus:bg-white transition-all uppercase"
                placeholder="MÁSCOLO OSCAR CARMELO"
              />
            </div>

            {/* CUIT */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                CUIT del Emisor (XX-XXXXXXXX-X)
              </label>
              <input
                type="text"
                value={form.cuit_emisor || ''}
                onChange={e => set('cuit_emisor', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3.5 py-2.5 font-mono font-bold text-slate-900 text-xs outline-none focus:border-blue-600 focus:bg-white transition-all tracking-wider"
                placeholder="20-12345678-9"
                maxLength={13}
              />
            </div>

            {/* Domicilio Fiscal */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                <MapPin size={11} /> Domicilio Fiscal Completo
              </label>
              <input
                type="text"
                value={form.domicilio_fiscal || ''}
                onChange={e => set('domicilio_fiscal', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3.5 py-2.5 font-bold text-slate-900 text-xs outline-none focus:border-blue-600 focus:bg-white transition-all uppercase"
                placeholder="CALLE 1234, LOCALIDAD, PROVINCIA"
              />
            </div>

            {/* Condición IVA */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                Condición frente al IVA
              </label>
              <select
                value={form.condicion_iva_emisor || 'Responsable Inscripto'}
                onChange={e => set('condicion_iva_emisor', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3.5 py-2.5 font-bold text-slate-900 text-xs outline-none focus:border-blue-600 focus:bg-white transition-all cursor-pointer"
              >
                <option value="Responsable Inscripto">Responsable Inscripto</option>
                <option value="Monotributo">Monotributo</option>
                <option value="Exento">Exento</option>
              </select>
            </div>

            {/* Inicio de Actividades */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                <Calendar size={11} /> Fecha de Inicio de Actividades (DD/MM/AAAA)
              </label>
              <input
                type="text"
                value={form.inicio_actividades || ''}
                onChange={e => set('inicio_actividades', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3.5 py-2.5 font-mono font-bold text-slate-900 text-xs outline-none focus:border-blue-600 focus:bg-white transition-all tracking-wider"
                placeholder="01/01/2000"
                maxLength={10}
              />
            </div>
          </div>
        </section>

        {/* ── PARÁMETROS ARCA ────────────────────────────── */}
        <section className="bg-white border border-slate-200 p-6 sm:p-8 rounded-sm shadow-sm space-y-6">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-200">
            <Receipt size={16} className="text-blue-600" />
            Parámetros de Facturación Electrónica ARCA
          </h2>

          <div className="space-y-6">
            {/* Punto de Venta */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                Punto de Venta Habilitado (Web Services)
              </label>
              <div className="relative w-40">
                <input
                  type="number"
                  min={1}
                  max={9999}
                  value={form.punto_venta ?? 1}
                  onChange={e => set('punto_venta', parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3.5 py-2.5 font-mono font-black text-slate-900 text-xl outline-none focus:border-blue-600 focus:bg-white transition-all text-center"
                />
              </div>
              <p className="text-[10px] text-slate-400 font-semibold mt-1.5">
                Debe coincidir con el punto de venta de tipo "Facturación Electrónica" en la web de AFIP.
              </p>
            </div>

            {/* Modo Producción / Homologación */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5">
                Entorno de Operación AFIP
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    set('modo_produccion', false);
                    set('cert_file', null);
                    set('key_file', null);
                    setCertFileName('');
                    setKeyFileName('');
                  }}
                  className={`p-4 rounded-sm border-2 transition-all text-left flex items-start gap-3 ${
                    !form.modo_produccion
                      ? 'border-amber-500 bg-amber-50/70 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className={`p-2 rounded ${!form.modo_produccion ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    <ShieldOff size={20} />
                  </div>
                  <div>
                    <p className={`font-black text-xs uppercase tracking-tight ${!form.modo_produccion ? 'text-amber-900' : 'text-slate-800'}`}>
                      Homologación
                    </p>
                    <p className="text-[9px] font-medium text-slate-500 uppercase tracking-wider mt-0.5">
                      Pruebas sin valor fiscal
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('⚠️ ¿Confirmar cambio a PRODUCCIÓN?\n\nA partir de este momento todas las facturas emitidas tendrán validez fiscal real ante AFIP/ARCA.\n\nAsegúrese de que los datos del emisor sean los correctos.')) {
                      set('modo_produccion', true);
                      set('cert_file', null);
                      set('key_file', null);
                      setCertFileName('');
                      setKeyFileName('');
                    }
                  }}
                  className={`p-4 rounded-sm border-2 transition-all text-left flex items-start gap-3 ${
                    form.modo_produccion
                      ? 'border-emerald-500 bg-emerald-50/70 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className={`p-2 rounded ${form.modo_produccion ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <p className={`font-black text-xs uppercase tracking-tight ${form.modo_produccion ? 'text-emerald-900' : 'text-slate-800'}`}>
                      Producción
                    </p>
                    <p className="text-[9px] font-medium text-slate-500 uppercase tracking-wider mt-0.5">
                      Facturación oficial AFIP
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Certificados */}
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <FileKey size={12} className="text-blue-600" />
                Certificados Digitales ({form.modo_produccion ? 'Producción' : 'Homologación'})
              </label>
              
              <div key={form.modo_produccion ? 'prod' : 'test'} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-sm">
                  <p className="text-[10px] font-black uppercase text-slate-800 mb-1.5">Certificado (.crt)</p>
                  <label className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-sm text-[9px] font-black uppercase tracking-wider cursor-pointer transition-colors">
                    <Upload size={10} /> {certFileName ? 'Reemplazar .crt' : 'Cargar archivo .crt'}
                    <input 
                      type="file" 
                      accept=".crt"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setCertFileName(file.name);
                          const reader = new FileReader();
                          reader.onload = (evt) => set('cert_file', evt.target?.result);
                          reader.readAsText(file);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                  {certFileName && (
                    <p className="text-[9px] font-mono text-emerald-600 font-bold mt-1.5 truncate">
                      ✓ {certFileName}
                    </p>
                  )}
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-sm">
                  <p className="text-[10px] font-black uppercase text-slate-800 mb-1.5">Llave Privada (.key)</p>
                  <label className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-sm text-[9px] font-black uppercase tracking-wider cursor-pointer transition-colors">
                    <Upload size={10} /> {keyFileName ? 'Reemplazar .key' : 'Cargar archivo .key'}
                    <input 
                      type="file" 
                      accept=".key"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setKeyFileName(file.name);
                          const reader = new FileReader();
                          reader.onload = (evt) => set('key_file', evt.target?.result);
                          reader.readAsText(file);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                  {keyFileName && (
                    <p className="text-[9px] font-mono text-emerald-600 font-bold mt-1.5 truncate">
                      ✓ {keyFileName}
                    </p>
                  )}
                </div>
              </div>
              
              {form.cert_file && form.key_file && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-sm flex items-center gap-2">
                  <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                  <p className="text-[9px] font-black uppercase tracking-wider text-emerald-800">
                    Archivos .crt y .key cargados y listos para guardar en el servidor
                  </p>
                </div>
              )}
            </div>

            {/* Preview Encabezado */}
            {isConfigured && (
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-sm space-y-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">
                  Vista Previa en Encabezado de Factura
                </p>
                <p className="font-black text-xs text-slate-900 uppercase">{form.razon_social}</p>
                <p className="text-[10px] text-slate-600 font-mono">CUIT: {form.cuit_emisor}</p>
                <p className="text-[10px] text-slate-600">{form.domicilio_fiscal}</p>
                <p className="text-[10px] text-slate-600">
                  {form.condicion_iva_emisor} · Inicio: {form.inicio_actividades} · Pto. Vta: {String(form.punto_venta ?? 1).padStart(4, '0')}
                </p>
              </div>
            )}

            {/* Timestamp */}
            {config?.updatedAt && (
              <div className="pt-2 flex items-center gap-1.5 text-[9px] text-slate-400 font-semibold uppercase tracking-wider">
                <Clock size={10} />
                <span>Última actualización: {new Date(config.updatedAt).toLocaleString('es-AR')}</span>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Save Action Bar */}
      <div className="border-t-2 border-slate-900 pt-6 flex justify-end">
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 font-black text-xs uppercase tracking-widest rounded-sm transition-all disabled:bg-slate-200 disabled:text-slate-400 shadow-lg shadow-blue-500/20"
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              <span>Guardando Parámetros...</span>
            </>
          ) : (
            <>
              <Save size={16} />
              <span>Guardar Configuración</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default SettingsPage;
