import {
  Home, Heart, Star, User, LayoutDashboard, GitBranch,
  Tag, BarChart2, Ticket, Users, TrendingUp, Settings, Cpu, LogOut,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

type NavTab = { path: string; label: string; Icon: React.ElementType };

// Each role gets exactly one set of tabs — no crossover
const ROLE_TABS: Record<string, NavTab[]> = {
  user: [
    { path: '/home',      label: 'Explorar',  Icon: Home },
    { path: '/favorites', label: 'Mis Gyms',  Icon: Heart },
    { path: '/premium',   label: 'Premium',   Icon: Star },
    { path: '/profile',   label: 'Perfil',    Icon: User },
  ],
  gym_admin: [
    { path: '/admin/gym',           label: 'Dashboard',  Icon: LayoutDashboard },
    { path: '/admin/gym/branches',  label: 'Sucursales', Icon: GitBranch },
    { path: '/admin/gym/offers',    label: 'Ofertas',    Icon: Tag },
    { path: '/admin/gym/premium',   label: 'Mi Plan',    Icon: Star },
  ],
  commerce_admin: [
    { path: '/admin/commerce',         label: 'Dashboard',   Icon: LayoutDashboard },
    { path: '/admin/commerce/coupons', label: 'Cupones',     Icon: Ticket },
    { path: '/admin/commerce/stats',   label: 'Estadísticas',Icon: BarChart2 },
    { path: '/admin/commerce/premium', label: 'Mi Plan',     Icon: Star },
  ],
  gofitnow_admin: [
    { path: '/admin/gofitnow',          label: 'Dashboard', Icon: LayoutDashboard },
    { path: '/admin/gofitnow/socios',   label: 'Socios',    Icon: Users },
    { path: '/admin/gofitnow/sensores', label: 'Sensores',  Icon: Cpu },
    { path: '/admin/gofitnow/impacto',  label: 'Impacto',   Icon: TrendingUp },
    { path: '/admin/gofitnow/config',   label: 'Config',    Icon: Settings },
  ],
};

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isGuest } = useAuth();

  // Role is already in context — no DB lookup needed
  const role = isGuest ? 'user' : (user?.role ?? 'user');
  const isPremium = user?.plan === 'premium';
  const baseTabs = ROLE_TABS[role] ?? ROLE_TABS.user;
  const tabs = role === 'user' && isPremium
    ? [
        ...baseTabs.slice(0, 3),
        { path: '/discounts', label: 'Descuentos GoFitNow', Icon: Tag },
        { path: '/compare', label: 'Comparar', Icon: BarChart2 },
        ...baseTabs.slice(3),
      ]
    : baseTabs;
  const sidebarSubtitle =
    role === 'gofitnow_admin' ? 'Panel Admin' :
    role === 'gym_admin' ? 'Panel Gym' :
    role === 'commerce_admin' ? 'Panel Comercio' :
    'Panel Usuario';

  const isActive = (path: string) => {
    // Exact match for root admin paths to avoid /admin/gym matching /admin/gym/branches
    const exactRoots = ['/admin/gym', '/admin/commerce', '/admin/gofitnow'];
    if (exactRoots.includes(path)) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] md:fixed md:left-0 md:top-0 md:translate-x-0 md:bottom-auto md:w-[200px] md:h-screen md:max-w-none bg-white border-t border-[#E5E5E5] md:border-t-0 md:border-r md:border-[#E5E5E5] flex items-center justify-around z-40">
      <div className="flex justify-around items-center h-16 px-2 w-full md:flex-col md:h-full md:justify-start md:items-stretch md:px-0 md:gap-0">
        <div className="hidden md:block px-4 pt-5 pb-4 border-b border-[#F0F0F0]">
          <p style={{ color: '#CC0000', fontWeight: 500, fontSize: 18 }}>GOFITNOW</p>
          <p style={{ fontSize: 12 }} className="text-[#999] mt-0.5">{sidebarSubtitle}</p>
        </div>
        <div className="hidden md:block py-2" />
        {tabs.map(({ path, label, Icon }) => {
          const active = isActive(path);
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              style={active ? { fontSize: 14, padding: '0.625rem 1rem' } : { fontSize: 14, padding: '0.625rem 1rem' }}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[44px] md:flex-row md:justify-start md:min-w-0 md:w-full md:text-left md:transition-colors ${
                active ? 'md:bg-[#CC0000] md:text-white' : 'md:text-[#111] md:hover:bg-[#F5F5F5]'
              }`}
            >
              <Icon
                size={22}
                className={`${active ? 'text-[#CC0000]' : 'text-[#666]'} md:w-4 md:h-4 ${active ? 'md:text-white' : 'md:text-[#111]'}`}
                strokeWidth={active ? 2.5 : 1.5}
              />
              <span className={`text-[10px] font-medium md:text-sm md:font-medium ${active ? 'text-[#CC0000] font-bold md:text-white' : 'text-[#666] md:text-[#111]'}`}>
                {label}
              </span>
            </button>
          );
        })}

        <button
          onClick={handleLogout}
          className="flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[44px] md:hidden"
        >
          <LogOut size={22} className="text-[#666]" strokeWidth={1.5} />
          <span className="text-[10px] font-medium text-[#666]">Salir</span>
        </button>

        <div className="hidden md:block mt-auto px-3 pb-4">
          {/* Separador */}
          <div className="border-t border-gray-200 my-2" />

          {/* Cerrar sesión */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors w-full text-left"
          >
            <LogOut className="w-5 h-5" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
