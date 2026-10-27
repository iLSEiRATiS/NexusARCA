import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, X, KeyRound } from 'lucide-react';
import { usePrivacy } from '../context/PrivacyContext';

export const PinAuthModal: React.FC = () => {
  const { isPinModalOpen, closePinModal, unlockWithPin } = usePrivacy();
  const [pin, setPin] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isPinModalOpen) {
      setPin('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isPinModalOpen]);

  if (!isPinModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length > 0) {
      unlockWithPin(pin);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div 
        className="bg-white border border-slate-200 shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 px-6 py-5 text-white flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={18} className="text-blue-400" />
            <h2 className="text-sm font-black uppercase tracking-wider">Acceso Gerencial</h2>
          </div>
          <button
            type="button"
            onClick={closePinModal}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 bg-slate-50/50">
          <div className="text-center space-y-1">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2 border border-blue-100">
              <KeyRound size={20} />
            </div>
            <p className="text-xs font-black text-slate-800 uppercase tracking-tight">
              Gestión Comercial y Remitos
            </p>
            <p className="text-[11px] text-slate-400 font-semibold leading-relaxed">
              Ingrese el PIN de autorización para revelar cuentas comerciales y remitos.
            </p>
          </div>

          <div>
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              maxLength={4}
              required
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className="w-full text-center bg-white border-2 border-slate-300 focus:border-blue-600 text-3xl font-mono tracking-widest py-3 px-4 outline-none transition-all shadow-inner"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={closePinModal}
              className="w-1/2 py-2.5 border border-slate-300 text-slate-600 hover:bg-slate-100 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pin.length === 0}
              className="w-1/2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Desbloquear
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
