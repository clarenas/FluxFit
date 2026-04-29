import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { OccupancyGauge } from '../components/OccupancyGauge';
import { OccupancyHeatmap } from '../components/OccupancyHeatmap';
import { GymBranchesTab } from '../components/admin/GymBranchesTab';
import { GymPromotionsTab } from '../components/admin/GymPromotionsTab';
import { formatCLP, getServiceCategoryLabel, getFullDayLabel, timeAgo } from '../lib/utils';
import type { Gym, GymPlan, GymService, GymDiscount, GymRecommendedHour, WeeklyOccupancySummary, OccupancyLog, GymBranch, GymPromotion } from '../lib/types';
import { Plus, Trash2, Copy, RefreshCw, AlertTriangle } from 'lucide-react';

type AdminTab = 'sucursales' | 'planes' | 'servicios' | 'promociones' | 'descuentos' | 'horarios' | 'sensor';

export function GymAdminPage() {
  const { user } = useAuth();
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
  const [activeTab, setActiveTab] = useState<AdminTab>('sucursales');
  const [showAddForm, setShowAddForm] = useState(false);
  const [maxCapacityEdit, setMaxCapacityEdit] = useState('');
  const [editingMaxCapacity, setEditingMaxCapacity] = useState(false);

  const [planForm, setPlanForm] = useState({ name: '', description: '', regular_price: '', premium_price: '', features: '' });
  const [serviceForm, setServiceForm] = useState({ name: '', description: '', regular_price: '', premium_price: '', category: 'entrenamiento' as string });
  const [discountForm, setDiscountForm] = useState({ description: '', regular_value: '', premium_value: '', discount_percentage: '' });
  const [hourForm, setHourForm] = useState({ day_of_week: '1', hour_start: '06:00', hour_end: '08:00', label: '' });

  const fetchAll = useCallback(async () => {
    if (!user) return;
    const { data: adminData } = await supabase.from('gym_admins').select('gym_id').eq('user_id', user.id).maybeSingle();
    if (!adminData) return;
    const gymId = adminData.gym_id;
    const [gymRes, plansRes, servicesRes, discountsRes, hoursRes, heatmapRes, logsRes, branchesRes, promoRes] = await Promise.all([
      supabase.from('gyms').select('*').eq('id', gymId).maybeSingle(),
      supabase.from('gym_plans').select('*').eq('gym_id', gymId),
      supabase.from('gym_services').select('*').eq('gym_id', gymId),
      supabase.from('gym_discounts').select('*').eq('gym_id', gymId),
      supabase.from('gym_recommended_hours').select('*').eq('gym_id', gymId),
      supabase.from('weekly_occupancy_summary').select('*').eq('gym_id', gymId),
      supabase.from('occupancy_logs').select('*').eq('gym_id', gymId).gte('recorded_at', new Date(new Date().setHours(0,0,0,0)).toISOString()).order('recorded_at', { ascending: true }),
      supabase.from('gym_branches').select('*').eq('gym_id', gymId).order('created_at'),
      supabase.from('gym_promotions').select('*').eq('gym_id', gymId).order('created_at'),
    ]);
    if (gymRes.data) { setGym(gymRes.data); setMaxCapacityEdit(String(gymRes.data.max_capacity)); }
    if (plansRes.data) setPlans(plansRes.data);
    if (servicesRes.data) setServices(servicesRes.data);
    if (discountsRes.data) setDiscounts(discountsRes.data);
    if (hoursRes.data) setRecommendedHours(hoursRes.data);
    if (heatmapRes.data) setHeatmapData(heatmapRes.data);
    if (logsRes.data) setTodayLogs(logsRes.data);
    if (branchesRes.data) setBranches(branchesRes.data);
    if (promoRes.data) setPromotions(promoRes.data);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

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

  if (!gym) return <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center text-[#666]">Cargando panel de administración...</div>;

  const tabs: { key: AdminTab; label: string }[] = [
    { key: 'sucursales', label: 'Sucursales' }, { key: 'planes', label: 'Planes' },
    { key: 'servicios', label: 'Servicios' }, { key: 'promociones', label: 'Promociones' },
    { key: 'descuentos', label: 'Descuentos' }, { key: 'horarios', label: 'Horarios' },
    { key: 'sensor', label: 'Sensor' },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-8">
      <div className="bg-[#111111] px-4 pt-8 pb-4"><p className="text-white/60 text-xs">FluxFit Admin</p><h1 className="text-white font-bold text-lg">{gym.name}</h1></div>
      <div className="px-4 pt-4 space-y-4">
        <div className="bg-white rounded-xl border border-[#E5E5E5] p-4">
          <div className="flex items-center gap-2 mb-2">
            {gym.sensor_online ? <><span className="w-3 h-3 rounded-full bg-[#16A34A] animate-pulse" /><span className="text-[#16A34A] font-bold text-sm">Sensor activo</span></> : <><span className="w-3 h-3 rounded-full bg-[#CC0000]" /><span className="text-[#CC0000] font-bold text-sm">Sensor sin conexión</span></>}
          </div>
          {gym.sensor_online ? <p className="text-xs text-[#666666]">Última actualización: {timeAgo(gym.last_sensor_ping)}</p> : (
            <><p className="text-xs text-[#666666]">Última señal: {gym.last_sensor_ping ? new Date(gym.last_sensor_ping).toLocaleString('es-CL') : 'Nunca'}</p><div className="flex items-center gap-1 mt-1 text-[#CC0000] text-xs"><AlertTriangle size={12} /> Verifica la conexión WiFi del sensor</div></>
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
              <div className="absolute left-0 top-0 text-[10px] text-[#999]">100%</div><div className="absolute left-0 bottom-0 text-[10px] text-[#999]">0%</div>
            </div>
          </div>
        )}

        <div><p className="text-xs text-[#666666] mb-2">Así te ven los usuarios</p><OccupancyHeatmap data={heatmapData} /></div>

        <div className="flex gap-1 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {tabs.map(t => <button key={t.key} onClick={() => { setActiveTab(t.key); setShowAddForm(false); }} className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${activeTab === t.key ? 'bg-[#111111] text-white' : 'bg-white text-[#666666] border border-[#E5E5E5]'}`}>{t.label}</button>)}
        </div>

        <div className="space-y-3">
          {activeTab === 'sucursales' && <GymBranchesTab gymId={gym.id} branches={branches} onRefresh={fetchAll} />}
          {activeTab === 'promociones' && <GymPromotionsTab gymId={gym.id} promotions={promotions} onRefresh={fetchAll} />}

          {activeTab === 'planes' && (<>
            {plans.map(p => <div key={p.id} className="bg-white rounded-xl border border-[#E5E5E5] p-3 flex items-center justify-between"><div><p className="font-bold text-sm text-[#111111]">{p.name}</p><p className="text-xs text-[#666666]">Regular: {formatCLP(p.regular_price)} / Premium: {formatCLP(p.premium_price)}</p></div><button onClick={() => deleteItem('gym_plans', p.id)} className="p-2"><Trash2 size={16} className="text-[#CC0000]" /></button></div>)}
            {showAddForm ? (
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 space-y-2">
                <input placeholder="Nombre" value={planForm.name} onChange={e => setPlanForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm" />
                <input placeholder="Descripción" value={planForm.description} onChange={e => setPlanForm(p => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm" />
                <div className="grid grid-cols-2 gap-2"><input placeholder="Precio regular" type="number" value={planForm.regular_price} onChange={e => setPlanForm(p => ({ ...p, regular_price: e.target.value }))} className="px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm" /><input placeholder="Precio premium" type="number" value={planForm.premium_price} onChange={e => setPlanForm(p => ({ ...p, premium_price: e.target.value }))} className="px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm" /></div>
                <input placeholder="Beneficios (separados por coma)" value={planForm.features} onChange={e => setPlanForm(p => ({ ...p, features: e.target.value }))} className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm" />
                <div className="flex gap-2"><button onClick={addPlan} className="flex-1 py-2 bg-[#CC0000] text-white font-bold rounded-lg text-sm">Guardar</button><button onClick={() => setShowAddForm(false)} className="flex-1 py-2 border border-[#E5E5E5] rounded-lg text-sm">Cancelar</button></div>
              </div>
            ) : <button onClick={() => setShowAddForm(true)} className="w-full py-2 border-2 border-dashed border-[#E5E5E5] rounded-xl text-[#666666] text-sm flex items-center justify-center gap-1"><Plus size={16} /> Agregar plan</button>}
          </>)}

          {activeTab === 'servicios' && (<>
            {services.map(s => <div key={s.id} className="bg-white rounded-xl border border-[#E5E5E5] p-3 flex items-center justify-between"><div><p className="font-bold text-sm text-[#111111]">{s.name}</p><p className="text-xs text-[#666666]">{getServiceCategoryLabel(s.category)} — {formatCLP(s.regular_price)}</p></div><button onClick={() => deleteItem('gym_services', s.id)} className="p-2"><Trash2 size={16} className="text-[#CC0000]" /></button></div>)}
            {showAddForm ? (
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 space-y-2">
                <input placeholder="Nombre" value={serviceForm.name} onChange={e => setServiceForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm" />
                <input placeholder="Descripción" value={serviceForm.description} onChange={e => setServiceForm(p => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm" />
                <select value={serviceForm.category} onChange={e => setServiceForm(p => ({ ...p, category: e.target.value }))} className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm"><option value="nutricion">Nutrición</option><option value="kinesiologia">Kinesiología</option><option value="entrenamiento">Entrenamiento</option><option value="otro">Otro</option></select>
                <div className="grid grid-cols-2 gap-2"><input placeholder="Precio regular" type="number" value={serviceForm.regular_price} onChange={e => setServiceForm(p => ({ ...p, regular_price: e.target.value }))} className="px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm" /><input placeholder="Precio premium" type="number" value={serviceForm.premium_price} onChange={e => setServiceForm(p => ({ ...p, premium_price: e.target.value }))} className="px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm" /></div>
                <div className="flex gap-2"><button onClick={addService} className="flex-1 py-2 bg-[#CC0000] text-white font-bold rounded-lg text-sm">Guardar</button><button onClick={() => setShowAddForm(false)} className="flex-1 py-2 border border-[#E5E5E5] rounded-lg text-sm">Cancelar</button></div>
              </div>
            ) : <button onClick={() => setShowAddForm(true)} className="w-full py-2 border-2 border-dashed border-[#E5E5E5] rounded-xl text-[#666666] text-sm flex items-center justify-center gap-1"><Plus size={16} /> Agregar servicio</button>}
          </>)}

          {activeTab === 'descuentos' && (<>
            {discounts.map(d => <div key={d.id} className="bg-white rounded-xl border border-[#E5E5E5] p-3 flex items-center justify-between"><div><p className="font-bold text-sm text-[#111111]">{d.description}</p><p className="text-xs text-[#666666]">−{d.discount_percentage}%</p></div><button onClick={() => deleteItem('gym_discounts', d.id)} className="p-2"><Trash2 size={16} className="text-[#CC0000]" /></button></div>)}
            {showAddForm ? (
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 space-y-2">
                <input placeholder="Descripción" value={discountForm.description} onChange={e => setDiscountForm(p => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm" />
                <div className="grid grid-cols-2 gap-2"><input placeholder="Valor regular" value={discountForm.regular_value} onChange={e => setDiscountForm(p => ({ ...p, regular_value: e.target.value }))} className="px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm" /><input placeholder="Valor premium" value={discountForm.premium_value} onChange={e => setDiscountForm(p => ({ ...p, premium_value: e.target.value }))} className="px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm" /></div>
                <input placeholder="% descuento" type="number" value={discountForm.discount_percentage} onChange={e => setDiscountForm(p => ({ ...p, discount_percentage: e.target.value }))} className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm" />
                <div className="flex gap-2"><button onClick={addDiscount} className="flex-1 py-2 bg-[#CC0000] text-white font-bold rounded-lg text-sm">Guardar</button><button onClick={() => setShowAddForm(false)} className="flex-1 py-2 border border-[#E5E5E5] rounded-lg text-sm">Cancelar</button></div>
              </div>
            ) : <button onClick={() => setShowAddForm(true)} className="w-full py-2 border-2 border-dashed border-[#E5E5E5] rounded-xl text-[#666666] text-sm flex items-center justify-center gap-1"><Plus size={16} /> Agregar descuento</button>}
          </>)}

          {activeTab === 'horarios' && (<>
            {recommendedHours.map(h => <div key={h.id} className="bg-white rounded-xl border border-[#E5E5E5] p-3 flex items-center justify-between"><div><p className="font-bold text-sm text-[#111111]">{h.label}</p><p className="text-xs text-[#666666]">{getFullDayLabel(h.day_of_week)} {h.hour_start}–{h.hour_end}</p></div><button onClick={() => deleteItem('gym_recommended_hours', h.id)} className="p-2"><Trash2 size={16} className="text-[#CC0000]" /></button></div>)}
            {showAddForm ? (
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 space-y-2">
                <select value={hourForm.day_of_week} onChange={e => setHourForm(p => ({ ...p, day_of_week: e.target.value }))} className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm">{[0,1,2,3,4,5,6].map(d => <option key={d} value={d}>{getFullDayLabel(d)}</option>)}</select>
                <div className="grid grid-cols-2 gap-2"><input type="time" value={hourForm.hour_start} onChange={e => setHourForm(p => ({ ...p, hour_start: e.target.value }))} className="px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm" /><input type="time" value={hourForm.hour_end} onChange={e => setHourForm(p => ({ ...p, hour_end: e.target.value }))} className="px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm" /></div>
                <input placeholder="Etiqueta (ej: Mediodía tranquilo)" value={hourForm.label} onChange={e => setHourForm(p => ({ ...p, label: e.target.value }))} className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm" />
                <div className="flex gap-2"><button onClick={addRecommendedHour} className="flex-1 py-2 bg-[#CC0000] text-white font-bold rounded-lg text-sm">Guardar</button><button onClick={() => setShowAddForm(false)} className="flex-1 py-2 border border-[#E5E5E5] rounded-lg text-sm">Cancelar</button></div>
              </div>
            ) : <button onClick={() => setShowAddForm(true)} className="w-full py-2 border-2 border-dashed border-[#E5E5E5] rounded-xl text-[#666666] text-sm flex items-center justify-center gap-1"><Plus size={16} /> Agregar horario recomendado</button>}
          </>)}

          {activeTab === 'sensor' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 space-y-3">
                <div className="flex items-center justify-between"><span className="text-xs text-[#666666] font-mono">gym_id:</span><div className="flex items-center gap-2"><code className="text-xs bg-[#F5F5F5] px-2 py-1 rounded font-mono break-all">{gym.id}</code><button onClick={() => copyToClipboard(gym.id)} className="p-1"><Copy size={14} className="text-[#666]" /></button></div></div>
                <div className="flex items-center justify-between"><span className="text-xs text-[#666666] font-mono">sensor_key:</span><div className="flex items-center gap-2"><code className="text-xs bg-[#F5F5F5] px-2 py-1 rounded font-mono break-all">{gym.sensor_key}</code><button onClick={() => copyToClipboard(gym.sensor_key)} className="p-1"><Copy size={14} className="text-[#666]" /></button></div></div>
              </div>
              <div className="bg-[#F5F5F5] rounded-xl p-4 text-sm text-[#666666]"><p>Entrega estos datos al técnico que instalará el sensor infrarrojo FluxFit. El sensor enviará actualizaciones automáticas cada 60 segundos vía WiFi.</p></div>
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
    </div>
  );
}
