import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
});

// Interceptor para inyectar Token
api.interceptors.request.use((config) => {
  const auth = localStorage.getItem('mascolo_facturador_auth');
  if (auth) {
    const { token } = JSON.parse(auth);
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar expiración de sesión
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('mascolo_facturador_auth');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
