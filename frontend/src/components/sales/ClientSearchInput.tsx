import { useState } from 'react';
import { Search, UserPlus, AlertTriangle, Building2, Wallet } from 'lucide-react';

interface ClientSearchInputProps {
  clientCuit: string;
  onClientCuitChange: (cuit: string) => void;
  selectedClient: any | undefined;
  filteredClients: any[];
  onSelectClient: (client: any) => void;
  onOpenQuickRegister: () => void;
}

export const ClientSearchInput = ({
  clientCuit,
  onClientCuitChange,
  selectedClient,
  filteredClients,
  onSelectClient,
  onOpenQuickRegister
}: ClientSearchInputProps) => {
  const [showDropdown, setShowDropdown] = useState(false);

  const cuitNoRegistrado = clientCuit.length >= 5 && !selectedClient;

  return (
    <section className="bg-white border border-slate-200 p-6 sm:p-8 rounded-sm shadow-sm relative group hover:border-blue-500 transition-all">
      <h2 className="text-xs font-black uppercase tracking-widest mb-6 text-slate-900 flex items-center gap-2">
        <span className="w-5 h-5 bg-slate-900 text-white rounded flex items-center justify-center text-[10px] font-black">
          01
        </span>
        Cliente Receptor (CUIT o Razón Social)
      </h2>

      <div className="relative">
        <div className="relative">
          <Search size={18} className="absolute left-4 top-4 text-slate-400" />
          <input 
            type="text"
            placeholder="BUSQUE POR NOMBRE, RAZÓN SOCIAL O CUIT..."
            className="w-full bg-slate-50 border border-slate-200 rounded-sm pl-12 pr-4 py-3 font-bold text-slate-900 text-sm outline-none focus:border-blue-600 focus:bg-white transition-all uppercase tracking-wider placeholder:text-slate-400 placeholder:normal-case placeholder:font-normal"
            value={clientCuit}
            onChange={(e) => {
              onClientCuitChange(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 250)}
          />
        </div>
        
        {/* Dropdown Suggestions */}
        {showDropdown && !selectedClient && (
          <div className="absolute z-30 w-full bg-white border border-slate-200 mt-1 shadow-2xl rounded-sm max-h-[320px] overflow-y-auto">
            {filteredClients.length > 0 ? (
              filteredClients.map((c: any) => (
                <div 
                  key={c.id} 
                  className="p-3.5 border-b border-slate-100 hover:bg-blue-50/60 cursor-pointer flex justify-between items-center transition-colors"
                  onClick={() => { 
                    onSelectClient(c);
                    setShowDropdown(false); 
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <Building2 size={16} className="text-slate-400" />
                    <div>
                      <p className="font-bold text-slate-900 text-xs uppercase">{c.razon_social}</p>
                      <p className="text-[10px] text-slate-400 font-semibold">{c.condicion_iva?.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                  <span className="text-slate-600 text-xs font-mono font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {c.cuit}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-4 text-slate-400 text-xs font-bold text-center">
                NO SE ENCONTRARON CLIENTES REGISTRADOS
              </div>
            )}

            {/* Quick Register Trigger */}
            <div 
              className="p-3.5 bg-slate-900 text-white font-black text-xs uppercase tracking-widest cursor-pointer hover:bg-blue-600 transition-colors flex justify-center items-center gap-2 sticky bottom-0"
              onMouseDown={(e) => {
                e.preventDefault();
                onOpenQuickRegister();
                setShowDropdown(false);
              }}
            >
              <UserPlus size={14} /> + REGISTRAR CLIENTE AHORA
            </div>
          </div>
        )}
      </div>
      
      {/* Client Selected Card */}
      {selectedClient ? (
        <div className="mt-4 p-4 bg-blue-50/50 border border-blue-200 rounded-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-blue-700 font-black text-sm uppercase">{selectedClient.razon_social}</span>
              <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-blue-600 text-white rounded">
                {selectedClient.condicion_iva?.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5">CUIT: {selectedClient.cuit}</p>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
            <Wallet size={16} className="text-slate-400" />
            <span className="text-slate-500 text-[11px]">Saldo Cartera:</span>
            <span className={`font-mono font-black ${Number(selectedClient.saldo_deuda) < 0 ? 'text-red-600' : 'text-slate-800'}`}>
              ${Math.abs(Number(selectedClient.saldo_deuda)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      ) : cuitNoRegistrado ? (
        <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200 rounded-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600 shrink-0" />
            <span>Cliente o CUIT no registrado en el sistema</span>
          </div>
          <button
            type="button"
            onClick={onOpenQuickRegister}
            className="bg-slate-900 hover:bg-blue-600 text-white px-3.5 py-1.5 text-[10px] font-black uppercase tracking-widest rounded transition-colors flex items-center gap-1.5 shrink-0"
          >
            <UserPlus size={12} /> Registrar Cliente
          </button>
        </div>
      ) : null}
    </section>
  );
};
