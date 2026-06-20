import { useQuery } from '@tanstack/react-query';
import { clientService } from '../services/clientService';
import api from '../services/api';
import { Link } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import ImportCSVModal from '../components/ImportCSVModal';
import { useState } from 'react';

const Dashboard = () => {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
  const { data: clients, isLoading: loadingClients } = useQuery({ 
    queryKey: ['clients'], 
    queryFn: clientService.getAll 
  });

  const { data, isLoading: loadingSales } = useQuery({
    queryKey: ['sales'],
    queryFn: async () => {
      const res = await api.get('/sales');
      return res.data;
    }
  });

  const sales = data?.data || [];

  if (loadingClients || loadingSales) {
    return <div className="p-10 font-bold uppercase tracking-widest text-xs text-slate-400">Cargando tablero...</div>;
  }

  // Totales
  const totalDebtPortfolio = clients?.reduce((acc: number, c: any) => {
    const balance = Number(c.saldo_deuda);
    return balance < 0 ? acc + Math.abs(balance) : acc;
  }, 0) || 0;
  const debtorClientsCount = clients?.filter((c: any) => Number(c.saldo_deuda) < 0).length || 0;

  const last7Days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();

  const salesChartData = last7Days.map(dateStr => {
    const daySales = sales.filter((s: any) => new Date(s.fecha).toISOString().split('T')[0] === dateStr);
    return {
      name: dateStr.split('-')[2] + '/' + dateStr.split('-')[1],
      total: daySales.reduce((acc: number, s: any) => acc + Number(s.total_real_ars), 0)
    };
  });

  return (
    <div className="space-y-16 py-4 animate-fade-in">
      <div className="flex justify-between items-end border-b-2 border-slate-900 pb-4">
        <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900">Inicio</h1>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">Panel de Gestión Fiscal</p>
      </div>

      {/* KPI GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="border-l-4 border-blue-600 bg-slate-50 pl-6 py-6 transition-all hover:bg-slate-100">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Deuda Cartera</p>
          <p className="text-3xl font-black text-slate-900">${totalDebtPortfolio.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</p>
          <p className="text-[10px] font-bold uppercase text-red-500 mt-2">{debtorClientsCount} Clientes con Saldo Pendiente</p>
        </div>

        <div className="border-l-4 border-slate-900 bg-slate-50 pl-6 py-6 transition-all hover:bg-slate-100">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Operaciones del Mes</p>
          <p className="text-3xl font-black text-slate-900">{sales?.length || 0}</p>
          <p className="text-[10px] font-bold uppercase text-slate-400 mt-2">Registros Procesados</p>
        </div>

        <Link to="/facturacion/nueva" className="bg-blue-600 text-white p-8 flex flex-col justify-between hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-80">Acceso Directo</p>
          <span className="text-xl font-black uppercase">Facturar →</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-16">
        {/* CHART VENTAS */}
        <section>
          <div className="flex justify-between items-end mb-8">
            <h3 className="text-xs font-black uppercase tracking-[0.4em] text-slate-900">Evolución Semanal de Facturación</h3>
            <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">VALORES EN PESOS ARGENTINOS</span>
          </div>
          <div className="h-[350px] w-full border-t border-slate-100 pt-10">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 'bold'}} dy={10} />
                <YAxis hide />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}} 
                  contentStyle={{border: '1px solid #1e293b', borderRadius: '0px', padding: '12px', fontWeight: 'bold'}}
                />
                <Bar dataKey="total" fill="#1e293b" radius={[4, 4, 0, 0]} barSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* ACCIONES RAPIDAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-12 border-t border-slate-100">
         <Link to="/clientes" className="bg-white border border-slate-200 p-8 hover:border-blue-600 transition-all group">
           <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest block mb-4 group-hover:text-blue-600 transition-colors">Cartera Comercial</span>
           <span className="text-2xl font-black uppercase block mb-2 text-slate-900">Clientes & Cuentas</span>
           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Gestión de saldos blancos y negros</span>
         </Link>

         <button onClick={() => setIsImportModalOpen(true)} className="bg-white border border-slate-200 p-8 hover:border-blue-600 transition-all text-left group">
           <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest block mb-4 group-hover:text-blue-600 transition-colors">Integración Externa</span>
           <span className="text-2xl font-black uppercase block mb-2 text-slate-900">Importar Movimientos</span>
           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Sincronizar CSV desde Aplicación de Stock</span>
         </button>
      </div>

      <ImportCSVModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />
    </div>
  );
};

export default Dashboard;
