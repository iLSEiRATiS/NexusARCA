import api from './api';

export interface Product {
  id: number;
  nombre: string;
  presentacion: string | null;
  precio_usd: number;
  iva_tasa: number;
  stock_actual: number;
  stock_minimo: number;
}

export const productService = {
  getAll: async (): Promise<Product[]> => {
    const response = await api.get('/products');
    return response.data;
  },
  create: async (data: Partial<Product>): Promise<Product> => {
    const response = await api.post('/products', data);
    return response.data;
  },
};
