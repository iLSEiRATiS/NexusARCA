import { useQuery } from '@tanstack/react-query';
import { currencyService } from '../services/currencyService';
import { productService } from '../services/productService';
import { clientService } from '../services/clientService';
import api from '../services/api';
import { Link } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Cell, PieChart, Pie
} from 'recharts';
import { CardSkeleton } from '../components/Skeletons';

const Dashboard = () => {
  const { data: dolar, isLoading: loadingDolar } = useQuery({ 
    queryKey: ['dolar'], 
    queryFn: currencyService.getDolarOficial 
  });

  const { data: products, isLoading: loadingProducts } = useQuery({ 
    queryKey: ['products'], 
    queryFn: productService.getAll 
  });

  const { data: clients, isLoading: loadingClients } = useQuery({ 
    queryKey: ['clients'], 
    queryFn: clientService.getAll 
  });

  const { data: sales, isLoading: loadingSales } = useQuery({
    queryKey: ['sales'],
    queryFn: async () => {
      const res = await api.get('/sales');
      return res.data;
    }
  });

  if (loadingDolar || loadingProducts || loadingClients || loadingSales) {
    return <div className="p-10"><CardSkeleton /></div>;
  }

  // Logic for charts
  const totalStock = products?.reduce((acc: number, p: any) => acc + (p.stock_actual || 0), 0);
  const lowStockCount = products?.filter((p: any) => p.stock_actual <= p.stock_minimo).length;
  const totalDebt = clients?.reduce((acc: number, c: any) => acc + Number(c.saldo_deuda), 0);

  // Sales evolution (last 7 days)
  const last7Days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toLocaleDateString();
  }).reverse();

  const salesChartData = last7Days.map(date => {
    const daySales = sales?.filter((s: any) => new Date(s.fecha).toLocaleDateString() === date) || [];
    return {
      name: date.split('/')[0] + '/' + date.split('/')[1],
      total: daySales.reduce((acc: number, s: any) => acc + Number(s.total_real_ars), 0)
    };
  });

  // Top products by stock
  const topProducts = products?.sort((a: any, b: any) => b.stock_actual - a.stock_actual).slice(0, 5) || [];

  return (
    <div className="p-6 md:p-10 animate-fade-in space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-800 tracking-tight mb-2">Tablero</h1>
          <p className="text-slate-400 font-medium text-[11px] uppercase tracking-widest italic">Estado General del Negocio</p>
        </div>
        <div className="bg-white px-6 py-4 rounded-[24px] border border-slate-100 shadow-premium flex items-center gap-6">
           <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Dólar Oficial (Venta)</span>
              <span className="text-2xl font-black text-[#005F73]">${dolar?.cotizacion || '0.00'}</span>
           </div>
           <div className="w-px h-10 bg-slate-100"></div>
           <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Actualización</span>
              <span className="text-xs font-bold text-slate-500 uppercase">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} HS</span>
           </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-soft group hover:shadow-premium transition-smooth">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Cartera de Deuda</p>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-bold text-slate-800 tracking-tighter">${totalDebt?.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
            <span className="bg-rose-50 text-rose-500 p-2 rounded-xl text-xs font-bold">-{clients?.filter((c:any)=>Number(c.saldo_deuda)>0).length} Clientes</span>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-soft group hover:shadow-premium transition-smooth">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Items en Stock</p>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-bold text-slate-800 tracking-tighter">{totalStock} <span className="text-sm text-slate-300">Un</span></span>
            <span className={`p-2 rounded-xl text-xs font-bold ${lowStockCount > 0 ? 'bg-amber-50 text-amber-600 animate-pulse' : 'bg-emerald-50 text-emerald-600'}`}>
              {lowStockCount} Críticos
            </span>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-soft group hover:shadow-premium transition-smooth">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Ventas del Mes</p>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-bold text-slate-800 tracking-tighter">{sales?.length || 0}</span>
            <span className="bg-sky-50 text-sky-600 p-2 rounded-xl text-xs font-bold">Operaciones</span>
          </div>
        </div>

        <div className="bg-emerald-600 p-8 rounded-[32px] shadow-emerald-100 shadow-xl group hover:scale-[1.02] transition-smooth cursor-pointer">
          <p className="text-[10px] font-bold text-emerald-200 uppercase tracking-widest mb-4 italic">Acceso Rápido</p>
          <Link to="/ventas/nueva" className="flex items-center justify-between text-white">
            <span className="text-xl font-bold">Nueva Venta</span>
            <span className="text-2xl">→</span>
          </Link>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-soft">
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-bold text-slate-800 uppercase text-xs tracking-widest flex items-center gap-3">
                <span className="w-2 h-6 bg-emerald-400 rounded-full"></span>
                Evolución de Ventas (7D)
              </h3>
              <span className="text-[10px] font-bold text-slate-400">MONTO EN ARS</span>
            </div>
            <div className="h-[300px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} dy={10} />
                    <YAxis hide />
                    <Tooltip 
                      cursor={{fill: '#f8fafc'}} 
                      contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                    />
                    <Bar dataKey="total" fill="#005F73" radius={[8, 8, 0, 0]} barSize={35} />
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </div>

         <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-soft">
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-bold text-slate-800 uppercase text-xs tracking-widest flex items-center gap-3">
                <span className="w-2 h-6 bg-[#E9D8A6] rounded-full"></span>
                Stock por Producto
              </h3>
              <Link to="/productos" className="text-[10px] font-bold text-sky-600 hover:underline">VER TODO</Link>
            </div>
            <div className="h-[300px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProducts} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="nombre" type="category" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 9, fontWeight: 'bold'}} width={100} />
                    <Tooltip 
                      cursor={{fill: '#f8fafc'}}
                      contentStyle={{borderRadius: '16px', border: 'none'}}
                    />
                    <Bar dataKey="stock_actual" fill="#94D2BD" radius={[0, 8, 8, 0]} barSize={20} />
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        <Link to="/productos" className="group">
           <div className="bg-[#EAE2D6]/40 p-8 rounded-[32px] border border-[#D6CCC2]/50 hover:bg-white transition-smooth flex items-center justify-between">
             <div className="flex items-center gap-5">
               <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm">📦</div>
               <div>
                 <span className="text-lg font-bold text-[#333D29] block">Gestión de Stock</span>
                 <span className="text-xs text-slate-500 font-medium">Controlar inventario y lotes</span>
               </div>
             </div>
             <span className="text-[#333D29]/20 group-hover:translate-x-2 transition-transform">→</span>
           </div>
        </Link>
        <Link to="/clientes" className="group">
           <div className="bg-[#EAE2D6]/40 p-8 rounded-[32px] border border-[#D6CCC2]/50 hover:bg-white transition-smooth flex items-center justify-between">
             <div className="flex items-center gap-5">
               <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm">👥</div>
               <div>
                 <span className="text-lg font-bold text-[#333D29] block">Directorio de Clientes</span>
                 <span className="text-xs text-slate-500 font-medium">Cuentas corrientes y saldos</span>
               </div>
             </div>
             <span className="text-[#333D29]/20 group-hover:translate-x-2 transition-transform">→</span>
           </div>
        </Link>
      </div>
    </div>
  );
};

export default Dashboard;
