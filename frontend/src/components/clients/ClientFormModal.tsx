import React, { useState, useEffect } from 'react';
import type { Client, ClientFormData } from '../../services/clientService';
import { parseArgNumber } from '../../utils/format';
import { X, User, Building2, Mail, Phone, MapPin, Hash, UserPlus, Pencil } from 'lucide-react';

interface ClientFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialData?: Client | null;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isPending: boolean;
}

export const ClientFormModal: React.FC<ClientFormModalProps> = ({
  isOpen,
  mode,
  initialData,
  onClose,
  onSubmit,
  isPending,
}) => {
  const [formData, setFormData] = useState<ClientFormData>({
    razon_social: '',
    cuit: '',
    email: '',
    direccion: '',
    condicion_iva: 'RESPONSABLE_INSCRIPTO',
    nro_iibb: '',
    telefono: '',
    porcentaje_facturacion: 80,
    saldo_blanco: '',
    saldo_interno: '',
  });

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && initialData) {
        setFormData({
          razon_social: initialData.razon_social || '',
          cuit: initialData.cuit || '',
          email: initialData.email || '',
          direccion: initialData.direccion || '',
          condicion_iva: initialData.condicion_iva || 'RESPONSABLE_INSCRIPTO',
          nro_iibb: initialData.nro_iibb || '',
          telefono: initialData.telefono || '',
          porcentaje_facturacion: Number(initialData.porcentaje_facturacion || 80),
          saldo_blanco: '',
          saldo_interno: '',
        });
      } else {
        setFormData({
          razon_social: '',
          cuit: '',
          email: '',
          direccion: '',
          condicion_iva: 'RESPONSABLE_INSCRIPTO',
          nro_iibb: '',
          telefono: '',
          porcentaje_facturacion: 80,
          saldo_blanco: '',
          saldo_interno: '',
        });
      }
    }
  }, [isOpen, mode, initialData]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanCuit = formData.cuit ? String(formData.cuit).replace(/[-\s.]/g, '') : '';
    const payload: any = {
      razon_social: formData.razon_social.trim(),
      cuit: cleanCuit,
      condicion_iva: formData.condicion_iva,
      email: formData.email ? String(formData.email).trim() : null,
      direccion: formData.direccion ? String(formData.direccion).trim() : null,
      nro_iibb: formData.nro_iibb ? String(formData.nro_iibb).trim() : null,
      telefono: formData.telefono ? String(formData.telefono).trim() : null,
    };

    if (mode === 'create') {
      const parsedBlanco = parseArgNumber(formData.saldo_blanco);
      const parsedInterno = parseArgNumber(formData.saldo_interno);
      // En alta, si se ingresa deuda positiva, se guarda en negativo
      payload.saldo_blanco = parsedBlanco > 0 ? -parsedBlanco : parsedBlanco;
      payload.saldo_interno = parsedInterno > 0 ? -parsedInterno : parsedInterno;
    }

    onSubmit(payload);
  };

  return (
    <div className="bg-white border border-slate-200 shadow-sm animate-fade-in">
      {/* Header */}
      <div className="bg-slate-900 px-6 sm:px-8 py-5 text-white flex justify-between items-center">
        <div className="flex items-center gap-2.5">
          {mode === 'create' ? (
            <UserPlus size={18} className="text-blue-400" />
          ) : (
            <Pencil size={18} className="text-blue-400" />
          )}
          <h2 className="text-lg font-black uppercase tracking-wider">
            {mode === 'create' ? 'Nuevo Cliente' : 'Editar Cliente'}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-300 hover:text-white transition-colors text-xs font-bold uppercase tracking-wider border border-slate-700 px-4 py-2 hover:border-slate-500 flex items-center gap-1.5 cursor-pointer"
        >
          <X size={14} />
          Cerrar
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6 bg-slate-50/50">
        {/* Sección: Datos Fiscales Principales */}
        <div className="bg-white p-5 border border-slate-200 space-y-4 shadow-sm">
          <span className="text-xs font-black text-slate-500 uppercase tracking-widest block border-b border-slate-100 pb-2">
            Identificación Fiscal
          </span>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <User size={13} className="text-slate-400" />
                Razón Social / Nombre Comercial *
              </label>
              <input
                type="text"
                required
                value={formData.razon_social}
                onChange={(e) => setFormData({ ...formData, razon_social: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-none px-3 py-2.5 font-bold text-slate-900 focus:border-blue-600 outline-none text-xs uppercase"
                placeholder="Ej: QUÍMICA INDUSTRIAL S.A."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Hash size={13} className="text-slate-400" />
                CUIT / DNI *
              </label>
              <input
                type="text"
                required
                value={formData.cuit}
                onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-none px-3 py-2.5 font-bold text-slate-900 focus:border-blue-600 outline-none text-xs"
                placeholder="20123456789"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Building2 size={13} className="text-slate-400" />
              Condición de IVA *
            </label>
            <select
              value={formData.condicion_iva}
              onChange={(e) => setFormData({ ...formData, condicion_iva: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-none px-3 py-2.5 font-bold text-slate-900 focus:border-blue-600 outline-none uppercase text-xs cursor-pointer"
            >
              <option value="RESPONSABLE_INSCRIPTO">Responsable Inscripto (Emite Factura A / B)</option>
              <option value="MONOTRIBUTO">Monotributista (Emite Factura B)</option>
              <option value="CONSUMIDOR_FINAL">Consumidor Final (Emite Factura B)</option>
              <option value="EXENTO">Exento</option>
            </select>
          </div>
        </div>

        {/* Sección: Datos de Contacto */}
        <div className="bg-white p-5 border border-slate-200 space-y-4 shadow-sm">
          <span className="text-xs font-black text-slate-500 uppercase tracking-widest block border-b border-slate-100 pb-2">
            Contacto y Domicilio Fiscal
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Mail size={13} className="text-slate-400" />
                Email
              </label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-none px-3 py-2.5 font-bold text-slate-900 focus:border-blue-600 outline-none text-xs"
                placeholder="contacto@empresa.com"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Phone size={13} className="text-slate-400" />
                Teléfono
              </label>
              <input
                type="text"
                value={formData.telefono || ''}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-none px-3 py-2.5 font-bold text-slate-900 focus:border-blue-600 outline-none text-xs"
                placeholder="11 5555-5555"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Hash size={13} className="text-slate-400" />
                Nro. Ingresos Brutos (IIBB)
              </label>
              <input
                type="text"
                value={formData.nro_iibb || ''}
                onChange={(e) => setFormData({ ...formData, nro_iibb: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-none px-3 py-2.5 font-bold text-slate-900 focus:border-blue-600 outline-none text-xs"
                placeholder="901-123456-7"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <MapPin size={13} className="text-slate-400" />
              Dirección Fiscal
            </label>
            <input
              type="text"
              value={formData.direccion || ''}
              onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-none px-3 py-2.5 font-bold text-slate-900 focus:border-blue-600 outline-none text-xs uppercase"
              placeholder="Av. Rivadavia 1234, CABA"
            />
          </div>
        </div>

        {/* Sección: Saldos Iniciales (Solo en creación) */}
        {mode === 'create' && (
          <div className="bg-white p-5 border border-slate-200 space-y-4 shadow-sm">
            <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
              <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
                Deuda Inicial Previa (Opcional)
              </span>
              <span className="text-[11px] font-bold text-slate-400 uppercase">
                Si el cliente arrastra saldo pendiente
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Saldo Blanco (Deuda fiscal en ARS)
                </label>
                <input
                  type="text"
                  value={formData.saldo_blanco}
                  onChange={(e) => setFormData({ ...formData, saldo_blanco: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-none px-3 py-2.5 font-bold text-slate-900 focus:border-blue-600 outline-none text-xs"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Saldo Interno (Deuda remitos en ARS)
                </label>
                <input
                  type="text"
                  value={formData.saldo_interno}
                  onChange={(e) => setFormData({ ...formData, saldo_interno: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-none px-3 py-2.5 font-bold text-slate-900 focus:border-blue-600 outline-none text-xs"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
        )}

        {/* Botones de acción */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest transition-all shadow-md shadow-blue-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isPending ? 'Guardando...' : mode === 'create' ? 'Crear Cliente' : 'Actualizar Cliente'}
          </button>
        </div>
      </form>
    </div>
  );
};
