import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, MapPin, Phone, Globe, Share2, Download, QrCode } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { OccupancyGauge } from '../components/OccupancyGauge';
import { OccupancyHeatmap } from '../components/OccupancyHeatmap';
import { BottomSheet } from '../components/BottomSheet';
import { Toast } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { formatCLP, getServiceCategoryLabel } from '../lib/utils';
import type { Gym, GymPlan, GymService, GymDiscount, GymRecommendedHour, WeeklyOccupancySummary, OccupancyLog, GymBranch } from '../lib/types';

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
  const [branches, setBranches] = useState<GymBranch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<GymBranch | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<GymPlan | null>(null);
  const [selectedService, setSelectedService] = useState<GymService | null>(null);
  const [selectedDiscount, setSelectedDiscount] = useState<GymDiscount | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [todayLogs, setTodayLogs] = useState<OccupancyLog[]>([]);
  const { toast, showToast } = useToast();

  const fetchAll = useCallback(async () => {
    if (!id) return;
    const [gymRes, plansRes, servicesRes, discountsRes, hoursRes, heatmapRes, logsRes, branchesRes] = await Promise.all([
      supabase.from('gyms').select('*').eq('id', id).maybeSingle(),
      supabase.from('gym_plans').select('*').eq('gym_id', id).eq('is_active', true),
      supabase.from('gym_services').select('*').eq('gym_id', id).eq('is_active', true),
      supabase.from('gym_discounts').select('*').eq('gym_id', id).eq('is_active', true),
      supabase.from('gym_recommended_hours').select('*').eq('gym_id', id).eq('is_active', true),
      supabase.from('weekly_occupancy_summary').select('*').eq('gym_id', id),
      supabase.from('occupancy_logs')
        .select('people_count, occupancy_percentage, occupancy_status, recorded_at')
        .eq('gym_id', id)
        .gte('recorded_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
        .order('recorded_at', { ascending: true }),
      supabase.from('gym_branches').select('*').eq('gym_id', id).eq('is_active', true).order('created_at'),
    ]);
    if (gymRes.error || !gymRes.data) { setFetchError('No se pudo cargar la información de este gym.'); return; }
    if (gymRes.data) setGym(gymRes.data);
    if (plansRes.data) setPlans(plansRes.data);
    if (servicesRes.data) setServices(servicesRes.data);
    if (discountsRes.data) setDiscounts(discountsRes.data);
    if (hoursRes.data) setRecommendedHours(hoursRes.data);
    if (heatmapRes.data) setHeatmapData(heatmapRes.data);
    if (logsRes.data) setTodayLogs(logsRes.data as OccupancyLog[]);
    if (branchesRes.data) setBranches(branchesRes.data);
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

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: gym?.name ?? '', text: `Mira este gym en GoFitNow: ${gym?.name ?? ''}`, url });
    } else {
      await navigator.clipboard.writeText(url);
      showToast('Link copiado al portapapeles', 'info');
    }
  };

  const handleDownloadCoupon = async (discount: GymDiscount) => {
    const code = discount.coupon_code || `GF-${discount.id.slice(0, 8).toUpperCase()}`;
    const couponText = `Fluxfit Cupón\nGym: ${gym?.name}\nDescuento: ${discount.title || discount.description}\nCódigo: ${code}`;
    await navigator.clipboard.writeText(couponText);
    showToast('Cupón copiado. Puedes pegarlo y guardarlo.', 'success');
  };

  const handleShowQr = async (discount: GymDiscount) => {
    if (!user?.id || !gym?.id) {
      showToast('Debes iniciar sesión para generar QR.', 'error');
      return;
    }
    const code = discount.coupon_code || `GF-${Date.now().toString(36).toUpperCase()}`;
    const qr = discount.qr_payload || `qr://${gym.id}/${code}/${user.id}`;
    setCouponCode(qr);
    setSelectedDiscount(discount);
  };

  const handleRegisterUsage = async () => {
    if (!selectedDiscount || !gym?.id || !user?.id) return;
    const amount = Number(selectedDiscount.discount_value ?? selectedDiscount.discount_percentage ?? 0);
    await supabase.from('coupon_usage').insert({
      gym_id: gym.id,
      branch_id: selectedBranch?.id ?? null,
      discount_id: selectedDiscount.id,
      user_id: user.id,
      type: selectedDiscount.type || 'plan_gym',
      amount,
    } as any);
    showToast('Cupón listo para usar en sucursal', 'success');
  };

  if (fetchError) return (
    <div className="min-h-screen flex items-center justify-center text-[#CC0000] px-8 text-center text-sm">{fetchError}</div>
  );
  if (!gym) return (
    <div className="min-h-screen flex items-center justify-center text-[#666]">Cargando...</div>
  );

  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-24">
      <Toast {...toast} />
      <div className="relative h-48 bg-gradient-to-br from-[#CC0000] to-[#111111]">
        <button onClick={() => navigate(-1)} className="absolute top-4 left-4 w-10 h-10 flex items-center justify-center bg-black/30 rounded-full"><ArrowLeft size={20} className="text-white" /></button>
        <div className="absolute top-4 right-4 flex gap-2">
          <button onClick={handleShare} className="w-10 h-10 flex items-center justify-center bg-black/30 rounded-full"><Share2 size={20} className="text-white" /></button>
          <button onClick={toggleFavorite} className="w-10 h-10 flex items-center justify-center bg-black/30 rounded-full"><Heart size={20} className={isFavorite ? 'text-[#CC0000] fill-[#CC0000]' : 'text-white'} /></button>
        </div>
        <h1 className="absolute bottom-4 left-4 text-white font-bold text-xl drop-shadow-lg">{gym.name}</h1>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {(() => {
          const displayData = selectedBranch ? {
            percentage: selectedBranch.occupancy_percentage,
            status: selectedBranch.occupancy_status,
            peopleCount: selectedBranch.current_count,
            sensorOnline: selectedBranch.sensor_online,
            lastSensorPing: selectedBranch.last_sensor_ping,
          } : {
            percentage: gym.occupancy_percentage,
            status: gym.occupancy_status,
            peopleCount: gym.current_count,
            sensorOnline: gym.sensor_online,
            lastSensorPing: gym.last_sensor_ping,
          };
          return (
            <div className="md:grid md:grid-cols-2 md:gap-4 space-y-4 md:space-y-0">
              <div className="space-y-3">
                <OccupancyGauge percentage={displayData.percentage} status={displayData.status} peopleCount={displayData.peopleCount} sensorOnline={displayData.sensorOnline} lastSensorPing={displayData.lastSensorPing} />
                {selectedBranch && (
                  <p className="text-sm text-[#666] flex items-center gap-2">
                    <MapPin size={14} /> {selectedBranch.address}
                  </p>
                )}
              </div>
              <OccupancyHeatmap data={heatmapData} />
            </div>
          );
        })()}

        {branches.length > 0 && (
          <div className="bg-white rounded-xl border border-[#E5E5E5] p-4">
            <p className="text-xs font-bold text-[#666] uppercase tracking-wider mb-3">Sucursales</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedBranch(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${!selectedBranch ? 'bg-[#CC0000] text-white' : 'bg-[#F5F5F5] text-[#666]'}`}
              >
                Principal
              </button>
              {branches.map(b => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBranch(b)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${selectedBranch?.id === b.id ? 'bg-[#CC0000] text-white' : 'bg-[#F5F5F5] text-[#666]'}`}
                >
                  {b.comuna || b.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {recommendedHours.length > 0 && (
          <div className="flex flex-wrap gap-2">{recommendedHours.map(h => <span key={h.id} className="bg-[#16A34A]/10 text-[#16A34A] text-xs font-medium px-2.5 py-1 rounded-full">{h.label}</span>)}</div>
        )}

        {(() => {
          const today = new Date().getDay();
          const todayData = heatmapData.filter(h => h.day_of_week === today);
          if (todayData.length === 0) return null;
          const best = todayData.reduce((a, b) => a.avg_percentage < b.avg_percentage ? a : b);
          const h = best.hour_of_day;
          const fmt = (n: number) => String(n).padStart(2, '0') + ':00';
          return (
            <div className="bg-[#16A34A]/10 border border-[#16A34A]/30 rounded-xl p-4">
              <p className="text-[#16A34A] font-bold text-sm">Mejor momento para venir hoy</p>
              <p className="text-[#16A34A] text-2xl font-bold mt-1">{fmt(h)} – {fmt(h + 1)}</p>
              <p className="text-[#16A34A]/70 text-xs mt-1">Históricamente el horario menos concurrido</p>
            </div>
          );
        })()}

        {todayLogs.length > 1 && (
          <div className="bg-white rounded-xl border border-[#E5E5E5] p-4">
            <h3 className="font-bold text-[#111111] text-sm mb-3">Cómo estuvo hoy</h3>
            <div className="flex items-end gap-1 h-16">
              {(() => {
                const logs = todayLogs.length > 12
                  ? todayLogs.filter((_, i) => i % Math.ceil(todayLogs.length / 12) === 0).slice(0, 12)
                  : todayLogs;
                return logs.map((log, i) => {
                  const color = log.occupancy_status === 'tranquilo' ? '#16A34A'
                    : log.occupancy_status === 'moderado' ? '#EAB308' : '#CC0000';
                  const pct = Math.max(log.occupancy_percentage, 5);
                  const time = new Date(log.recorded_at).toLocaleTimeString('es-CL',
                    { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full rounded-t-sm transition-all duration-300"
                        style={{ height: `${pct}%`, backgroundColor: color, minHeight: 4 }} />
                      <span className="text-[8px] text-[#999] rotate-45 origin-left">{time}</span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 space-y-3">
          <h3 className="font-bold text-[#111111]">Información</h3>
          {gym.address && <p className="text-sm text-[#666666] flex items-center gap-2"><MapPin size={14} /> {gym.address}</p>}
          {gym.address && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(gym.address + ', ' + gym.comuna + ', Chile')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2 border border-[#CC0000]/30 text-[#CC0000] rounded-xl text-sm font-bold active:scale-[0.98] transition-transform"
            >
              <MapPin size={14} />
              Cómo llegar
            </a>
          )}
          {gym.phone && <a href={`tel:${gym.phone}`} className="text-sm text-[#666666] flex items-center gap-2"><Phone size={14} /> {gym.phone}</a>}
          {gym.website && <a href={gym.website} target="_blank" rel="noopener noreferrer" className="text-sm text-[#CC0000] flex items-center gap-2"><Globe size={14} /> {gym.website}</a>}
          {gym.description && <p className="text-sm text-[#666666] mt-2">{gym.description}</p>}
        </div>

        {plans.length > 0 && (
          <div>
            <h3 className="font-bold text-[#111111] mb-3">Planes disponibles</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {plans.map(plan => (
                <div key={plan.id} className="bg-white rounded-xl border border-[#E5E5E5] p-4">
                  <h4 className="font-bold text-[#111111]">{plan.name}</h4>
                  <div className="mt-2 space-y-1">
                    {!isPremium ? (
                      <><p className="text-sm text-[#111111]">Regular: {formatCLP(plan.regular_price)}/mes</p><p className="text-sm text-[#999]">✦ Premium: {formatCLP(plan.premium_price)}/mes 🔒</p><p className="text-xs text-[#999]">Con membresía GoFitNow</p></>
                    ) : (
                      <><p className="text-sm text-[#999] line-through">Regular: {formatCLP(plan.regular_price)}/mes</p><p className="text-sm text-[#16A34A] font-bold">Tu precio: {formatCLP(plan.premium_price)}/mes</p><span className="inline-block bg-[#CC0000] text-white text-xs font-bold px-2 py-0.5 rounded-full mt-1">✦ Precio GoFitNow</span></>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                <div key={d.id} className="p-4 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm text-[#111111]">{d.title || d.description}</p>
                    <p className="text-xs text-[#999] mt-0.5">{d.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleDownloadCoupon(d)} className="px-2 py-1 rounded-lg border border-[#E5E5E5] text-xs text-[#666] flex items-center gap-1">
                      <Download size={12} /> Cupón
                    </button>
                    <button onClick={() => handleShowQr(d)} className="px-2 py-1 rounded-lg bg-[#CC0000] text-white text-xs flex items-center gap-1">
                      <QrCode size={12} /> QR
                    </button>
                  </div>
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
        {selectedPlan && <div className="space-y-3"><p className="text-sm text-[#666666]">{selectedPlan.description}</p><p className="text-sm text-[#666666]">Para contratar este plan preséntate en recepción o visita <a href={gym.website} target="_blank" rel="noopener noreferrer" className="text-[#CC0000] underline">{gym.website || 'el sitio web del gym'}</a> mostrando tu membresía GoFitNow activa.</p></div>}
      </BottomSheet>

      <BottomSheet open={!!selectedService} onClose={() => setSelectedService(null)} title={selectedService?.name}>
        {selectedService && <div className="space-y-3"><p className="text-sm text-[#666666]">{selectedService.description}</p><p className="text-sm text-[#666666]">Para reservar, contacta al gym: <a href={`tel:${gym.phone}`} className="text-[#CC0000] underline">{gym.phone}</a>{gym.website && <> o visita <a href={gym.website} target="_blank" rel="noopener noreferrer" className="text-[#CC0000] underline">el sitio web</a></>}</p></div>}
      </BottomSheet>

      <BottomSheet open={!!selectedDiscount} onClose={() => setSelectedDiscount(null)} title={selectedDiscount?.title || 'Cupón QR'}>
        {selectedDiscount && (
          <div className="space-y-3">
            <p className="text-sm text-[#666]">Presenta este código QR en sucursal para canjear tu descuento.</p>
            <div className="bg-[#F5F5F5] rounded-xl p-3 font-mono text-xs break-all">{couponCode}</div>
            <button onClick={handleRegisterUsage} className="w-full py-2.5 bg-[#CC0000] text-white font-bold rounded-xl text-sm">
              Usar en sucursal
            </button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
