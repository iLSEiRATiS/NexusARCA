import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from 'sonner';
import { currencyService } from './services/currencyService';
import Dashboard from './pages/Dashboard';
import ClientsPage from './pages/ClientsPage';
import NewSalePage from './pages/NewSalePage';
import SalesPage from './pages/SalesPage';
import QuotationsPage from './pages/QuotationsPage';
import NewQuotationPage from './pages/NewQuotationPage';
import LoginPage from './pages/LoginPage';
import SettingsPage from './pages/SettingsPage';
import { 
  LayoutDashboard, 
  FileText, 
  Calculator, 
  Users, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  RefreshCw,
  ShieldCheck,
  Lock
} from 'lucide-react';
import { PrivacyProvider, usePrivacy } from './context/PrivacyContext';
import { PinAuthModal } from './components/PinAuthModal';

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

interface NavLinkProps {
  to: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
}

const NavLink = ({ to, icon, children, onClick }: NavLinkProps) => {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
  
  return (
    <Link 
      to={to} 
      onClick={onClick}
      className={`font-bold px-3 py-2 text-xs transition-all flex items-center gap-2 uppercase tracking-wider ${
        isActive 
          ? 'bg-slate-900 text-white shadow-sm' 
          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
      }`}
    >
      <span className={isActive ? 'text-blue-400' : 'text-slate-400'}>{icon}</span>
      {children}
    </Link>
  );
};

// Indicador compacto del dólar BNA para el Navbar
const HeaderDolarIndicator = () => {
  const { data: dolar, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['dolar-bna'],
    queryFn: currencyService.getDolarOficial,
    refetchInterval: 1000 * 60 * 30, // cada 30 min
  });

  return (
    <button 
      type="button"
      onClick={() => refetch()} 
      disabled={isFetching}
      className="hidden lg:flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 transition-all cursor-pointer text-left"
      title="Cotización oficial BNA (Clic para sincronizar)"
    >
      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">USD BNA:</span>
      <span className="text-xs font-black text-slate-900">
        {isLoading ? '...' : isError ? 'S/D' : `$${Number(dolar).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
      </span>
      <RefreshCw size={11} className={`text-slate-400 ${isFetching ? 'animate-spin' : ''}`} />
    </button>
  );
};

// Indicador discreto del modo de privacidad para el Navbar
const PrivacyNavbarBadge = () => {
  const { isManagementUnlocked, openPinModal, lockManagement } = usePrivacy();

  if (isManagementUnlocked) {
    return (
      <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-300 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-emerald-800 animate-fade-in shadow-2xs">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span>Gestión Activa</span>
        <button
          type="button"
          onClick={lockManagement}
          className="ml-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
          title="Bloquear y volver a Modo Fiscal Oficial (Esc)"
        >
          <Lock size={12} />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={openPinModal}
      className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-slate-600 transition-all cursor-pointer"
      title="Modo Fiscal Oficial protegido. Clic para autorizar gestión comercial (Ctrl+Shift+G)"
    >
      <ShieldCheck size={14} className="text-blue-600" />
      <span>Modo Fiscal</span>
    </button>
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

  const userInitial = auth?.user?.nombre ? auth.user.nombre.charAt(0).toUpperCase() : 'U';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Top Navbar */}
      <nav className="border-b border-slate-200 px-6 md:px-10 py-4 flex justify-between items-center sticky top-0 z-50 bg-white shadow-xs">
        {/* Logo / Brand */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 bg-slate-900 text-white flex items-center justify-center font-black text-base tracking-tighter">
            M
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-black tracking-tight uppercase text-slate-900 leading-none">
              Máscolo <span className="text-blue-600 font-bold">Facturador</span>
            </span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">
              ARCA &bull; Facturación Fiscal
            </span>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <div className="hidden md:flex items-center gap-2">
          <NavLink to="/" icon={<LayoutDashboard size={14} />}>Inicio</NavLink>
          <NavLink to="/facturacion" icon={<FileText size={14} />}>Facturación</NavLink>
          <NavLink to="/cotizaciones" icon={<Calculator size={14} />}>Presupuestos</NavLink>
          <NavLink to="/clientes" icon={<Users size={14} />}>Clientes</NavLink>
          <NavLink to="/configuracion" icon={<Settings size={14} />}>Config</NavLink>
        </div>

        {/* Desktop Right Section: Privacy + Dolar + User */}
        <div className="hidden md:flex items-center gap-3">
          <PrivacyNavbarBadge />
          <HeaderDolarIndicator />

          <div className="h-5 w-px bg-slate-200"></div>

          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center text-xs font-black">
              {userInitial}
            </div>
            <span className="text-xs font-bold uppercase text-slate-700 tracking-wider">
              {auth?.user?.nombre || 'Usuario'}
            </span>
          </div>

          <button 
            type="button"
            onClick={handleLogout}
            className="text-xs font-bold uppercase border border-slate-300 text-slate-600 px-3 py-1.5 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all tracking-wider flex items-center gap-1.5 cursor-pointer"
            title="Cerrar Sesión"
          >
            <LogOut size={13} />
            Salir
          </button>
        </div>

        {/* Mobile Nav Button */}
        <button 
          type="button"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="md:hidden p-2 text-slate-900 text-lg border border-slate-200 cursor-pointer"
        >
          {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden border-b border-slate-200 bg-white p-5 flex flex-col gap-2 animate-fade-in shadow-lg">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-1">
            <PrivacyNavbarBadge />
            <HeaderDolarIndicator />
          </div>
          <NavLink to="/" icon={<LayoutDashboard size={16} />} onClick={() => setIsMenuOpen(false)}>Inicio</NavLink>
          <NavLink to="/facturacion" icon={<FileText size={16} />} onClick={() => setIsMenuOpen(false)}>Facturación</NavLink>
          <NavLink to="/cotizaciones" icon={<Calculator size={16} />} onClick={() => setIsMenuOpen(false)}>Presupuestos</NavLink>
          <NavLink to="/clientes" icon={<Users size={16} />} onClick={() => setIsMenuOpen(false)}>Clientes</NavLink>
          <NavLink to="/configuracion" icon={<Settings size={16} />} onClick={() => setIsMenuOpen(false)}>Configuración</NavLink>
          <div className="pt-2 border-t border-slate-100 flex justify-between items-center mt-2">
            <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">
              {auth?.user?.nombre || 'Usuario'}
            </span>
            <button 
              type="button"
              onClick={handleLogout}
              className="font-bold text-red-600 text-xs uppercase tracking-wider flex items-center gap-1.5"
            >
              <LogOut size={13} />
              Cerrar Sesión
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 md:p-10">
        <div className="bg-white border border-slate-200 p-6 md:p-10 shadow-xs min-h-[70vh]">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 text-center border-t border-slate-200 bg-white">
        <div className="flex flex-col sm:flex-row justify-center items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest">
          <span>Máscolo Químicos</span>
          <span className="hidden sm:inline">&bull;</span>
          <span>Sistema Facturador Fiscal ARCA 2026</span>
        </div>
      </footer>
    </div>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PrivacyProvider>
        <Toaster position="top-right" richColors closeButton />
        <PinAuthModal />
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
              <Route path="/configuracion" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </PrivacyProvider>
    </QueryClientProvider>
  );
}

export default App;
