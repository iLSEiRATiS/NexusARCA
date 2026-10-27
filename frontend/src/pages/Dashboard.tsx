import { useQuery } from '@tanstack/react-query';
import { clientService } from '../services/clientService';
import api from '../services/api';
import { Link } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import ImportCSVModal from '../components/ImportCSVModal';
import { useState } from 'react';
import { 
  TrendingUp, Users, FileText, PlusCircle, UploadCloud, 
  ShieldCheck, ArrowUpRight, Calculator, Calendar 
} from 'lucide-react';

const Dashboard = () => {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
  const { data: clients, isLoading: loadingClients } = useQuery({ 
    queryKey: ['clients'], 
    queryFn: clientService.getAll 
  });

  const { data: salesData, isLoading: loadingSales } = useQuery({
    queryKey: ['sales'],
    queryFn: async () => {
      const res = await api.get('/sales');
      return res.data;
    }
  });

  const { data: configData } = useQuery({
    queryKey: ['config'],
    queryFn: async () => {
      const res = await api.get('/config');
      return res.data;
    }
  });

  const sales = salesData?.data || [];

  if (loadingClients || loadingSales) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent animate-spin mx-auto"></div>
        <p className="font-bold uppercase tracking-widest text-xs text-slate-400">Cargando tablero fiscal...</p>
      </div>
    );
  }

  // Cálculos de cartera
  const totalDebtPortfolio = clients?.reduce((acc: number, c: any) => {
    const balance = Number(c.saldo_deuda);
    return balance < 0 ? acc + Math.abs(balance) : acc;
  }, 0) || 0;
  
  const debtorClientsCount = clients?.filter((c: any) => Number(c.saldo_deuda) < 0).length || 0;
  const totalClientsCount = clients?.length || 0;

  // Cálculo de ventas del mes actual
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const salesThisMonth = sales.filter((s: any) => {
    const d = new Date(s.fecha);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const totalSoldThisMonth = salesThisMonth.reduce(
    (acc: number, s: any) => acc + Number(s.total_real_ars || 0), 
    0
  );

  // Evolución de los últimos 7 días
  const last7Days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();

  const salesChartData = last7Days.map(dateStr => {
    const daySales = sales.filter((s: any) => new Date(s.fecha).toISOString().split('T')[0] === dateStr);
    const dayTotal = daySales.reduce((acc: number, s: any) => acc + Number(s.total_real_ars), 0);
    const parts = dateStr.split('-');
    return {
      name: `${parts[2]}/${parts[1]}`,
      total: dayTotal,
      rawDate: dateStr
    };
  });

  const totalWeeklySales = salesChartData.reduce((acc, d) => acc + d.total, 0);

  // Tooltip personalizado para el gráfico
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-3 border border-slate-800 shadow-lg text-xs space-y-1">
          <p className="font-bold text-slate-400 uppercase tracking-wider">{data.name}</p>
          <p className="text-sm font-black text-white">
            ${Number(data.total).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      );
    }
    return null;
  };

  const todayFormatted = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(new Date());

  const isProduction = configData?.modo_produccion === true;
  const puntoVenta = configData?.punto_venta || 1;

  return (
    <div className="space-y-10 py-2 animate-fade-in">
      {/* Encabezado del Dashboard */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b-2 border-slate-900 pb-5">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-slate-900">
              Panel Principal
            </h1>
            <span className={`text-[10px] font-black px-2 py-0.5 uppercase tracking-wider flex items-center gap-1 border ${
              isProduction 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              <ShieldCheck size={12} />
              {isProduction ? `ARCA Producción (PV ${puntoVenta})` : 'Homologación AFIP'}
            </span>
          </div>
          <p className="text-xs font-bold text-slate-400 capitalize tracking-wider flex items-center gap-1.5">
            <Calendar size={13} />
            {todayFormatted}
          </p>
        </div>

        <Link
          to="/facturacion/nueva"
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm cursor-pointer"
        >
          <PlusCircle size={15} />
          Nueva Facturación
        </Link>
      </div>

      {/* Grid de KPIs principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* KPI 1: Deuda Cartera */}
        <Link 
          to="/clientes" 
          className="bg-white p-6 border border-slate-200 hover:border-blue-600 transition-all shadow-xs group flex flex-col justify-between"
        >
          <div>
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Deuda Cartera</span>
              <Users size={16} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              ${totalDebtPortfolio.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
            <span className="font-black text-red-600">{debtorClientsCount} con deuda</span>
            <span className="text-slate-400 font-bold">{totalClientsCount} clientes</span>
          </div>
        </Link>

        {/* KPI 2: Ventas del Mes */}
        <Link 
          to="/facturacion" 
          className="bg-white p-6 border border-slate-200 hover:border-blue-600 transition-all shadow-xs group flex flex-col justify-between"
        >
          <div>
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Facturación del Mes</span>
              <FileText size={16} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              ${totalSoldThisMonth.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
            <span className="font-bold text-slate-500">{salesThisMonth.length} comprobantes</span>
            <span className="text-blue-600 font-bold flex items-center gap-0.5">Ver lista <ArrowUpRight size={12} /></span>
          </div>
        </Link>

        {/* KPI 3: Total Semana */}
        <div className="bg-white p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Últimos 7 Días</span>
              <TrendingUp size={16} className="text-emerald-500" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              ${totalWeeklySales.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs font-bold text-slate-400">
            Ritmo semanal consolidado
          </div>
        </div>

        {/* KPI 4: Acceso Facturación Rápida */}
        <div className="bg-slate-900 p-6 text-white flex flex-col justify-between shadow-xs">
          <div>
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-2">
              Emisión Fiscal
            </span>
            <p className="text-xl font-black uppercase tracking-tight">
              Facturador Libre
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Bimonetario, Kilos y Notas de Crédito
            </p>
          </div>
          <Link
            to="/facturacion/nueva"
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 font-black text-xs uppercase tracking-wider text-center transition-all block"
          >
            Facturar Ahora &rarr;
          </Link>
        </div>
      </div>

      {/* Gráfico de Evolución Semanal */}
      <section className="bg-white border border-slate-200 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
              Evolución Semanal de Facturación
            </h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
              Valores totales consolidados en Pesos Argentinos (ARS)
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs font-black text-slate-900 block">
              Total 7 días: ${totalWeeklySales.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="h-[280px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
            <BarChart data={salesChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }} 
                dy={8} 
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="total" fill="#2563eb" radius={[3, 3, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Accesos Rápidos Inferiores */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Link 
          to="/clientes" 
          className="bg-white border border-slate-200 p-6 hover:border-blue-600 transition-all shadow-xs group block"
        >
          <div className="w-9 h-9 bg-slate-100 text-slate-700 flex items-center justify-center font-black mb-3 group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <Users size={18} />
          </div>
          <h3 className="text-base font-black uppercase text-slate-900 mb-1">
            Clientes & Cuentas
          </h3>
          <p className="text-xs text-slate-500">
            Saldos en blanco e interno, cargas de deuda y cobranzas.
          </p>
        </Link>

        <Link 
          to="/cotizaciones" 
          className="bg-white border border-slate-200 p-6 hover:border-blue-600 transition-all shadow-xs group block"
        >
          <div className="w-9 h-9 bg-slate-100 text-slate-700 flex items-center justify-center font-black mb-3 group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <Calculator size={18} />
          </div>
          <h3 className="text-base font-black uppercase text-slate-900 mb-1">
            Presupuestos
          </h3>
          <p className="text-xs text-slate-500">
            Cotizaciones no fiscales bimonetarias (USD/ARS).
          </p>
        </Link>

        <button 
          type="button"
          onClick={() => setIsImportModalOpen(true)} 
          className="bg-white border border-slate-200 p-6 hover:border-blue-600 transition-all shadow-xs text-left group cursor-pointer"
        >
          <div className="w-9 h-9 bg-slate-100 text-slate-700 flex items-center justify-center font-black mb-3 group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <UploadCloud size={18} />
          </div>
          <h3 className="text-base font-black uppercase text-slate-900 mb-1">
            Importar Stock CSV
          </h3>
          <p className="text-xs text-slate-500">
            Cargar despacho de productos desde archivo externo.
          </p>
        </button>
      </div>

      <ImportCSVModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />
    </div>
  );
};

export default Dashboard;
