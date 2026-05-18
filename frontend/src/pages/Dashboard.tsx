import { useQuery } from '@tanstack/react-query';
import { currencyService } from '../services/currencyService';
import { productService } from '../services/productService';
import { clientService } from '../services/clientService';
import api from '../services/api';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const { data: dolar } = useQuery({
    queryKey: ['dolar'],
    queryFn: currencyService.getDolarOficial,
    refetchInterval: 1000 * 60 * 10,
  });

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: productService.getAll,
  });

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: clientService.getAll,
  });

  const { data: salesData } = useQuery({
    queryKey: ['sales'],
    queryFn: async () => {
      const res = await api.get('/sales');
      return res.data;
    }
  });

  const { data: quotationsData } = useQuery({
    queryKey: ['quotations'],
    queryFn: async () => {
      const res = await api.get('/quotations');
      return res.data;
    }
  });

  const sales = salesData?.data;
  const quotations = quotationsData?.data;

  // Alertas de Stock
  const lowStockProducts = products?.filter((p: any) => p.stock_actual <= p.stock_minimo) || [];

  // Alertas de Vencimiento (próximos 30 días)
  const expiringBatches = products?.flatMap((p: any) => 
    p.batches?.filter((b: any) => {
      if (!b.fecha_vencimiento) return false;
      const days = (new Date(b.fecha_vencimiento).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
      return days > 0 && days <= 30;
    }).map((b: any) => ({ ...b, productName: p.nombre }))
  ) || [];

  // Métricas Financieras
  const totalDebt = clients?.reduce((acc: number, c: any) => acc + Number(c.saldo_deuda), 0) || 0;
  const salesThisMonth = sales?.filter((s: any) => {
    const saleDate = new Date(s.fecha);
    const now = new Date();
    return saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear();
  }).reduce((acc: number, s: any) => acc + Number(s.total_real_ars), 0) || 0;

  const pendingQuotations = quotations?.filter((q: any) => q.estado === 'PENDIENTE').length || 0;

  const inventoryValueUsd = products?.reduce((acc: number, p: any) => acc + (Number(p.stock_actual) * Number(p.precio_usd)), 0) || 0;
  
  const topProducts = products?.map((p: any) => ({
    ...p,
    value: Number(p.stock_actual) * Number(p.precio_usd)
  })).sort((a: any, b: any) => b.value - a.value).slice(0, 3) || [];

  return (
    <div className="p-6 md:p-10 max-w-[1600px] mx-auto animate-fade-in">
      <div className="mb-8 md:mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
        <div>
          <h1 className="text-4xl md:text-6xl font-bold text-slate-800 tracking-tighter mb-1 italic">Tablero</h1>
          <p className="text-[11px] font-bold text-slate-400 tracking-[0.3em] uppercase">Control Central de Operaciones</p>
        </div>
        <div className="bg-[#FCFAF5] px-8 py-4 rounded-2xl shadow-soft border border-[#E9E4DB] text-left sm:text-right w-full sm:w-auto">
          <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-1">Dólar Oficial BNA</p>
          <p className="text-3xl font-bold text-[#005F73]">${dolar?.cotizacion || '0.00'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-5 mb-12">
        {[
          { label: 'Ventas del Mes', value: `$${salesThisMonth.toLocaleString('es-AR')}`, sub: 'Facturado', color: 'text-slate-800', bg: 'bg-[#FCFAF5]' },
          { label: 'Presupuestos', value: pendingQuotations, sub: 'Pendientes', color: 'text-[#005F73]', bg: 'bg-[#94D2BD]/10' },
          { label: 'Deuda a Cobrar', value: `$${totalDebt.toLocaleString('es-AR')}`, sub: 'Saldo Pendiente', color: 'text-[#AE2012]', bg: 'bg-[#AE2012]/5' },
          { label: 'Valor Depósito', value: `USD ${inventoryValueUsd.toLocaleString('en-US', {maximumFractionDigits: 0})}`, sub: 'Capital', color: 'text-[#0A9396]', bg: 'bg-[#0A9396]/5' },
          { label: 'Vencimientos', value: expiringBatches.length, sub: 'Próximos 30 días', color: expiringBatches.length > 0 ? 'text-[#CA6702]' : 'text-[#005F73]', bg: expiringBatches.length > 0 ? 'bg-[#CA6702]/5' : 'bg-[#94D2BD]/10' },
        ].map((kpi, i) => (
          <div key={i} className={`${kpi.bg} p-6 rounded-[28px] border border-[#E9E4DB]/60 shadow-soft hover:shadow-md transition-smooth group animate-slide-up`} style={{ animationDelay: `${i * 0.1}s` }}>
            <span className="text-slate-400 font-bold text-[10px] tracking-widest uppercase block mb-3 group-hover:text-[#005F73] transition-colors">{kpi.label}</span>
            <div className={`text-2xl font-bold tracking-tight ${kpi.color}`}>
              {kpi.value}
            </div>
            <p className="text-slate-400 text-[10px] font-medium mt-3 uppercase tracking-wider italic opacity-60">{kpi.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 md:gap-10">
        {/* Sección de Alertas y Rankings */}
        <div className="xl:col-span-2 space-y-6 md:space-y-8 animate-slide-up" style={{ animationDelay: '0.5s' }}>
          <section className="bg-[#FCFAF5] border border-[#E9E4DB] rounded-[40px] p-6 md:p-8 shadow-soft">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
              <h2 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight">Alertas de Gestión</h2>
              <span className="bg-[#F1EDE4] px-4 py-1.5 rounded-full text-[10px] font-bold text-slate-500 uppercase tracking-widest border border-[#E9E4DB]/50">Prioridad Alta</span>
            </div>
            
            <div className="space-y-4 mb-8">
              {expiringBatches.map((batch: any, i) => (
                <div key={i} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 bg-[#CA6702]/5 rounded-2xl border border-[#CA6702]/10 shadow-sm hover:border-[#CA6702]/30 transition-smooth gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-2 h-2 bg-[#CA6702] rounded-full animate-pulse"></span>
                      <p className="text-[10px] text-[#CA6702] font-bold uppercase tracking-widest">Vencimiento Cercano</p>
                    </div>
                    <p className="text-lg font-bold text-slate-800 uppercase leading-tight">{batch.productName}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Lote: {batch.nro_lote}</p>
                  </div>
                  <div className="text-left sm:text-right w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-[#CA6702]/10">
                    <p className="text-xl font-bold text-[#CA6702]">{new Date(batch.fecha_vencimiento).toLocaleDateString()}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Fecha Límite</p>
                  </div>
                </div>
              ))}

              {lowStockProducts.map((p: any) => (
                <div key={p.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 bg-[#AE2012]/5 rounded-2xl border border-[#AE2012]/10 shadow-sm hover:border-[#AE2012]/30 transition-smooth gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-2 h-2 bg-[#AE2012] rounded-full"></span>
                      <p className="text-[10px] text-[#AE2012] font-bold uppercase tracking-widest">Stock Crítico</p>
                    </div>
                    <p className="text-lg font-bold text-slate-800 uppercase leading-tight">{p.nombre}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{p.presentacion}</p>
                  </div>
                  <div className="text-left sm:text-right w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-[#AE2012]/10">
                    <p className="text-xl font-bold text-[#AE2012]">{p.stock_actual} Un</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">En Stock</p>
                  </div>
                </div>
              ))}

              {expiringBatches.length === 0 && lowStockProducts.length === 0 && (
                <div className="text-center py-12 bg-[#94D2BD]/10 rounded-3xl border border-dashed border-[#94D2BD]/30">
                  <div className="w-12 h-12 bg-[#94D2BD]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-[#005F73] text-xl font-bold">✓</span>
                  </div>
                  <p className="text-slate-500 font-bold uppercase text-[11px] tracking-widest">Sin Alertas Pendientes</p>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-t border-[#E9E4DB]/50 pt-8 gap-4">
              <h2 className="text-lg font-bold text-slate-800 tracking-tight uppercase">Valorización de Activos</h2>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inversión Actual en Depósito</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {topProducts.map((p: any, i) => (
                <div key={p.id} className="bg-[#FCFAF5] p-6 rounded-2xl border border-[#E9E4DB] hover:border-[#94D2BD] hover:bg-white hover:shadow-md transition-smooth">
                   <div className="flex justify-between items-center mb-3">
                     <span className="text-slate-300 font-bold text-[10px]">RANK #{i+1}</span>
                     <span className="w-2 h-2 bg-[#94D2BD] rounded-full"></span>
                   </div>
                   <p className="font-bold text-slate-700 uppercase leading-none mb-1 text-sm truncate">{p.nombre}</p>
                   <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-3 italic">{p.stock_actual} Unidades</p>
                   <p className="text-xl font-bold text-[#005F73] tracking-tight">USD {p.value.toLocaleString('en-US', {maximumFractionDigits: 0})}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Accesos Rápidos */}
        <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.7s' }}>
          <Link to="/ventas/nueva" className="block bg-[#005F73] p-8 rounded-[40px] shadow-lg shadow-[#005F73]/10 hover:bg-[#001219] transition-smooth group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 group-hover:scale-125 transition-transform duration-500"></div>
            <span className="text-[#94D2BD] font-bold text-[11px] tracking-[0.2em] uppercase mb-6 block relative z-10">Operación</span>
            <div className="flex justify-between items-center text-white relative z-10">
              <span className="text-2xl font-bold tracking-tight">Nueva Venta</span>
              <span className="text-3xl group-hover:translate-x-2 transition-smooth">→</span>
            </div>
          </Link>

          <Link to="/productos" className="block bg-slate-800 p-8 rounded-[40px] shadow-lg hover:bg-slate-900 transition-smooth group text-white">
            <span className="text-slate-400 font-bold text-[11px] tracking-[0.2em] uppercase mb-6 block">Gestión Física</span>
            <div className="flex justify-between items-center">
              <span className="text-2xl font-bold tracking-tight">Stock e Inventario</span>
              <div className="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center group-hover:rotate-6 transition-smooth">
                <span className="text-xl">📦</span>
              </div>
            </div>
          </Link>

          <Link to="/clientes" className="block bg-[#FCFAF5] border border-[#E9E4DB] p-8 rounded-[40px] shadow-soft hover:bg-white hover:border-[#94D2BD] transition-smooth group">
            <span className="text-slate-400 font-bold text-[11px] tracking-[0.2em] uppercase mb-6 block">Directorio</span>
            <div className="flex justify-between items-center text-slate-800">
              <span className="text-2xl font-bold tracking-tight">Cartera de Clientes</span>
              <div className="w-12 h-12 rounded-xl bg-[#F1EDE4] flex items-center justify-center group-hover:bg-[#94D2BD]/20 transition-smooth">
                <span className="text-xl">👥</span>
              </div>
            </div>
          </Link>

          <Link to="/cotizaciones" className="block bg-[#0A9396] p-8 rounded-[40px] shadow-lg shadow-[#0A9396]/10 hover:bg-[#005F73] transition-smooth group text-white">
             <span className="text-[#94D2BD] font-bold text-[11px] tracking-[0.2em] uppercase mb-6 block">Comercial</span>
             <div className="flex justify-between items-center relative z-10">
               <span className="text-2xl font-bold tracking-tight">Presupuestos</span>
               <span className="text-xl">📄</span>
             </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
