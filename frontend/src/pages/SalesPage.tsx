import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { generateSalePDF } from '../services/pdfService';
import { useState } from 'react';
import { Link } from 'react-router-dom';

const SalesPage = () => {
  const [searchTerm, setSearchBar] = useState('');
  const { data: salesData, isLoading, error } = useQuery({
    queryKey: ['sales'],
    queryFn: async () => {
      const res = await api.get('/sales');
      return res.data;
    }
  });

  const sales = salesData?.data;

  const filteredSales = sales?.filter((s: any) => 
    s.client?.razon_social.toLowerCase().includes(searchTerm.toLowerCase()) || 
    String(s.id).includes(searchTerm)
  );

  if (isLoading) return (
    <div className="p-12 text-center space-y-4 animate-pulse">
      <div className="h-12 bg-slate-100 rounded-2xl w-48 mx-auto"></div>
      <div className="h-[60vh] bg-slate-50 rounded-[32px]"></div>
    </div>
  );
  if (error) return <div className="p-12 text-rose-500 font-bold text-center">Error al cargar historial</div>;

  return (
    <div className="p-6 md:p-10 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-800 tracking-tight mb-2">Ventas</h1>
          <p className="text-slate-400 font-medium text-[11px] uppercase tracking-widest italic">Registro Histórico de Operaciones</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative flex-1 sm:w-64">
            <input 
              type="text" 
              placeholder="Buscar por cliente o ID..." 
              value={searchTerm}
              onChange={(e) => setSearchBar(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400 transition-smooth shadow-sm"
            />
          </div>
          <Link 
            to="/ventas/nueva"
            className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm tracking-tight hover:bg-emerald-700 transition-smooth shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
          >
            <span>+</span> Nueva Operación
          </Link>
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
                <th className="px-6 py-5 font-bold text-[11px] text-slate-400 uppercase tracking-widest text-center">Tipo</th>
                <th className="px-6 py-5 font-bold text-[11px] text-slate-400 uppercase tracking-widest text-center">Monto Total</th>
                <th className="px-8 py-5 font-bold text-[11px] text-slate-400 uppercase tracking-widest text-right">Comprobantes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredSales?.map((sale: any) => (
                <tr key={sale.id} className="group hover:bg-slate-50/30 transition-smooth">
                  <td className="px-8 py-6">
                    <div className="font-bold text-slate-700">#{String(sale.id).padStart(5, '0')}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">{new Date(sale.fecha).toLocaleDateString()}</div>
                  </td>
                  <td className="px-6 py-6">
                    <div className="font-bold text-slate-700 uppercase text-sm">{sale.client?.razon_social}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">CUIT: {sale.client?.cuit}</div>
                  </td>
                  <td className="px-6 py-6 text-center">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border ${sale.tipo_comprobante?.includes('Factura') ? 'bg-sky-50 text-sky-600 border-sky-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                      {sale.tipo_comprobante || 'Venta'}
                    </span>
                  </td>
                  <td className="px-6 py-6 text-center">
                    <div className="text-lg font-bold text-slate-700 tracking-tight">${Number(sale.total_real_ars).toLocaleString('es-AR')}</div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Monto Final</div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button 
                      onClick={() => generateSalePDF(sale)}
                      className="bg-white border border-slate-200 text-slate-600 px-4 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-smooth shadow-sm"
                    >
                      Descargar PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredSales?.map((sale: any) => (
            <div key={sale.id} className="p-5 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-slate-700">#{String(sale.id).padStart(5, '0')}</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{new Date(sale.fecha).toLocaleDateString()}</div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider border ${sale.tipo_comprobante?.includes('Factura') ? 'bg-sky-50 text-sky-600 border-sky-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                  {sale.tipo_comprobante || 'Venta'}
                </span>
              </div>

              <div>
                <div className="font-bold text-slate-700 uppercase text-sm truncate">{sale.client?.razon_social}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">CUIT: {sale.client?.cuit}</div>
              </div>

              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="text-xl font-bold text-slate-700 tracking-tight">
                  ${Number(sale.total_real_ars).toLocaleString('es-AR')}
                </div>
                <button 
                  onClick={() => generateSalePDF(sale)}
                  className="bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-lg font-bold text-[9px] uppercase tracking-wider shadow-sm flex items-center gap-2"
                >
                  📄 PDF
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredSales?.length === 0 && (
          <div className="py-20 text-center">
            <p className="text-slate-300 font-bold uppercase tracking-[0.2em] italic text-sm">Sin movimientos que mostrar</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesPage;
