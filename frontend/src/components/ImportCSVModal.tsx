import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { toast } from 'sonner';
import { Loader2, UploadCloud } from 'lucide-react';

interface ImportCSVModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ImportCSVModal = ({ isOpen, onClose }: ImportCSVModalProps) => {
  const queryClient = useQueryClient();
  const [csvData, setCsvData] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

  const importMutation = useMutation({
    mutationFn: async (data: string) => {
      const response = await api.post('/import/csv', { csvData: data });
      return response.data;
    },
    onSuccess: () => {
      toast.success('IMPORTACIÓN FINALIZADA CON ÉXITO');
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onClose();
      setCsvData('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al importar CSV');
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvData(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvData(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-none w-full max-w-xl shadow-2xl overflow-hidden animate-fade-in border border-slate-200">
        <div className="bg-slate-900 p-8 text-white flex justify-between items-center border-b border-slate-800">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tighter">Importar Movimientos</h2>
            <p className="text-slate-400 text-[9px] font-black uppercase mt-1 tracking-[0.2em]">Intercambio de datos externo (Mascolo Stock)</p>
          </div>
          <button onClick={onClose} className="text-white hover:text-slate-400 transition-all text-3xl font-light leading-none px-2">&times;</button>
        </div>

        <div className="p-8 space-y-8 bg-white">
          <div 
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-none p-12 text-center transition-all relative ${
              isDragging ? 'border-blue-600 bg-slate-50' : 'border-slate-100 bg-white'
            }`}
          >
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            
            {csvData ? (
              <div className="space-y-4">
                <div className="font-black text-slate-900 text-sm uppercase tracking-widest">Archivo Preparado</div>
                <p className="text-[10px] text-blue-600 uppercase font-black tracking-widest">
                  {csvData.split('\n').length - 1} REGISTROS DETECTADOS
                </p>
                <button 
                  onClick={() => setCsvData('')}
                  className="text-slate-300 font-black text-[9px] uppercase hover:text-red-600 tracking-widest transition-colors"
                >
                  REMOVER ARCHIVO
                </button>
              </div>
            ) : (
              <div className="space-y-4 flex flex-col items-center">
                <UploadCloud className="text-slate-200 mb-2" size={48} />
                <div className="font-black text-slate-900 text-sm uppercase tracking-widest">Arrastre el CSV aquí</div>
                <p className="text-[9px] text-slate-400 uppercase font-black tracking-[0.2em]">O HAGA CLIC PARA EXPLORAR</p>
              </div>
            )}
          </div>

          <div className="border border-slate-100 p-6 bg-slate-50 shadow-sm">
            <p className="text-[9px] font-black text-slate-500 leading-relaxed uppercase tracking-widest text-center">
              ESTE PROCESO SINCRONIZARÁ LOS MOVIMIENTOS Y LOS CLIENTES EN EL SISTEMA FISCAL.
              LOS SALDOS DE CUENTA CORRIENTE SE ACTUALIZARÁN AUTOMÁTICAMENTE SEGÚN LA OPERACIÓN.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button 
              onClick={() => importMutation.mutate(csvData)}
              disabled={!csvData || importMutation.isPending}
              className="w-full bg-blue-600 text-white p-5 font-black uppercase tracking-[0.2em] hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-300 transition-all flex items-center justify-center gap-3 shadow-lg shadow-blue-100"
            >
              {importMutation.isPending ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  SINCRONIZANDO...
                </>
              ) : 'Confirmar Importación'}
            </button>
            <button 
              onClick={onClose}
              className="w-full text-slate-400 font-black text-[10px] uppercase tracking-widest py-4 hover:text-slate-900 transition-all"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportCSVModal;
