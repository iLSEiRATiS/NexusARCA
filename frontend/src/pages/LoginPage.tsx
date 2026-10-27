import { useState } from 'react';
import { Lock, User, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
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
      setError(err.response?.data?.message || 'Error al iniciar sesión. Verifique sus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans text-slate-900">
      <div className="w-full max-w-md bg-white border border-slate-200 p-8 sm:p-12 rounded-sm shadow-2xl space-y-8 animate-fade-in">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="w-12 h-12 bg-slate-900 text-white flex items-center justify-center font-black text-2xl mx-auto rounded-sm shadow-md">
            M
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">
              Máscolo <span className="text-blue-600">Facturador</span>
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              Sistema de Emisión Fiscal &bull; ARCA / AFIP
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                <User size={12} className="text-slate-400" /> Nombre de Usuario
              </label>
              <input 
                required
                type="text" 
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 px-3.5 py-3 rounded-sm font-bold text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all text-xs uppercase placeholder:text-slate-400"
                placeholder="USUARIO"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                <Lock size={12} className="text-slate-400" /> Contraseña
              </label>
              <input 
                required
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 px-3.5 py-3 rounded-sm font-bold text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all text-xs placeholder:text-slate-400"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 p-3 rounded-sm text-red-700 font-bold text-xs flex items-center gap-2">
              <AlertCircle size={16} className="text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button 
            disabled={loading}
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-sm font-black text-xs uppercase tracking-widest transition-all disabled:bg-slate-200 disabled:text-slate-400 shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                <span>Validando Acceso...</span>
              </>
            ) : (
              <span>Entrar al Sistema</span>
            )}
          </button>
        </form>

        {/* Security badge footer */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          <ShieldCheck size={14} className="text-emerald-600" />
          <span>Conexión Cifrada &bull; Facturación Segura</span>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
