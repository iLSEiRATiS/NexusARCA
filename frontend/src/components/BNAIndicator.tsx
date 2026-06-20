import { useQuery } from '@tanstack/react-query';
import { currencyService } from '../services/currencyService';

const BNAIndicator = () => {
  const { data: dolar, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['dolar-bna'],
    queryFn: currencyService.getDolarOficial,
    refetchInterval: 1000 * 60 * 30, // Refrescar cada 30 min
  });

  return (
    <div className="flex items-center gap-6 bg-slate-50 px-5 py-3 border border-slate-200">
      <div className="flex flex-col">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Dólar Oficial (Operativo)</span>
        <div className="flex items-center gap-2">
          {isLoading ? (
            <div className="h-4 w-16 bg-slate-200 animate-pulse"></div>
          ) : isError ? (
            <span className="text-[10px] font-bold text-red-600 uppercase">Sin Conexión</span>
          ) : (
            <span className="text-lg font-black text-slate-900 tracking-tighter">
              ${Number(dolar).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </span>
          )}
        </div>
      </div>

      <button 
        onClick={() => refetch()}
        disabled={isFetching}
        className={`bg-white border border-slate-200 px-3 py-1 text-slate-400 font-bold text-[9px] uppercase hover:border-slate-400 hover:text-slate-600 transition-all ${isFetching ? 'animate-spin' : ''}`}
        title="Sincronizar Cotización"
      >
        {isFetching ? '↻' : 'ACT'}
      </button>
    </div>
  );
};

export default BNAIndicator;
