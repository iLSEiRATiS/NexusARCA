import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productService } from '../services/productService';
import api from '../services/api';
import { toast } from 'sonner';

const ProductsPage = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchBar] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isEditBatchModalOpen, setIsEditBatchModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    nombre: '',
    presentacion: '',
    peso_kg: 25,
    costo_usd: 0,
    precio_usd: 0,
    iva_tasa: 21,
    stock_actual: 0,
    stock_minimo: 5
  });

  const [adjustData, setAdjustData] = useState({
    cantidad: 1,
    tipo: 'INGRESO', 
    motivo: '',
    nro_lote: '',
    fecha_vencimiento: ''
  });

  const [editBatchData, setEditBatchData] = useState({
    nro_lote: '',
    cantidad_bultos: 0,
    fecha_vencimiento: '',
    estado: 'ACTIVO'
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: productService.getAll,
  });

  const filteredProducts = products?.filter((p: any) => 
    p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.presentacion?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { data: productDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['product', selectedProduct?.id],
    queryFn: async () => {
      const res = await api.get(`/products/${selectedProduct.id}`);
      return res.data;
    },
    enabled: !!selectedProduct && isDetailsModalOpen,
  });

  const createMutation = useMutation({
    mutationFn: productService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsModalOpen(false);
      resetForm();
      toast.success('Producto guardado correctamente');
    }
  });

  const handleClone = (product: any) => {
    setFormData({
      nombre: product.nombre + ' (Copia)',
      presentacion: product.presentacion || '',
      peso_kg: Number(product.peso_kg),
      costo_usd: Number(product.costo_usd),
      precio_usd: Number(product.precio_usd),
      iva_tasa: Number(product.iva_tasa),
      stock_actual: 0,
      stock_minimo: Number(product.stock_minimo)
    });
    setIsModalOpen(true);
  };

  const adjustMutation = useMutation({
    mutationFn: async (data: any) => {
      return api.post(`/products/${selectedProduct.id}/stock`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', selectedProduct?.id] });
      setIsAdjustModalOpen(false);
      setAdjustData({ cantidad: 1, tipo: 'INGRESO', motivo: '', nro_lote: '', fecha_vencimiento: '' });
      toast.success('INGRESO REGISTRADO');
    }
  });

  const updateBatchMutation = useMutation({
    mutationFn: async (data: any) => {
      return api.patch(`/products/batches/${selectedBatch.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', selectedProduct?.id] });
      setIsEditBatchModalOpen(false);
      toast.success('Lote actualizado');
    }
  });

  const deleteBatchMutation = useMutation({
    mutationFn: async (batchId: number) => {
      return api.delete(`/products/batches/${batchId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', selectedProduct?.id] });
      toast.success('Lote eliminado');
    }
  });

  const resetForm = () => {
    setFormData({ nombre: '', presentacion: '', peso_kg: 25, costo_usd: 0, precio_usd: 0, iva_tasa: 21, stock_actual: 0, stock_minimo: 5 });
  };

  const openAdjustModal = (product: any) => {
    setSelectedProduct(product);
    setIsAdjustModalOpen(true);
  };

  const openDetails = (product: any) => {
    setSelectedProduct(product);
    setIsDetailsModalOpen(true);
  };

  const openEditBatch = (batch: any) => {
    setSelectedBatch(batch);
    setEditBatchData({
      nro_lote: batch.nro_lote,
      cantidad_bultos: batch.cantidad_bultos,
      fecha_vencimiento: batch.fecha_vencimiento ? batch.fecha_vencimiento.split('T')[0] : '',
      estado: batch.estado || 'ACTIVO'
    });
    setIsEditBatchModalOpen(true);
  };

  const handleDeleteBatch = (batchId: number) => {
    if (window.confirm('¿ELIMINAR ESTE LOTE? El stock total se recalculará automáticamente.')) {
      deleteBatchMutation.mutate(batchId);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    adjustMutation.mutate(adjustData);
  };

  if (isLoading) return (
    <div className="p-12 text-center space-y-4 animate-pulse">
      <div className="h-12 bg-slate-100 rounded-2xl w-48 mx-auto"></div>
      <div className="h-[60vh] bg-slate-50 rounded-[32px]"></div>
    </div>
  );

  return (
    <div className="p-6 md:p-10 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-800 tracking-tight mb-2">Inventario</h1>
          <p className="text-slate-400 font-medium text-[11px] uppercase tracking-widest italic">Gestión de Stock y Trazabilidad</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative flex-1 sm:w-64">
            <input 
              type="text" 
              placeholder="Buscar producto..." 
              value={searchTerm}
              onChange={(e) => setSearchBar(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-400 transition-smooth shadow-sm"
            />
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm tracking-tight hover:bg-emerald-700 transition-smooth shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
          >
            <span>+</span> Nuevo Item
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-[24px] shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 font-bold text-[11px] text-slate-400 uppercase tracking-widest">Producto</th>
                <th className="px-6 py-5 font-bold text-[11px] text-slate-400 uppercase tracking-widest text-center">Stock Total</th>
                <th className="px-6 py-5 font-bold text-[11px] text-slate-400 uppercase tracking-widest text-center">Precio / Margen</th>
                <th className="px-8 py-5 font-bold text-[11px] text-slate-400 uppercase tracking-widest text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredProducts?.map((product: any) => {
                const costo = Number(product.costo_usd);
                const precio = Number(product.precio_usd);
                const margen = costo > 0 ? ((precio - costo) / precio * 100).toFixed(1) : '100';
                const isLowStock = product.stock_actual <= product.stock_minimo;
                
                return (
                  <tr key={product.id} className="group hover:bg-slate-50/30 transition-smooth">
                    <td className="px-8 py-6">
                      <div className="font-bold text-slate-700 text-lg uppercase group-hover:text-emerald-700 transition-colors">
                        {product.nombre}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-2 mt-1">
                        {product.presentacion || `${product.peso_kg} KG`}
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-500 border border-slate-200 text-[9px]">{product.batches?.length || 0} Lotes</span>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <div className={`text-2xl font-bold tracking-tight ${isLowStock ? 'text-rose-500' : 'text-slate-700'}`}>
                        {product.stock_actual} <span className="text-[11px] text-slate-400 uppercase font-medium">un</span>
                      </div>
                      {isLowStock && (
                        <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full uppercase tracking-wider mt-1 inline-block border border-rose-100">
                          Reponer
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-6 text-center">
                      <div className="text-xl font-bold text-slate-700 tracking-tight">USD {precio.toFixed(2)}</div>
                      <div className="flex items-center justify-center gap-2 mt-1.5">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Margen:</span>
                        <span className={`text-[10px] font-bold ${Number(margen) > 30 ? 'text-emerald-600' : 'text-amber-600'}`}>{margen}%</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => openDetails(product)}
                          className="bg-sky-50 text-sky-700 px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider hover:bg-sky-100 transition-smooth border border-sky-100"
                        >
                          Ver Lotes
                        </button>
                        <button 
                          onClick={() => openAdjustModal(product)}
                          className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider hover:bg-emerald-100 transition-smooth border border-emerald-100"
                        >
                          Ingreso
                        </button>
                        <button 
                          onClick={() => handleClone(product)}
                          className="bg-slate-50 text-slate-500 px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider hover:bg-slate-100 transition-smooth border border-slate-200"
                        >
                          Copia
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals with new aesthetic */}
      {isDetailsModalOpen && selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-slide-up border border-slate-200">
            <div className="bg-slate-50 p-8 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 tracking-tight uppercase">{selectedProduct.nombre}</h2>
                <p className="text-slate-400 font-bold text-[10px] tracking-widest uppercase mt-1">Historial de Lotes y Trazabilidad</p>
              </div>
              <button onClick={() => setIsDetailsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-smooth text-3xl font-light">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-8">
              {isLoadingDetails ? (
                <div className="text-center py-12 animate-pulse text-slate-300 font-bold uppercase text-sm">Sincronizando...</div>
              ) : (
                <div className="bg-slate-50/50 rounded-2xl border border-slate-100 overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-100/50 border-b border-slate-100">
                        <th className="px-6 py-4 font-bold text-[10px] text-slate-400 uppercase tracking-widest">Identificador</th>
                        <th className="px-6 py-4 font-bold text-[10px] text-slate-400 uppercase tracking-widest text-center">Bultos</th>
                        <th className="px-6 py-4 font-bold text-[10px] text-slate-400 uppercase tracking-widest text-center">Vencimiento</th>
                        <th className="px-6 py-4 font-bold text-[10px] text-slate-400 uppercase tracking-widest text-right">Gestión</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {productDetails?.batches?.map((batch: any) => (
                        <tr key={batch.id} className="hover:bg-white transition-smooth">
                          <td className="px-6 py-5">
                            <span className="font-bold text-slate-700 uppercase">{batch.nro_lote}</span>
                            <div className="mt-1">
                              <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider border ${batch.estado === 'BLOQUEADO' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                {batch.estado || 'Activo'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-center font-bold text-slate-800 text-xl">{batch.cantidad_bultos}</td>
                          <td className="px-6 py-5 text-center font-semibold text-xs text-slate-500">
                            {batch.fecha_vencimiento ? new Date(batch.fecha_vencimiento).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-6 py-5 text-right flex gap-3 justify-end items-center h-full pt-6">
                            <button onClick={() => openEditBatch(batch)} className="text-sky-600 font-bold text-[10px] uppercase hover:underline">Editar</button>
                            <button onClick={() => handleDeleteBatch(batch.id)} className="text-rose-500 font-bold text-[10px] uppercase hover:underline">Eliminar</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Batch Modal */}
      {isEditBatchModalOpen && selectedBatch && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-10 border border-slate-200 animate-slide-up">
            <h3 className="text-xl font-bold text-slate-800 mb-8 border-b border-slate-50 pb-4 uppercase tracking-tight">Ajustar Lote</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Código de Lote</label>
                <input type="text" value={editBatchData.nro_lote} onChange={e => setEditBatchData({...editBatchData, nro_lote: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 uppercase focus:border-sky-400 outline-none transition-smooth"/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Cantidad</label>
                  <input type="number" value={editBatchData.cantidad_bultos} onChange={e => setEditBatchData({...editBatchData, cantidad_bultos: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 focus:border-sky-400 outline-none transition-smooth"/>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Estado</label>
                  <select value={editBatchData.estado || 'ACTIVO'} onChange={e => setEditBatchData({...editBatchData, estado: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 focus:border-sky-400 outline-none transition-smooth uppercase text-xs">
                    <option value="ACTIVO">Activo</option>
                    <option value="BLOQUEADO">Bloqueado</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Fecha Vencimiento</label>
                <input type="date" value={editBatchData.fecha_vencimiento} onChange={e => setEditBatchData({...editBatchData, fecha_vencimiento: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 focus:border-sky-400 outline-none transition-smooth"/>
              </div>
            </div>
            <div className="mt-10 flex gap-3">
              <button onClick={() => setIsEditBatchModalOpen(false)} className="flex-1 py-3 rounded-xl font-bold text-[11px] uppercase text-slate-400 hover:bg-slate-50 transition-smooth">Cancelar</button>
              <button onClick={() => updateBatchMutation.mutate(editBatchData)} className="flex-2 bg-sky-600 text-white py-3 rounded-xl font-bold text-[11px] uppercase shadow-lg shadow-sky-100 hover:bg-sky-700 transition-smooth">Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Entry Modal */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl overflow-hidden animate-slide-up border border-emerald-100">
            <div className="bg-emerald-600 px-10 py-8 text-white">
              <h2 className="text-2xl font-bold tracking-tight uppercase">Ingreso de Mercadería</h2>
              <p className="text-emerald-100 text-[10px] font-bold tracking-widest uppercase mt-1 italic">{selectedProduct?.nombre}</p>
            </div>
            <form onSubmit={handleAdjustSubmit} className="p-10 space-y-6">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Identificador de Lote</label>
                <input required type="text" value={adjustData.nro_lote} onChange={e => setAdjustData({...adjustData, nro_lote: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 uppercase focus:border-emerald-500 outline-none transition-smooth"/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Cantidad (Un)</label>
                  <input required type="number" value={adjustData.cantidad} onChange={e => setAdjustData({...adjustData, cantidad: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 focus:border-emerald-500 outline-none transition-smooth"/>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Vencimiento</label>
                  <input type="date" value={adjustData.fecha_vencimiento} onChange={e => setAdjustData({...adjustData, fecha_vencimiento: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 focus:border-emerald-500 outline-none transition-smooth"/>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Proveedor / Motivo</label>
                <input required type="text" placeholder="Ej: Compra a Quimica Sur" value={adjustData.motivo} onChange={e => setAdjustData({...adjustData, motivo: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 uppercase focus:border-emerald-500 outline-none transition-smooth placeholder:text-slate-300"/>
              </div>
              <button type="submit" disabled={adjustMutation.isPending} className="w-full mt-6 bg-emerald-600 text-white py-4 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-smooth">
                {adjustMutation.isPending ? 'Procesando...' : 'Confirmar Ingreso'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* New Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-2xl shadow-2xl overflow-hidden animate-slide-up border border-slate-200">
            <div className="bg-slate-800 px-10 py-8 text-white flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold tracking-tight uppercase">Nuevo Producto</h2>
                <p className="text-slate-400 text-[10px] font-bold tracking-widest uppercase mt-1">Alta en Catálogo Maestro</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-smooth text-3xl font-light">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-10">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Nombre Comercial</label>
                  <input required type="text" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 uppercase focus:border-emerald-500 outline-none transition-smooth"/>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Peso Unitario (KG)</label>
                  <input required type="number" value={formData.peso_kg} onChange={e => setFormData({...formData, peso_kg: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 focus:border-emerald-500 outline-none transition-smooth"/>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Stock Mínimo</label>
                  <input required type="number" value={formData.stock_minimo} onChange={e => setFormData({...formData, stock_minimo: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 focus:border-emerald-500 outline-none transition-smooth"/>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-2">Costo (USD / KG)</label>
                  <input required type="number" step="0.01" value={formData.costo_usd} onChange={e => setFormData({...formData, costo_usd: Number(e.target.value)})} className="w-full bg-rose-50/50 border border-rose-100 rounded-xl px-4 py-3 font-bold text-rose-700 focus:border-rose-400 outline-none transition-smooth"/>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-2">Venta (USD / KG)</label>
                  <input required type="number" step="0.01" value={formData.precio_usd} onChange={e => setFormData({...formData, precio_usd: Number(e.target.value)})} className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl px-4 py-3 font-bold text-emerald-700 focus:border-emerald-400 outline-none transition-smooth"/>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 mt-10">
                 <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 rounded-2xl font-bold text-[11px] uppercase text-slate-400 hover:bg-slate-50 transition-smooth">Cancelar</button>
                 <button type="submit" className="flex-[2] bg-slate-800 text-white py-4 rounded-2xl font-bold text-[11px] uppercase tracking-widest shadow-xl hover:bg-slate-900 transition-smooth">Registrar Producto</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsPage;