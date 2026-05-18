import api from './api';

export const currencyService = {
  getDolarOficial: async () => {
    const response = await api.get('/currency/dolar-oficial');
    return response.data; // Esperamos { rate: number } o similar
  },
};
