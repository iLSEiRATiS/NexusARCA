import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quotationService } from '../services/quotationService';
import type { Quotation } from '../services/quotationService';
import { generateQuotationPDF } from '../services/pdfService';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TableSkeleton } from '../components/Skeletons';
import ConfirmModal from '../components/ConfirmModal';

const QuotationsPage = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchBar] = useState('');
  const [filterStatus, setFilterStatus] = useState('TODOS');
  
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; quotationId: number | null }>({
    isOpen: false,
    quotationId: null
  });

  const { data, isLoading } = useQuery({
    queryKey: ['quotations'],
    queryFn: () => quotationService.getAll(),
  });

  const quotations = data?.data || [];

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, estado }: { id: number, estado: Quotation['estado'] }) => 
      quotationService.updateStatus(id, estado),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quotations'] }),
  });

  const convertToSaleMutation = useMutation({
    mutationFn: (id: number) => quotationService.convertToSale(id, { tipo_comprobante: 'Factura B' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('PRESUPUESTO CONVERTIDO A VENTA');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => quotationService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      setDeleteConfirm({ isOpen: false, quotationId: null });
      toast.success('Presupuesto eliminado');
    },
  });

  const filteredQuotations = quotations.filter((q: Quotation) => {
    const matchesSearch = 
      q.client?.razon_social.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(q.id).includes(searchTerm);
    
    const matchesStatus = filterStatus === 'TODOS' || q.estado === filterStatus;

    return matchesSearch && matchesStatus;
  });

  if (isLoading) return <div className="p-6 md:p-10"><TableSkeleton /></div>;

  return (
    <div className="p-6 md:p-10 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-800 tracking-tight mb-2">Presupuestos</h1>
          <p className="text-slate-400 font-medium text-[11px] uppercase tracking-widest italic">Cotizaciones y Propuestas Comerciales</p>
        </div>
        <Link 
          to="/cotizaciones/nueva" 
          className="bg-emerald-600 text-white px-8 py-3 rounded-2xl font-bold text-sm tracking-tight hover:bg-emerald-700 transition-smooth shadow-xl flex items-center justify-center gap-3 group w-full md:w-auto"
        >
          <span>+</span> Nueva Cotización <span className="group-hover:translate-x-1 transition-transform">→</span>
        </Link>
      </div>

      {/* Advanced Filters */}
      <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-soft mb-8">
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
               <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Búsqueda rápida</label>
               <input 
                 type="text" 
                 placeholder="Cliente o ID..." 
                 value={searchTerm}
                 onChange={(e) => setSearchBar(e.target.value)}
                 className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-sky-400 transition-smooth"
               />
            </div>
            <div className="space-y-2">
               <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Estado</label>
               <div className="flex flex-wrap gap-2">
                  {['TODOS', 'PENDIENTE', 'ACEPTADO', 'RECHAZADO', 'CONVERTIDO'].map(s => (
                    <button 
                      key={s} 
                      onClick={() => setFilterStatus(s)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-smooth border ${filterStatus === s ? 'bg-slate-800 border-slate-800 text-white shadow-md' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-200'}`}
                    >
                      {s}
                    </button>
                  ))}
               </div>
            </div>
         </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-[24px] shadow-soft overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 font-bold text-[11px] text-slate-400 uppercase tracking-widest">ID / Fecha</th>
                <th className="px-6 py-5 font-bold text-[11px] text-slate-400 uppercase tracking-widest">Cliente</th>
                <th className="px-6 py-5 font-bold text-[11px] text-slate-400 uppercase tracking-widest text-center">Total Est.</th>
                <th className="px-6 py-5 font-bold text-[11px] text-slate-400 uppercase tracking-widest text-center">Estado</th>
                <th className="px-8 py-5 font-bold text-[11px] text-slate-400 uppercase tracking-widest text-right">Gestión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredQuotations?.map((q: Quotation) => (
                <tr key={q.id} className="group hover:bg-slate-50/30 transition-smooth">
                  <td className="px-8 py-6">
                    <div className="font-bold text-slate-700">#{String(q.id).padStart(5, '0')}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">Vence: {q.validez_dias} Días</div>
                  </td>
                  <td className="px-6 py-6">
                    <div className="font-bold text-slate-700 uppercase text-sm">{q.client?.razon_social}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{new Date(q.fecha).toLocaleDateString()}</div>
                  </td>
                  <td className="px-6 py-6 text-center">
                    <div className="text-lg font-bold text-slate-700 tracking-tight">${Number(q.total_real_ars).toLocaleString('es-AR')}</div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">ARS Est.</div>
                  </td>
                  <td className="px-6 py-6 text-center">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                      q.estado === 'PENDIENTE' ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                      q.estado === 'ACEPTADO' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      q.estado === 'CONVERTIDO' ? 'bg-sky-50 text-sky-600 border-sky-100' :
                      'bg-slate-50 text-slate-400 border-slate-100'
                    }`}>
                      {q.estado}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-2">
                      {q.estado === 'PENDIENTE' && (
                        <>
                          <button 
                            onClick={() => updateStatusMutation.mutate({ id: q.id, estado: 'ACEPTADO' })}
                            className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-lg font-bold text-[9px] uppercase tracking-wider hover:bg-emerald-100 transition-smooth border border-emerald-100"
                          >
                            Aceptar
                          </button>
                          <button 
                            onClick={() => updateStatusMutation.mutate({ id: q.id, estado: 'RECHAZADO' })}
                            className="bg-rose-50 text-rose-600 px-3 py-1 rounded-lg font-bold text-[9px] uppercase tracking-wider hover:bg-rose-100 transition-smooth border border-rose-100"
                          >
                            Rechazar
                          </button>
                        </>
                      )}
                      {q.estado === 'ACEPTADO' && (
                        <button 
                          onClick={() => {
                            if(window.confirm('¿Confirmar conversión a venta real? Se descontará stock.')) {
                              convertToSaleMutation.mutate(q.id);
                            }
                          }}
                          className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg font-bold text-[9px] uppercase tracking-wider hover:bg-emerald-700 transition-smooth shadow-sm"
                        >
                          Facturar
                        </button>
                      )}
                      <button 
                        onClick={() => generateQuotationPDF(q)}
                        className="bg-white border border-slate-200 text-slate-500 px-3 py-1.5 rounded-lg font-bold text-[9px] uppercase hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-smooth shadow-sm"
                      >
                        PDF
                      </button>
                      <button 
                        onClick={() => setDeleteConfirm({ isOpen: true, quotationId: q.id })}
                        className="bg-slate-50 text-slate-300 px-3 py-1.5 rounded-lg font-bold text-[9px] uppercase hover:text-rose-500 transition-smooth border border-slate-100"
                      >
                        &times;
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredQuotations?.map((q: Quotation) => (
            <div key={q.id} className="p-5 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-slate-700">#{String(q.id).padStart(5, '0')}</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{new Date(q.fecha).toLocaleDateString()}</div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider border ${
                  q.estado === 'PENDIENTE' ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                  q.estado === 'ACEPTADO' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                  q.estado === 'CONVERTIDO' ? 'bg-sky-50 text-sky-600 border-sky-100' :
                  'bg-slate-50 text-slate-400 border-slate-100'
                }`}>
                  {q.estado}
                </span>
              </div>

              <div>
                <div className="font-bold text-slate-700 uppercase text-sm truncate">{q.client?.razon_social}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Vence en {q.validez_dias} días</div>
              </div>

              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="text-xl font-bold text-slate-700 tracking-tight">
                  ${Number(q.total_real_ars).toLocaleString('es-AR')}
                </div>
                <button 
                  onClick={() => generateQuotationPDF(q)}
                  className="bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-lg font-bold text-[9px] uppercase shadow-sm"
                >
                  📄 PDF
                </button>
              </div>

              {/* Mobile Actions */}
              <div className="flex gap-2">
                {q.estado === 'PENDIENTE' && (
                  <>
                    <button 
                      onClick={() => updateStatusMutation.mutate({ id: q.id, estado: 'ACEPTADO' })}
                      className="flex-1 bg-emerald-50 text-emerald-600 py-2.5 rounded-xl font-bold text-[10px] uppercase border border-emerald-100"
                    >
                      Aceptar
                    </button>
                    <button 
                      onClick={() => updateStatusMutation.mutate({ id: q.id, estado: 'RECHAZADO' })}
                      className="flex-1 bg-rose-50 text-rose-600 py-2.5 rounded-xl font-bold text-[10px] uppercase border border-rose-100"
                    >
                      Rechazar
                    </button>
                  </>
                )}
                {q.estado === 'ACEPTADO' && (
                  <button 
                    onClick={() => {
                      if(window.confirm('¿Confirmar conversión a venta real?')) {
                        convertToSaleMutation.mutate(q.id);
                      }
                    }}
                    className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl font-bold text-[10px] uppercase shadow-lg shadow-emerald-100"
                  >
                    Facturar Venta
                  </button>
                )}
                <button 
                  onClick={() => setDeleteConfirm({ isOpen: true, quotationId: q.id })}
                  className="w-12 bg-slate-50 text-slate-300 flex items-center justify-center rounded-xl border border-slate-100"
                >
                  &times;
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredQuotations?.length === 0 && (
          <div className="py-20 text-center">
            <p className="text-slate-300 font-bold uppercase tracking-[0.2em] italic text-sm">Sin presupuestos registrados</p>
          </div>
        )}
      </div>

      <ConfirmModal 
        isOpen={deleteConfirm.isOpen}
        title="¿Eliminar Presupuesto?"
        message="Se borrará la cotización permanentemente. Esta acción no se puede deshacer."
        onConfirm={() => deleteConfirm.quotationId && deleteMutation.mutate(deleteConfirm.quotationId)}
        onCancel={() => setDeleteConfirm({ isOpen: false, quotationId: null })}
        confirmText="Eliminar"
      />
    </div>
  );
};

export default QuotationsPage;
