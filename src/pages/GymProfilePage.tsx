import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, MapPin, Phone, Globe } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { OccupancyGauge } from '../components/OccupancyGauge';
import { OccupancyHeatmap } from '../components/OccupancyHeatmap';
import { BottomSheet } from '../components/BottomSheet';
import { formatCLP, getServiceCategoryLabel } from '../lib/utils';
import type { Gym, GymPlan, GymService, GymDiscount, GymRecommendedHour, WeeklyOccupancySummary } from '../lib/types';

export function GymProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isGuest } = useAuth();
  const isPremium = user?.is_premium ?? false;
  const [gym, setGym] = useState<Gym | null>(null);
  const [plans, setPlans] = useState<GymPlan[]>([]);
  const [services, setServices] = useState<GymService[]>([]);
  const [discounts, setDiscounts] = useState<GymDiscount[]>([]);
  const [recommendedHours, setRecommendedHours] = useState<GymRecommendedHour[]>([]);
  const [heatmapData, setHeatmapData] = useState<WeeklyOccupancySummary[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<GymPlan | null>(null);
  const [selectedService, setSelectedService] = useState<GymService | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!id) return;
    const [gymRes, plansRes, servicesRes, discountsRes, hoursRes, heatmapRes] = await Promise.all([
      supabase.from('gyms').select('*').eq('id', id).maybeSingle(),
      supabase.from('gym_plans').select('*').eq('gym_id', id).eq('is_active', true),
      supabase.from('gym_services').select('*').eq('gym_id', id).eq('is_active', true),
      supabase.from('gym_discounts').select('*').eq('gym_id', id).eq('is_active', true),
      supabase.from('gym_recommended_hours').select('*').eq('gym_id', id).eq('is_active', true),
      supabase.from('weekly_occupancy_summary').select('*').eq('gym_id', id),
    ]);
    if (gymRes.error || !gymRes.data) { setFetchError('No se pudo cargar la información de este gym.'); return; }
    if (gymRes.data) setGym(gymRes.data);
    if (plansRes.data) setPlans(plansRes.data);
    if (servicesRes.data) setServices(servicesRes.data);
    if (discountsRes.data) setDiscounts(discountsRes.data);
    if (hoursRes.data) setRecommendedHours(hoursRes.data);
    if (heatmapRes.data) setHeatmapData(heatmapRes.data);
    if (user && !isGuest) {
      const { data: fav } = await supabase.from('user_favorite_gyms').select('id').eq('user_id', user.id).eq('gym_id', id).maybeSingle();
      setIsFavorite(!!fav);
    }
  }, [id, user, isGuest]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase.channel(`gym-${id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'gyms', filter: `id=eq.${id}` }, payload => {
      if (payload.new) setGym(prev => prev ? { ...prev, ...payload.new } as Gym : prev);
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const toggleFavorite = async () => {
    if (!user || isGuest || !id) return;
    if (isFavorite) { await supabase.from('user_favorite_gyms').delete().eq('user_id', user.id).eq('gym_id', id); }
    else { await supabase.from('user_favorite_gyms').insert({ user_id: user.id, gym_id: id }); }
    setIsFavorite(!isFavorite);
  };

  if (fetchError) return (
    <div className="min-h-screen flex items-center justify-center text-[#CC0000] px-8 text-center text-sm">{fetchError}</div>
  );
  if (!gym) return (
    <div className="min-h-screen flex items-center justify-center text-[#666]">Cargando...</div>
  );

  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-24">
      <div className="relative h-48 bg-gradient-to-br from-[#CC0000] to-[#111111]">
        <button onClick={() => navigate(-1)} className="absolute top-4 left-4 w-10 h-10 flex items-center justify-center bg-black/30 rounded-full"><ArrowLeft size={20} className="text-white" /></button>
        <button onClick={toggleFavorite} className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center"><Heart size={24} className={isFavorite ? 'text-[#CC0000] fill-[#CC0000]' : 'text-white'} /></button>
        <h1 className="absolute bottom-4 left-4 text-white font-bold text-xl drop-shadow-lg">{gym.name}</h1>
      </div>

      <div className="px-4 pt-4 space-y-4">
        <OccupancyGauge percentage={gym.occupancy_percentage} status={gym.occupancy_status} peopleCount={gym.current_count} sensorOnline={gym.sensor_online} lastSensorPing={gym.last_sensor_ping} />
        <OccupancyHeatmap data={heatmapData} />

        {recommendedHours.length > 0 && (
          <div className="flex flex-wrap gap-2">{recommendedHours.map(h => <span key={h.id} className="bg-[#16A34A]/10 text-[#16A34A] text-xs font-medium px-2.5 py-1 rounded-full">{h.label}</span>)}</div>
        )}

        <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 space-y-3">
          <h3 className="font-bold text-[#111111]">Información</h3>
          {gym.address && <p className="text-sm text-[#666666] flex items-center gap-2"><MapPin size={14} /> {gym.address}</p>}
          {gym.phone && <a href={`tel:${gym.phone}`} className="text-sm text-[#666666] flex items-center gap-2"><Phone size={14} /> {gym.phone}</a>}
          {gym.website && <a href={gym.website} target="_blank" rel="noopener noreferrer" className="text-sm text-[#CC0000] flex items-center gap-2"><Globe size={14} /> {gym.website}</a>}
          {gym.description && <p className="text-sm text-[#666666] mt-2">{gym.description}</p>}
        </div>

        {plans.length > 0 && (
          <div>
            <h3 className="font-bold text-[#111111] mb-3">Planes disponibles</h3>
            <div className="space-y-3">
              {plans.map(plan => (
                <div key={plan.id} className="bg-white rounded-xl border border-[#E5E5E5] p-4">
                  <h4 className="font-bold text-[#111111]">{plan.name}</h4>
                  <div className="mt-2 space-y-1">
                    {!isPremium ? (
                      <><p className="text-sm text-[#111111]">Regular: {formatCLP(plan.regular_price)}/mes</p><p className="text-sm text-[#999]">✦ Premium: {formatCLP(plan.premium_price)}/mes 🔒</p><p className="text-xs text-[#999]">Con membresía FluxFit</p></>
                    ) : (
                      <><p className="text-sm text-[#999] line-through">Regular: {formatCLP(plan.regular_price)}/mes</p><p className="text-sm text-[#16A34A] font-bold">Tu precio: {formatCLP(plan.premium_price)}/mes</p><span className="inline-block bg-[#CC0000] text-white text-xs font-bold px-2 py-0.5 rounded-full mt-1">✦ Precio FluxFit</span></>
                    )}
                  </div>
                  {plan.features.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{plan.features.map((f, i) => <span key={i} className="text-xs bg-[#F5F5F5] text-[#666666] px-2 py-0.5 rounded-full">{f}</span>)}</div>}
                  <button onClick={() => setSelectedPlan(plan)} className="mt-3 w-full py-2.5 border-2 border-[#111111] text-[#111111] font-bold rounded-xl text-sm active:scale-[0.98] transition-transform">Ver plan</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {services.length > 0 && (
          <div>
            <h3 className="font-bold text-[#111111] mb-3">Servicios</h3>
            <div className="space-y-3">
              {services.map(svc => (
                <div key={svc.id} className="bg-white rounded-xl border border-[#E5E5E5] p-4">
                  <div className="flex items-center justify-between"><h4 className="font-bold text-[#111111]">{svc.name}</h4><span className="text-xs bg-[#F5F5F5] text-[#666666] px-2 py-0.5 rounded-full">{getServiceCategoryLabel(svc.category)}</span></div>
                  <p className="text-sm text-[#666666] mt-1">{svc.description}</p>
                  <div className="mt-2">{!isPremium ? <p className="text-sm text-[#111111]">{formatCLP(svc.regular_price)} <span className="text-[#999]">✦ {formatCLP(svc.premium_price)} 🔒</span></p> : <p className="text-sm text-[#16A34A] font-bold">Tu precio: {formatCLP(svc.premium_price)}</p>}</div>
                  <button onClick={() => setSelectedService(svc)} className="mt-2 w-full py-2 border-2 border-[#111111] text-[#111111] font-bold rounded-xl text-sm active:scale-[0.98] transition-transform">Cómo reservar</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {discounts.length > 0 && (
          <div>
            <h3 className="font-bold text-[#111111] mb-3">Descuentos en este gym</h3>
            <div className="bg-white rounded-xl border border-[#E5E5E5] divide-y divide-[#E5E5E5]">
              {discounts.map(d => (
                <div key={d.id} className="p-4 flex items-center justify-between">
                  <div><p className="text-sm text-[#111111]">{d.description}</p><p className="text-xs text-[#999] mt-0.5">Regular: {d.regular_value}</p></div>
                  {!isPremium ? <span className="text-sm text-[#999]">✦ {d.premium_value} 🔒</span> : <span className="text-sm text-[#16A34A] font-bold">✦ {d.premium_value}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={toggleFavorite} className="w-full py-3.5 bg-white border-2 border-[#E5E5E5] rounded-xl font-bold text-[#111111] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
          <Heart size={18} className={isFavorite ? 'text-[#CC0000] fill-[#CC0000]' : ''} />{isFavorite ? 'Guardado' : 'Guardar gym'}
        </button>
      </div>

      <BottomSheet open={!!selectedPlan} onClose={() => setSelectedPlan(null)} title={selectedPlan?.name}>
        {selectedPlan && <div className="space-y-3"><p className="text-sm text-[#666666]">{selectedPlan.description}</p><p className="text-sm text-[#666666]">Para contratar este plan preséntate en recepción o visita <a href={gym.website} target="_blank" rel="noopener noreferrer" className="text-[#CC0000] underline">{gym.website || 'el sitio web del gym'}</a> mostrando tu membresía FluxFit activa.</p></div>}
      </BottomSheet>

      <BottomSheet open={!!selectedService} onClose={() => setSelectedService(null)} title={selectedService?.name}>
        {selectedService && <div className="space-y-3"><p className="text-sm text-[#666666]">{selectedService.description}</p><p className="text-sm text-[#666666]">Para reservar, contacta al gym: <a href={`tel:${gym.phone}`} className="text-[#CC0000] underline">{gym.phone}</a>{gym.website && <> o visita <a href={gym.website} target="_blank" rel="noopener noreferrer" className="text-[#CC0000] underline">el sitio web</a></>}</p></div>}
      </BottomSheet>
    </div>
  );
}
