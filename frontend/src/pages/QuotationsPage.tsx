import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quotationService } from '../services/quotationService';
import type { Quotation } from '../services/quotationService';
import { generateQuotationPDF } from '../services/pdfService';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TableSkeleton } from '../components/Skeletons';
import ConfirmModal from '../components/ConfirmModal';
import { toast } from 'sonner';

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
      toast.success('PRESUPUESTO CONVERTIDO A FACTURACIÓN');
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
    <div className="animate-fade-in space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-2 border-slate-900 pb-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter uppercase mb-1">Presupuestos</h1>
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em]">Cotizaciones y Propuestas Comerciales</p>
        </div>
        <Link 
          to="/cotizaciones/nueva" 
          className="bg-blue-600 text-white px-8 py-3 font-black text-xs tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-3 group w-full md:w-auto uppercase shadow-lg shadow-blue-100"
        >
          + Nueva Cotización
        </Link>
      </div>

      {/* Advanced Filters */}
      <div className="bg-white p-8 rounded-none border border-slate-200 shadow-sm">
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="space-y-3">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Búsqueda rápida</label>
               <input 
                 type="text" 
                 placeholder="CLIENTE O ID..." 
                 value={searchTerm}
                 onChange={(e) => setSearchBar(e.target.value)}
                 className="w-full bg-slate-50 border border-slate-200 px-4 py-3 text-xs font-bold uppercase outline-none focus:border-blue-600 transition-all tracking-widest text-slate-900"
               />
            </div>
            <div className="space-y-3 lg:col-span-2">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filtrar por Estado</label>
               <div className="flex flex-wrap gap-2">
                  {['TODOS', 'PENDIENTE', 'ACEPTADO', 'RECHAZADO', 'CONVERTIDO'].map(s => (
                    <button 
                      key={s} 
                      onClick={() => setFilterStatus(s)}
                      className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest transition-all border ${filterStatus === s ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-900 hover:text-slate-900'}`}
                    >
                      {s}
                    </button>
                  ))}
               </div>
            </div>
         </div>
      </div>

      <div className="bg-white border border-slate-200 shadow-sm rounded-none overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <th className="px-8 py-4 font-black text-[10px] uppercase tracking-widest">ID / Fecha</th>
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest">Cliente</th>
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-center">Total Est.</th>
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-center">Estado</th>
                <th className="px-8 py-4 font-black text-[10px] uppercase tracking-widest text-right">Gestión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredQuotations?.map((q: Quotation) => (
                <tr key={q.id} className="group hover:bg-slate-50 transition-all">
                  <td className="px-8 py-6">
                    <div className="font-black text-slate-900 text-base uppercase">#{String(q.id).padStart(5, '0')}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">VALIDEZ: {q.validez_dias} DÍAS</div>
                  </td>
                  <td className="px-6 py-6">
                    <div className="font-black text-slate-900 uppercase text-sm">{q.client?.razon_social}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{new Date(q.fecha).toLocaleDateString()}</div>
                  </td>
                  <td className="px-6 py-6 text-center">
                    <div className="text-xl font-black text-slate-900 tracking-tighter">${Number(q.total_real_ars).toLocaleString('es-AR')}</div>
                    <div className="text-[8px] text-slate-400 font-black uppercase tracking-widest mt-0.5">ARS ESTIMADO</div>
                  </td>
                  <td className="px-6 py-6 text-center">
                    <span className={`px-2 py-0.5 border text-[9px] font-black uppercase tracking-widest ${
                      q.estado === 'PENDIENTE' ? 'bg-white text-slate-900 border-slate-900' : 
                      q.estado === 'ACEPTADO' ? 'bg-blue-600 text-white border-blue-600' :
                      q.estado === 'CONVERTIDO' ? 'bg-slate-100 text-slate-400 border-slate-200' :
                      'bg-slate-50 text-slate-300 border-slate-100'
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
                            className="border border-slate-200 text-slate-600 px-3 py-1.5 font-black text-[9px] uppercase tracking-widest hover:border-slate-900 hover:text-slate-900 transition-all"
                          >
                            Aceptar
                          </button>
                          <button 
                            onClick={() => updateStatusMutation.mutate({ id: q.id, estado: 'RECHAZADO' })}
                            className="border border-slate-200 text-slate-300 px-3 py-1.5 font-black text-[9px] uppercase tracking-widest hover:text-red-600 hover:border-red-600 transition-all"
                          >
                            Rechazar
                          </button>
                        </>
                      )}
                      {q.estado === 'ACEPTADO' && (
                        <button 
                          onClick={() => {
                            if(window.confirm('¿Confirmar conversión a facturación real?')) {
                              convertToSaleMutation.mutate(q.id);
                            }
                          }}
                          className="bg-slate-900 text-white px-4 py-1.5 font-black text-[9px] uppercase tracking-widest hover:bg-slate-800 transition-all"
                        >
                          Facturar
                        </button>
                      )}
                      <button 
                        onClick={() => generateQuotationPDF(q)}
                        className="bg-white border border-slate-200 text-slate-600 px-3 py-1.5 font-black text-[9px] uppercase tracking-widest hover:bg-slate-50 transition-all"
                      >
                        PDF
                      </button>
                      <button 
                        onClick={() => setDeleteConfirm({ isOpen: true, quotationId: q.id })}
                        className="text-slate-300 hover:text-red-600 transition-all px-2 py-1.5 font-black text-lg"
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
                  <div className="font-black text-slate-900 text-base uppercase leading-tight">#{String(q.id).padStart(5, '0')} - {q.client?.razon_social}</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{new Date(q.fecha).toLocaleDateString()}</div>
                </div>
                <span className={`px-2 py-0.5 border text-[8px] font-black uppercase tracking-widest ${
                  q.estado === 'PENDIENTE' ? 'bg-white text-slate-900 border-slate-900' : 
                  q.estado === 'ACEPTADO' ? 'bg-blue-600 text-white border-blue-600' :
                  q.estado === 'CONVERTIDO' ? 'bg-slate-100 text-slate-400 border-slate-200' :
                  'bg-slate-50 text-slate-300 border-slate-100'
                }`}>
                  {q.estado}
                </span>
              </div>

              <div className="flex justify-between items-center border border-slate-200 p-4 bg-slate-50 shadow-sm">
                <div className="text-xl font-black text-slate-900 tracking-tighter">
                  ${Number(q.total_real_ars).toLocaleString('es-AR')}
                </div>
                <button 
                  onClick={() => generateQuotationPDF(q)}
                  className="bg-slate-900 text-white px-4 py-1.5 font-black text-[9px] uppercase tracking-widest"
                >
                  PDF
                </button>
              </div>

              {/* Mobile Actions */}
              <div className="flex gap-2">
                {q.estado === 'PENDIENTE' && (
                  <>
                    <button 
                      onClick={() => updateStatusMutation.mutate({ id: q.id, estado: 'ACEPTADO' })}
                      className="flex-1 border border-slate-200 text-slate-600 py-3 font-black text-[9px] uppercase tracking-widest"
                    >
                      Aceptar
                    </button>
                    <button 
                      onClick={() => updateStatusMutation.mutate({ id: q.id, estado: 'RECHAZADO' })}
                      className="flex-1 border border-slate-100 text-slate-300 py-3 font-black text-[9px] uppercase tracking-widest"
                    >
                      Rechazar
                    </button>
                  </>
                )}
                {q.estado === 'ACEPTADO' && (
                  <button 
                    onClick={() => {
                      if(window.confirm('¿Confirmar conversión a facturación real?')) {
                        convertToSaleMutation.mutate(q.id);
                      }
                    }}
                    className="flex-1 bg-slate-900 text-white py-3 font-black text-[9px] uppercase tracking-widest"
                  >
                    Facturar
                  </button>
                )}
                <button 
                  onClick={() => setDeleteConfirm({ isOpen: true, quotationId: q.id })}
                  className="w-10 border border-slate-200 text-slate-400 flex items-center justify-center font-bold text-xl"
                >
                  &times;
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredQuotations?.length === 0 && (
          <div className="py-20 text-center">
            <p className="text-slate-300 font-black uppercase tracking-[0.2em] text-[10px]">Sin presupuestos registrados</p>
          </div>
        )}
      </div>

      <ConfirmModal 
        isOpen={deleteConfirm.isOpen}
        title="¿ELIMINAR PRESUPUESTO?"
        message="SE BORRARÁ LA COTIZACIÓN PERMANENTEMENTE. ESTA ACCIÓN NO SE PUEDE DESHACER."
        onConfirm={() => deleteConfirm.quotationId && deleteMutation.mutate(deleteConfirm.quotationId)}
        onCancel={() => setDeleteConfirm({ isOpen: false, quotationId: null })}
        confirmText="ELIMINAR"
      />
    </div>
  );
};

export default QuotationsPage;
