import { Home, Heart, Star, User, LayoutDashboard, GitBranch, Tag, BarChart2, Ticket } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

type NavTab = { path: string; label: string; Icon: React.ElementType };

const userTabs: NavTab[] = [
  { path: '/home', label: 'Explorar', Icon: Home },
  { path: '/favorites', label: 'Mis Gyms', Icon: Heart },
  { path: '/premium', label: 'Premium', Icon: Star },
  { path: '/profile', label: 'Perfil', Icon: User },
];

const gymAdminTabs: NavTab[] = [
  { path: '/admin/gym', label: 'Dashboard', Icon: LayoutDashboard },
  { path: '/admin/gym/branches', label: 'Sucursales', Icon: GitBranch },
  { path: '/admin/gym/offers', label: 'Ofertas', Icon: Tag },
  { path: '/admin/gym/premium', label: 'Mi Plan', Icon: Star },
];

const commerceAdminTabs: NavTab[] = [
  { path: '/admin/commerce', label: 'Dashboard', Icon: LayoutDashboard },
  { path: '/admin/commerce/coupons', label: 'Mis Cupones', Icon: Ticket },
  { path: '/admin/commerce/stats', label: 'Estadísticas', Icon: BarChart2 },
  { path: '/admin/commerce/premium', label: 'Mi Plan', Icon: Star },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isGuest } = useAuth();
  const [isGymAdmin, setIsGymAdmin] = useState(false);
  const [isCommerceAdmin, setIsCommerceAdmin] = useState(false);

  useEffect(() => {
    if (!user || isGuest) return;
    supabase.from('gym_admins').select('id').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setIsGymAdmin(!!data));
    supabase.from('commerce_admins').select('id').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => setIsCommerceAdmin(!!data));
  }, [user, isGuest]);

  // Determine which tab set to show based on current route and role
  const onGymAdmin = location.pathname.startsWith('/admin/gym');
  const onCommerceAdmin = location.pathname.startsWith('/admin/commerce');

  let tabs: NavTab[];
  if (onGymAdmin && isGymAdmin) {
    tabs = gymAdminTabs;
  } else if (onCommerceAdmin && isCommerceAdmin) {
    tabs = commerceAdminTabs;
  } else {
    tabs = userTabs;
  }

  const isActive = (path: string) => {
    if (path === '/admin/gym' || path === '/admin/commerce') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] md:fixed md:left-0 md:top-0 md:translate-x-0 md:bottom-auto md:w-[200px] md:h-screen md:max-w-none md:flex-col md:justify-start md:pt-8 md:border-r md:border-[#E5E5E5] md:border-t-0 bg-white border-t border-[#E5E5E5] flex items-center justify-around z-40">
      <div className="flex justify-around items-center h-16 px-2 w-full md:flex-col md:h-full md:justify-start md:items-stretch md:px-0 md:gap-1">
        {tabs.map(({ path, label, Icon }) => {
          const active = isActive(path);
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[44px] md:w-full md:justify-start md:px-6 md:py-3 md:gap-3 md:rounded-none md:flex-row md:min-w-0 ${active ? 'md:bg-[#CC0000]/5' : ''}`}
            >
              <Icon
                size={22}
                className={active ? 'text-[#CC0000]' : 'text-[#666]'}
                fill={active && path === '/favorites' ? '#CC0000' : 'none'}
                strokeWidth={active ? 2.5 : 1.5}
              />
              <span className={`text-[10px] font-medium md:text-sm ${active ? 'text-[#CC0000]' : 'text-[#666]'}`}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
