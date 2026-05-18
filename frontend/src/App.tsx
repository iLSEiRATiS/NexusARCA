import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from 'sonner';
import Dashboard from './pages/Dashboard';
import ProductsPage from './pages/ProductsPage';
import ClientsPage from './pages/ClientsPage';
import NewSalePage from './pages/NewSalePage';
import SalesPage from './pages/SalesPage';
import QuotationsPage from './pages/QuotationsPage';
import NewQuotationPage from './pages/NewQuotationPage';
import LoginPage from './pages/LoginPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const auth = localStorage.getItem('engroncho_auth');
  if (!auth) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

import logo from './assets/logo.png';

const NavLink = ({ to, children, onClick, className }: { to: string, children: React.ReactNode, onClick?: () => void, className?: string }) => {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
  
  return (
    <Link 
      to={to} 
      onClick={onClick}
      className={className || `${
        isActive ? 'text-[#005F73] bg-[#E9D8A6]/40 shadow-sm' : 'text-slate-500 hover:text-[#005F73] hover:bg-[#E9D8A6]/20'
      } font-bold px-5 py-2.5 rounded-2xl text-[13px] tracking-tight transition-smooth flex items-center gap-2 w-full md:w-auto mb-1 md:mb-0`}
    >
      {children}
    </Link>
  );
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const isLogin = location.pathname === '/login';

  // Prevent background scroll when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMenuOpen]);

  if (isLogin) return <>{children}</>;

  const handleLogout = () => {
    localStorage.removeItem('engroncho_auth');
    window.location.href = '/login';
  };

  const authData = localStorage.getItem('engroncho_auth');
  const auth = authData ? JSON.parse(authData) : {};

  return (
    <div className="min-h-screen bg-[#EAE2D6] flex flex-col font-sans selection:bg-[#94D2BD]/30 overflow-x-hidden">
      <nav className="glass border-b border-[#D6CCC2]/60 px-4 md:px-12 py-3.5 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <Link to="/" className="flex items-center gap-3 md:gap-4 group shrink-0">
          <img src={logo} alt="EnGroncho" className="w-10 h-10 md:w-12 md:h-12 object-contain group-hover:rotate-6 transition-transform duration-500" />
          <div className="flex flex-col leading-tight">
            <span className="text-xl md:text-2xl font-bold tracking-tighter text-[#333D29] italic">En<span className="text-[#005F73]">Groncho</span></span>
            <span className="text-[8px] md:text-[9px] font-bold text-[#333D29]/40 uppercase tracking-[0.2em]">Gestión Industrial</span>
          </div>
        </Link>

        {/* Mobile Menu Button */}
        <div className="flex items-center gap-4 md:hidden">
           <button 
             onClick={() => setIsMenuOpen(!isMenuOpen)}
             className="bg-[#F2EBE1] p-2.5 rounded-xl border border-[#D6CCC2] text-[#333D29] font-bold text-[10px] uppercase shadow-sm flex items-center gap-2"
           >
             {isMenuOpen ? (
               <>
                 <span className="text-xs">✕</span>
                 <span>Cerrar</span>
               </>
             ) : (
               <>
                 <span className="text-xs">☰</span>
                 <span>Menú</span>
               </>
             )}
           </button>
        </div>

        {/* Desktop Nav */}
        <div className="hidden md:flex gap-1.5 p-1 bg-[#D6CCC2]/30 rounded-[22px] border border-[#D6CCC2]/50">
          <NavLink to="/">Tablero</NavLink>
          <NavLink to="/ventas">Ventas</NavLink>
          <NavLink to="/cotizaciones">Presupuestos</NavLink>
          <NavLink to="/productos">Stock</NavLink>
          <NavLink to="/clientes">Clientes</NavLink>
        </div>

        <div className="hidden lg:flex items-center gap-6 shrink-0">
          <div className="flex flex-col text-right">
            <span className="text-[10px] font-bold text-[#333D29]/60 uppercase tracking-widest leading-none">{auth.user?.nombre || 'Usuario'}</span>
            <span className="text-[12px] font-bold text-[#005F73] flex items-center justify-end gap-1 mt-0.5 capitalize">
              {auth.user?.role || 'Admin'}
            </span>
          </div>
          <button 
            onClick={handleLogout}
            className="bg-[#F2EBE1] hover:bg-rose-100 hover:text-rose-700 px-4 py-2 rounded-xl font-bold text-[11px] uppercase transition-smooth border border-[#D6CCC2] text-[#333D29]/50"
          >
            Salir
          </button>
        </div>
      </nav>

      {/* Mobile Full-Screen Menu Overlay */}
      <div className={`fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] transition-all duration-300 md:hidden ${isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsMenuOpen(false)}>
        <div 
          className={`absolute top-0 right-0 w-[80%] h-full bg-[#EAE2D6] shadow-2xl transition-transform duration-300 flex flex-col ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}
          onClick={e => e.stopPropagation()}
        >
          {/* Menu Header */}
          <div className="bg-[#333D29] p-6 flex justify-between items-center text-white shrink-0">
            <div className="flex items-center gap-3">
               <img src={logo} alt="EnGroncho" className="w-8 h-8 object-contain brightness-0 invert" />
               <span className="font-bold tracking-tighter italic">Navegación</span>
            </div>
            <button 
              onClick={() => setIsMenuOpen(false)}
              className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-full text-2xl font-light"
            >
              &times;
            </button>
          </div>

          {/* Menu Links */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-[#EAE2D6]">
            <NavLink to="/" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-5 bg-white rounded-[20px] border border-[#D6CCC2] font-bold text-[#333D29] shadow-sm">
              <span className="text-xl">📊</span> 
              <div className="flex flex-col">
                <span className="text-sm">Tablero</span>
                <span className="text-[9px] text-slate-400 font-medium uppercase">Resumen General</span>
              </div>
            </NavLink>
            <NavLink to="/ventas" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-5 bg-white rounded-[20px] border border-[#D6CCC2] font-bold text-[#333D29] shadow-sm">
              <span className="text-xl">💰</span>
              <div className="flex flex-col">
                <span className="text-sm">Ventas</span>
                <span className="text-[9px] text-slate-400 font-medium uppercase">Historial de Operaciones</span>
              </div>
            </NavLink>
            <NavLink to="/cotizaciones" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-5 bg-white rounded-[20px] border border-[#D6CCC2] font-bold text-[#333D29] shadow-sm">
              <span className="text-xl">📄</span>
              <div className="flex flex-col">
                <span className="text-sm">Presupuestos</span>
                <span className="text-[9px] text-slate-400 font-medium uppercase">Cotizaciones y Clientes</span>
              </div>
            </NavLink>
            <NavLink to="/productos" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-5 bg-white rounded-[20px] border border-[#D6CCC2] font-bold text-[#333D29] shadow-sm">
              <span className="text-xl">📦</span>
              <div className="flex flex-col">
                <span className="text-sm">Stock</span>
                <span className="text-[9px] text-slate-400 font-medium uppercase">Gestión de Inventario</span>
              </div>
            </NavLink>
            <NavLink to="/clientes" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-5 bg-white rounded-[20px] border border-[#D6CCC2] font-bold text-[#333D29] shadow-sm">
              <span className="text-xl">👥</span>
              <div className="flex flex-col">
                <span className="text-sm">Clientes</span>
                <span className="text-[9px] text-slate-400 font-medium uppercase">Cartera Comercial</span>
              </div>
            </NavLink>
          </div>
          
          {/* Menu Footer */}
          <div className="p-6 bg-white border-t border-[#D6CCC2] mt-auto">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-[#005F73] rounded-full flex items-center justify-center text-white font-bold text-xl">
                {auth.user?.nombre?.[0] || 'U'}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-[#333D29]">{auth.user?.nombre || 'Usuario'}</span>
                <span className="text-[10px] font-bold text-[#005F73] uppercase tracking-widest">{auth.user?.role || 'Administrador'}</span>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="w-full bg-rose-50 text-rose-600 py-4 rounded-2xl font-bold text-xs uppercase border border-rose-100 shadow-sm flex items-center justify-center gap-3 active:scale-95 transition-transform"
            >
              <span>🚪</span> Cerrar Sesión
            </button>
          </div>
        </div>
      </div>

      <main className="flex-1 w-full max-w-[1600px] mx-auto px-2 md:px-8 py-4 md:py-8 animate-fade-in">
        <div className="bg-[#F2EBE1]/80 backdrop-blur-md rounded-[24px] md:rounded-[48px] shadow-premium min-h-[82vh] border border-[#D6CCC2]/60 overflow-hidden">
          {children}
        </div>
      </main>

      <footer className="py-8 text-center px-6">
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
      </footer>
    </div>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" richColors closeButton />
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/productos" element={<ProtectedRoute><ProductsPage /></ProtectedRoute>} />
            <Route path="/clientes" element={<ProtectedRoute><ClientsPage /></ProtectedRoute>} />
            <Route path="/ventas" element={<ProtectedRoute><SalesPage /></ProtectedRoute>} />
            <Route path="/ventas/nueva" element={<ProtectedRoute><NewSalePage /></ProtectedRoute>} />
            <Route path="/cotizaciones" element={<ProtectedRoute><QuotationsPage /></ProtectedRoute>} />
            <Route path="/cotizaciones/nueva" element={<ProtectedRoute><NewQuotationPage /></ProtectedRoute>} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
