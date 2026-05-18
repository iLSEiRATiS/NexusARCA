import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quotationService } from '../services/quotationService';
import type { Quotation } from '../services/quotationService';
import { generateQuotationPDF } from '../services/pdfService';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useState } from 'react';

const QuotationsPage = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchBar] = useState('');
  
  const { data: quotationsData, isLoading, error } = useQuery({
    queryKey: ['quotations'],
    queryFn: () => quotationService.getAll(),
  });

  const quotations = quotationsData?.data;

  const filteredQuotations = quotations?.filter((q: Quotation) => 
    q.client?.razon_social.toLowerCase().includes(searchTerm.toLowerCase()) || 
    String(q.id).includes(searchTerm)
  );

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, estado }: { id: number, estado: Quotation['estado'] }) => 
      quotationService.updateStatus(id, estado),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      toast.success('Estado actualizado');
    }
  });

  const convertToSaleMutation = useMutation({
    mutationFn: (id: number) => quotationService.convertToSale(id, { tipo_comprobante: 'Factura B' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('CONVERTIDO EN VENTA EXITOSAMENTE');
    },
    onError: (err: any) => {
      toast.error('Error al convertir: ' + (err.response?.data?.message || err.message));
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => quotationService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      toast.success('Presupuesto eliminado');
    }
  });

  if (isLoading) return (
    <div className="p-12 text-center space-y-4 animate-pulse">
      <div className="h-12 bg-slate-100 rounded-2xl w-48 mx-auto"></div>
      <div className="h-[60vh] bg-slate-50 rounded-[32px]"></div>
    </div>
  );
  if (error) return <div className="p-12 text-rose-500 font-bold text-center">Error al cargar presupuestos</div>;

  return (
    <div className="p-6 md:p-10 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-800 tracking-tight mb-2">Presupuestos</h1>
          <p className="text-slate-400 font-medium text-[11px] uppercase tracking-widest italic">Gestión Comercial y Cotizaciones</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative flex-1 sm:w-64">
            <input 
              type="text" 
              placeholder="Buscar por cliente o ID..." 
              value={searchTerm}
              onChange={(e) => setSearchBar(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-sky-400 transition-smooth shadow-sm"
            />
          </div>
          <Link 
            to="/cotizaciones/nueva"
            className="bg-sky-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm tracking-tight hover:bg-sky-700 transition-smooth shadow-lg shadow-sky-100 flex items-center justify-center gap-2"
          >
            <span>+</span> Nueva Cotización
          </Link>
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-[24px] shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
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
                        onClick={() => { if(window.confirm('¿Eliminar?')) deleteMutation.mutate(q.id); }}
                        className="bg-slate-50 text-slate-300 px-3 py-1.5 rounded-lg font-bold text-[9px] uppercase hover:text-rose-500 transition-smooth border border-slate-100"
                      >
                        &times;
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredQuotations?.length === 0 && (
                <tr>
                   <td colSpan={5} className="py-20 text-center">
                      <p className="text-slate-300 font-bold uppercase tracking-[0.2em] italic text-sm">Sin presupuestos registrados</p>
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default QuotationsPage;
