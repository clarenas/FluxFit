import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { OccupancyGauge } from '../components/OccupancyGauge';
import { OccupancyHeatmap } from '../components/OccupancyHeatmap';
import { GymBranchesTab } from '../components/admin/GymBranchesTab';
import { GymPromotionsTab } from '../components/admin/GymPromotionsTab';
import AdminSidebar from '../components/AdminSidebar';
import { formatCLP, getServiceCategoryLabel, getFullDayLabel, timeAgo } from '../lib/utils';
import type { Gym, GymPlan, GymService, GymDiscount, GymRecommendedHour, WeeklyOccupancySummary, OccupancyLog, GymBranch, GymPromotion, CouponRedemption } from '../lib/types';
import { Plus, Trash2, Copy, RefreshCw, AlertTriangle, QrCode, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { Toast } from '../components/Toast';

type AdminTab = 'sucursales' | 'planes' | 'servicios' | 'promociones' | 'descuentos' | 'horarios' | 'sensor' | 'mi_plan' | 'validar_qr';

interface Props { initialTab?: AdminTab; }

const COMUNAS = ['Ñuñoa', 'Las Condes', 'Vitacura', 'Providencia', 'La Reina', 'Peñalolén'];
const inp = 'w-full px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm focus:outline-none focus:border-[#CC0000]';

export function GymAdminPage({ initialTab }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast, showToast } = useToast();
  const [gym, setGym] = useState<Gym | null>(null);
  const [plans, setPlans] = useState<GymPlan[]>([]);
  const [services, setServices] = useState<GymService[]>([]);
  const [discounts, setDiscounts] = useState<GymDiscount[]>([]);
  const [recommendedHours, setRecommendedHours] = useState<GymRecommendedHour[]>([]);
  const [branches, setBranches] = useState<GymBranch[]>([]);
  const [promotions, setPromotions] = useState<GymPromotion[]>([]);
  const [heatmapData, setHeatmapData] = useState<WeeklyOccupancySummary[]>([]);
  const [todayLogs, setTodayLogs] = useState<OccupancyLog[]>([]);
  const [sensorLogs, setSensorLogs] = useState<OccupancyLog[]>([]);
  const [redemptions, setRedemptions] = useState<CouponRedemption[]>([]);
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab ?? 'sensor');
  const [subscription, setSubscription] = useState<{ plan: string } | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [maxCapacityEdit, setMaxCapacityEdit] = useState('');
  const [editingMaxCapacity, setEditingMaxCapacity] = useState(false);

  const [planForm, setPlanForm] = useState({ name: '', description: '', regular_price: '', premium_price: '', features: '' });
  const [serviceForm, setServiceForm] = useState({ name: '', description: '', regular_price: '', premium_price: '', category: 'entrenamiento' as string });
  const [discountForm, setDiscountForm] = useState({ description: '', regular_value: '', premium_value: '', discount_percentage: '' });
  const [hourForm, setHourForm] = useState({ day_of_week: '1', hour_start: '06:00', hour_end: '08:00', label: '' });
  const [editingInfo, setEditingInfo] = useState(false);
  const [infoForm, setInfoForm] = useState({ name: '', address: '', comuna: '', phone: '', website: '', description: '' });

  // QR validation state
  const [qrInput, setQrInput] = useState('');
  const [qrResult, setQrResult] = useState<{ ok: boolean; message: string; userEmail?: string } | null>(null);
  const [validatingQr, setValidatingQr] = useState(false);

  // Pending profile state
  const [isPending, setIsPending] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    const { data: adminData } = await supabase.from('gym_admins').select('gym_id').eq('user_id', user.id).maybeSingle();
    if (!adminData) return;
    const gymId = adminData.gym_id;
    const { data: subData } = await supabase.from('gym_subscriptions').select('plan').eq('gym_id', gymId).maybeSingle();
    setSubscription(subData);
    setLoadingPlan(false);
    const [gymRes, plansRes, servicesRes, discountsRes, hoursRes, heatmapRes, logsRes, branchesRes, promoRes, redemptionsRes] = await Promise.all([
      supabase.from('gyms').select('*').eq('id', gymId).maybeSingle(),
      supabase.from('gym_plans').select('*').eq('gym_id', gymId),
      supabase.from('gym_services').select('*').eq('gym_id', gymId),
      supabase.from('gym_discounts').select('*').eq('gym_id', gymId),
      supabase.from('gym_recommended_hours').select('*').eq('gym_id', gymId),
      supabase.from('weekly_occupancy_summary').select('*').eq('gym_id', gymId),
      supabase.from('occupancy_logs').select('*').eq('gym_id', gymId).gte('recorded_at', new Date(new Date().setHours(0,0,0,0)).toISOString()).order('recorded_at', { ascending: true }),
      supabase.from('gym_branches').select('*').eq('gym_id', gymId).order('created_at'),
      supabase.from('gym_promotions').select('*').eq('gym_id', gymId).order('created_at'),
      supabase.from('coupon_redemptions').select('*').eq('gym_id', gymId).order('redeemed_at', { ascending: false }).limit(20),
    ]);
    if (gymRes.data) {
      setGym(gymRes.data);
      setMaxCapacityEdit(String(gymRes.data.max_capacity));
      setInfoForm({ name: gymRes.data.name, address: gymRes.data.address ?? '', comuna: gymRes.data.comuna ?? '', phone: gymRes.data.phone ?? '', website: gymRes.data.website ?? '', description: gymRes.data.description ?? '' });
      setIsPending(gymRes.data.approval_status === 'pending');
    }
    if (plansRes.data) setPlans(plansRes.data);
    if (servicesRes.data) setServices(servicesRes.data);
    if (discountsRes.data) setDiscounts(discountsRes.data);
    if (hoursRes.data) setRecommendedHours(hoursRes.data);
    if (heatmapRes.data) setHeatmapData(heatmapRes.data);
    if (logsRes.data) setTodayLogs(logsRes.data);
    if (branchesRes.data) setBranches(branchesRes.data);
    if (promoRes.data) setPromotions(promoRes.data);
    if (redemptionsRes.data) setRedemptions(redemptionsRes.data as CouponRedemption[]);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!gym) return;
    const channel = supabase.channel(`admin-gym-${gym.id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'gyms', filter: `id=eq.${gym.id}` }, payload => {
      if (payload.new) setGym(prev => prev ? { ...prev, ...payload.new } as Gym : prev);
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [gym]);

  const updateMaxCapacity = async () => {
    if (!gym) return;
    const val = parseInt(maxCapacityEdit);
    if (isNaN(val) || val < 1) return;
    await supabase.from('gyms').update({ max_capacity: val }).eq('id', gym.id);
    setGym(prev => prev ? { ...prev, max_capacity: val } : prev);
    setEditingMaxCapacity(false);
  };

  const regenerateSensorKey = async () => {
    if (!gym || !confirm('¿Estás seguro? La clave anterior dejará de funcionar.')) return;
    const newKey = crypto.randomUUID();
    await supabase.from('gyms').update({ sensor_key: newKey }).eq('id', gym.id);
    setGym(prev => prev ? { ...prev, sensor_key: newKey } : prev);
  };

  const testSensor = async () => {
    if (!gym) return;
    const { data } = await supabase.from('occupancy_logs').select('*').eq('gym_id', gym.id).order('recorded_at', { ascending: false }).limit(5);
    if (data) setSensorLogs(data);
  };

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); };

  const addPlan = async () => {
    if (!gym || !planForm.name) return;
    await supabase.from('gym_plans').insert({ gym_id: gym.id, name: planForm.name, description: planForm.description, regular_price: parseInt(planForm.regular_price) || 0, premium_price: parseInt(planForm.premium_price) || 0, features: planForm.features ? planForm.features.split(',').map(s => s.trim()) : [] });
    setPlanForm({ name: '', description: '', regular_price: '', premium_price: '', features: '' }); setShowAddForm(false); fetchAll();
  };

  const addService = async () => {
    if (!gym || !serviceForm.name) return;
    await supabase.from('gym_services').insert({ gym_id: gym.id, name: serviceForm.name, description: serviceForm.description, regular_price: parseInt(serviceForm.regular_price) || 0, premium_price: parseInt(serviceForm.premium_price) || 0, category: serviceForm.category });
    setServiceForm({ name: '', description: '', regular_price: '', premium_price: '', category: 'entrenamiento' }); setShowAddForm(false); fetchAll();
  };

  const addDiscount = async () => {
    if (!gym || !discountForm.description) return;
    await supabase.from('gym_discounts').insert({ gym_id: gym.id, description: discountForm.description, regular_value: discountForm.regular_value, premium_value: discountForm.premium_value, discount_percentage: parseInt(discountForm.discount_percentage) || 0 });
    setDiscountForm({ description: '', regular_value: '', premium_value: '', discount_percentage: '' }); setShowAddForm(false); fetchAll();
  };

  const addRecommendedHour = async () => {
    if (!gym || !hourForm.label) return;
    await supabase.from('gym_recommended_hours').insert({ gym_id: gym.id, day_of_week: parseInt(hourForm.day_of_week), hour_start: hourForm.hour_start, hour_end: hourForm.hour_end, label: hourForm.label });
    setHourForm({ day_of_week: '1', hour_start: '06:00', hour_end: '08:00', label: '' }); setShowAddForm(false); fetchAll();
  };

  const deleteItem = async (table: string, id: string) => {
    if (!confirm('¿Eliminar este elemento?')) return;
    await supabase.from(table).delete().eq('id', id); fetchAll();
  };

  const saveGymInfo = async () => {
    if (!gym) return;
    const { error } = await supabase.from('gyms').update({
      name: infoForm.name, address: infoForm.address, comuna: infoForm.comuna,
      phone: infoForm.phone, website: infoForm.website, description: infoForm.description,
      approval_status: 'pending',
      is_active: false,
    }).eq('id', gym.id);
    if (error) {
      showToast('Error al guardar cambios. Intenta de nuevo.', 'error');
      return;
    }
    setGym(prev => prev ? { ...prev, ...infoForm, approval_status: 'pending', is_active: false } : prev);
    setIsPending(true);
    setEditingInfo(false);
    showToast('Cambios enviados para revisión por FluxFit', 'success');
  };

  const validateQr = async () => {
    if (!gym || !qrInput.trim()) return;
    setValidatingQr(true);
    setQrResult(null);
    try {
      // QR code format: userId:couponToken
      const parts = qrInput.trim().split(':');
      if (parts.length < 2) {
        setQrResult({ ok: false, message: 'Código QR inválido. Formato incorrecto.' });
        return;
      }
      const [userId] = parts;
      // Check user premium status
      const { data: userData } = await supabase.from('users').select('email, is_premium').eq('id', userId).maybeSingle();
      if (!userData) {
        setQrResult({ ok: false, message: 'Usuario no encontrado.' });
        return;
      }
      if (!userData.is_premium) {
        setQrResult({ ok: false, message: `El usuario ${userData.email} no tiene membresía Premium activa.` });
        return;
      }
      // Check for duplicate redemption (same code, same gym)
      const { data: existing } = await supabase.from('coupon_redemptions').select('id').eq('coupon_code', qrInput.trim()).eq('gym_id', gym.id).maybeSingle();
      if (existing) {
        setQrResult({ ok: false, message: `Este cupón ya fue canjeado anteriormente en este gym.` });
        return;
      }
      // Register redemption
      await supabase.from('coupon_redemptions').insert({
        user_id: userId, gym_id: gym.id, coupon_code: qrInput.trim(), validated_by: user?.id,
      });
      setQrResult({ ok: true, message: 'Canje registrado correctamente.', userEmail: userData.email });
      setQrInput('');
      fetchAll();
    } finally {
      setValidatingQr(false);
    }
  };

  if (!gym) return <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center text-[#666]">Cargando panel de administración...</div>;

  const rawPlan = (subscription?.plan ?? '').toLowerCase().trim();
  const normalizedPlan =
    rawPlan === 'basic' ? 'basico' :
    rawPlan === 'premium_gym' ? 'pro' :
    rawPlan || 'basico';
  const hasManagementAccess = true;
  const canEditInfo = hasManagementAccess;
  const canManagePlans = hasManagementAccess;
  const canManageServices = hasManagementAccess;
  const canManageDiscounts = hasManagementAccess;
  const canManageHours = hasManagementAccess;
  const canManageBranches = hasManagementAccess;
  const canSeePromotions = hasManagementAccess;
  const canValidateQr = hasManagementAccess;

  const allTabs: { key: AdminTab; label: string; allowed: boolean }[] = [
    { key: 'sensor', label: 'Sensor', allowed: true },
    { key: 'mi_plan', label: 'Mi Plan', allowed: true },
    { key: 'sucursales', label: 'Sucursales', allowed: canManageBranches },
    { key: 'planes', label: 'Planes', allowed: canManagePlans },
    { key: 'servicios', label: 'Servicios', allowed: canManageServices },
    { key: 'promociones', label: 'Promociones', allowed: canSeePromotions },
    { key: 'descuentos', label: 'Descuentos', allowed: canManageDiscounts },
    { key: 'horarios', label: 'Horarios', allowed: canManageHours },
    { key: 'validar_qr', label: 'Validar QR', allowed: canValidateQr },
  ];
  const tabs = allTabs.filter(t => t.allowed);
  const navItems = tabs.map((t) => ({
    id: t.key,
    label: t.key === 'mi_plan' ? 'Mi Plan' : t.label,
    icon:
      t.key === 'sensor' ? '📡' :
      t.key === 'sucursales' ? '🏢' :
      t.key === 'planes' ? '⭐' :
      t.key === 'servicios' ? '🛠️' :
      t.key === 'promociones' ? '🎯' :
      t.key === 'descuentos' ? '🏷️' :
      t.key === 'horarios' ? '📅' :
      t.key === 'validar_qr' ? '✅' :
      '📊'
  }));

  return (
    <div className="flex h-screen bg-gray-50">
      <Toast {...toast} />
      <AdminSidebar
        navItems={navItems}
        activeTab={activeTab}
        onTabChange={(tab) => { setActiveTab(tab as AdminTab); setShowAddForm(false); }}
        logo="FLUXFIT"
        title="Panel Gym"
      />

      <main className="flex-1 overflow-y-auto">
      <div className="max-w-[900px] mx-auto w-full px-4 py-4 space-y-4">
        <div className="bg-[#111111] px-4 pt-8 pb-4">
          <p className="text-white/60 text-xs">FluxFit Admin</p>
          <h1 className="text-white font-bold text-lg">{gym.name}</h1>
          {isPending && (
            <div className="mt-2 flex items-center gap-2 bg-amber-500/20 rounded-lg px-3 py-1.5">
              <Clock size={13} className="text-amber-300" />
              <span className="text-amber-300 text-xs font-medium">Perfil pendiente de aprobación — no visible para usuarios</span>
            </div>
          )}
        </div>

        {!loadingPlan && normalizedPlan === 'free' && (
          <div className="bg-[#FFFBEB] border border-[#FCD34D] rounded-xl p-4">
            <p className="text-[#92400E] font-bold text-sm">Plan gratuito — acceso limitado</p>
            <p className="text-[#92400E] text-xs mt-1">Contrata un plan para gestionar tu gym completo.</p>
            <button onClick={() => navigate('/premium')} className="mt-2 text-xs font-bold text-[#CC0000] underline">Ver planes →</button>
          </div>
        )}

        {/* Occupancy summary */}
        <div className="bg-white rounded-xl border border-[#E5E5E5] p-4">
          <div className="flex items-center gap-2 mb-2">
            {gym.sensor_online ? <><span className="w-3 h-3 rounded-full bg-[#16A34A] animate-pulse" /><span className="text-[#16A34A] font-bold text-sm">Sensor activo</span></> : <><span className="w-3 h-3 rounded-full bg-[#CC0000]" /><span className="text-[#CC0000] font-bold text-sm">Sensor sin conexión</span></>}
          </div>
          {gym.sensor_online ? <p className="text-xs text-[#666666]">Última actualización: {timeAgo(gym.last_sensor_ping)}</p> : (
            <><p className="text-xs text-[#666666]">Última señal: {gym.last_sensor_ping ? new Date(gym.last_sensor_ping).toLocaleString('es-CL') : 'Nunca'}</p>
            <div className="flex items-center gap-1 mt-1 text-[#CC0000] text-xs"><AlertTriangle size={12} /> Verifica la conexión WiFi del sensor</div></>
          )}
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-[#111111] font-bold">{gym.current_count} personas / {gym.max_capacity}</span>
            {editingMaxCapacity ? (
              <div className="flex items-center gap-2"><input type="number" value={maxCapacityEdit} onChange={e => setMaxCapacityEdit(e.target.value)} className="w-20 px-2 py-1 border border-[#E5E5E5] rounded text-sm" /><button onClick={updateMaxCapacity} className="text-[#CC0000] text-sm font-bold">Guardar</button><button onClick={() => setEditingMaxCapacity(false)} className="text-[#666] text-sm">X</button></div>
            ) : <button onClick={() => setEditingMaxCapacity(true)} className="text-[#CC0000] text-xs font-bold">Editar capacidad</button>}
          </div>
          <div className="mt-2 h-2 bg-[#E5E5E5] rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(gym.occupancy_percentage, 100)}%`, backgroundColor: gym.occupancy_status === 'tranquilo' ? '#16A34A' : gym.occupancy_status === 'moderado' ? '#EAB308' : '#CC0000' }} /></div>
        </div>

        <OccupancyGauge percentage={gym.occupancy_percentage} status={gym.occupancy_status} peopleCount={gym.current_count} sensorOnline={gym.sensor_online} lastSensorPing={gym.last_sensor_ping} compact />

        {todayLogs.length > 0 && (
          <div className="bg-white rounded-xl border border-[#E5E5E5] p-4">
            <h3 className="font-bold text-[#111111] text-sm mb-3">Ocupación hoy</h3>
            <div className="h-32 relative">
              <svg className="w-full h-full" viewBox="0 0 300 120" preserveAspectRatio="none">
                <line x1="0" y1="0" x2="300" y2="0" stroke="#E5E5E5" strokeWidth="0.5" /><line x1="0" y1="40" x2="300" y2="40" stroke="#E5E5E5" strokeWidth="0.5" /><line x1="0" y1="80" x2="300" y2="80" stroke="#E5E5E5" strokeWidth="0.5" /><line x1="0" y1="120" x2="300" y2="120" stroke="#E5E5E5" strokeWidth="0.5" />
                {todayLogs.length > 1 && (<><polygon points={todayLogs.map((log, i) => `${(i / (todayLogs.length - 1)) * 300},${120 - (log.occupancy_percentage / 100) * 120}`).join(' ') + ' 300,120 0,120'} fill="url(#chartGradient)" opacity="0.3" /><polyline points={todayLogs.map((log, i) => `${(i / (todayLogs.length - 1)) * 300},${120 - (log.occupancy_percentage / 100) * 120}`).join(' ')} fill="none" stroke="#CC0000" strokeWidth="2" /></>)}
                <defs><linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#CC0000" /><stop offset="100%" stopColor="#CC0000" stopOpacity="0" /></linearGradient></defs>
              </svg>
            </div>
          </div>
        )}

        <div><p className="text-xs text-[#666666] mb-2">Así te ven los usuarios</p><OccupancyHeatmap data={heatmapData} /></div>

        {/* Ficha Técnica */}
        <div className="bg-white rounded-xl border border-[#E5E5E5] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-[#111]">Ficha Técnica</h3>
            {!editingInfo && canEditInfo && <button onClick={() => setEditingInfo(true)} className="px-3 py-1.5 border border-[#111111] text-[#111111] font-bold rounded-lg text-xs">Editar</button>}
            {!canEditInfo && <span className="text-xs text-[#999]">Plan Light/Pro para editar</span>}
          </div>
          {editingInfo ? (
            <div className="space-y-2">
              <input placeholder="Nombre del gym" value={infoForm.name} onChange={e => setInfoForm(p => ({ ...p, name: e.target.value }))} className={inp} />
              <input placeholder="Dirección" value={infoForm.address} onChange={e => setInfoForm(p => ({ ...p, address: e.target.value }))} className={inp} />
              <select value={infoForm.comuna} onChange={e => setInfoForm(p => ({ ...p, comuna: e.target.value }))} className={inp}>
                <option value="">Seleccionar comuna</option>
                {COMUNAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input placeholder="Teléfono" value={infoForm.phone} onChange={e => setInfoForm(p => ({ ...p, phone: e.target.value }))} className={inp} />
              <input placeholder="Sitio web" value={infoForm.website} onChange={e => setInfoForm(p => ({ ...p, website: e.target.value }))} className={inp} />
              <textarea rows={3} placeholder="Descripción" value={infoForm.description} onChange={e => setInfoForm(p => ({ ...p, description: e.target.value }))} className={`${inp} resize-none`} />
              <p className="text-[10px] text-amber-600">Al guardar, el perfil quedará pendiente de aprobación por FluxFit.</p>
              <div className="flex gap-2 pt-1">
                <button onClick={saveGymInfo} className="flex-1 py-2 bg-[#CC0000] text-white font-bold rounded-lg text-sm">Guardar y enviar a revisión</button>
                <button onClick={() => setEditingInfo(false)} className="flex-1 py-2 border border-[#E5E5E5] rounded-lg text-sm">Cancelar</button>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-sm font-medium text-[#111]">{gym.name}</p>
              <p className="text-sm text-[#666]">{gym.address}{gym.comuna ? `, ${gym.comuna}` : ''}</p>
              {gym.phone && <p className="text-sm text-[#666]">{gym.phone}</p>}
              {gym.website && <p className="text-sm text-[#CC0000]">{gym.website}</p>}
              {gym.description && <p className="text-sm text-[#666] mt-1">{gym.description}</p>}
            </div>
          )}
        </div>

        <div className="space-y-3">
          {activeTab === 'sucursales' && <GymBranchesTab gymId={gym.id} branches={branches} onRefresh={fetchAll} />}
          {activeTab === 'promociones' && <GymPromotionsTab gymId={gym.id} promotions={promotions} onRefresh={fetchAll} />}

          {activeTab === 'planes' && (<>
            <p className="text-xs text-[#666] mb-2">Crea planes con precios rebajados exclusivos para usuarios Premium de FluxFit.</p>
            {plans.map(p => <div key={p.id} className="bg-white rounded-xl border border-[#E5E5E5] p-3 flex items-center justify-between"><div><p className="font-bold text-sm text-[#111111]">{p.name}</p><p className="text-xs text-[#666666]">Regular: {formatCLP(p.regular_price)} / Premium: {formatCLP(p.premium_price)}</p></div><button onClick={() => deleteItem('gym_plans', p.id)} className="p-2"><Trash2 size={16} className="text-[#CC0000]" /></button></div>)}
            {showAddForm ? (
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 space-y-2">
                <input placeholder="Nombre" value={planForm.name} onChange={e => setPlanForm(p => ({ ...p, name: e.target.value }))} className={inp} />
                <input placeholder="Descripción" value={planForm.description} onChange={e => setPlanForm(p => ({ ...p, description: e.target.value }))} className={inp} />
                <div className="grid grid-cols-2 gap-2"><input placeholder="Precio regular" type="number" value={planForm.regular_price} onChange={e => setPlanForm(p => ({ ...p, regular_price: e.target.value }))} className={inp} /><input placeholder="Precio premium" type="number" value={planForm.premium_price} onChange={e => setPlanForm(p => ({ ...p, premium_price: e.target.value }))} className={inp} /></div>
                <input placeholder="Beneficios (separados por coma)" value={planForm.features} onChange={e => setPlanForm(p => ({ ...p, features: e.target.value }))} className={inp} />
                <div className="flex gap-2"><button onClick={addPlan} className="flex-1 py-2 bg-[#CC0000] text-white font-bold rounded-lg text-sm">Guardar</button><button onClick={() => setShowAddForm(false)} className="flex-1 py-2 border border-[#E5E5E5] rounded-lg text-sm">Cancelar</button></div>
              </div>
            ) : <button onClick={() => setShowAddForm(true)} className="w-full py-2 border-2 border-dashed border-[#E5E5E5] rounded-xl text-[#666666] text-sm flex items-center justify-center gap-1"><Plus size={16} /> Agregar plan rebajado</button>}
          </>)}

          {activeTab === 'servicios' && (<>
            {services.map(s => <div key={s.id} className="bg-white rounded-xl border border-[#E5E5E5] p-3 flex items-center justify-between"><div><p className="font-bold text-sm text-[#111111]">{s.name}</p><p className="text-xs text-[#666666]">{getServiceCategoryLabel(s.category)} — {formatCLP(s.regular_price)}</p></div><button onClick={() => deleteItem('gym_services', s.id)} className="p-2"><Trash2 size={16} className="text-[#CC0000]" /></button></div>)}
            {showAddForm ? (
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 space-y-2">
                <input placeholder="Nombre" value={serviceForm.name} onChange={e => setServiceForm(p => ({ ...p, name: e.target.value }))} className={inp} />
                <input placeholder="Descripción" value={serviceForm.description} onChange={e => setServiceForm(p => ({ ...p, description: e.target.value }))} className={inp} />
                <select value={serviceForm.category} onChange={e => setServiceForm(p => ({ ...p, category: e.target.value }))} className={inp}><option value="nutricion">Nutrición</option><option value="kinesiologia">Kinesiología</option><option value="entrenamiento">Entrenamiento</option><option value="otro">Otro</option></select>
                <div className="grid grid-cols-2 gap-2"><input placeholder="Precio regular" type="number" value={serviceForm.regular_price} onChange={e => setServiceForm(p => ({ ...p, regular_price: e.target.value }))} className={inp} /><input placeholder="Precio premium" type="number" value={serviceForm.premium_price} onChange={e => setServiceForm(p => ({ ...p, premium_price: e.target.value }))} className={inp} /></div>
                <div className="flex gap-2"><button onClick={addService} className="flex-1 py-2 bg-[#CC0000] text-white font-bold rounded-lg text-sm">Guardar</button><button onClick={() => setShowAddForm(false)} className="flex-1 py-2 border border-[#E5E5E5] rounded-lg text-sm">Cancelar</button></div>
              </div>
            ) : <button onClick={() => setShowAddForm(true)} className="w-full py-2 border-2 border-dashed border-[#E5E5E5] rounded-xl text-[#666666] text-sm flex items-center justify-center gap-1"><Plus size={16} /> Agregar servicio</button>}
          </>)}

          {activeTab === 'descuentos' && (<>
            {discounts.map(d => <div key={d.id} className="bg-white rounded-xl border border-[#E5E5E5] p-3 flex items-center justify-between"><div><p className="font-bold text-sm text-[#111111]">{d.description}</p><p className="text-xs text-[#666666]">−{d.discount_percentage}%</p></div><button onClick={() => deleteItem('gym_discounts', d.id)} className="p-2"><Trash2 size={16} className="text-[#CC0000]" /></button></div>)}
            {showAddForm ? (
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 space-y-2">
                <input placeholder="Descripción" value={discountForm.description} onChange={e => setDiscountForm(p => ({ ...p, description: e.target.value }))} className={inp} />
                <div className="grid grid-cols-2 gap-2"><input placeholder="Valor regular" value={discountForm.regular_value} onChange={e => setDiscountForm(p => ({ ...p, regular_value: e.target.value }))} className={inp} /><input placeholder="Valor premium" value={discountForm.premium_value} onChange={e => setDiscountForm(p => ({ ...p, premium_value: e.target.value }))} className={inp} /></div>
                <input placeholder="% descuento" type="number" value={discountForm.discount_percentage} onChange={e => setDiscountForm(p => ({ ...p, discount_percentage: e.target.value }))} className={inp} />
                <div className="flex gap-2"><button onClick={addDiscount} className="flex-1 py-2 bg-[#CC0000] text-white font-bold rounded-lg text-sm">Guardar</button><button onClick={() => setShowAddForm(false)} className="flex-1 py-2 border border-[#E5E5E5] rounded-lg text-sm">Cancelar</button></div>
              </div>
            ) : <button onClick={() => setShowAddForm(true)} className="w-full py-2 border-2 border-dashed border-[#E5E5E5] rounded-xl text-[#666666] text-sm flex items-center justify-center gap-1"><Plus size={16} /> Agregar descuento</button>}
          </>)}

          {activeTab === 'horarios' && (<>
            {recommendedHours.map(h => <div key={h.id} className="bg-white rounded-xl border border-[#E5E5E5] p-3 flex items-center justify-between"><div><p className="font-bold text-sm text-[#111111]">{h.label}</p><p className="text-xs text-[#666666]">{getFullDayLabel(h.day_of_week)} {h.hour_start}–{h.hour_end}</p></div><button onClick={() => deleteItem('gym_recommended_hours', h.id)} className="p-2"><Trash2 size={16} className="text-[#CC0000]" /></button></div>)}
            {showAddForm ? (
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 space-y-2">
                <select value={hourForm.day_of_week} onChange={e => setHourForm(p => ({ ...p, day_of_week: e.target.value }))} className={inp}>{[0,1,2,3,4,5,6].map(d => <option key={d} value={d}>{getFullDayLabel(d)}</option>)}</select>
                <div className="grid grid-cols-2 gap-2"><input type="time" value={hourForm.hour_start} onChange={e => setHourForm(p => ({ ...p, hour_start: e.target.value }))} className={inp} /><input type="time" value={hourForm.hour_end} onChange={e => setHourForm(p => ({ ...p, hour_end: e.target.value }))} className={inp} /></div>
                <input placeholder="Etiqueta (ej: Mediodía tranquilo)" value={hourForm.label} onChange={e => setHourForm(p => ({ ...p, label: e.target.value }))} className={inp} />
                <div className="flex gap-2"><button onClick={addRecommendedHour} className="flex-1 py-2 bg-[#CC0000] text-white font-bold rounded-lg text-sm">Guardar</button><button onClick={() => setShowAddForm(false)} className="flex-1 py-2 border border-[#E5E5E5] rounded-lg text-sm">Cancelar</button></div>
              </div>
            ) : <button onClick={() => setShowAddForm(true)} className="w-full py-2 border-2 border-dashed border-[#E5E5E5] rounded-xl text-[#666666] text-sm flex items-center justify-center gap-1"><Plus size={16} /> Agregar horario recomendado</button>}
          </>)}

          {activeTab === 'validar_qr' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <QrCode size={20} className="text-[#CC0000]" />
                  <h3 className="font-bold text-[#111]">Validar cupón Premium</h3>
                </div>
                <p className="text-xs text-[#666]">Ingresa o escanea el código QR del usuario para verificar su membresía y registrar el canje.</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={qrInput}
                    onChange={e => setQrInput(e.target.value)}
                    placeholder="Pegar código QR aquí..."
                    className={inp}
                    onKeyDown={e => e.key === 'Enter' && validateQr()}
                  />
                  <button
                    onClick={validateQr}
                    disabled={validatingQr || !qrInput.trim()}
                    className="px-4 py-2 bg-[#CC0000] text-white font-bold rounded-lg text-sm disabled:opacity-50 flex-shrink-0"
                  >
                    {validatingQr ? '...' : 'Validar'}
                  </button>
                </div>
                {qrResult && (
                  <div className={`flex items-start gap-3 p-3 rounded-xl ${qrResult.ok ? 'bg-[#16A34A]/10 border border-[#16A34A]/30' : 'bg-[#CC0000]/10 border border-[#CC0000]/30'}`}>
                    {qrResult.ok ? <CheckCircle size={20} className="text-[#16A34A] flex-shrink-0" /> : <XCircle size={20} className="text-[#CC0000] flex-shrink-0" />}
                    <div>
                      <p className={`font-bold text-sm ${qrResult.ok ? 'text-[#16A34A]' : 'text-[#CC0000]'}`}>{qrResult.ok ? 'Canje exitoso' : 'No válido'}</p>
                      <p className={`text-xs mt-0.5 ${qrResult.ok ? 'text-[#16A34A]' : 'text-[#CC0000]'}`}>{qrResult.message}</p>
                      {qrResult.userEmail && <p className="text-xs text-[#16A34A] mt-0.5">Usuario: {qrResult.userEmail}</p>}
                    </div>
                  </div>
                )}
              </div>

              {redemptions.length > 0 && (
                <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#F5F5F5]">
                    <p className="font-bold text-sm text-[#111]">Últimos canjes ({redemptions.length})</p>
                  </div>
                  <div className="divide-y divide-[#F5F5F5]">
                    {redemptions.slice(0, 10).map(r => (
                      <div key={r.id} className="px-4 py-2.5 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-[#111] font-mono">{r.coupon_code.slice(0, 20)}...</p>
                          <p className="text-[10px] text-[#999]">{new Date(r.redeemed_at).toLocaleString('es-CL')}</p>
                        </div>
                        <CheckCircle size={14} className="text-[#16A34A]" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'mi_plan' && null /* handled by /premium — see PremiumPage */}

          {activeTab === 'sensor' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 space-y-3">
                <div className="flex items-center justify-between"><span className="text-xs text-[#666666] font-mono">gym_id:</span><div className="flex items-center gap-2"><code className="text-xs bg-[#F5F5F5] px-2 py-1 rounded font-mono break-all">{gym.id}</code><button onClick={() => copyToClipboard(gym.id)} className="p-1"><Copy size={14} className="text-[#666]" /></button></div></div>
                <div className="flex items-center justify-between"><span className="text-xs text-[#666666] font-mono">sensor_key:</span><div className="flex items-center gap-2"><code className="text-xs bg-[#F5F5F5] px-2 py-1 rounded font-mono break-all">{gym.sensor_key}</code><button onClick={() => copyToClipboard(gym.sensor_key)} className="p-1"><Copy size={14} className="text-[#666]" /></button></div></div>
              </div>
              <div className="bg-[#F5F5F5] rounded-xl p-4 text-sm text-[#666666]"><p>Entrega estos datos al técnico que instalará el sensor infrarrojo FluxFit.</p></div>
              <button onClick={regenerateSensorKey} className="w-full py-2.5 border-2 border-[#CC0000] text-[#CC0000] font-bold rounded-xl text-sm">Regenerar sensor key</button>
              <button onClick={testSensor} className="w-full py-2.5 border-2 border-[#111111] text-[#111111] font-bold rounded-xl text-sm flex items-center justify-center gap-2"><RefreshCw size={16} /> Probar conexión</button>
              {sensorLogs.length > 0 && (
                <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
                  <table className="w-full text-xs"><thead><tr className="bg-[#F5F5F5]"><th className="p-2 text-left">Personas</th><th className="p-2 text-left">%</th><th className="p-2 text-left">Estado</th><th className="p-2 text-left">Hora</th></tr></thead>
                    <tbody>{sensorLogs.map(log => <tr key={log.id} className="border-t border-[#E5E5E5]"><td className="p-2">{log.people_count}</td><td className="p-2">{Math.round(log.occupancy_percentage)}%</td><td className="p-2">{log.occupancy_status}</td><td className="p-2">{new Date(log.recorded_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      </main>
    </div>
  );
}
