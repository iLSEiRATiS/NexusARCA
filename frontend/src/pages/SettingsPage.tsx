import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { toast } from 'sonner';
import { Settings, ShieldCheck, ShieldOff, Save, AlertTriangle, Building2, Receipt } from 'lucide-react';

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      toast.success('Configuración guardada correctamente.');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al guardar la configuración.');
    },
  });

  if (isLoading) {
    return (
      <div className="p-10 text-xs font-bold uppercase tracking-widest text-slate-400 text-center">
        Cargando configuración...
      </div>
    );
  }

  const isConfigured =
    form.razon_social !== 'EMISOR SIN CONFIGURAR' &&
    form.cuit_emisor !== '00-00000000-0' &&
    form.domicilio_fiscal !== '';

  return (
    <div className="space-y-12 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-2 border-slate-900 pb-6 gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-slate-900">
            Configuración
          </h1>
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-1">
            Datos del emisor y parámetros del sistema de facturación
          </p>
        </div>
        <div className="flex items-center gap-4">
          {form.modo_produccion ? (
            <div className="flex items-center gap-2 bg-green-50 border border-green-300 px-4 py-2">
              <ShieldCheck size={14} className="text-green-600" />
              <span className="text-green-700 font-black text-[10px] uppercase tracking-widest">Modo Producción</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 px-4 py-2">
              <ShieldOff size={14} className="text-amber-600" />
              <span className="text-amber-700 font-black text-[10px] uppercase tracking-widest">Modo Homologación</span>
            </div>
          )}
        </div>
      </div>

      {/* Advertencia si no está configurado */}
      {!isConfigured && (
        <div className="flex items-start gap-4 bg-amber-50 border border-amber-200 p-6">
          <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-black text-amber-800 text-sm uppercase tracking-tight">
              Datos del emisor sin configurar
            </p>
            <p className="text-amber-700 text-xs font-bold mt-1 leading-relaxed">
              Completá los datos a continuación para que aparezcan correctamente en las facturas generadas.
              Pedile estos datos al contador de Mascolo Químicos.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

        {/* ── DATOS DEL EMISOR ──────────────────────────────── */}
        <section className="space-y-8">
          <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-900 flex items-center gap-2 pb-4 border-b border-slate-200">
            <Building2 size={14} className="text-blue-600" />
            Datos del Emisor (Mascolo Químicos)
          </h2>

          <div className="space-y-6">
            {/* Razón Social */}
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
                Razón Social (exacta según AFIP)
              </label>
              <input
                type="text"
                value={form.razon_social || ''}
                onChange={e => set('razon_social', e.target.value)}
                className="w-full bg-slate-50 border-b-2 border-slate-900 px-4 py-3 font-bold text-slate-900 text-sm outline-none focus:border-blue-600 transition-all uppercase"
                placeholder="MASCOLO OSCAR ADOLFO"
              />
            </div>

            {/* CUIT */}
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
                CUIT del Titular (con guiones: XX-XXXXXXXX-X)
              </label>
              <input
                type="text"
                value={form.cuit_emisor || ''}
                onChange={e => set('cuit_emisor', e.target.value)}
                className="w-full bg-slate-50 border-b-2 border-slate-900 px-4 py-3 font-bold text-slate-900 text-sm outline-none focus:border-blue-600 transition-all tracking-widest"
                placeholder="20-12345678-9"
                maxLength={13}
              />
            </div>

            {/* Domicilio Fiscal */}
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
                Domicilio Fiscal Completo (según AFIP)
              </label>
              <input
                type="text"
                value={form.domicilio_fiscal || ''}
                onChange={e => set('domicilio_fiscal', e.target.value)}
                className="w-full bg-slate-50 border-b-2 border-slate-900 px-4 py-3 font-bold text-slate-900 text-sm outline-none focus:border-blue-600 transition-all uppercase"
                placeholder="CALLE 1234, LOCALIDAD, PROVINCIA"
              />
            </div>

            {/* Condición IVA */}
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
                Condición frente al IVA
              </label>
              <select
                value={form.condicion_iva_emisor || 'Responsable Inscripto'}
                onChange={e => set('condicion_iva_emisor', e.target.value)}
                className="w-full bg-slate-50 border-b-2 border-slate-900 px-4 py-3 font-bold text-slate-900 text-sm outline-none focus:border-blue-600 transition-all uppercase"
              >
                <option value="Responsable Inscripto">Responsable Inscripto</option>
                <option value="Monotributo">Monotributo</option>
                <option value="Exento">Exento</option>
              </select>
            </div>

            {/* Inicio de Actividades */}
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
                Fecha de Inicio de Actividades (DD/MM/AAAA)
              </label>
              <input
                type="text"
                value={form.inicio_actividades || ''}
                onChange={e => set('inicio_actividades', e.target.value)}
                className="w-full bg-slate-50 border-b-2 border-slate-900 px-4 py-3 font-bold text-slate-900 text-sm outline-none focus:border-blue-600 transition-all tracking-widest"
                placeholder="01/01/2000"
                maxLength={10}
              />
            </div>
          </div>
        </section>

        {/* ── CONFIGURACIÓN ARCA ────────────────────────────── */}
        <section className="space-y-8">
          <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-900 flex items-center gap-2 pb-4 border-b border-slate-200">
            <Receipt size={14} className="text-blue-600" />
            Parámetros ARCA / AFIP
          </h2>

          <div className="space-y-6">
            {/* Punto de Venta */}
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
                Número de Punto de Venta habilitado para Web Services
              </label>
              <input
                type="number"
                min={1}
                max={9999}
                value={form.punto_venta ?? 1}
                onChange={e => set('punto_venta', parseInt(e.target.value) || 1)}
                className="w-full bg-slate-50 border-b-2 border-slate-900 px-4 py-3 font-black text-slate-900 text-2xl outline-none focus:border-blue-600 transition-all tracking-widest"
              />
              <p className="text-[9px] text-slate-400 font-bold mt-2 uppercase tracking-widest">
                Verificar en ARCA → Administración de Puntos de Venta. Debe ser tipo "Facturación Electrónica".
              </p>
            </div>

            {/* Modo Producción / Homologación */}
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
                Entorno de Operación
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => set('modo_produccion', false)}
                  className={`p-6 border-2 transition-all text-center flex flex-col items-center gap-3 ${
                    !form.modo_produccion
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-slate-200 bg-white hover:border-slate-400'
                  }`}
                >
                  <ShieldOff size={24} className={!form.modo_produccion ? 'text-amber-500' : 'text-slate-300'} />
                  <div>
                    <p className={`font-black text-xs uppercase tracking-widest ${!form.modo_produccion ? 'text-amber-700' : 'text-slate-400'}`}>
                      Homologación
                    </p>
                    <p className={`text-[8px] font-bold mt-1 uppercase tracking-widest ${!form.modo_produccion ? 'text-amber-600' : 'text-slate-300'}`}>
                      Facturas de prueba
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    if (window.confirm('⚠️ ¿Confirmar cambio a PRODUCCIÓN?\n\nA partir de este momento todas las facturas emitidas tendrán validez fiscal real ante AFIP/ARCA.\n\nAsegúrese de que los datos del emisor sean los correctos.')) {
                      set('modo_produccion', true);
                    }
                  }}
                  className={`p-6 border-2 transition-all text-center flex flex-col items-center gap-3 ${
                    form.modo_produccion
                      ? 'border-green-500 bg-green-50'
                      : 'border-slate-200 bg-white hover:border-green-400'
                  }`}
                >
                  <ShieldCheck size={24} className={form.modo_produccion ? 'text-green-600' : 'text-slate-300'} />
                  <div>
                    <p className={`font-black text-xs uppercase tracking-widest ${form.modo_produccion ? 'text-green-800' : 'text-slate-400'}`}>
                      Producción
                    </p>
                    <p className={`text-[8px] font-bold mt-1 uppercase tracking-widest ${form.modo_produccion ? 'text-green-600' : 'text-slate-300'}`}>
                      Facturas reales AFIP
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Última actualización */}
            {config?.updatedAt && (
              <div className="pt-4 border-t border-slate-100">
                <p className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">
                  Última actualización: {new Date(config.updatedAt).toLocaleString('es-AR')}
                </p>
              </div>
            )}
          </div>

          {/* Preview de cómo quedará la factura */}
          {isConfigured && (
            <div className="bg-slate-50 border border-slate-200 p-6 mt-4">
              <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">
                Vista previa — Encabezado de Factura
              </h3>
              <div className="font-bold text-sm text-slate-900 uppercase">{form.razon_social}</div>
              <div className="text-[10px] text-slate-500 font-bold mt-1">CUIT: {form.cuit_emisor}</div>
              <div className="text-[10px] text-slate-500 font-bold">{form.domicilio_fiscal}</div>
              <div className="text-[10px] text-slate-500 font-bold">
                {form.condicion_iva_emisor} — Inicio: {form.inicio_actividades}
              </div>
              <div className="text-[10px] text-slate-500 font-bold">
                Pto. Venta: {String(form.punto_venta ?? 1).padStart(4, '0')}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* BOTÓN GUARDAR */}
      <div className="border-t-2 border-slate-900 pt-8 flex justify-end">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="flex items-center gap-3 bg-slate-900 text-white px-10 py-4 font-black text-[11px] uppercase tracking-[0.3em] hover:bg-slate-800 transition-all disabled:bg-slate-200 disabled:text-slate-400 shadow-lg"
        >
          <Save size={14} />
          {saveMutation.isPending ? 'Guardando...' : 'Guardar Configuración'}
        </button>
      </div>
    </div>
  );
};

export default SettingsPage;
