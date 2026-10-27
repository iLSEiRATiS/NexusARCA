import { 
  FileText, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  FileDown, 
  Clock, 
  AlertCircle
} from 'lucide-react';
import { generateSalePDF, generateCreditNotePDF } from '../../services/pdfService';

interface SalesTableProps {
  sales: any[];
  isLoading: boolean;
  onProcess: (sale: any) => void;
  onCreditNote: (sale: any) => void;
  isCreditNotePending?: boolean;
}

export const SalesTable = ({
  sales,
  isLoading,
  onProcess,
  onCreditNote,
  isCreditNotePending = false
}: SalesTableProps) => {

  const getBadgeStyle = (tipo: string = '', cae: boolean, isAnulada: boolean) => {
    if (isAnulada) return 'bg-red-50 text-red-700 border-red-200';
    if (tipo.includes('Factura A')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (tipo.includes('Factura B')) return 'bg-slate-100 text-slate-700 border-slate-300';
    if (tipo.includes('Remito')) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    if (cae) return 'bg-slate-900 text-white border-slate-900';
    return 'bg-slate-50 text-slate-600 border-slate-200';
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 p-16 text-center shadow-sm">
        <Loader2 className="animate-spin inline-block text-blue-600 mb-3" size={32} />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cargando comprobantes...</p>
      </div>
    );
  }

  if (sales.length === 0) {
    return (
      <div className="bg-white border border-slate-200 p-16 text-center shadow-sm">
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
          <AlertCircle size={24} />
        </div>
        <p className="text-sm font-black text-slate-800 uppercase tracking-wide">No se encontraron comprobantes</p>
        <p className="text-xs text-slate-400 font-semibold mt-1">Pruebe ajustando el término de búsqueda o registre una nueva operación.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest">ID / Fecha</th>
              <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest">Cliente</th>
              <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-center">Tipo / Estado</th>
              <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-center">Total Facturado</th>
              <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sales.map((sale: any) => {
              const isAnulada = sale.estado_factura === 'ANULADA';
              const isAutorizada = Boolean(sale.cae);
              const canProcess = !isAutorizada && !isAnulada;
              const canAnnul = isAutorizada && ['Factura A', 'Factura B'].includes(sale.tipo_comprobante) && !isAnulada;

              return (
                <tr key={sale.id} className="group hover:bg-slate-50/80 transition-all">
                  {/* ID / Fecha */}
                  <td className="px-6 py-5">
                    <div className="font-mono font-black text-slate-900 text-sm">
                      #{String(sale.id).padStart(5, '0')}
                    </div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                      {new Date(sale.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </div>
                  </td>

                  {/* Cliente */}
                  <td className="px-6 py-5">
                    <div className="font-bold text-slate-900 uppercase text-sm group-hover:text-blue-600 transition-colors">
                      {sale.client?.razon_social || 'Consumidor Final'}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono tracking-wider mt-0.5">
                      CUIT: {sale.client?.cuit || 'Sin CUIT'}
                    </div>
                  </td>

                  {/* Tipo / Estado */}
                  <td className="px-6 py-5 text-center">
                    <div className="inline-flex flex-col items-center gap-1.5">
                      <span className={`px-2.5 py-0.5 border text-[9px] font-black uppercase tracking-wider rounded ${getBadgeStyle(sale.tipo_comprobante, isAutorizada, isAnulada)}`}>
                        {sale.tipo_comprobante || 'Comprobante'}
                      </span>
                      
                      {isAnulada ? (
                        <div className="flex items-center gap-1 text-[9px] font-black text-red-600 uppercase tracking-tight">
                          <XCircle size={10} /> ANULADA
                        </div>
                      ) : isAutorizada ? (
                        <div className="flex items-center gap-1 text-[9px] font-black text-blue-600 uppercase tracking-tight">
                          <CheckCircle2 size={10} /> AUTORIZADA
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                          <Clock size={10} /> PENDIENTE
                        </div>
                      )}

                      {isAnulada && sale.nro_comprobante_nc && (
                        <div className="text-[8px] font-mono font-bold text-red-500 uppercase">
                          NC: {sale.nro_comprobante_nc}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Total Real ARS */}
                  <td className="px-6 py-5 text-center">
                    <div className="text-base font-black font-mono text-slate-900 tracking-tight">
                      ${Number(sale.total_real_ars).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-[8px] text-slate-400 font-black uppercase tracking-widest">
                      ARS FINAL
                    </div>
                  </td>

                  {/* Acciones */}
                  <td className="px-6 py-5 text-right">
                    <div className="flex justify-end items-center gap-2 flex-wrap">
                      {/* PROCESAR */}
                      {canProcess && (
                        <button 
                          onClick={() => onProcess(sale)}
                          className="bg-slate-900 text-white px-3.5 py-1.5 rounded font-black text-[9px] uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center gap-1.5 shadow-sm"
                        >
                          <FileText size={12} /> PROCESAR
                        </button>
                      )}

                      {/* ANULAR */}
                      {canAnnul && (
                        <button 
                          onClick={() => onCreditNote(sale)}
                          disabled={isCreditNotePending}
                          className="bg-red-50 text-red-600 border border-red-200 px-3.5 py-1.5 rounded font-black text-[9px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all flex items-center gap-1.5 disabled:opacity-50"
                        >
                          ANULAR
                        </button>
                      )}

                      {/* PDF Comprobante */}
                      <button 
                        onClick={() => generateSalePDF(sale)}
                        className="bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded font-bold text-[9px] uppercase tracking-wider hover:border-slate-400 hover:bg-slate-50 transition-all flex items-center gap-1"
                      >
                        <FileDown size={11} className="text-slate-500" />
                        {isAutorizada ? 'FACTURA' : 'PDF'}
                      </button>

                      {/* PDF Nota de Crédito */}
                      {isAnulada && sale.cae_nota_credito && (
                        <button 
                          onClick={() => generateCreditNotePDF(sale)}
                          className="bg-red-50 border border-red-200 text-red-600 px-3 py-1.5 rounded font-bold text-[9px] uppercase tracking-wider hover:bg-red-100 transition-all flex items-center gap-1"
                        >
                          <FileDown size={11} /> NC
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile View */}
      <div className="md:hidden divide-y divide-slate-100">
        {sales.map((sale: any) => {
          const isAnulada = sale.estado_factura === 'ANULADA';
          const isAutorizada = Boolean(sale.cae);
          const canProcess = !isAutorizada && !isAnulada;
          const canAnnul = isAutorizada && ['Factura A', 'Factura B'].includes(sale.tipo_comprobante) && !isAnulada;

          return (
            <div key={sale.id} className="p-4 space-y-3.5">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-slate-900 text-sm">#{String(sale.id).padStart(5, '0')}</span>
                    <span className={`px-2 py-0.5 border text-[8px] font-black uppercase rounded ${getBadgeStyle(sale.tipo_comprobante, isAutorizada, isAnulada)}`}>
                      {sale.tipo_comprobante || 'Comprobante'}
                    </span>
                  </div>
                  <p className="font-bold text-slate-900 text-sm uppercase mt-1 leading-tight">
                    {sale.client?.razon_social || 'Consumidor Final'}
                  </p>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    {new Date(sale.fecha).toLocaleDateString('es-AR')} · CUIT: {sale.client?.cuit || 'N/A'}
                  </p>
                  {isAnulada && (
                    <div className="text-[9px] font-black text-red-600 uppercase mt-1 flex items-center gap-1">
                      <XCircle size={10} /> ANULADA{sale.nro_comprobante_nc ? ` · NC ${sale.nro_comprobante_nc}` : ''}
                    </div>
                  )}
                </div>

                <div className="text-right">
                  <div className="text-base font-black font-mono text-slate-900">
                    ${Number(sale.total_real_ars).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[8px] text-slate-400 font-bold uppercase">TOTAL ARS</div>
                </div>
              </div>

              {/* Mobile Actions */}
              <div className="flex gap-2 flex-wrap pt-1">
                {canProcess && (
                  <button 
                    onClick={() => onProcess(sale)}
                    className="flex-1 bg-slate-900 text-white py-2.5 rounded font-black text-[10px] uppercase tracking-wider hover:bg-blue-600 transition-all"
                  >
                    PROCESAR
                  </button>
                )}
                {canAnnul && (
                  <button 
                    onClick={() => onCreditNote(sale)}
                    disabled={isCreditNotePending}
                    className="flex-1 bg-red-600 text-white py-2.5 rounded font-black text-[10px] uppercase tracking-wider disabled:opacity-50"
                  >
                    ANULAR
                  </button>
                )}
                <button 
                  onClick={() => generateSalePDF(sale)}
                  className="flex-1 border border-slate-200 bg-white text-slate-700 py-2.5 rounded font-bold text-[10px] uppercase tracking-wider hover:bg-slate-50 transition-all flex items-center justify-center gap-1"
                >
                  <FileDown size={12} /> {isAutorizada ? 'FACTURA' : 'PDF'}
                </button>
                {isAnulada && sale.cae_nota_credito && (
                  <button 
                    onClick={() => generateCreditNotePDF(sale)}
                    className="flex-1 border border-red-200 bg-red-50 text-red-600 py-2.5 rounded font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1"
                  >
                    <FileDown size={12} /> NC
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
