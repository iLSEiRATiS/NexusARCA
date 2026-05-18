import api from './api';

export interface Client {
  id: number;
  razon_social: string;
  cuit: string;
  direccion: string | null;
  condicion_iva: string;
  nro_iibb: string | null;
  telefono: string | null;
  saldo_blanco: number;
  saldo_negro: number;
  saldo_deuda: number;
  porcentaje_facturacion: number;
}

export const clientService = {
  getAll: async () => {
    const response = await api.get('/clients');
    return response.data;
  },
  getById: async (id: number) => {
    const response = await api.get(`/clients/${id}`);
    return response.data;
  },
  create: async (data: any) => {
    const response = await api.post('/clients', data);
    return response.data;
  },
  update: async (id: number, data: any) => {
    const response = await api.patch(`/clients/${id}`, data);
    return response.data;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/clients/${id}`);
    return response.data;
  },
};
