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

  const getConfirmButtonStyles = () => {
    switch(variant) {
      case 'danger': return 'bg-red-600 hover:bg-red-700 shadow-red-100';
      case 'warning': return 'bg-amber-500 hover:bg-amber-600 shadow-amber-100';
      default: return 'bg-blue-600 hover:bg-blue-700 shadow-blue-100';
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm animate-fade-in" onClick={onCancel}></div>
      <div className="bg-white rounded-none w-full max-w-md shadow-2xl relative z-10 animate-fade-in border border-slate-200 overflow-hidden">
        <div className="p-10 text-center border-b border-slate-100 bg-slate-50">
          <h3 className="text-xl font-black text-slate-900 mb-6 uppercase tracking-tight">{title}</h3>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest leading-relaxed">{message}</p>
        </div>
        <div className="flex p-6 gap-3 bg-white">
          <button 
            onClick={onCancel}
            className="flex-1 py-4 font-bold text-[10px] uppercase text-slate-400 hover:text-slate-900 tracking-widest transition-all border border-slate-200 hover:bg-slate-50"
          >
            {cancelText}
          </button>
          <button 
            onClick={onConfirm}
            className={`flex-1 py-4 font-black text-[10px] uppercase text-white tracking-[0.2em] transition-all shadow-lg ${getConfirmButtonStyles()}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
