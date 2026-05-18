import api from './api';
import type { Client } from './clientService';
import type { Product } from './productService';

export interface QuotationItem {
  id: number;
  product_id: number;
  product: Product;
  cantidad: number;
  precio_unitario_ars: number;
  precio_unitario_usd: number;
}

export interface Quotation {
  id: number;
  client_id: number;
  client: Client;
  fecha: string;
  validez_dias: number;
  estado: 'PENDIENTE' | 'ACEPTADO' | 'RECHAZADO' | 'CONVERTIDO';
  total_real_ars: number;
  cotizacion_dolar_usada: number;
  items: QuotationItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuotationDTO {
  client_id: number;
  items: { product_id: number; cantidad: number }[];
  validez_dias?: number;
}

export const quotationService = {
  getAll: async (page = 1, limit = 50): Promise<{ data: Quotation[]; meta: any }> => {
    const response = await api.get('/quotations', { params: { page, limit } });
    return response.data;
  },
  getById: async (id: number): Promise<Quotation> => {
    const response = await api.get(`/quotations/${id}`);
    return response.data;
  },
  create: async (data: CreateQuotationDTO): Promise<Quotation> => {
    const response = await api.post('/quotations', data);
    return response.data;
  },
  updateStatus: async (id: number, estado: Quotation['estado']): Promise<Quotation> => {
    const response = await api.patch(`/quotations/${id}/status`, { estado });
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/quotations/${id}`);
  },
  convertToSale: async (id: number, data: { tipo_comprobante: string }): Promise<any> => {
    const response = await api.post(`/quotations/${id}/convert`, data);
    return response.data;
  },
};
