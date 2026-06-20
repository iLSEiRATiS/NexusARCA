import { useState } from 'react';
import api from '../services/api';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const res = await api.post('/auth/login', { username, password });
      localStorage.setItem('mascolo_facturador_auth', JSON.stringify(res.data));
      window.location.href = '/';
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans text-slate-900">
      <div className="w-full max-w-md bg-white border border-slate-200 p-10 md:p-14 shadow-sm">
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-black uppercase tracking-tighter mb-3 text-slate-900">Mascolo <span className="text-blue-600">Facturador</span></h1>
        </div>

        <form onSubmit={handleLogin} className="space-y-10">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Nombre de Usuario</label>
              <input 
                required
                type="text" 
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 px-4 py-4 font-bold text-slate-900 outline-none focus:border-blue-600 transition-all text-sm uppercase placeholder:text-slate-300"
                placeholder="Ingresar Usuario"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Contraseña</label>
              <input 
                required
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 px-4 py-4 font-bold text-slate-900 outline-none focus:border-blue-600 transition-all text-sm placeholder:text-slate-300"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 p-4 text-red-600 font-bold text-[10px] uppercase text-center tracking-widest animate-pulse">
              {error}
            </div>
          )}

          <button 
            disabled={loading}
            type="submit"
            className="w-full bg-blue-600 text-white py-5 font-black text-xs uppercase tracking-[0.2em] hover:bg-blue-700 transition-all disabled:bg-slate-200 shadow-lg shadow-blue-100"
          >
            {loading ? 'Validando...' : 'Entrar al Sistema'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
