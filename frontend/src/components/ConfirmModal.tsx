import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger'
}) => {
  if (!isOpen) return null;

  const colors = {
    danger: 'bg-rose-600 hover:bg-rose-700 shadow-rose-100',
    warning: 'bg-amber-500 hover:bg-amber-600 shadow-amber-100',
    info: 'bg-sky-600 hover:bg-sky-700 shadow-sky-100'
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={onCancel}></div>
      <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden relative z-10 animate-slide-up border border-slate-100">
        <div className="p-8 text-center">
          <div className={`w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center text-2xl ${
            variant === 'danger' ? 'bg-rose-50 text-rose-600' : 
            variant === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-sky-50 text-sky-600'
          }`}>
            {variant === 'danger' ? '⚠️' : variant === 'warning' ? '⚡' : 'ℹ️'}
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2 uppercase tracking-tight">{title}</h3>
          <p className="text-slate-500 text-sm leading-relaxed">{message}</p>
        </div>
        <div className="flex border-t border-slate-50 p-4 gap-3">
          <button 
            onClick={onCancel}
            className="flex-1 py-4 rounded-2xl font-bold text-xs uppercase text-slate-400 hover:bg-slate-50 transition-smooth"
          >
            {cancelText}
          </button>
          <button 
            onClick={onConfirm}
            className={`flex-1 py-4 rounded-2xl font-bold text-xs uppercase text-white shadow-lg transition-smooth ${colors[variant]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
