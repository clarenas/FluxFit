import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Lock, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useGyms } from '../hooks/useGyms';
import { GymCard } from '../components/GymCard';
import { BottomSheet } from '../components/BottomSheet';
import { GoFitNowLogo } from '../components/GoFitNowLogo';
import { Toast } from '../components/Toast';
import { SkeletonList } from '../components/SkeletonList';
import { useToast } from '../hooks/useToast';
import { formatCLP, getCommerceCategoryEmoji, getCommerceCategoryLabel } from '../lib/utils';
import type { Commerce } from '../lib/types';

type FilterType = 'all' | 'tranquilo' | 'moderado' | 'lleno';

const COMUNAS = ['Todas', 'Ñuñoa', 'Las Condes', 'Vitacura', 'Providencia', 'La Reina', 'Peñalolén'];

export function HomePage() {
  const navigate = useNavigate();
  const { user, isGuest } = useAuth();
  const { gyms, loading: loadingGyms, error: gymsError } = useGyms();
  const [commerces, setCommerces] = useState<Commerce[]>([]);
  const [commercesError, setCommercesError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [selectedCommerce, setSelectedCommerce] = useState<Commerce | null>(null);
  const [selectedComuna, setSelectedComuna] = useState('Todas');
  const { toast, showToast } = useToast();
  const isPremium = user?.is_premium ?? false;

  const fetchCommerces = useCallback(async () => {
    const { data, error } = await supabase.from('commerces').select('*').eq('is_active', true);
    if (error) { setCommercesError('No se pudieron cargar los descuentos.'); return; }
    setCommerces(data ?? []);
  }, []);

  const fetchFavorites = useCallback(async () => {
    if (!user || isGuest) return;
    const { data } = await supabase.from('user_favorite_gyms').select('gym_id').eq('user_id', user.id);
    if (data) setFavorites(data.map(f => f.gym_id));
  }, [user, isGuest]);

  useEffect(() => { fetchCommerces(); fetchFavorites(); }, [fetchCommerces, fetchFavorites]);

  const toggleFavorite = async (gymId: string) => {
    if (!user || isGuest) return;
    if (favorites.includes(gymId)) {
      await supabase.from('user_favorite_gyms').delete().eq('user_id', user.id).eq('gym_id', gymId);
      setFavorites(prev => prev.filter(id => id !== gymId));
      showToast('Gym eliminado de favoritos', 'info');
    } else {
      await supabase.from('user_favorite_gyms').insert({ user_id: user.id, gym_id: gymId });
      setFavorites(prev => [...prev, gymId]);
      showToast('Gym guardado en favoritos', 'success');
    }
  };

  const filteredGyms = gyms.filter(g => {
    if (filter !== 'all' && g.occupancy_status !== filter) return false;
    if (selectedComuna !== 'Todas' && g.comuna !== selectedComuna) return false;
    if (search && !g.name.toLowerCase().includes(search.toLowerCase()) && !g.comuna.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'Todos' }, { key: 'tranquilo', label: '🟢 Tranquilo' },
    { key: 'moderado', label: '🟡 Moderado' }, { key: 'lleno', label: '🔴 Lleno' },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-20 md:max-w-[900px] md:mx-auto">
      <Toast {...toast} />
      <div className="bg-white border-b border-[#E5E5E5] px-4 py-3 flex items-center gap-3 sticky top-0 z-40">
        <GoFitNowLogo size="sm" />
        <span className="text-[#111111] font-semibold flex-1">Hola, {isGuest ? 'invitado' : (user?.full_name?.split(' ')[0] || 'usuario')}</span>
        {isPremium && <span className="bg-[#CC0000] text-white text-xs font-bold px-2 py-1 rounded-full">✦ Premium</span>}
      </div>

      <div className="px-4 pt-4 space-y-6">
        {!isPremium && (
          <div className="bg-[#CC0000] rounded-xl p-5 text-white relative overflow-hidden">
            <span className="absolute top-3 right-4 text-3xl opacity-30">✦</span>
            <h2 className="font-bold text-lg">Hazte miembro GoFitNow</h2>
            <p className="text-white/80 text-sm mt-1">Precios especiales en todos los gyms y descuentos exclusivos</p>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li className="flex items-center gap-2"><Check size={14} /> Precios rebajados en planes de gym</li>
              <li className="flex items-center gap-2"><Check size={14} /> Descuentos en nutrición y suplementos</li>
              <li className="flex items-center gap-2"><Check size={14} /> Acceso a toda la red GoFitNow</li>
            </ul>
            <p className="text-2xl font-bold mt-3">{formatCLP(2990)} <span className="text-sm font-normal">/ mes</span></p>
            <button onClick={() => navigate('/premium')} className="mt-3 w-full py-3 bg-white text-[#CC0000] font-bold rounded-xl active:scale-[0.98] transition-transform">Quiero ser Premium</button>
          </div>
        )}

        <div>
          <h2 className="text-[#111111] font-bold text-base mb-3">Descuentos GoFitNow</h2>
          {commercesError && <p className="text-[#CC0000] text-sm py-2">{commercesError}</p>}
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide md:grid md:grid-cols-4 md:overflow-x-visible md:mx-0 md:px-0">
            {commerces.map(c => (
              <button key={c.id} onClick={() => setSelectedCommerce(c)} className="flex-shrink-0 md:flex-shrink w-36 md:w-full bg-white rounded-xl shadow-sm border border-[#E5E5E5] p-3 text-left active:scale-[0.97] transition-transform">
                <div className="text-2xl mb-1">{getCommerceCategoryEmoji(c.category)}</div>
                <h3 className="font-bold text-[#111111] text-sm leading-tight truncate">{c.name}</h3>
                <div className="mt-2 relative inline-block">
                  <span className="bg-[#CC0000] text-white text-xs font-bold px-2 py-0.5 rounded-full">−{c.discount_percentage}%</span>
                  {!isPremium && <Lock size={12} className="absolute -top-1 -right-1 text-[#999] bg-white rounded-full" />}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-[#111111] font-bold text-base mb-3">Selecciona tu gym</h2>
          <div className="relative mb-3">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999]" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o comuna..." className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#E5E5E5] text-[#111111] text-sm focus:outline-none focus:ring-2 focus:ring-[#CC0000]/30" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {COMUNAS.map(c => (
              <button key={c} onClick={() => setSelectedComuna(c)} className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${selectedComuna === c ? 'bg-[#111111] text-white' : 'bg-white text-[#666666] border border-[#E5E5E5]'}`}>{c}</button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {filters.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)} className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${filter === f.key ? 'bg-[#CC0000] text-white' : 'bg-white text-[#666666] border border-[#E5E5E5]'}`}>{f.label}</button>
            ))}
          </div>
          {gymsError && <p className="text-[#CC0000] text-sm text-center py-4">{gymsError}</p>}
          {loadingGyms ? <SkeletonList /> : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
              {filteredGyms.map(gym => (
                <GymCard key={gym.id} gym={gym} isFavorite={favorites.includes(gym.id)} onToggleFavorite={toggleFavorite} onClick={id => navigate(`/gym/${id}`)} />
              ))}
            </div>
          )}
          {!loadingGyms && filteredGyms.length === 0 && (
            <div className="text-center py-12">
              <p className="text-[#666666] text-sm">No se encontraron gyms con este filtro</p>
              <button
                onClick={() => { setFilter('all'); setSelectedComuna('Todas'); setSearch(''); }}
                className="mt-3 text-[#CC0000] font-bold text-sm"
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      </div>

      <BottomSheet open={!!selectedCommerce} onClose={() => setSelectedCommerce(null)} title={selectedCommerce?.name}>
        {selectedCommerce && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{getCommerceCategoryEmoji(selectedCommerce.category)}</span>
              <span className="text-sm text-[#666666]">{getCommerceCategoryLabel(selectedCommerce.category)}</span>
            </div>
            <p className="text-[#666666] text-sm">{selectedCommerce.description}</p>
            {isPremium ? (
              <div className="bg-[#16A34A]/10 border border-[#16A34A]/30 rounded-xl p-4">
                <p className="text-[#16A34A] font-bold text-lg">Tu descuento: {selectedCommerce.discount_percentage}%</p>
                <p className="text-[#16A34A] text-sm mt-1">{selectedCommerce.discount_description}</p>
              </div>
            ) : (
              <div className="bg-[#CC0000]/10 border border-[#CC0000]/30 rounded-xl p-4 flex items-center gap-3">
                <Lock size={20} className="text-[#CC0000]" />
                <p className="text-[#CC0000] text-sm font-medium">Activa tu membresía GoFitNow para acceder</p>
              </div>
            )}
            {selectedCommerce.address && <p className="text-sm text-[#666666]">📍 {selectedCommerce.address}</p>}
            {selectedCommerce.website && <a href={selectedCommerce.website} target="_blank" rel="noopener noreferrer" className="text-sm text-[#CC0000] underline block">🔗 {selectedCommerce.website}</a>}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
