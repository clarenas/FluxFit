import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { GymCard } from '../components/GymCard';
import type { Gym } from '../lib/types';

export function FavoritesPage() {
  const navigate = useNavigate();
  const { user, isGuest } = useAuth();
  const [gyms, setGyms] = useState<Gym[]>([]);

  const fetchFavorites = useCallback(async () => {
    if (!user || isGuest) return;
    const { data: favs } = await supabase.from('user_favorite_gyms').select('gym_id').eq('user_id', user.id);
    if (favs) {
      const ids = favs.map(f => f.gym_id);
      if (ids.length > 0) { const { data: gymData } = await supabase.from('gyms').select('*').in('id', ids).eq('is_active', true); if (gymData) setGyms(gymData); }
    }
  }, [user, isGuest]);

  useEffect(() => { fetchFavorites(); }, [fetchFavorites]);

  useEffect(() => {
    const channel = supabase.channel('fav-gyms-realtime').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'gyms' }, payload => {
      setGyms(prev => prev.map(g => g.id === payload.new.id ? { ...g, ...payload.new } as Gym : g));
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const toggleFavorite = async (gymId: string) => {
    if (!user || isGuest) return;
    await supabase.from('user_favorite_gyms').delete().eq('user_id', user.id).eq('gym_id', gymId);
    setGyms(prev => prev.filter(g => g.id !== gymId));
  };

  if (isGuest) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] pb-20">
        <div className="bg-white border-b border-[#E5E5E5] px-4 py-3"><h1 className="text-[#111111] font-bold text-lg">Mis Gyms</h1></div>
        <div className="px-4 pt-4">
          <div className="text-center py-16">
            <Eye size={48} className="text-[#E5E5E5] mx-auto mb-3" />
            <p className="text-[#666666]">Crea una cuenta para guardar gyms</p>
            <button onClick={() => navigate('/auth?mode=register')} className="mt-3 text-[#CC0000] font-bold text-sm">Crear cuenta</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-20">
      <div className="bg-white border-b border-[#E5E5E5] px-4 py-3"><h1 className="text-[#111111] font-bold text-lg">Mis Gyms</h1></div>
      <div className="px-4 pt-4">
        {gyms.length === 0 ? (
          <div className="text-center py-16"><Heart size={48} className="text-[#E5E5E5] mx-auto mb-3" /><p className="text-[#666666]">Aún no tienes gyms guardados</p><button onClick={() => navigate('/home')} className="mt-3 text-[#CC0000] font-bold text-sm">Explorar gyms</button></div>
        ) : (
          <div className="grid grid-cols-2 gap-3">{gyms.map(gym => <GymCard key={gym.id} gym={gym} isFavorite={true} onToggleFavorite={toggleFavorite} onClick={id => navigate(`/gym/${id}`)} />)}</div>
        )}
      </div>
    </div>
  );
}
