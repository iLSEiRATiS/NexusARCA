import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  Plus, 
  Search, 
  CheckCircle2, 
  Clock, 
  DollarSign
} from 'lucide-react';
import api from '../services/api';
import { currencyService } from '../services/currencyService';
import { SalesTable } from '../components/sales/SalesTable';
import { ProcessBillingModal } from '../components/sales/ProcessBillingModal';
import { usePrivacy } from '../context/PrivacyContext';

const SalesPage = () => {
  const { isManagementUnlocked } = usePrivacy();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSaleToProcess, setSelectedSaleToProcess] = useState<any | null>(null);

  const { data: dolarRate } = useQuery({ 
    queryKey: ['dolar-bna'], 
    queryFn: currencyService.getDolarOficial 
  });

  const { data, isLoading } = useQuery({
    queryKey: ['sales'],
    queryFn: async () => {
      const res = await api.get('/sales');
      return res.data;
    }
  });

  const creditNoteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.post(`/sales/${id}/credit-note`);
      return res.data;
    },
    onSuccess: (resData) => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      const tipo = resData.tipo_comprobante === 'Factura A' ? 'A' : 'B';
      toast.success(`✅ NOTA DE CRÉDITO ${tipo} EMITIDA EXITOSAMENTE`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al emitir nota de crédito');
    }
  });

  const sales = data?.data || [];

  const filteredSales = useMemo(() => {
    return sales
      .filter((s: any) => {
        if (!isManagementUnlocked) {
          // Si está en Modo Fiscal Oficial, ocultar comprobantes de remito interno sin CAE
          const isInternalRemito = s.tipo_comprobante === 'Remito' && !s.cae;
          if (isInternalRemito) return false;
        }
        return true;
      })
      .filter((s: any) => {
        const searchLower = searchTerm.toLowerCase();
        const razonSocial = (s.client?.razon_social || '').toLowerCase();
        const cuit = String(s.client?.cuit || '');
        return (
          razonSocial.includes(searchLower) || 
          cuit.includes(searchLower) || 
          String(s.id).includes(searchTerm)
        );
      });
  }, [sales, searchTerm, isManagementUnlocked]);

  // Quick metrics
  const metrics = useMemo(() => {
    const activeSales = isManagementUnlocked
      ? sales
      : sales.filter((s: any) => !(s.tipo_comprobante === 'Remito' && !s.cae));
    const totalArs = activeSales.reduce((acc: number, s: any) => acc + (s.estado_factura !== 'ANULADA' ? Number(s.total_real_ars || 0) : 0), 0);
    const autorizadasCount = activeSales.filter((s: any) => Boolean(s.cae) && s.estado_factura !== 'ANULADA').length;
    const pendientesCount = activeSales.filter((s: any) => !s.cae && s.estado_factura !== 'ANULADA').length;
    return { totalArs, autorizadasCount, pendientesCount };
  }, [sales, isManagementUnlocked]);

  const handleCreditNote = (sale: any) => {
    const tipo = sale.tipo_comprobante === 'Factura A' ? 'A' : 'B';
    const confirmMessage = `¿Está seguro de anular el comprobante #${String(sale.id).padStart(5, '0')} con una NOTA DE CRÉDITO ${tipo} ante AFIP?`;
    if (window.confirm(confirmMessage)) {
      creditNoteMutation.mutate(sale.id);
    }
  };

  return (
    <div className="animate-fade-in space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-2 border-slate-900 pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight uppercase">
            Facturación
          </h1>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">
            Gestión de Comprobantes, Remitos y Emisión AFIP / ARCA
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Link 
            to="/facturacion/nueva" 
            className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-3.5 font-black text-xs uppercase tracking-widest transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 rounded-sm"
          >
            <Plus size={16} />
            <span>Nueva Operación</span>
          </Link>
        </div>
      </div>

      {/* KPI mini-cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 p-4 rounded-sm shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Facturado Activo</p>
            <p className="text-xl font-black font-mono text-slate-900 mt-0.5">
              ${metrics.totalArs.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
            <DollarSign size={20} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-sm shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Autorizadas por AFIP</p>
            <p className="text-xl font-black font-mono text-emerald-600 mt-0.5">
              {metrics.autorizadasCount} <span className="text-xs font-semibold text-slate-400">comprobantes</span>
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-sm shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pendientes de Facturar</p>
            <p className="text-xl font-black font-mono text-amber-600 mt-0.5">
              {metrics.pendientesCount} <span className="text-xs font-semibold text-slate-400">operaciones</span>
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock size={20} />
          </div>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="bg-white border border-slate-200 p-4 rounded-sm shadow-sm">
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-3.5 text-slate-400" />
          <input 
            type="text" 
            placeholder="BUSCAR POR CLIENTE, CUIT O NÚMERO DE OPERACIÓN..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 pl-11 pr-4 py-2.5 text-xs font-bold uppercase outline-none focus:border-blue-600 focus:bg-white transition-all tracking-wider text-slate-900 rounded-sm"
          />
        </div>
      </div>

      {/* Sales Table */}
      <SalesTable 
        sales={filteredSales}
        isLoading={isLoading}
        onProcess={(sale) => setSelectedSaleToProcess(sale)}
        onCreditNote={handleCreditNote}
        isCreditNotePending={creditNoteMutation.isPending}
      />

      {/* Modal de Procesamiento / Emisión AFIP */}
      <ProcessBillingModal 
        isOpen={Boolean(selectedSaleToProcess)}
        sale={selectedSaleToProcess}
        dolarRate={dolarRate}
        onClose={() => setSelectedSaleToProcess(null)}
        onSuccess={() => setSelectedSaleToProcess(null)}
      />
    </div>
  );
};

export default SalesPage;
