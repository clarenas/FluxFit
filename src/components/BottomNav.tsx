import { Home, Heart, Star, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const tabs = [
  { path: '/home', label: 'Inicio', Icon: Home },
  { path: '/favorites', label: 'Mis Gyms', Icon: Heart },
  { path: '/premium', label: 'Premium', Icon: Star },
  { path: '/profile', label: 'Perfil', Icon: User },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = (path: string) => location.pathname.startsWith(path);

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
              <Icon size={22} className={active ? 'text-[#CC0000]' : 'text-[#666]'} fill={active && path === '/favorites' ? '#CC0000' : 'none'} strokeWidth={active ? 2.5 : 1.5} />
              <span className={`text-[10px] font-medium md:text-sm ${active ? 'text-[#CC0000]' : 'text-[#666]'}`}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
