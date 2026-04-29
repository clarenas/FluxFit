import { useNavigate } from 'react-router-dom';
import { LogOut, Eye, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getInitials, getOccupancyColor, getOccupancyLabel } from '../lib/utils';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Gym } from '../lib/types';

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, signOut, isGuest } = useAuth();
  const [favGyms, setFavGyms] = useState<Gym[]>([]);
  const isPremium = user?.is_premium ?? false;

  const fetchFavGyms = useCallback(async () => {
    if (!user || isGuest) return;
    const { data: favs } = await supabase.from('user_favorite_gyms').select('gym_id').eq('user_id', user.id);
    if (favs && favs.length > 0) {
      const { data: gymData } = await supabase.from('gyms').select('*').in('id', favs.map(f => f.gym_id)).eq('is_active', true);
      if (gymData) setFavGyms(gymData);
    }
  }, [user, isGuest]);

  useEffect(() => { fetchFavGyms(); }, [fetchFavGyms]);

  useEffect(() => {
    const channel = supabase.channel('profile-gyms-realtime').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'gyms' }, payload => {
      setFavGyms(prev => prev.map(g => g.id === payload.new.id ? { ...g, ...payload.new } as Gym : g));
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleSignOut = async () => { await signOut(); navigate('/'); };

  if (isGuest) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] pb-20">
        <div className="bg-white border-b border-[#E5E5E5] px-4 py-3"><h1 className="text-[#111111] font-bold text-lg">Perfil</h1></div>
        <div className="px-4 pt-6 space-y-4">
          <div className="bg-white rounded-xl border border-[#E5E5E5] p-5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#E5E5E5] flex items-center justify-center text-[#666]"><Eye size={24} /></div>
            <div className="flex-1">
              <h2 className="font-bold text-[#111111]">Modo invitado</h2>
              <p className="text-sm text-[#666666]">Estas explorando la app sin cuenta</p>
            </div>
          </div>
          <div className="bg-[#CC0000]/10 border border-[#CC0000]/30 rounded-xl p-4">
            <p className="text-[#CC0000] font-bold">Crea tu cuenta para acceder a todo</p>
            <p className="text-[#CC0000] text-sm mt-1">Guarda gyms, activa Premium y obtiene descuentos exclusivos</p>
          </div>
          <button onClick={() => navigate('/auth?mode=register')} className="w-full py-3.5 bg-[#CC0000] text-white font-bold rounded-xl text-base active:scale-[0.98] transition-transform">Crear cuenta</button>
          <button onClick={() => navigate('/auth?mode=login')} className="w-full py-3.5 border-2 border-[#111111] text-[#111111] font-bold rounded-xl text-base active:scale-[0.98] transition-transform">Ya tengo cuenta</button>
          <button onClick={() => navigate('/')} className="w-full py-3.5 border-2 border-[#CC0000]/30 text-[#CC0000] font-bold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"><LogOut size={18} />Salir del modo invitado</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-20">
      <div className="bg-white border-b border-[#E5E5E5] px-4 py-3"><h1 className="text-[#111111] font-bold text-lg">Perfil</h1></div>
      <div className="px-4 pt-6 space-y-4">
        <div className="bg-white rounded-xl border border-[#E5E5E5] p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[#CC0000] flex items-center justify-center text-white font-bold text-lg">{user ? getInitials(user.full_name) : '?'}</div>
          <div className="flex-1">
            <h2 className="font-bold text-[#111111]">{user?.full_name || 'Usuario'}</h2>
            <p className="text-sm text-[#666666]">{user?.email}</p>
            {isPremium && <span className="inline-block mt-1 bg-[#CC0000] text-white text-xs font-bold px-2 py-0.5 rounded-full">✦ FluxFit Premium</span>}
          </div>
        </div>
        {isPremium && user?.premium_since && (
          <div className="bg-[#16A34A]/10 border border-[#16A34A]/30 rounded-xl p-4"><p className="text-[#16A34A] font-bold">Miembro Premium activo</p><p className="text-[#16A34A] text-sm mt-1">Miembro desde {new Date(user.premium_since).toLocaleDateString('es-CL')}</p></div>
        )}
        {!isPremium && (
          <button onClick={() => navigate('/premium')} className="w-full bg-[#CC0000] text-white font-bold rounded-xl p-4 text-left active:scale-[0.98] transition-transform"><p className="font-bold text-lg">✦ Hazte Premium</p><p className="text-white/80 text-sm mt-1">Desbloquea descuentos y precios especiales</p></button>
        )}
        <div>
          <h3 className="font-bold text-[#111111] mb-3">Mis gyms guardados</h3>
          {favGyms.length === 0 ? <p className="text-sm text-[#666666]">Aún no tienes gyms guardados</p> : (
            <div className="space-y-2">
              {favGyms.map(gym => {
                const statusColor = gym.sensor_online ? getOccupancyColor(gym.occupancy_status) : '#999';
                const statusLabel = gym.sensor_online ? getOccupancyLabel(gym.occupancy_status) : 'Sin datos';
                return (
                  <button key={gym.id} onClick={() => navigate(`/gym/${gym.id}`)} className="w-full bg-white rounded-xl border border-[#E5E5E5] p-3 flex items-center justify-between active:scale-[0.98] transition-transform">
                    <div className="text-left"><p className="font-bold text-[#111111] text-sm">{gym.name}</p><p className="text-xs text-[#666666]">{gym.comuna}</p></div>
                    <span className="text-white text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: statusColor }}>{statusLabel}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <button onClick={handleSignOut} className="w-full py-3.5 border-2 border-[#111111] text-[#111111] font-bold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"><LogOut size={18} />Cerrar sesión</button>
        <button
          onClick={() => navigate('/contact')}
          className="w-full py-3.5 border border-[#E5E5E5] text-[#666666] rounded-xl flex items-center justify-center gap-2 text-sm active:scale-[0.98] transition-transform"
        >
          <Mail size={16} />
          Contáctanos
        </button>
      </div>
    </div>
  );
}
