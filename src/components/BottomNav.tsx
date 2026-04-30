import {
  Home, Heart, Star, User, LayoutDashboard, GitBranch,
  Tag, BarChart2, Ticket, Users, TrendingUp, Settings,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
  fluxfit_admin: [
    { path: '/admin/fluxfit',         label: 'Dashboard', Icon: LayoutDashboard },
    { path: '/admin/fluxfit/socios',  label: 'Socios',    Icon: Users },
    { path: '/admin/fluxfit/impacto', label: 'Impacto',   Icon: TrendingUp },
    { path: '/admin/fluxfit/config',  label: 'Config',    Icon: Settings },
  ],
};

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isGuest } = useAuth();

  // Role is already in context — no DB lookup needed
  const role = isGuest ? 'user' : (user?.role ?? 'user');
  const tabs = ROLE_TABS[role] ?? ROLE_TABS.user;

  const isActive = (path: string) => {
    // Exact match for root admin paths to avoid /admin/gym matching /admin/gym/branches
    const exactRoots = ['/admin/gym', '/admin/commerce', '/admin/fluxfit'];
    if (exactRoots.includes(path)) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] md:fixed md:left-0 md:top-0 md:translate-x-0 md:bottom-auto md:w-[200px] md:h-screen md:max-w-none bg-white border-t border-[#E5E5E5] md:border-t-0 md:border-r md:border-[#E5E5E5] flex items-center justify-around z-40">
      <div className="flex justify-around items-center h-16 px-2 w-full md:flex-col md:h-full md:justify-start md:items-stretch md:px-0 md:pt-8 md:gap-1">
        {tabs.map(({ path, label, Icon }) => {
          const active = isActive(path);
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[44px] md:flex-row md:justify-start md:px-5 md:py-3 md:gap-3 md:min-w-0 md:w-full ${active ? 'md:bg-[#CC0000]/5' : ''}`}
            >
              <Icon
                size={22}
                className={active ? 'text-[#CC0000]' : 'text-[#666]'}
                strokeWidth={active ? 2.5 : 1.5}
              />
              <span className={`text-[10px] font-medium md:text-sm ${active ? 'text-[#CC0000] font-bold' : 'text-[#666]'}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
