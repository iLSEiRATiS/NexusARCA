import api from './api';

export interface Client {
  id: number;
  external_id?: number | null;
  razon_social: string;
  cuit: string;
  email: string | null;
  direccion: string | null;
  condicion_iva: string;
  nro_iibb: string | null;
  telefono: string | null;
  saldo_blanco: number | string;
  saldo_interno: number | string;
  saldo_deuda: number | string;
  saldo_a_favor?: number | string;
  porcentaje_facturacion?: number | string;
  sales?: any[];
  payments?: any[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ClientFormData {
  razon_social: string;
  cuit: string;
  email?: string | null;
  direccion?: string | null;
  condicion_iva: string;
  nro_iibb?: string | null;
  telefono?: string | null;
  porcentaje_facturacion?: number;
  saldo_blanco?: number | string;
  saldo_interno?: number | string;
  saldo_a_favor?: number | string;
}

export interface PaymentPayload {
  monto: number;
  metodo: string;
  referencia?: string;
  imputacion: string;
  fecha?: string;
  nro_cheque?: string;
  fecha_vto_cheque?: string;
  caja?: string;
}

export interface LoadCreditPayload {
  monto: number | string;
  motivo?: string;
  fecha?: string;
  metodo?: string;
  modo?: 'add' | 'direct';
}

export const clientService = {
  getAll: async (): Promise<Client[]> => {
    const response = await api.get('/clients');
    return response.data;
  },
  getById: async (id: number): Promise<Client> => {
    const response = await api.get(`/clients/${id}`);
    return response.data;
  },
  create: async (data: any): Promise<Client> => {
    const response = await api.post('/clients', data);
    return response.data;
  },
  update: async (id: number, data: any): Promise<Client> => {
    const response = await api.patch(`/clients/${id}`, data);
    return response.data;
  },
  delete: async (id: number): Promise<void> => {
    const response = await api.delete(`/clients/${id}`);
    return response.data;
  },
  registerPayment: async (clientId: number, data: PaymentPayload): Promise<any> => {
    const response = await api.post(`/clients/${clientId}/payments`, data);
    return response.data;
  },
  loadCredit: async (clientId: number, data: LoadCreditPayload): Promise<Client> => {
    const response = await api.post(`/clients/${clientId}/credit`, data);
    return response.data;
  },
  deletePayment: async (clientId: number, paymentId: number): Promise<{ success: boolean }> => {
    const response = await api.delete(`/clients/${clientId}/payments/${paymentId}`);
    return response.data;
  }
};
