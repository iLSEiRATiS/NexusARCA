import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientService, type Client } from '../services/clientService';
import { toast } from 'sonner';
import { generateAccountStatementPDF, generateSalePDF } from '../services/pdfService';
import ConfirmModal from '../components/ConfirmModal';
import { TableSkeleton } from '../components/Skeletons';
import { Plus, Search } from 'lucide-react';

import { ClientFormModal } from '../components/clients/ClientFormModal';
import { ClientBalanceModal } from '../components/clients/ClientBalanceModal';
import { ClientPaymentModal } from '../components/clients/ClientPaymentModal';
import { ClientDetailModal } from '../components/clients/ClientDetailModal';
import { ClientsTable } from '../components/clients/ClientsTable';
import { processClientLedger, getDocumentClassification } from '../utils/accountLedger';
import { usePrivacy } from '../context/PrivacyContext';

const ClientsPage = () => {
  const queryClient = useQueryClient();
  const { isManagementUnlocked } = usePrivacy();
  const [searchTerm, setSearchBar] = useState('');

  // Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);

  // Clientes seleccionados
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedClientForEdit, setSelectedClientForEdit] = useState<Client | null>(null);

  // Estado para modal de cobro
  const [paymentData, setPaymentData] = useState({
    monto: '' as number | string,
    metodo: 'EFECTIVO',
    referencia: '',
    imputacion: 'MIXTO',
    fecha: new Date().toISOString().split('T')[0],
  });

  // Modal confirmación eliminar
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; clientId: number | null }>({
    isOpen: false,
    clientId: null,
  });

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: clientService.getAll,
  });

  const { data: clientDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['client', selectedClient?.id],
    queryFn: async () => {
      if (!selectedClient?.id) return null;
      return await clientService.getById(selectedClient.id);
    },
    enabled: !!selectedClient?.id && isDetailsModalOpen,
  });

  // Mantener selectedClient sincronizado con la lista fresca de clientes
  useEffect(() => {
    if (selectedClient && clients.length > 0) {
      const refreshed = clients.find((c: Client) => c.id === selectedClient.id);
      if (refreshed) {
        setSelectedClient(refreshed);
      }
    }
  }, [clients]);

  // ── Mutaciones ───────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: clientService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setIsCreateModalOpen(false);
      toast.success('Cliente registrado exitosamente');
    },
    onError: (err: any) => {
      console.error('Error creating client:', err);
      const msg = err.response?.data?.message || err.message || 'Error al registrar cliente';
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => {
      if (!selectedClientForEdit?.id) throw new Error('No hay cliente seleccionado');
      return clientService.update(selectedClientForEdit.id, data);
    },
    onSuccess: (updatedClient) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client', selectedClientForEdit?.id] });
      if (selectedClient?.id === selectedClientForEdit?.id) {
        setSelectedClient((prev: any) => ({ ...prev, ...updatedClient }));
      }
      setIsEditModalOpen(false);
      setSelectedClientForEdit(null);
      toast.success('Cliente actualizado correctamente');
    },
    onError: (err: any) => {
      console.error('Error updating client:', err);
      const msg = err.response?.data?.message || err.message || 'Error al actualizar cliente';
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: clientService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Cliente eliminado');
      setDeleteConfirm({ isOpen: false, clientId: null });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al eliminar cliente');
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!selectedClient?.id) throw new Error('No hay cliente seleccionado');
      return clientService.registerPayment(selectedClient.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client', selectedClient?.id] });
      setIsPaymentModalOpen(false);
      setIsDetailsModalOpen(true);
      setPaymentData({
        monto: '',
        metodo: 'EFECTIVO',
        referencia: '',
        imputacion: isManagementUnlocked ? 'MIXTO' : 'BLANCO',
        fecha: new Date().toISOString().split('T')[0],
      });
      toast.success('Cobro registrado exitosamente');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.message || 'Error al registrar cobro');
    },
  });

  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentId: number) => {
      if (!selectedClient?.id) throw new Error('No hay cliente seleccionado');
      return clientService.deletePayment(selectedClient.id, paymentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client', selectedClient?.id] });
      toast.success('Movimiento deshecho exitosamente');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.message || 'Error al deshacer movimiento');
    },
  });

  const updateBalanceMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!selectedClient?.id) throw new Error('No hay cliente seleccionado');
      return clientService.update(selectedClient.id, data);
    },
    onSuccess: (updatedClient) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client', selectedClient?.id] });
      setSelectedClient((prev: any) => ({ ...prev, ...updatedClient }));
      setIsBalanceModalOpen(false);
      toast.success('Deuda cargada correctamente');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.message || 'Error al actualizar saldos');
    },
  });

  // ── Helpers de navegación y modales ──────────────────────────────────────
  const handleOpenDetails = (client: Client) => {
    setSelectedClient(client);
    setIsDetailsModalOpen(true);
    setIsCreateModalOpen(false);
    setIsEditModalOpen(false);
    setIsPaymentModalOpen(false);
    setIsBalanceModalOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenEdit = (client: Client) => {
    setSelectedClientForEdit(client);
    setIsEditModalOpen(true);
    setIsDetailsModalOpen(false);
    setIsCreateModalOpen(false);
    setIsPaymentModalOpen(false);
    setIsBalanceModalOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenPayment = (client: Client) => {
    setSelectedClient(client);
    setPaymentData({
      monto: '',
      metodo: 'EFECTIVO',
      referencia: '',
      imputacion: isManagementUnlocked ? 'MIXTO' : 'BLANCO',
      fecha: new Date().toISOString().split('T')[0],
    });
    setIsPaymentModalOpen(true);
    setIsDetailsModalOpen(false);
    setIsBalanceModalOpen(false);
    setIsCreateModalOpen(false);
    setIsEditModalOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenBalance = (client: Client) => {
    if (!isManagementUnlocked) return;
    setSelectedClient(client);
    setIsBalanceModalOpen(true);
    setIsDetailsModalOpen(false);
    setIsPaymentModalOpen(false);
    setIsCreateModalOpen(false);
    setIsEditModalOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const applyDebtToPayment = (item: any) => {
    const isVenta = item.type === 'venta';
    const rawMonto = item.saldoPendiente !== undefined
      ? Number(item.saldoPendiente)
      : (isVenta ? Number(item.total_real_ars || item.monto_ars || 0) : Math.abs(Number(item.monto_ars || 0)));

    const info = item.classification || getDocumentClassification(item);
    const imputacion = info.caracter === 'FISCAL' 
      ? 'BLANCO' 
      : (info.caracter === 'INTERNO' 
          ? (isManagementUnlocked ? 'INTERNO' : 'BLANCO') 
          : (isManagementUnlocked ? 'MIXTO' : 'BLANCO'));
    const referencia = `Cobro ${info.title}`;

    setPaymentData({
      monto: rawMonto,
      metodo: 'EFECTIVO',
      referencia: referencia,
      imputacion: imputacion,
      fecha: new Date().toISOString().split('T')[0],
    });
  };

  const handleQuickPay = (item: any) => {
    applyDebtToPayment(item);
    setIsDetailsModalOpen(false);
    setIsPaymentModalOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const monto = Number(paymentData.monto);
    if (!selectedClient?.id) {
      toast.error('No hay cliente seleccionado');
      return;
    }
    if (isNaN(monto) || monto <= 0) {
      toast.error('El monto debe ser un número mayor a 0');
      return;
    }
    paymentMutation.mutate({ ...paymentData, monto });
  };

  const handleExportStatement = () => {
    if (!selectedClient || !clientDetails) return;
    const history = [
      ...(clientDetails.sales || []).map((s: any) => ({ ...s, tipo: 'FACTURACIÓN' })),
      ...(clientDetails.payments || []).map((p: any) => ({ ...p, tipo: 'COBRO' })),
    ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    generateAccountStatementPDF(selectedClient, history);
  };

  // Cálculo unificado de comprobantes pendientes para el selector del modal de cobro
  const { pendingDebts } = useMemo(() => {
    return processClientLedger(selectedClient, clientDetails);
  }, [selectedClient, clientDetails]);

  if (isLoading) {
    return (
      <div className="p-6 md:p-10">
        <TableSkeleton />
      </div>
    );
  }

  const anyModalActive = isCreateModalOpen || isEditModalOpen || isDetailsModalOpen || isPaymentModalOpen || isBalanceModalOpen;

  return (
    <div className="animate-fade-in space-y-8">
      {/* Encabezado Principal */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-2 border-slate-900 pb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight uppercase mb-1">
            Clientes y Cuentas Corrientes
          </h1>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">
            Directorio, Saldos Fiscales y Control de Cobranzas
          </p>
        </div>

        {!anyModalActive && (
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative flex-1 sm:w-72">
              <input
                type="text"
                placeholder="BUSCAR POR RAZÓN SOCIAL O CUIT..."
                value={searchTerm}
                onChange={(e) => setSearchBar(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 px-4 py-3 pl-10 text-xs font-bold uppercase outline-none focus:border-blue-600 transition-all text-slate-900"
              />
              <Search size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-blue-600 text-white px-6 py-3 font-black text-xs tracking-wider hover:bg-blue-700 transition-all flex items-center justify-center gap-2 uppercase shadow-sm cursor-pointer"
            >
              <Plus size={16} />
              Nuevo Cliente
            </button>
          </div>
        )}
      </div>

      {/* Modal: Alta de Cliente */}
      <ClientFormModal
        isOpen={isCreateModalOpen}
        mode="create"
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={(data) => createMutation.mutate(data)}
        isPending={createMutation.isPending}
      />

      {/* Modal: Edición de Cliente */}
      <ClientFormModal
        isOpen={isEditModalOpen}
        mode="edit"
        initialData={selectedClientForEdit}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedClientForEdit(null);
        }}
        onSubmit={(data) => updateMutation.mutate(data)}
        isPending={updateMutation.isPending}
      />

      {/* Modal: Ficha Detallada de Cuenta Corriente */}
      <ClientDetailModal
        isOpen={isDetailsModalOpen}
        client={selectedClient}
        clientDetails={clientDetails}
        isLoadingDetails={isLoadingDetails}
        onClose={() => setIsDetailsModalOpen(false)}
        onEdit={(c) => handleOpenEdit(c)}
        onOpenPayment={(c) => handleOpenPayment(c)}
        onOpenBalance={(c) => handleOpenBalance(c)}
        onQuickPay={handleQuickPay}
        onDeletePayment={(id) => deletePaymentMutation.mutate(id)}
        onDownloadSale={(s) => generateSalePDF(s)}
        onExportStatement={handleExportStatement}
        isDeletePending={deletePaymentMutation.isPending}
      />

      {/* Modal: Cargar Deuda */}
      <ClientBalanceModal
        isOpen={isBalanceModalOpen}
        client={selectedClient}
        onClose={() => setIsBalanceModalOpen(false)}
        onSubmit={(data) => updateBalanceMutation.mutate(data)}
        isPending={updateBalanceMutation.isPending}
      />

      {/* Modal: Registrar Cobro */}
      <ClientPaymentModal
        isOpen={isPaymentModalOpen}
        client={selectedClient}
        pendingDebts={pendingDebts}
        paymentData={paymentData}
        setPaymentData={setPaymentData}
        onClose={() => setIsPaymentModalOpen(false)}
        onSubmit={handlePaymentSubmit}
        onSelectDebt={(debt) => applyDebtToPayment({ ...debt.raw, type: debt.type })}
        isPending={paymentMutation.isPending}
      />

      {/* Tabla Principal de Clientes (Se oculta al abrir la ficha o menú de acciones) */}
      {!anyModalActive && (
        <ClientsTable
          clients={clients}
          searchTerm={searchTerm}
          onSelectClient={handleOpenDetails}
          onOpenPayment={handleOpenPayment}
          onOpenBalance={handleOpenBalance}
          onEditClient={handleOpenEdit}
          onDeleteClient={(id) => setDeleteConfirm({ isOpen: true, clientId: id })}
        />
      )}

      {/* Modal Confirmación Eliminación */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="¿ELIMINAR CLIENTE?"
        message="Esta acción es irreversible y eliminará todo el historial contable y de comprobantes asociado a este cliente. ¿Estás seguro de continuar?"
        onConfirm={() => {
          if (deleteConfirm.clientId) {
            deleteMutation.mutate(deleteConfirm.clientId);
          }
        }}
        onCancel={() => setDeleteConfirm({ isOpen: false, clientId: null })}
        confirmText="ELIMINAR PERMANENTEMENTE"
        variant="danger"
      />
    </div>
  );
};

export default ClientsPage;
