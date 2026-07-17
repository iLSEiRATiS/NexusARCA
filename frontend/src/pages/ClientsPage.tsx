import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientService } from '../services/clientService';
import api from '../services/api';
import { toast } from 'sonner';
import { generateAccountStatementPDF, generateSalePDF } from '../services/pdfService';
import ConfirmModal from '../components/ConfirmModal';
import { TableSkeleton } from '../components/Skeletons';
import { Download, PackageOpen } from 'lucide-react';

const ClientsPage = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchBar] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);

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
    const history = [
      ...(clientDetails.sales || []).map((s: any) => ({ ...s, tipo: 'FACTURACIÓN' })),
      ...(clientDetails.payments || []).map((p: any) => ({ ...p, tipo: 'COBRO' }))
    ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    generateAccountStatementPDF(selectedClient, history);
  };

  const handleNumericInput = (value: string, min: number = 0) => {
    const cleanedValue = value.replace(/[^0-9.]/g, '');
    const numValue = parseFloat(cleanedValue);
    if (isNaN(numValue)) return 0;
    return Math.max(min, numValue);
  };

  const preventInvalidChars = (e: React.KeyboardEvent) => {
    if (['e', 'E', '+', '-'].includes(e.key)) {
      e.preventDefault();
    }
  };

  if (isLoading) return <div className="p-6 md:p-10"><TableSkeleton /></div>;

  return (
    <div className="animate-fade-in space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-2 border-slate-900 pb-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter uppercase mb-1">Clientes</h1>
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em]">Cuentas Corrientes y Directorio</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative flex-1 sm:w-64">
            <input
              type="text"
              placeholder="BUSCAR CLIENTE..."
              value={searchTerm}
              onChange={(e) => setSearchBar(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 px-4 py-3 text-xs font-bold uppercase outline-none focus:border-blue-600 transition-all tracking-widest text-slate-900"
            />
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 text-white px-8 py-3 font-black text-xs tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-2 uppercase"
          >
            + Nuevo Cliente
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 shadow-sm rounded-none overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <th className="px-8 py-4 font-black text-[10px] uppercase tracking-widest">Razón Social / CUIT</th>
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-center">Estado de Cuenta</th>
                <th className="px-6 py-4 font-black text-[10px] uppercase tracking-widest text-center">Split</th>
                <th className="px-8 py-4 font-black text-[10px] uppercase tracking-widest text-right">Gestión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClients?.map((client: any) => {
                const totalDebt = Number(client.saldo_deuda);
                const hasDebt = totalDebt < 0;

                return (
                  <tr key={client.id} className="group hover:bg-slate-50 transition-all">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 ${totalDebt < -100000 ? 'bg-red-600 animate-pulse' : totalDebt < 0 ? 'bg-blue-600' : 'bg-slate-200'}`}></div>
                        <div className="font-black text-slate-900 text-lg uppercase cursor-pointer hover:text-blue-600 transition-colors" onClick={() => openDetails(client)}>
                          {client.razon_social}
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 ml-5">
                        CUIT: {client.cuit} • {client.condicion_iva}
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex justify-center gap-2">
                        <div className="px-3 py-1 border border-slate-100 text-center min-w-[100px] bg-white">
                          <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">Blanco</p>
                          <p className="text-[11px] font-black text-slate-900">${Math.abs(Number(client.saldo_blanco)).toLocaleString('es-AR')}</p>
                        </div>
                        <div className="px-3 py-1 border border-slate-100 text-center min-w-[100px] bg-white">
                          <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">Negro</p>
                          <p className="text-[11px] font-black text-slate-900">${Math.abs(Number(client.saldo_negro)).toLocaleString('es-AR')}</p>
                        </div>
                        <div className={`px-3 py-1 border text-center min-w-[100px] ${hasDebt ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-100 bg-slate-50 text-slate-900'}`}>
                          <p className={`text-[7px] font-bold uppercase tracking-widest ${hasDebt ? 'text-slate-400' : 'text-slate-400'}`}>{hasDebt ? 'Deuda' : 'Saldo'}</p>
                          <p className="text-[11px] font-black">${Math.abs(totalDebt).toLocaleString('es-AR')}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <span className="text-slate-900 font-black text-xs uppercase">{client.porcentaje_facturacion}%</span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openDetails(client)} className="border border-slate-200 text-slate-600 px-4 py-1.5 font-bold text-[9px] uppercase hover:bg-slate-50 transition-all tracking-widest">Historial</button>
                        <button onClick={() => openPaymentModal(client)} className="bg-slate-900 text-white px-4 py-1.5 font-bold text-[9px] uppercase hover:bg-slate-800 transition-all tracking-widest">Cobrar</button>
                        <button onClick={() => handleDeleteClick(client.id)} className="text-slate-300 hover:text-red-600 transition-all px-2 py-1 font-bold text-lg">&times;</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredClients?.map((client: any) => {
            const totalDebt = Number(client.saldo_deuda);
            const hasDebt = totalDebt < 0;
            return (
              <div key={client.id} className="p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <div className="font-black text-slate-900 text-base uppercase truncate" onClick={() => openDetails(client)}>{client.razon_social}</div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">CUIT: {client.cuit} • {client.porcentaje_facturacion}% SPLIT</div>
                  </div>
                  <div className={`shrink-0 px-2 py-1 border border-slate-900 ml-2 ${hasDebt ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
                    <p className="text-[10px] font-black tracking-tighter">${Math.abs(totalDebt).toLocaleString('es-AR')}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 border border-slate-100 text-center bg-slate-50"><p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mb-1">Blanco</p><p className="text-xs font-black text-slate-900">${Number(client.saldo_blanco).toLocaleString('es-AR')}</p></div>
                  <div className="p-2 border border-slate-100 text-center bg-slate-50"><p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mb-1">Negro</p><p className="text-xs font-black text-slate-900">${Number(client.saldo_negro).toLocaleString('es-AR')}</p></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openDetails(client)} className="flex-1 border border-slate-200 text-slate-600 py-2 font-black text-[9px] uppercase tracking-widest">Historial</button>
                  <button onClick={() => openPaymentModal(client)} className="flex-[1.5] bg-slate-900 text-white py-2 font-black text-[9px] uppercase tracking-widest">Cobrar</button>
                  <button onClick={() => handleDeleteClick(client.id)} className="w-10 border border-slate-200 text-slate-400 flex items-center justify-center font-bold text-xl">&times;</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Details Modal */}
      {isDetailsModalOpen && selectedClient && (
        <div className="fixed inset-0 bg-slate-900/80 z-[100] flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-none w-full max-w-5xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh] animate-fade-in">
            <div className="bg-slate-900 p-6 sm:p-8 text-white flex justify-between items-start border-b border-slate-800">
              <div className="flex-1">
                <h2 className="text-2xl sm:text-3xl font-black tracking-tighter uppercase leading-tight">{selectedClient.razon_social}</h2>
                <div className="flex gap-4 mt-2">
                  <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">CUIT: {selectedClient.cuit}</span>
                  <span className="text-slate-300 font-bold text-[10px] uppercase tracking-widest">Split: {selectedClient.porcentaje_facturacion}%</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleExportStatement} className="hidden sm:flex items-center gap-2 bg-white text-slate-900 px-4 py-2 rounded-none font-black text-[10px] uppercase hover:bg-slate-100 transition-all tracking-widest">📄 Estado de Cuenta</button>
                <button onClick={() => setIsDetailsModalOpen(false)} className="text-white hover:text-slate-400 transition-all text-3xl font-light leading-none px-2">&times;</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-slate-50">
              <div className="sm:hidden mb-6"><button onClick={handleExportStatement} className="w-full bg-slate-900 text-white py-3 rounded-none font-black text-[10px] uppercase tracking-widest">📄 Descargar Estado de Cuenta</button></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                <div className="p-6 bg-white border border-slate-200 shadow-sm"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Blanco</p><p className="text-2xl font-black text-slate-900">${Number(selectedClient.saldo_blanco).toLocaleString('es-AR')}</p></div>
                <div className="p-6 bg-white border border-slate-200 shadow-sm"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Negro</p><p className="text-2xl font-black text-slate-900">${Number(selectedClient.saldo_negro).toLocaleString('es-AR')}</p></div>
                <div className="p-6 bg-blue-600 text-white flex flex-col justify-between shadow-lg shadow-blue-100">
                  <div><p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-1">Total Adeudado</p><p className="text-2xl font-black">${Math.abs(Number(selectedClient.saldo_deuda)).toLocaleString('es-AR')}</p></div>
                  <button onClick={() => setIsPaymentModalOpen(true)} className="mt-4 border border-white text-white py-2 font-black text-[10px] uppercase tracking-widest hover:bg-white hover:text-blue-600 transition-all">Registrar Cobro</button>
                </div>
              </div>
              <div className="space-y-6">
                <h3 className="text-xs font-black text-slate-900 mb-6 border-b border-slate-200 pb-2 uppercase tracking-[0.3em]">Actividad Reciente</h3>
                {isLoadingDetails ? (<div className="text-center py-10 text-slate-300 font-bold uppercase text-[10px] tracking-[0.2em]">Cargando...</div>) : (
                  <div className="space-y-4">
                    {(!clientDetails?.sales?.length && !clientDetails?.payments?.length) && <p className="text-center py-10 text-slate-400 font-bold uppercase text-[10px] tracking-widest">Sin movimientos</p>}
                    {[...(clientDetails?.sales || []).map((s: any) => ({ ...s, type: 'venta' })), ...(clientDetails?.payments || []).map((p: any) => ({ ...p, type: 'cobro' }))].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()).map((item: any, idx: number) => (
                      <div key={idx} className="bg-white border border-slate-200 overflow-hidden hover:border-blue-600 transition-all shadow-sm">
                        <div className="p-5 flex flex-col sm:flex-row justify-between items-center gap-4">
                          <div className="text-center sm:text-left">
                            <div className="flex items-center gap-2 justify-center sm:justify-start">
                              <p className="font-black text-slate-900 text-sm uppercase tracking-tight">
                                {item.type === 'venta' ? `Facturación #${String(item.id).padStart(5, '0')}` : 'Cobro Recibido'}
                              </p>
                              {item.external_id && (
                                <span className="bg-slate-50 border border-slate-200 text-slate-400 text-[7px] font-black px-1.5 py-0.5 uppercase tracking-tighter">Sincronizado</span>
                              )}
                            </div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                              {new Date(item.fecha).toLocaleDateString()} • {item.tipo_comprobante || item.metodo_pago}
                            </p>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className={`text-xl font-black ${item.type === 'venta' ? 'text-slate-900' : 'text-blue-600'}`}>
                                {item.type === 'venta' ? '-' : '+'}${Number(item.total_real_ars || item.monto_ars).toLocaleString('es-AR')}
                              </p>
                              <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em]">ARS</p>
                            </div>
                            {item.type === 'venta' && (
                              <button
                                onClick={() => generateSalePDF({ ...item, client: selectedClient })}
                                className="p-3 border border-slate-100 text-slate-300 hover:text-blue-600 hover:border-blue-600 transition-all"
                                title="Descargar Comprobante"
                              >
                                <Download size={16} />
                              </button>
                            )}
                          </div>
                        </div>

                        {item.type === 'venta' && item.items && item.items.length > 0 && (
                          <div className="px-5 py-4 border-t border-slate-50 bg-slate-50/50">
                            <div className="flex items-center gap-2 mb-3">
                              <PackageOpen size={12} className="text-slate-300" />
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Artículos</p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
                              {item.items.map((si: any, sIdx: number) => (
                                <div key={sIdx} className="flex justify-between items-center py-1">
                                  <span className="text-[10px] font-bold text-slate-600 uppercase truncate pr-4">{si.product?.nombre}</span>
                                  <span className="text-[10px] font-black text-slate-900 shrink-0">{si.cantidad} UN</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
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
        <div className="fixed inset-0 z-[100] overflow-y-auto">
          {/* SOLID BACKGROUND, NO TRANSPARENCY, NO BLACK */}
          <div className="fixed inset-0 bg-slate-900/50" onClick={() => setIsModalOpen(false)}></div>
          <div className="flex min-h-full items-center justify-center p-4 sm:p-10">
            {/* CORRECTLY CENTERED MODAL */}
            <div className="bg-white w-full max-w-lg border border-slate-300 relative z-10 animate-fade-in flex flex-col shadow-2xl">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 w-12 h-12 flex items-center justify-center text-slate-400 text-3xl font-light hover:text-red-600 hover:bg-red-50 transition-colors z-50"
                title="Cerrar ventana"
              >
                &times;
              </button>
              <div className="bg-slate-900 px-8 py-8 text-white shrink-0">
                <h2 className="text-2xl font-black uppercase tracking-widest">Nuevo Cliente</h2>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-2">Alta en Cartera</p>
              </div>

              <form onSubmit={handleSubmit} className="p-8 bg-slate-50 flex flex-col gap-6">

                {/* 1 Column Layout */}
                <div className="flex flex-col gap-6">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Razón Social</label>
                    <input required type="text" value={formData.razon_social} onChange={e => setFormData({ ...formData, razon_social: e.target.value })} className="w-full bg-white border border-slate-200 p-5 font-bold text-slate-900 uppercase focus:border-blue-600 outline-none text-base transition-all" />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">CUIT</label>
                    <input required type="text" value={formData.cuit} onChange={e => setFormData({ ...formData, cuit: e.target.value })} className="w-full bg-white border border-slate-200 p-5 font-bold text-slate-900 focus:border-blue-600 outline-none text-base transition-all" />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Condición IVA</label>
                    <select value={formData.condicion_iva} onChange={e => setFormData({ ...formData, condicion_iva: e.target.value })} className="w-full bg-white border border-slate-200 p-5 font-bold text-slate-900 focus:border-blue-600 outline-none text-base transition-all uppercase">
                      <option value="RESPONSABLE_INSCRIPTO">Responsable Inscripto</option>
                      <option value="MONOTRIBUTO">Monotributo</option>
                      <option value="EXENTO">Exento</option>
                      <option value="CONSUMIDOR_FINAL">Consumidor Final</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Dirección Fiscal</label>
                    <input type="text" value={formData.direccion} onChange={e => setFormData({ ...formData, direccion: e.target.value })} className="w-full bg-white border border-slate-200 p-5 font-bold text-slate-900 focus:border-blue-600 outline-none text-base transition-all" />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Teléfono</label>
                    <input type="text" value={formData.telefono} onChange={e => setFormData({ ...formData, telefono: e.target.value })} className="w-full bg-white border border-slate-200 p-5 font-bold text-slate-900 focus:border-blue-600 outline-none text-base transition-all" />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Split Oficial (%)</label>
                    <input
                      required
                      type="number"
                      min="0"
                      max="100"
                      value={formData.porcentaje_facturacion}
                      onKeyDown={preventInvalidChars}
                      onChange={e => setFormData({ ...formData, porcentaje_facturacion: handleNumericInput(e.target.value) })}
                      className="w-full bg-white border border-slate-200 p-5 font-black text-slate-900 focus:border-blue-600 outline-none text-base transition-all"
                    />
                  </div>
                </div>

                <div className="mt-8 flex flex-col sm:flex-row gap-4 pt-4 border-t border-slate-200">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="w-full sm:w-1/3 py-5 font-bold text-xs uppercase text-slate-400 tracking-widest hover:text-slate-600 hover:bg-slate-200 transition-colors border border-transparent">
                    Cancelar
                  </button>
                  <button type="submit" className="w-full sm:w-2/3 bg-blue-600 text-white py-5 font-black text-sm uppercase tracking-[0.2em] hover:bg-blue-700 transition-all">
                    Confirmar Alta
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {isPaymentModalOpen && selectedClient && (
        <div className="fixed inset-0 bg-slate-900/80 z-[100] flex items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full h-full sm:h-auto sm:max-h-[92vh] sm:rounded-none sm:w-[95%] sm:max-w-lg border border-slate-200 shadow-2xl overflow-hidden flex flex-col animate-fade-in">
            <div className="bg-slate-900 px-6 py-6 text-white flex justify-between items-start shrink-0">
              <div>
                <h2 className="text-xl font-black uppercase tracking-widest">Registrar Cobro</h2>
                <p className="text-slate-400 text-[9px] font-bold uppercase tracking-[0.2em] mt-1">{selectedClient.razon_social}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="w-10 h-10 flex items-center justify-center text-white text-3xl font-light"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handlePaymentSubmit} className="p-6 sm:p-10 space-y-6 flex-1 overflow-y-auto bg-slate-50">
              <div className="p-4 bg-white border border-slate-200 flex justify-between items-center mb-4 shadow-sm">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Deuda Total</p>
                  <p className="text-xl font-black text-slate-900">${Math.abs(Number(selectedClient.saldo_deuda)).toLocaleString('es-AR')}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Negro</p>
                  <p className="text-sm font-black text-slate-900">${Math.abs(Number(selectedClient.saldo_negro)).toLocaleString('es-AR')}</p>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Monto a Cobrar (ARS)</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  value={paymentData.monto === 0 ? '' : paymentData.monto}
                  onKeyDown={preventInvalidChars}
                  onChange={e => setPaymentData({ ...paymentData, monto: e.target.value === '' ? 0 : handleNumericInput(e.target.value) })}
                  className="w-full bg-transparent border-b-2 border-slate-900 rounded-none px-2 py-4 font-black text-4xl text-slate-900 focus:border-blue-600 outline-none transition-all"
                  placeholder="0.00"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Método</label><select value={paymentData.metodo} onChange={e => setPaymentData({ ...paymentData, metodo: e.target.value })} className="w-full bg-white border border-slate-200 rounded-none px-3 py-4 font-bold text-slate-900 focus:border-blue-600 outline-none uppercase text-xs"><option value="EFECTIVO">Efectivo</option><option value="TRANSFERENCIA">Transferencia</option><option value="CHEQUE">Cheque</option></select></div>
                <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Imputación</label><select value={paymentData.imputacion} onChange={e => setPaymentData({ ...paymentData, imputacion: e.target.value })} className="w-full bg-white border border-slate-200 rounded-none px-3 py-4 font-bold text-slate-900 focus:border-blue-600 outline-none uppercase text-xs"><option value="MIXTO">Mixto (Auto)</option><option value="BLANCO" disabled={Number(selectedClient.saldo_blanco) >= 0}>Solo Blanco</option><option value="NEGRO" disabled={Number(selectedClient.saldo_negro) >= 0}>Solo Negro</option></select></div>
              </div>
              <button type="submit" disabled={paymentMutation.isPending} className="w-full mt-4 bg-blue-600 text-white py-4 font-black text-xs uppercase tracking-[0.2em] hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">Confirmar Cobro</button>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal isOpen={deleteConfirm.isOpen} title="¿ELIMINAR CLIENTE?" message="ESTA ACCIÓN ES IRREVERSIBLE Y ELIMINARÁ TODO EL HISTORIAL ASOCIADO AL CLIENTE. ¿ESTÁS SEGURO?" onConfirm={confirmDelete} onCancel={() => setDeleteConfirm({ isOpen: false, clientId: null })} confirmText="ELIMINAR PERMANENTEMENTE" variant="danger" />
    </div>
  );
};

export default ClientsPage;
