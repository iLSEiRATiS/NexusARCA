import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { clientService } from '../../services/clientService';
import { toast } from 'sonner';
import { X, UserPlus, Loader2 } from 'lucide-react';

interface QuickClientModalProps {
  isOpen: boolean;
  initialQuery?: string;
  onClose: () => void;
  onClientCreated: (client: any) => void;
}

export const QuickClientModal = ({
  isOpen,
  initialQuery = '',
  onClose,
  onClientCreated
}: QuickClientModalProps) => {
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    razon_social: '',
    cuit: '',
    condicion_iva: 'RESPONSABLE_INSCRIPTO',
    direccion: '',
    telefono: '',
    email: ''
  });

  useEffect(() => {
    if (!isOpen) return;
    const clean = initialQuery.replace(/[-\s.]/g, '');
    const isDigits = /^\d+$/.test(clean);

    setForm({
      razon_social: !isDigits ? initialQuery.toUpperCase() : '',
      cuit: isDigits ? initialQuery : '',
      condicion_iva: 'RESPONSABLE_INSCRIPTO',
      direccion: '',
      telefono: '',
      email: ''
    });
  }, [isOpen, initialQuery]);

  const quickCreateClientMutation = useMutation({
    mutationFn: async (data: typeof form) => {
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
      toast.success(`Cliente ${newClient.razon_social} registrado y seleccionado`);
      onClientCreated(newClient);
      onClose();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Error al registrar cliente';
      toast.error(msg);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.razon_social.trim()) {
      toast.error('La Razón Social es requerida');
      return;
    }
    if (!form.cuit.trim()) {
      toast.error('El CUIT / DNI es requerido');
      return;
    }
    quickCreateClientMutation.mutate(form);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white border border-slate-200 shadow-2xl max-w-lg w-full rounded-sm overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-blue-600 rounded">
              <UserPlus size={16} />
            </div>
            <div>
              <h3 className="text-base font-black uppercase tracking-tight">Alta Rápida de Cliente</h3>
              <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">Registrar sin salir del facturador</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 bg-slate-50 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
              Razón Social / Nombre Completo *
            </label>
            <input
              required
              type="text"
              placeholder="EJ: DISTRIBUIDORA NORTE S.A."
              value={form.razon_social}
              onChange={e => setForm({ ...form, razon_social: e.target.value })}
              className="w-full bg-white border border-slate-200 p-2.5 rounded font-bold text-slate-900 uppercase focus:border-blue-600 outline-none text-xs"
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
                value={form.cuit}
                onChange={e => setForm({ ...form, cuit: e.target.value })}
                className="w-full bg-white border border-slate-200 p-2.5 rounded font-mono font-bold text-slate-900 focus:border-blue-600 outline-none text-xs"
              />
            </div>

            <div>
              <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                Condición IVA *
              </label>
              <select
                value={form.condicion_iva}
                onChange={e => setForm({ ...form, condicion_iva: e.target.value })}
                className="w-full bg-white border border-slate-200 p-2.5 rounded font-bold text-slate-900 focus:border-blue-600 outline-none text-xs cursor-pointer"
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
              value={form.direccion}
              onChange={e => setForm({ ...form, direccion: e.target.value })}
              className="w-full bg-white border border-slate-200 p-2.5 rounded font-bold text-slate-900 focus:border-blue-600 outline-none text-xs"
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
                value={form.telefono}
                onChange={e => setForm({ ...form, telefono: e.target.value })}
                className="w-full bg-white border border-slate-200 p-2.5 rounded font-bold text-slate-900 focus:border-blue-600 outline-none text-xs"
              />
            </div>
            <div>
              <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                Email (Opcional)
              </label>
              <input
                type="email"
                placeholder="contacto@cliente.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full bg-white border border-slate-200 p-2.5 rounded font-bold text-slate-900 focus:border-blue-600 outline-none text-xs"
              />
            </div>
          </div>

          <div className="pt-3 flex gap-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-2.5 font-bold text-[10px] uppercase text-slate-500 hover:text-slate-700 tracking-wider rounded"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={quickCreateClientMutation.isPending}
              className="w-2/3 bg-blue-600 hover:bg-blue-700 text-white py-2.5 font-black text-[10px] uppercase tracking-widest rounded transition-all disabled:bg-slate-300 flex items-center justify-center gap-2 shadow-sm"
            >
              {quickCreateClientMutation.isPending ? (
                <>
                  <Loader2 className="animate-spin" size={14} />
                  <span>Guardando...</span>
                </>
              ) : (
                <span>Guardar y Seleccionar</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
