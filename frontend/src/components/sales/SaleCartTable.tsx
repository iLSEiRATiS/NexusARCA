import { Plus, Trash2, PackageOpen } from 'lucide-react';
import { parseArgNumber } from '../../utils/format';

export interface CartItem {
  id: string;
  descripcion: string;
  cantidad: number | string;
  precio: number | string;
  moneda: 'USD' | 'ARS';
  iva_tasa: number | string;
  subtotal_usd: number;
}

interface SaleCartTableProps {
  cart: CartItem[];
  cotizacion: number;
  onUpdateItem: (id: string, field: keyof CartItem, value: any) => void;
  onRemoveItem: (id: string) => void;
  onAddManualItem: () => void;
}

export const SaleCartTable = ({
  cart,
  cotizacion,
  onUpdateItem,
  onRemoveItem,
  onAddManualItem
}: SaleCartTableProps) => {
  return (
    <section className="bg-white border border-slate-200 p-6 sm:p-8 rounded-sm shadow-sm space-y-6">
      <div className="flex justify-between items-center border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
            <span className="w-5 h-5 bg-slate-900 text-white rounded flex items-center justify-center text-[10px] font-black">
              02
            </span>
            Artículos a Facturar
          </h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
            {cart.length} {cart.length === 1 ? 'ítem cargado' : 'ítems cargados'}
          </p>
        </div>

        <button 
          type="button"
          onClick={onAddManualItem} 
          className="text-xs font-black uppercase tracking-widest text-blue-600 hover:text-blue-800 flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-blue-50 transition-colors"
        >
          <Plus size={14} /> Agregar Manual
        </button>
      </div>

      {cart.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-sm bg-slate-50/50">
          <PackageOpen size={36} className="text-slate-300 mx-auto mb-2" />
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            El carrito está vacío
          </p>
          <p className="text-[10px] text-slate-400 font-semibold mt-1">
            Cargue un archivo CSV con la tirada o use el botón "+ Agregar Manual"
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[650px]">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 text-[9px] font-black uppercase tracking-widest bg-slate-50">
                <th className="py-2.5 px-3">Descripción</th>
                <th className="py-2.5 px-2 text-center w-24">Cant. (KG)</th>
                <th className="py-2.5 px-2 text-center w-20">Moneda</th>
                <th className="py-2.5 px-2 text-right w-32">P. Unitario</th>
                <th className="py-2.5 px-2 text-center w-20">% IVA</th>
                <th className="py-2.5 px-2 text-right w-32">Subtotal ARS</th>
                <th className="py-2.5 px-2 text-center w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cart.map((item) => {
                const priceInArs = item.moneda === 'USD' 
                  ? parseArgNumber(item.precio) * cotizacion 
                  : parseArgNumber(item.precio);
                const subtotalArs = parseArgNumber(item.cantidad) * priceInArs;

                return (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                    {/* Descripción */}
                    <td className="py-2.5 px-3">
                      <input 
                        type="text" 
                        value={item.descripcion}
                        onChange={e => onUpdateItem(item.id, 'descripcion', e.target.value)}
                        className="w-full bg-transparent border-b border-transparent focus:border-blue-600 outline-none font-bold text-slate-900 text-xs py-1"
                        placeholder="Nombre del artículo / producto"
                      />
                    </td>

                    {/* Cantidad */}
                    <td className="py-2.5 px-2">
                      <input 
                        type="text" 
                        value={item.cantidad || ''}
                        onChange={e => onUpdateItem(item.id, 'cantidad', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white rounded outline-none font-mono font-bold text-slate-900 text-xs text-center py-1"
                        placeholder="0"
                      />
                    </td>

                    {/* Moneda */}
                    <td className="py-2.5 px-2">
                      <select
                        value={item.moneda}
                        onChange={e => onUpdateItem(item.id, 'moneda', e.target.value)}
                        className="w-full bg-slate-100 border border-slate-200 focus:border-blue-600 rounded outline-none font-bold text-slate-900 text-xs text-center py-1 cursor-pointer"
                      >
                        <option value="USD">U$D</option>
                        <option value="ARS">ARS</option>
                      </select>
                    </td>

                    {/* Precio */}
                    <td className="py-2.5 px-2">
                      <input 
                        type="text" 
                        value={item.precio || ''}
                        onChange={e => onUpdateItem(item.id, 'precio', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white rounded outline-none font-mono font-bold text-slate-900 text-xs text-right py-1 px-2"
                        placeholder="0.00"
                      />
                    </td>

                    {/* IVA % */}
                    <td className="py-2.5 px-2">
                      <input 
                        type="text" 
                        value={item.iva_tasa || ''}
                        onChange={e => onUpdateItem(item.id, 'iva_tasa', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white rounded outline-none font-mono font-bold text-slate-900 text-xs text-center py-1"
                        placeholder="21"
                      />
                    </td>

                    {/* Subtotal ARS */}
                    <td className="py-2.5 px-2 text-right">
                      <span className="font-mono font-bold text-slate-900 text-xs">
                        ${subtotalArs.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>

                    {/* Remove Action */}
                    <td className="py-2.5 px-2 text-center">
                      <button 
                        type="button"
                        onClick={() => onRemoveItem(item.id)} 
                        className="text-slate-300 hover:text-red-600 p-1 rounded transition-colors"
                        title="Eliminar artículo"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
