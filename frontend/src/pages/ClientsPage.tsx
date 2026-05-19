import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientService } from '../services/clientService';
import api from '../services/api';
import { toast } from 'sonner';
import { generateAccountStatementPDF } from '../services/pdfService';
import ConfirmModal from '../components/ConfirmModal';
import { TableSkeleton } from '../components/Skeletons';

const ClientsPage = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchBar] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  
  // State for stylized confirm modal
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; clientId: number | null }>({
    isOpen: false,
    clientId: null
  });

  const [formData, setFormData] = useState({
    razon_social: '',
    cuit: '',
    direccion: '',
    condicion_iva: 'RESPONSABLE_INSCRIPTO',
    nro_iibb: '',
    telefono: '',
    porcentaje_facturacion: 80
  });

  const [paymentData, setPaymentData] = useState({
    monto: 0,
    metodo: 'EFECTIVO',
    referencia: '',
    imputacion: 'MIXTO' 
  });

  const { data: clients, isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: clientService.getAll,
  });

  const { data: clientDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['client', selectedClient?.id],
    queryFn: async () => {
      const res = await clientService.getById(selectedClient.id);
      return res;
    },
    enabled: !!selectedClient && isDetailsModalOpen,
  });

  const filteredClients = clients?.filter((c: any) => 
    c.razon_social.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.cuit.includes(searchTerm)
  );

  const createMutation = useMutation({
    mutationFn: clientService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setIsModalOpen(false);
      resetForm();
      toast.success('Cliente registrado correctamente');
    },
    onError: (err: any) => {
      console.error('Error creating client:', err);
      toast.error(err.response?.data?.message || 'Error al registrar cliente. Verifique los datos.');
    }
  });

  const paymentMutation = useMutation({
    mutationFn: async (data: any) => {
      return api.post(`/clients/${selectedClient.id}/payments`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client', selectedClient?.id] });
      setIsPaymentModalOpen(false);
      setPaymentData({ monto: 0, metodo: 'EFECTIVO', referencia: '', imputacion: 'MIXTO' });
      toast.success('COBRO REGISTRADO EXITOSAMENTE');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al registrar cobro');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: clientService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Cliente eliminado');
      setDeleteConfirm({ isOpen: false, clientId: null });
    }
  });

  const resetForm = () => {
    setFormData({
      razon_social: '',
      cuit: '',
      direccion: '',
      condicion_iva: 'RESPONSABLE_INSCRIPTO',
      nro_iibb: '',
      telefono: '',
      porcentaje_facturacion: 80
    });
  };

  const openPaymentModal = (client: any) => {
    setSelectedClient(client);
    setIsPaymentModalOpen(true);
  };

  const openDetails = (client: any) => {
    setSelectedClient(client);
    setIsDetailsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    paymentMutation.mutate(paymentData);
  };

  const handleDeleteClick = (id: number) => {
    setDeleteConfirm({ isOpen: true, clientId: id });
  };

  const confirmDelete = () => {
    if (deleteConfirm.clientId) {
      deleteMutation.mutate(deleteConfirm.clientId);
    }
  };

  const handleExportStatement = () => {
    if (!selectedClient || !clientDetails) return;
    
    // Merge sales and payments for chronological history
    const history = [
      ...(clientDetails.sales || []).map((s: any) => ({ ...s, tipo: 'VENTA' })),
      ...(clientDetails.payments || []).map((p: any) => ({ ...p, tipo: 'COBRO' }))
    ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    generateAccountStatementPDF(selectedClient, history);
  };

  if (isLoading) return (
    <div className="p-6 md:p-10">
      <TableSkeleton />
    </div>
  );

  return (
    <div className="p-6 md:p-10 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-800 tracking-tight mb-2">Clientes</h1>
          <p className="text-slate-400 font-medium text-[11px] uppercase tracking-widest italic">Cuentas Corrientes y Directorio</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative flex-1 sm:w-64">
            <input 
              type="text" 
              placeholder="Buscar por razón social..." 
              value={searchTerm}
              onChange={(e) => setSearchBar(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400 transition-smooth shadow-sm"
            />
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm tracking-tight hover:bg-emerald-700 transition-smooth shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
          >
            <span>+</span> Nuevo Cliente
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-[24px] shadow-soft overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 font-bold text-[11px] text-slate-400 uppercase tracking-widest">Razón Social / CUIT</th>
                <th className="px-6 py-5 font-bold text-[11px] text-slate-400 uppercase tracking-widest text-center">Estado de Cuenta</th>
                <th className="px-6 py-5 font-bold text-[11px] text-slate-400 uppercase tracking-widest text-center">Split Base</th>
                <th className="px-8 py-5 font-bold text-[11px] text-slate-400 uppercase tracking-widest text-right">Gestión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredClients?.map((client: any) => {
                const totalDebt = Number(client.saldo_deuda);
                const hasDebt = totalDebt > 0;
                
                return (
                  <tr key={client.id} className="group hover:bg-slate-50/30 transition-smooth">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                         <div className={`w-3 h-3 rounded-full ${totalDebt > 100000 ? 'bg-rose-500 animate-pulse' : totalDebt > 0 ? 'bg-amber-400' : 'bg-emerald-400'}`}></div>
                         <div className="font-bold text-slate-700 text-lg uppercase group-hover:text-emerald-700 transition-colors cursor-pointer" onClick={() => openDetails(client)}>
                           {client.razon_social}
                         </div>
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1 ml-6">
                        CUIT: {client.cuit} • {client.condicion_iva}
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex justify-center gap-3">
                         <div className="px-4 py-2 rounded-2xl bg-sky-50 border border-sky-100/50 text-center min-w-[120px]">
                            <p className="text-[8px] font-bold text-sky-400 uppercase tracking-widest">En blanco</p>
                            <p className="text-sm font-bold text-sky-700">${Number(client.saldo_blanco).toLocaleString('es-AR')}</p>
                         </div>
                         <div className="px-4 py-2 rounded-2xl bg-slate-50 border border-slate-100/50 text-center min-w-[120px]">
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">EnGroncho</p>
                            <p className="text-sm font-bold text-slate-700">${Number(client.saldo_negro).toLocaleString('es-AR')}</p>
                         </div>
                         <div className={`px-4 py-2 rounded-2xl border text-center min-w-[120px] shadow-sm ${hasDebt ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
                            <p className="text-[8px] font-bold uppercase tracking-widest opacity-60">Total Deuda</p>
                            <p className="text-sm font-bold">${totalDebt.toLocaleString('es-AR')}</p>
                         </div>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <span className="bg-slate-100 px-3 py-1 rounded-lg text-slate-600 font-bold text-xs">
                        {client.porcentaje_facturacion}%
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => openDetails(client)}
                          className="bg-sky-50 text-sky-700 px-4 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider hover:bg-sky-100 transition-smooth border border-sky-100"
                        >
                          Historial
                        </button>
                        <button 
                          onClick={() => openPaymentModal(client)}
                          className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider hover:bg-emerald-700 transition-smooth shadow-sm"
                        >
                          Cobrar
                        </button>
                        <button 
                          onClick={() => handleDeleteClick(client.id)}
                          className="bg-slate-50 text-slate-400 px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider hover:bg-rose-50 hover:text-rose-600 transition-smooth border border-slate-200"
                        >
                          &times;
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredClients?.map((client: any) => {
            const totalDebt = Number(client.saldo_deuda);
            const hasDebt = totalDebt > 0;

            return (
              <div key={client.id} className="p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1 flex gap-3">
                    <div className={`w-3 h-3 rounded-full shrink-0 mt-1.5 ${totalDebt > 100000 ? 'bg-rose-500 animate-pulse' : totalDebt > 0 ? 'bg-amber-400' : 'bg-emerald-400'}`}></div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-700 text-lg uppercase leading-tight truncate" onClick={() => openDetails(client)}>
                        {client.razon_social}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                        CUIT: {client.cuit} • {client.porcentaje_facturacion}% Split
                      </div>
                    </div>
                  </div>
                  <div className={`shrink-0 px-3 py-1 rounded-full border text-center ml-2 ${hasDebt ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
                    <p className="text-[11px] font-bold">${totalDebt.toLocaleString('es-AR')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                   <div className="p-3 rounded-xl bg-sky-50 border border-sky-100/50 text-center">
                      <p className="text-[8px] font-bold text-sky-400 uppercase tracking-widest mb-1">Blanco</p>
                      <p className="text-sm font-bold text-sky-700">${Number(client.saldo_blanco).toLocaleString('es-AR')}</p>
                   </div>
                   <div className="p-3 rounded-xl bg-slate-50 border border-slate-100/50 text-center">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">EnGroncho</p>
                      <p className="text-sm font-bold text-slate-700">${Number(client.saldo_negro).toLocaleString('es-AR')}</p>
                   </div>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => openDetails(client)}
                    className="flex-1 bg-sky-50 text-sky-700 py-2.5 rounded-xl font-bold text-[10px] uppercase border border-sky-100"
                  >
                    Historial
                  </button>
                  <button 
                    onClick={() => openPaymentModal(client)}
                    className="flex-[1.5] bg-emerald-600 text-white py-2.5 rounded-xl font-bold text-[10px] uppercase shadow-lg shadow-emerald-100"
                  >
                    Registrar Cobro
                  </button>
                  <button 
                    onClick={() => handleDeleteClick(client.id)}
                    className="w-12 bg-slate-50 text-slate-400 flex items-center justify-center rounded-xl border border-slate-200"
                  >
                    &times;
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Details Modal */}
      {isDetailsModalOpen && selectedClient && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-[24px] sm:rounded-[32px] w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh] animate-slide-up border border-slate-200">
            <div className="bg-slate-50 p-6 sm:p-8 border-b border-slate-100 flex justify-between items-start">
              <div className="flex-1">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-800 tracking-tight uppercase leading-tight">{selectedClient.razon_social}</h2>
                <div className="flex flex-wrap gap-2 sm:gap-4 mt-2">
                   <span className="text-slate-400 font-bold text-[9px] sm:text-[10px] tracking-widest uppercase">CUIT: {selectedClient.cuit}</span>
                   <span className="text-emerald-600 font-bold text-[9px] sm:text-[10px] tracking-widest uppercase">Split: {selectedClient.porcentaje_facturacion}%</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleExportStatement}
                  className="hidden sm:flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-wider hover:bg-slate-900 transition-smooth"
                >
                  📄 Estado de Cuenta
                </button>
                <button onClick={() => setIsDetailsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-smooth text-3xl font-light leading-none px-2">&times;</button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-white">
              <div className="sm:hidden mb-6">
                <button 
                  onClick={handleExportStatement}
                  className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold text-[10px] uppercase tracking-wider"
                >
                  📄 Descargar Estado de Cuenta
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 mb-10">
                 <div className="p-5 sm:p-6 rounded-2xl bg-sky-50 border border-sky-100 shadow-sm">
                    <p className="text-[10px] font-bold text-sky-400 uppercase tracking-widest mb-2">Deuda en blanco</p>
                    <p className="text-2xl sm:text-3xl font-bold text-sky-700">${Number(selectedClient.saldo_blanco).toLocaleString('es-AR')}</p>
                 </div>
                 <div className="p-5 sm:p-6 rounded-2xl bg-slate-50 border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Deuda EnGroncho</p>
                    <p className="text-2xl sm:text-3xl font-bold text-slate-700">${Number(selectedClient.saldo_negro).toLocaleString('es-AR')}</p>
                 </div>
                 <div className="p-5 sm:p-6 rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-100 flex flex-col justify-between">
                    <div>
                       <p className="text-[10px] font-bold text-emerald-200 uppercase tracking-widest mb-1">Total Adeudado</p>
                       <p className="text-2xl sm:text-3xl font-bold">${Number(selectedClient.saldo_deuda).toLocaleString('es-AR')}</p>
                    </div>
                    <button onClick={() => setIsPaymentModalOpen(true)} className="mt-4 bg-white/20 hover:bg-white/30 text-white py-2 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-smooth">Registrar Cobro</button>
                 </div>
              </div>

              <div className="space-y-4">
                 <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-50 pb-2 uppercase tracking-tight">Actividad Reciente</h3>
                 {isLoadingDetails ? (
                    <div className="text-center py-10 text-slate-300 font-bold uppercase text-xs">Cargando historial...</div>
                 ) : (
                    <div className="space-y-3">
                       {(!clientDetails?.sales?.length && !clientDetails?.payments?.length) && <p className="text-center py-10 text-slate-400 italic text-sm">Sin movimientos registrados</p>}
                       {/* Simplified history combining sales and payments */}
                       {[...(clientDetails?.sales || []).map((s:any)=>({...s, type:'venta'})), ...(clientDetails?.payments || []).map((p:any)=>({...p, type:'cobro'}))].sort((a,b)=>new Date(b.fecha).getTime() - new Date(a.fecha).getTime()).map((item: any, idx: number) => (
                          <div key={idx} className="p-4 sm:p-5 rounded-2xl border border-slate-100 hover:bg-slate-50/50 transition-smooth flex flex-col sm:flex-row justify-between items-center gap-4">
                             <div className="text-center sm:text-left">
                                <p className="font-bold text-slate-700 text-sm uppercase">
                                  {item.type === 'venta' ? `Venta #${String(item.id).padStart(4, '0')}` : 'Cobro Recibido'}
                                </p>
                                <p className="text-[10px] font-medium text-slate-400 uppercase">
                                  {new Date(item.fecha).toLocaleDateString()} • {item.tipo_comprobante || item.metodo_pago}
                                </p>
                             </div>
                             <div className="text-right">
                                <p className={`text-lg font-bold ${item.type === 'venta' ? 'text-rose-500' : 'text-emerald-600'}`}>
                                  {item.type === 'venta' ? '+' : '-'}${Number(item.total_real_ars || item.monto_ars).toLocaleString('es-AR')}
                                </p>
                             </div>
                          </div>
                       ))}
                    </div>
                 )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Client Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#F2EBE1] sm:bg-slate-900/60 sm:backdrop-blur-sm z-[100] flex items-center justify-center">
          <div className="bg-white w-full h-full sm:h-auto sm:max-h-[92vh] sm:rounded-[32px] sm:w-[95%] sm:max-w-2xl shadow-2xl overflow-hidden flex flex-col animate-slide-up">
            <div className="bg-slate-800 px-6 sm:px-10 py-6 sm:py-8 text-white flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight uppercase">Nuevo Cliente</h2>
                <p className="text-slate-400 text-[10px] font-bold tracking-widest uppercase mt-0.5 italic">Alta en Cartera Comercial</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-full text-2xl font-light sm:hover:bg-white/20 transition-smooth"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 sm:p-10 overflow-y-auto flex-1 custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Razón Social</label>
                  <input required type="text" value={formData.razon_social} onChange={e => setFormData({...formData, razon_social: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold text-slate-700 uppercase focus:border-emerald-500 outline-none transition-smooth text-lg sm:text-base shadow-sm"/>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">CUIT</label>
                  <input required type="text" value={formData.cuit} onChange={e => setFormData({...formData, cuit: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold text-slate-700 focus:border-emerald-500 outline-none transition-smooth text-lg sm:text-base shadow-sm"/>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Condición IVA</label>
                  <select value={formData.condicion_iva} onChange={e => setFormData({...formData, condicion_iva: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold text-slate-700 focus:border-emerald-500 outline-none transition-smooth text-lg sm:text-base shadow-sm">
                    <option value="RESPONSABLE_INSCRIPTO">Responsable Inscripto</option>
                    <option value="MONOTRIBUTO">Monotributo</option>
                    <option value="EXENTO">Exento</option>
                    <option value="CONSUMIDOR_FINAL">Consumidor Final</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Dirección Fiscal</label>
                  <input type="text" value={formData.direccion} onChange={e => setFormData({...formData, direccion: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold text-slate-700 focus:border-emerald-500 outline-none transition-smooth text-lg sm:text-base shadow-sm"/>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Teléfono</label>
                  <input type="text" value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold text-slate-700 focus:border-emerald-500 outline-none transition-smooth text-lg sm:text-base shadow-sm"/>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1.5">Split Oficial (%)</label>
                  <input required type="number" min="0" max="100" value={formData.porcentaje_facturacion} onChange={e => setFormData({...formData, porcentaje_facturacion: Number(e.target.value)})} className="w-full bg-emerald-50/50 border border-emerald-100 rounded-2xl px-5 py-4 font-bold text-emerald-700 focus:border-emerald-400 outline-none transition-smooth text-lg sm:text-base shadow-sm"/>
                </div>
              </div>
              
              <div className="mt-10 space-y-3">
                 <button type="submit" className="w-full bg-slate-800 text-white py-5 rounded-2xl font-bold text-sm uppercase tracking-widest shadow-xl sm:hover:bg-slate-900 transition-smooth">
                   Confirmar Alta
                 </button>
                 <button type="button" onClick={() => setIsModalOpen(false)} className="w-full py-4 rounded-2xl font-bold text-sm uppercase text-slate-400 sm:hover:bg-slate-50 transition-smooth">
                   Cancelar
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {isPaymentModalOpen && selectedClient && (
        <div className="fixed inset-0 bg-[#F2EBE1] sm:bg-slate-900/60 sm:backdrop-blur-sm z-[100] flex items-center justify-center">
          <div className="bg-white w-full h-full sm:h-auto sm:max-h-[92vh] sm:rounded-[32px] sm:w-[95%] sm:max-w-lg shadow-2xl overflow-hidden flex flex-col animate-slide-up">
            <div className="bg-emerald-600 px-6 sm:px-10 py-6 sm:py-8 text-white flex justify-between items-start shrink-0">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight uppercase leading-tight">Registrar Cobro</h2>
                <p className="text-emerald-100 text-[10px] font-bold tracking-widest uppercase mt-1 italic">{selectedClient.razon_social}</p>
              </div>
              <button 
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-full text-2xl font-light sm:hover:bg-white/20 transition-smooth"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handlePaymentSubmit} className="p-6 sm:p-10 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
              <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-100 flex justify-between items-center mb-4">
                 <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Deuda Total</p>
                    <p className="text-xl sm:text-2xl font-bold text-slate-700">${Number(selectedClient.saldo_deuda).toLocaleString('es-AR')}</p>
                 </div>
                 <div className="text-right">
                    <p className="text-[10px] font-bold text-[#0A9396] uppercase tracking-widest">EnGroncho</p>
                    <p className="text-xs sm:text-sm font-bold text-[#005F73]">${Number(selectedClient.saldo_negro).toLocaleString('es-AR')}</p>
                 </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Monto a Cobrar (ARS)</label>
                <input required type="number" step="0.01" value={paymentData.monto === 0 ? '' : paymentData.monto} onChange={e => setPaymentData({...paymentData, monto: e.target.value === '' ? 0 : Number(e.target.value)})} className="w-full bg-white border-2 border-emerald-100 rounded-2xl px-4 sm:px-5 py-3 sm:py-4 font-bold text-xl sm:text-2xl text-emerald-700 focus:border-emerald-500 outline-none transition-smooth shadow-inner" placeholder="0.00"/>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Método</label>
                  <select value={paymentData.metodo} onChange={e => setPaymentData({...paymentData, metodo: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 focus:border-emerald-500 outline-none transition-smooth">
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="TRANSFERENCIA">Transferencia</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Imputación</label>
                  <select 
                    value={paymentData.imputacion} 
                    onChange={e => setPaymentData({...paymentData, imputacion: e.target.value})} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 focus:border-emerald-500 outline-none transition-smooth uppercase text-[10px]"
                  >
                    <option value="MIXTO">Mixto (Auto)</option>
                    <option value="BLANCO" disabled={Number(selectedClient.saldo_blanco) >= 0}>
                      Solo en blanco {Number(selectedClient.saldo_blanco) >= 0 ? '(Saldado)' : ''}
                    </option>
                    <option value="NEGRO" disabled={Number(selectedClient.saldo_negro) >= 0}>
                      Solo EnGroncho {Number(selectedClient.saldo_negro) >= 0 ? '(Saldado)' : ''}
                    </option>
                  </select>
                </div>
              </div>
              
              <button type="submit" disabled={paymentMutation.isPending} className="w-full mt-4 sm:mt-6 bg-emerald-600 text-white py-3 sm:py-4 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-smooth">
                {paymentMutation.isPending ? 'Procesando...' : 'Confirmar Cobro'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Stylized Confirm Modal */}
      <ConfirmModal 
        isOpen={deleteConfirm.isOpen}
        title="¿Eliminar Cliente?"
        message="Esta acción es irreversible y eliminará todo el historial asociado al cliente. ¿Estás seguro?"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, clientId: null })}
        confirmText="Eliminar permanentemente"
        variant="danger"
      />
    </div>
  );
};

export default ClientsPage;
