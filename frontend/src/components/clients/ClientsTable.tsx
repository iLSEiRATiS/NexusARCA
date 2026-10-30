import React from 'react';
import type { Client } from '../../services/clientService';
import { Eye, DollarSign, PlusCircle, Pencil, Trash2, Building2 } from 'lucide-react';
import { usePrivacy } from '../../context/PrivacyContext';

interface ClientsTableProps {
  clients: Client[];
  searchTerm: string;
  onSelectClient: (client: Client) => void;
  onOpenPayment: (client: Client) => void;
  onOpenBalance: (client: Client) => void;
  onEditClient: (client: Client) => void;
  onDeleteClient: (id: number) => void;
}

export const ClientsTable: React.FC<ClientsTableProps> = ({
  clients,
  searchTerm,
  onSelectClient,
  onOpenPayment,
  onOpenBalance,
  onEditClient,
  onDeleteClient,
}) => {
  const { isManagementUnlocked } = usePrivacy();
  const filteredClients = clients.filter((c) =>
    c.razon_social.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.cuit.includes(searchTerm)
  );

  if (filteredClients.length === 0) {
    return (
      <div className="bg-white border border-slate-200 p-12 text-center shadow-sm">
        <Building2 size={32} className="mx-auto text-slate-300 mb-3" />
        <p className="text-sm font-black text-slate-700 uppercase tracking-wider mb-1">
          No se encontraron clientes
        </p>
        <p className="text-xs text-slate-400">
          {searchTerm ? `No hay resultados para "${searchTerm}"` : 'Aún no hay clientes registrados en el sistema.'}
        </p>
      </div>
    );
  }

  const getCondicionBadge = (cond: string) => {
    switch (cond) {
      case 'RESPONSABLE_INSCRIPTO':
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-black px-2 py-0.5 uppercase tracking-wider">Resp. Inscripto</span>;
      case 'MONOTRIBUTO':
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black px-2 py-0.5 uppercase tracking-wider">Monotributo</span>;
      case 'CONSUMIDOR_FINAL':
        return <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-black px-2 py-0.5 uppercase tracking-wider">Consumidor Final</span>;
      case 'EXENTO':
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black px-2 py-0.5 uppercase tracking-wider">Exento</span>;
      default:
        return <span className="bg-slate-50 text-slate-600 border border-slate-200 text-[10px] font-black px-2 py-0.5 uppercase tracking-wider">{cond || 'S/D'}</span>;
    }
  };

  return (
    <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
      {/* Vista de escritorio (Tabla) */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white border-b border-slate-800 text-[11px] font-black uppercase tracking-wider">
              <th className="py-4 px-6">Cliente / CUIT</th>
              <th className="py-4 px-4">Condición IVA</th>
              <th className="py-4 px-4 text-right">Saldo Fiscal (ARCA)</th>
              {isManagementUnlocked && (
                <th className="py-4 px-4 text-right">Saldo Interno (Remitos)</th>
              )}
              <th className="py-4 px-6 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
            {filteredClients.map((client) => {
              const blancoNum = Number(client.saldo_blanco || 0);
              const internoNum = Number(client.saldo_interno || 0);

              return (
                <tr
                  key={client.id}
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  onClick={() => onSelectClient(client)}
                >
                  {/* Cliente y CUIT */}
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900 text-sm uppercase tracking-tight group-hover:text-blue-600 transition-colors">
                        {client.razon_social}
                      </span>
                      {client.external_id && (
                        <span className="bg-slate-100 text-slate-500 text-[9px] font-black px-1.5 py-0.5 uppercase tracking-tighter">
                          Ext #{client.external_id}
                        </span>
                      )}
                    </div>
                    <span className="text-slate-400 font-normal text-xs block mt-0.5">
                      CUIT: {client.cuit}
                    </span>
                  </td>

                  {/* Condición IVA */}
                  <td className="py-4 px-4">
                    {getCondicionBadge(client.condicion_iva)}
                  </td>

                  {/* Saldo Fiscal */}
                  <td className="py-4 px-4 text-right font-black" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <span className={blancoNum < 0 ? 'text-slate-900' : 'text-slate-500'}>
                        ${blancoNum.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <button
                        type="button"
                        onClick={() => onOpenBalance(client)}
                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                        title="Modificar Saldo Fiscal"
                      >
                        <Pencil size={12} />
                      </button>
                    </div>
                  </td>

                  {/* Columnas protegidas de Gestión Comercial */}
                  {isManagementUnlocked && (
                    <td className="py-4 px-4 text-right font-black" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <span className={internoNum < 0 ? 'text-slate-900' : 'text-slate-500'}>
                          ${internoNum.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <button
                          type="button"
                          onClick={() => onOpenBalance(client)}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                          title="Modificar Saldo Interno"
                        >
                          <Pencil size={12} />
                        </button>
                      </div>
                    </td>
                  )}

                  {/* Acciones */}
                  <td className="py-4 px-6" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectClient(client)}
                        className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors border border-slate-200"
                        title="Ver Cuenta Corriente y Ficha"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenPayment(client)}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1 transition-all shadow-sm"
                        title="Registrar Cobro"
                      >
                        <DollarSign size={12} />
                        Cobrar
                      </button>
                      {isManagementUnlocked && (
                        <button
                          type="button"
                          onClick={() => onOpenBalance(client)}
                          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors border border-slate-200"
                          title="Cargar Deuda / Remito"
                        >
                          <PlusCircle size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onEditClient(client)}
                        className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors border border-slate-200"
                        title="Editar Datos"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteClient(client.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors border border-slate-200"
                        title="Eliminar Cliente"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Vista Mobile (Tarjetas) */}
      <div className="lg:hidden divide-y divide-slate-100">
        {filteredClients.map((client) => {
          return (
            <div
              key={client.id}
              className="p-5 space-y-4 hover:bg-slate-50 transition-colors cursor-pointer"
              onClick={() => onSelectClient(client)}
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <h3 className="font-black text-slate-900 text-sm uppercase tracking-tight">
                    {client.razon_social}
                  </h3>
                  <span className="text-xs text-slate-400">CUIT: {client.cuit}</span>
                </div>
                {getCondicionBadge(client.condicion_iva)}
              </div>

              <div className={`grid ${isManagementUnlocked ? 'grid-cols-2' : 'grid-cols-1'} gap-3 p-3 bg-slate-50 border border-slate-100 text-xs`}>
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Saldo Fiscal</span>
                    <span className="font-bold text-slate-900">${Number(client.saldo_blanco || 0).toLocaleString('es-AR')}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenBalance(client)}
                    className="p-1 text-slate-400 hover:text-blue-600"
                    title="Modificar Saldo"
                  >
                    <Pencil size={12} />
                  </button>
                </div>
                {isManagementUnlocked && (
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Remitos / Gestión</span>
                      <span className="font-bold text-slate-900">${Number(client.saldo_interno || 0).toLocaleString('es-AR')}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenBalance(client)}
                      className="p-1 text-slate-400 hover:text-blue-600"
                      title="Modificar Saldo"
                    >
                      <Pencil size={12} />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => onOpenPayment(client)}
                  className="px-3 py-1.5 bg-emerald-600 text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-sm cursor-pointer"
                >
                  <DollarSign size={12} /> Cobrar
                </button>
                {isManagementUnlocked && (
                  <button
                    type="button"
                    onClick={() => onOpenBalance(client)}
                    className="px-3 py-1.5 border border-slate-300 text-slate-700 font-bold text-[10px] uppercase tracking-wider hover:bg-slate-100 cursor-pointer flex items-center gap-1"
                  >
                    <Pencil size={11} /> Saldo
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onEditClient(client)}
                  className="p-1.5 border border-slate-200 text-slate-500 hover:text-blue-600"
                  title="Editar"
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteClient(client.id)}
                  className="p-1.5 border border-slate-200 text-slate-400 hover:text-red-600"
                  title="Eliminar"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
