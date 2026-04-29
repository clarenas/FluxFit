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
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-[#111111] border-t border-[#333] z-50">
      <div className="flex justify-around items-center h-16 px-2">
        {tabs.map(({ path, label, Icon }) => {
          const active = isActive(path);
          return (
            <button key={path} onClick={() => navigate(path)} className="flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[44px]">
              <Icon size={22} className={active ? 'text-[#CC0000]' : 'text-white'} fill={active && path === '/favorites' ? '#CC0000' : 'none'} strokeWidth={active ? 2.5 : 1.5} />
              <span className={`text-[10px] font-medium ${active ? 'text-[#CC0000]' : 'text-[#999]'}`}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
