import { useState } from 'react';
import api from '../services/api';
import logo from '../assets/logo.png';

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
      localStorage.setItem('engroncho_auth', JSON.stringify(res.data));
      window.location.href = '/';
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EAE2D6] flex items-center justify-center p-6 font-sans">
      {/* Texture Background */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#D6CCC2 0.5px, transparent 0.5px), linear-gradient(90deg, #D6CCC2 0.5px, transparent 0.5px)', backgroundSize: '40px 40px' }}></div>

      <div className="w-full max-w-md animate-slide-up relative z-10">
        <div className="bg-[#F2EBE1] rounded-[56px] p-10 md:p-14 shadow-premium border border-[#D6CCC2]">
          <div className="text-center mb-10">
            <img src={logo} alt="EnGroncho" className="w-24 h-24 object-contain mx-auto mb-6 drop-shadow-lg transition-smooth hover:scale-105 duration-500" />
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-[10px] font-bold text-[#333D29]/60 uppercase tracking-widest mb-2.5 ml-1">Usuario</label>
              <input 
                required
                type="text" 
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full bg-[#EAE2D6]/40 border border-[#D6CCC2] rounded-2xl px-6 py-4 font-bold text-[#333D29] outline-none focus:border-[#005F73] transition-smooth shadow-inner"
                placeholder="Nombre de usuario"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#333D29]/60 uppercase tracking-widest mb-2.5 ml-1">Contraseña</label>
              <input 
                required
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-[#EAE2D6]/40 border border-[#D6CCC2] rounded-2xl px-6 py-4 font-bold text-[#333D29] outline-none focus:border-[#005F73] transition-smooth shadow-inner"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-rose-100/50 border border-rose-200 p-4 rounded-xl text-rose-700 font-bold text-[11px] uppercase text-center animate-pulse">
                {error}
              </div>
            )}

            <button 
              disabled={loading}
              type="submit"
              className="w-full bg-[#005F73] text-white py-5 rounded-2xl font-bold text-sm uppercase tracking-widest shadow-xl hover:bg-[#001219] transition-smooth active:scale-[0.98] mt-4"
            >
              {loading ? 'Sincronizando...' : 'Entrar al Sistema'}
            </button>
          </form>
        </div>
        
        <div className="text-center mt-12">
           <div className="text-[#333D29]/30 font-bold text-[10px] tracking-[0.3em] uppercase flex items-center justify-center gap-3">
            <span>EnGroncho</span>
            <span className="w-1.5 h-1.5 bg-[#D6CCC2] rounded-full"></span>
            <a 
              href="https://www.Miauwdev.com.ar" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-[#0A9396] hover:text-[#005F73] transition-colors"
            >
              MiauwDev
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
