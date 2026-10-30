import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  Plus, 
  Search, 
  FileText, 
  FileDown, 
  Check, 
  X, 
  Trash2, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ArrowRight,
  Calculator,
  Calendar
} from 'lucide-react';

import { quotationService } from '../services/quotationService';
import type { Quotation } from '../services/quotationService';
import { generateQuotationPDF } from '../services/pdfService';
import { TableSkeleton } from '../components/Skeletons';
import ConfirmModal from '../components/ConfirmModal';

const QuotationsPage = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('TODOS');
  
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; quotationId: number | null }>({
    isOpen: false,
    quotationId: null
  });

  const { data, isLoading } = useQuery({
    queryKey: ['quotations'],
    queryFn: () => quotationService.getAll(),
  });

  const quotations: Quotation[] = data?.data || [];

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, estado }: { id: number; estado: Quotation['estado'] }) => 
      quotationService.updateStatus(id, estado),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      toast.success('Estado del presupuesto actualizado');
    },
    onError: () => toast.error('Error al actualizar estado')
  });

  const convertToSaleMutation = useMutation({
    mutationFn: (id: number) => quotationService.convertToSale(id, { tipo_comprobante: 'Factura B' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('PRESUPUESTO CONVERTIDO A FACTURACIÓN');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al convertir presupuesto');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => quotationService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      setDeleteConfirm({ isOpen: false, quotationId: null });
      toast.success('Presupuesto eliminado');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al eliminar presupuesto');
    }
  });

  const filteredQuotations = useMemo(() => {
    return quotations.filter((q: Quotation) => {
      const searchLower = searchTerm.toLowerCase();
      const razonSocial = (q.client?.razon_social || '').toLowerCase();
      const matchesSearch = 
        razonSocial.includes(searchLower) ||
        String(q.id).includes(searchTerm);
      
      const matchesStatus = filterStatus === 'TODOS' || q.estado === filterStatus;

      return matchesSearch && matchesStatus;
    });
  }, [quotations, searchTerm, filterStatus]);

  // Metrics summary
  const metrics = useMemo(() => {
    const totalCount = quotations.length;
    const pendientes = quotations.filter(q => q.estado === 'PENDIENTE').length;
    const aceptados = quotations.filter(q => q.estado === 'ACEPTADO').length;
    const totalEstimadoArs = quotations
      .filter(q => q.estado !== 'RECHAZADO')
      .reduce((acc, q) => acc + Number(q.total_real_ars || 0), 0);
    return { totalCount, pendientes, aceptados, totalEstimadoArs };
  }, [quotations]);

  const getStatusBadge = (estado: Quotation['estado']) => {
    switch (estado) {
      case 'PENDIENTE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
            <Clock size={10} /> Pendiente
          </span>
        );
      case 'ACEPTADO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
            <CheckCircle2 size={10} /> Aceptado
          </span>
        );
      case 'CONVERTIDO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Check size={10} /> Facturado
          </span>
        );
      case 'RECHAZADO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200">
            <XCircle size={10} /> Rechazado
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-slate-50 text-slate-600 border border-slate-200">
            {estado}
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 md:p-10 space-y-6">
        <TableSkeleton />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-2 border-slate-900 pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight uppercase">
            Presupuestos
          </h1>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">
            Cotizaciones, Estimaciones de Costo y Propuestas Comerciales
          </p>
        </div>
        <Link 
          to="/cotizaciones/nueva" 
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3.5 font-black text-xs uppercase tracking-widest transition-all rounded-sm shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 w-full md:w-auto"
        >
          <Plus size={16} />
          <span>Nueva Cotización</span>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 p-4 rounded-sm shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Estimado en Cartera</p>
            <p className="text-xl font-black font-mono text-slate-900 mt-0.5">
              ${metrics.totalEstimadoArs.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
            <Calculator size={20} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-sm shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pendientes de Aprobación</p>
            <p className="text-xl font-black font-mono text-amber-600 mt-0.5">
              {metrics.pendientes} <span className="text-xs font-semibold text-slate-400">cotizaciones</span>
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock size={20} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-sm shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Aceptados para Facturar</p>
            <p className="text-xl font-black font-mono text-blue-600 mt-0.5">
              {metrics.aceptados} <span className="text-xs font-semibold text-slate-400">listos</span>
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-5 rounded-sm border border-slate-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="md:col-span-1">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
              <input 
                type="text" 
                placeholder="BUSCAR POR CLIENTE O ID..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-2 text-xs font-bold uppercase outline-none focus:border-blue-600 focus:bg-white transition-all tracking-wider text-slate-900 rounded-sm"
              />
            </div>
          </div>

          <div className="md:col-span-2 flex items-center gap-2 flex-wrap justify-start md:justify-end">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Estado:</span>
            {['TODOS', 'PENDIENTE', 'ACEPTADO', 'CONVERTIDO', 'RECHAZADO'].map(s => (
              <button 
                key={s} 
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-sm transition-all border ${
                  filterStatus === s 
                    ? 'bg-slate-900 border-slate-900 text-white shadow-sm' 
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-800'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quotations Table */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-sm overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest">ID / Fecha</th>
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest">Cliente</th>
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-center">Total Estimado</th>
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-center">Estado</th>
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-right">Gestión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredQuotations.map((q: Quotation) => (
                <tr key={q.id} className="group hover:bg-slate-50/80 transition-all">
                  <td className="px-6 py-5">
                    <div className="font-mono font-black text-slate-900 text-sm">#{String(q.id).padStart(5, '0')}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5 flex items-center gap-1">
                      <Calendar size={10} /> {new Date(q.fecha).toLocaleDateString('es-AR')}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="font-bold text-slate-900 uppercase text-sm group-hover:text-blue-600 transition-colors">
                      {q.client?.razon_social}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono tracking-wider mt-0.5">
                      CUIT: {q.client?.cuit || 'S/D'}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className="text-base font-black font-mono text-slate-900 tracking-tight">
                      ${Number(q.total_real_ars).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-[8px] text-slate-400 font-black uppercase tracking-widest">
                      ARS ESTIMADO
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    {getStatusBadge(q.estado)}
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex justify-end items-center gap-2">
                      {q.estado === 'PENDIENTE' && (
                        <>
                          <button 
                            onClick={() => updateStatusMutation.mutate({ id: q.id, estado: 'ACEPTADO' })}
                            className="border border-blue-200 bg-blue-50/70 text-blue-700 px-3 py-1.5 rounded font-bold text-[9px] uppercase tracking-wider hover:bg-blue-600 hover:text-white transition-all flex items-center gap-1"
                            title="Aceptar cotización"
                          >
                            <Check size={11} /> Aceptar
                          </button>
                          <button 
                            onClick={() => updateStatusMutation.mutate({ id: q.id, estado: 'RECHAZADO' })}
                            className="border border-slate-200 text-slate-400 px-2.5 py-1.5 rounded font-bold text-[9px] uppercase tracking-wider hover:text-red-600 hover:border-red-200 transition-all"
                            title="Rechazar cotización"
                          >
                            <X size={11} />
                          </button>
                        </>
                      )}

                      {q.estado === 'ACEPTADO' && (
                        <button 
                          onClick={() => {
                            if (window.confirm('¿Desea convertir este presupuesto en una operación de facturación real?')) {
                              convertToSaleMutation.mutate(q.id);
                            }
                          }}
                          className="bg-slate-900 text-white px-3.5 py-1.5 rounded font-black text-[9px] uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center gap-1 shadow-sm"
                        >
                          <ArrowRight size={11} /> Facturar
                        </button>
                      )}

                      <button 
                        onClick={() => generateQuotationPDF(q)}
                        className="bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded font-bold text-[9px] uppercase tracking-wider hover:border-slate-400 hover:bg-slate-50 transition-all flex items-center gap-1"
                      >
                        <FileDown size={11} className="text-slate-500" /> PDF
                      </button>

                      <button 
                        onClick={() => setDeleteConfirm({ isOpen: true, quotationId: q.id })}
                        className="text-slate-300 hover:text-red-600 p-1.5 rounded transition-colors"
                        title="Eliminar presupuesto"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredQuotations.map((q: Quotation) => (
            <div key={q.id} className="p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-slate-900 text-sm">#{String(q.id).padStart(5, '0')}</span>
                    {getStatusBadge(q.estado)}
                  </div>
                  <p className="font-bold text-slate-900 text-sm uppercase mt-1 leading-tight">
                    {q.client?.razon_social}
                  </p>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    {new Date(q.fecha).toLocaleDateString('es-AR')}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-base font-black font-mono text-slate-900">
                    ${Number(q.total_real_ars).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[8px] text-slate-400 font-bold uppercase">ESTIMADO ARS</div>
                </div>
              </div>

              {/* Mobile Actions */}
              <div className="flex gap-2 pt-1 flex-wrap">
                {q.estado === 'PENDIENTE' && (
                  <>
                    <button 
                      onClick={() => updateStatusMutation.mutate({ id: q.id, estado: 'ACEPTADO' })}
                      className="flex-1 bg-blue-50 border border-blue-200 text-blue-700 py-2 rounded font-black text-[9px] uppercase tracking-wider"
                    >
                      Aceptar
                    </button>
                    <button 
                      onClick={() => updateStatusMutation.mutate({ id: q.id, estado: 'RECHAZADO' })}
                      className="flex-1 border border-slate-200 text-slate-500 py-2 rounded font-bold text-[9px] uppercase tracking-wider"
                    >
                      Rechazar
                    </button>
                  </>
                )}
                {q.estado === 'ACEPTADO' && (
                  <button 
                    onClick={() => {
                      if (window.confirm('¿Confirmar conversión a facturación real?')) {
                        convertToSaleMutation.mutate(q.id);
                      }
                    }}
                    className="flex-1 bg-slate-900 text-white py-2 rounded font-black text-[9px] uppercase tracking-wider"
                  >
                    Facturar
                  </button>
                )}
                <button 
                  onClick={() => generateQuotationPDF(q)}
                  className="flex-1 border border-slate-200 bg-white text-slate-700 py-2 rounded font-bold text-[9px] uppercase tracking-wider flex items-center justify-center gap-1"
                >
                  <FileDown size={12} /> PDF
                </button>
                <button 
                  onClick={() => setDeleteConfirm({ isOpen: true, quotationId: q.id })}
                  className="px-3 border border-slate-200 text-slate-400 hover:text-red-600 rounded flex items-center justify-center"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredQuotations.length === 0 && (
          <div className="py-16 text-center">
            <FileText size={36} className="text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              No se encontraron presupuestos
            </p>
            <p className="text-[10px] text-slate-400 font-semibold mt-1">
              {searchTerm || filterStatus !== 'TODOS' ? 'Pruebe modificando los filtros aplicados' : 'Cree su primera cotización comercial'}
            </p>
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
