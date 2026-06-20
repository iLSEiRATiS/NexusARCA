import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from 'sonner';
import Dashboard from './pages/Dashboard';
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
  const auth = localStorage.getItem('mascolo_facturador_auth');
  if (!auth) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const NavLink = ({ to, children, onClick }: { to: string, children: React.ReactNode, onClick?: () => void }) => {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
  
  return (
    <Link 
      to={to} 
      onClick={onClick}
      className={`${
        isActive ? 'border-b-2 border-slate-900 text-slate-900' : 'text-slate-400 hover:text-slate-600'
      } font-bold px-2 py-2 text-[13px] transition-all flex items-center gap-2 uppercase tracking-wider`}
    >
      {children}
    </Link>
  );
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const isLogin = location.pathname === '/login';

  if (isLogin) return <>{children}</>;

  const handleLogout = () => {
    localStorage.removeItem('mascolo_facturador_auth');
    window.location.href = '/login';
  };

  let auth: any = {};
  try {
    const authData = localStorage.getItem('mascolo_facturador_auth');
    auth = authData ? JSON.parse(authData) : {};
  } catch (e) {
    console.error('Error parsing auth data', e);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <nav className="border-b border-slate-200 px-6 md:px-10 py-6 flex justify-between items-center sticky top-0 z-50 bg-white">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-xl font-black tracking-tighter uppercase text-slate-900">Mascolo <span className="text-blue-600 font-light">Facturador</span></span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex gap-10">
          <NavLink to="/">Inicio</NavLink>
          <NavLink to="/facturacion">Facturación</NavLink>
          <NavLink to="/cotizaciones">Presupuestos</NavLink>
          <NavLink to="/clientes">Clientes</NavLink>
        </div>

        <div className="hidden md:flex items-center gap-6">
          <span className="text-[11px] font-bold uppercase text-slate-400 tracking-widest">{auth?.user?.nombre || 'Usuario'}</span>
          <button 
            onClick={handleLogout}
            className="text-[11px] font-bold uppercase border border-slate-900 px-4 py-2 hover:bg-slate-900 hover:text-white transition-all tracking-widest"
          >
            Salir
          </button>
        </div>

        {/* Mobile Nav Button */}
        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="md:hidden p-2 text-slate-900 text-xl"
        >
          {isMenuOpen ? '✕' : '☰'}
        </button>
      </nav>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden border-b border-slate-200 bg-white p-6 flex flex-col gap-4 animate-fade-in shadow-lg">
          <NavLink to="/" onClick={() => setIsMenuOpen(false)}>Inicio</NavLink>
          <NavLink to="/facturacion" onClick={() => setIsMenuOpen(false)}>Facturación</NavLink>
          <NavLink to="/cotizaciones" onClick={() => setIsMenuOpen(false)}>Presupuestos</NavLink>
          <NavLink to="/clientes" onClick={() => setIsMenuOpen(false)}>Clientes</NavLink>
          <button 
            onClick={handleLogout}
            className="text-left font-bold text-slate-400 px-2 py-2 text-sm uppercase tracking-widest"
          >
            Salir
          </button>
        </div>
      )}

      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-10">
        <div className="bg-white border border-slate-200 p-6 md:p-10 shadow-sm min-h-[70vh]">
          {children}
        </div>
      </main>

      <footer className="py-12 text-center border-t border-slate-200 bg-white">
        <span className="text-slate-300 text-[10px] font-bold uppercase tracking-[0.4em]">Mascolo Químicos &bull; 2026</span>
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
            <Route path="/clientes" element={<ProtectedRoute><ClientsPage /></ProtectedRoute>} />
            <Route path="/facturacion" element={<ProtectedRoute><SalesPage /></ProtectedRoute>} />
            <Route path="/facturacion/nueva" element={<ProtectedRoute><NewSalePage /></ProtectedRoute>} />
            <Route path="/cotizaciones" element={<ProtectedRoute><QuotationsPage /></ProtectedRoute>} />
            <Route path="/cotizaciones/nueva" element={<ProtectedRoute><NewQuotationPage /></ProtectedRoute>} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
