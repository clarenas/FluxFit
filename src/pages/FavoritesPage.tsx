import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Eye, GitCompare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { GymCard } from '../components/GymCard';
import { getOccupancyColor, getOccupancyLabel, formatCLP } from '../lib/utils';
import type { Gym, GymPlan } from '../lib/types';

type Tab = 'guardados' | 'comparar';

function CompareSlot({ label, gym, gyms, onChange, plans }: { label: string; gym: Gym | null; gyms: Gym[]; onChange: (g: Gym | null) => void; plans: GymPlan[] }) {
  const [open, setOpen] = useState(false);
  const statusColor = gym && gym.sensor_online ? getOccupancyColor(gym.occupancy_status) : '#999';
  const statusLabel = gym ? (gym.sensor_online ? getOccupancyLabel(gym.occupancy_status) : 'Sin datos') : '';
  const pct = gym ? gym.occupancy_percentage : 0;

  return (
    <div className="flex-1 min-w-0">
      <p className="text-[10px] text-[#999] font-bold uppercase tracking-wider mb-1">{label}</p>
      {gym ? (
        <div className="bg-white rounded-xl border border-[#E5E5E5] p-3">
          <button onClick={() => setOpen(true)} className="w-full text-left">
            <p className="font-bold text-[#111] text-sm truncate">{gym.name}</p>
            <p className="text-xs text-[#999] truncate">{gym.comuna}</p>
          </button>
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-[#666]">Ocupación</span>
              <span className="text-[10px] font-bold" style={{ color: statusColor }}>{statusLabel}</span>
            </div>
            <div className="h-2 bg-[#F5F5F5] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: statusColor }} />
            </div>
            <p className="text-[10px] text-[#999] mt-0.5 text-right">{pct}%</p>
          </div>
          {plans.length > 0 && (
            <div className="mt-2 space-y-1">
              {plans.slice(0, 2).map(p => (
                <div key={p.id} className="flex justify-between text-xs">
                  <span className="text-[#666] truncate mr-1">{p.name}</span>
                  <span className="font-bold text-[#111] flex-shrink-0">{formatCLP(p.regular_price)}</span>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => onChange(null)} className="mt-2 text-[10px] text-[#CC0000] font-bold">Cambiar</button>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="w-full h-24 border-2 border-dashed border-[#E5E5E5] rounded-xl flex items-center justify-center text-[#999] text-xs">
          + Seleccionar gym
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end" onClick={() => setOpen(false)}>
          <div className="bg-white w-full rounded-t-2xl p-4 max-h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <p className="font-bold text-[#111] mb-3">Seleccionar gym</p>
            <div className="space-y-2">
              {gyms.map(g => (
                <button key={g.id} onClick={() => { onChange(g); setOpen(false); }} className="w-full text-left p-3 rounded-xl border border-[#E5E5E5] active:bg-[#F5F5F5]">
                  <p className="font-bold text-sm text-[#111]">{g.name}</p>
                  <p className="text-xs text-[#999]">{g.comuna}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function FavoritesPage() {
  const navigate = useNavigate();
  const { user, isGuest } = useAuth();
  const [tab, setTab] = useState<Tab>('guardados');
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [allGyms, setAllGyms] = useState<Gym[]>([]);
  const [gymA, setGymA] = useState<Gym | null>(null);
  const [gymB, setGymB] = useState<Gym | null>(null);
  const [plansA, setPlansA] = useState<GymPlan[]>([]);
  const [plansB, setPlansB] = useState<GymPlan[]>([]);

  const fetchFavorites = useCallback(async () => {
    if (!user || isGuest) return;
    const { data: favs } = await supabase.from('user_favorite_gyms').select('gym_id').eq('user_id', user.id);
    if (favs && favs.length > 0) {
      const { data: gymData } = await supabase.from('gyms').select('*').in('id', favs.map(f => f.gym_id)).eq('is_active', true);
      if (gymData) setGyms(gymData);
    }
  }, [user, isGuest]);

  useEffect(() => { fetchFavorites(); }, [fetchFavorites]);

  useEffect(() => {
    supabase.from('gyms').select('*').eq('is_active', true).order('name').then(({ data }) => setAllGyms(data ?? []));
  }, []);

  useEffect(() => {
    const channel = supabase.channel('fav-gyms-realtime').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'gyms' }, payload => {
      const updated = payload.new as Gym;
      setGyms(prev => prev.map(g => g.id === updated.id ? { ...g, ...updated } : g));
      setGymA(prev => prev?.id === updated.id ? { ...prev, ...updated } : prev);
      setGymB(prev => prev?.id === updated.id ? { ...prev, ...updated } : prev);
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (gymA) supabase.from('gym_plans').select('*').eq('gym_id', gymA.id).eq('is_active', true).then(({ data }) => setPlansA(data ?? []));
    else setPlansA([]);
  }, [gymA]);

  useEffect(() => {
    if (gymB) supabase.from('gym_plans').select('*').eq('gym_id', gymB.id).eq('is_active', true).then(({ data }) => setPlansB(data ?? []));
    else setPlansB([]);
  }, [gymB]);

  const toggleFavorite = async (gymId: string) => {
    if (!user || isGuest) return;
    await supabase.from('user_favorite_gyms').delete().eq('user_id', user.id).eq('gym_id', gymId);
    setGyms(prev => prev.filter(g => g.id !== gymId));
  };

  if (isGuest) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] pb-24">
        <div className="bg-white border-b border-[#E5E5E5] px-4 py-3"><h1 className="text-[#111] font-bold text-lg">Mis Gyms</h1></div>
        <div className="px-4 pt-4 text-center py-16">
          <Eye size={48} className="text-[#E5E5E5] mx-auto mb-3" />
          <p className="text-[#666]">Crea una cuenta para guardar gyms</p>
          <button onClick={() => navigate('/auth?mode=register')} className="mt-3 text-[#CC0000] font-bold text-sm">Crear cuenta</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-24">
      <div className="bg-white border-b border-[#E5E5E5] px-4 py-3">
        <h1 className="text-[#111] font-bold text-lg">Mis Gyms</h1>
      </div>

      <div className="flex bg-white border-b border-[#E5E5E5]">
        {(['guardados', 'comparar'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold border-b-2 transition-colors ${tab === t ? 'border-[#CC0000] text-[#CC0000]' : 'border-transparent text-[#999]'}`}>
            {t === 'guardados' ? <><Heart size={13} /> Guardados</> : <><GitCompare size={13} /> Comparar</>}
          </button>
        ))}
      </div>

      <div className="px-4 pt-4">
        {tab === 'guardados' && (
          gyms.length === 0 ? (
            <div className="text-center py-16">
              <Heart size={48} className="text-[#E5E5E5] mx-auto mb-3" />
              <p className="text-[#666]">Aún no tienes gyms guardados</p>
              <button onClick={() => navigate('/home')} className="mt-3 text-[#CC0000] font-bold text-sm">Explorar gyms</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {gyms.map(gym => <GymCard key={gym.id} gym={gym} isFavorite onToggleFavorite={toggleFavorite} onClick={id => navigate(`/gym/${id}`)} />)}
            </div>
          )
        )}

        {tab === 'comparar' && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <CompareSlot label="Gym A" gym={gymA} gyms={allGyms} onChange={setGymA} plans={plansA} />
              <CompareSlot label="Gym B" gym={gymB} gyms={allGyms} onChange={setGymB} plans={plansB} />
            </div>

            {gymA && gymB && (
              <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#F5F5F5]">
                  <p className="font-bold text-sm text-[#111]">Comparación de planes</p>
                </div>
                {(() => {
                  const allPlanNames = Array.from(new Set([...plansA.map(p => p.name), ...plansB.map(p => p.name)]));
                  if (allPlanNames.length === 0) return <p className="text-xs text-[#999] p-4">Sin planes registrados</p>;
                  return (
                    <div className="divide-y divide-[#F5F5F5]">
                      <div className="grid grid-cols-3 px-4 py-2 bg-[#F5F5F5]">
                        <p className="text-[10px] font-bold text-[#666] uppercase">Plan</p>
                        <p className="text-[10px] font-bold text-[#666] uppercase text-center truncate">{gymA.name}</p>
                        <p className="text-[10px] font-bold text-[#666] uppercase text-center truncate">{gymB.name}</p>
                      </div>
                      {allPlanNames.map(name => {
                        const pa = plansA.find(p => p.name === name);
                        const pb = plansB.find(p => p.name === name);
                        return (
                          <div key={name} className="grid grid-cols-3 px-4 py-3 items-center">
                            <p className="text-xs text-[#111] font-bold">{name}</p>
                            <p className="text-xs text-center text-[#111]">{pa ? formatCLP(pa.regular_price) : '—'}</p>
                            <p className="text-xs text-center text-[#111]">{pb ? formatCLP(pb.regular_price) : '—'}</p>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {(!gymA || !gymB) && (
              <p className="text-center text-xs text-[#999] py-8">Selecciona dos gyms para comparar</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
