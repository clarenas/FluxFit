import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { OccupancyGauge } from '../components/OccupancyGauge';
import { GymBranchesTab } from '../components/admin/GymBranchesTab';
import { GymPromotionsTab } from '../components/admin/GymPromotionsTab';
import AdminSidebar from '../components/AdminSidebar';
import { formatCLP, timeAgo } from '../lib/utils';
import type { Gym, GymBranch, GymDiscount, GymPlan, GymPromotion, OccupancyLog } from '../lib/types';
import { Plus, Trash2, Pencil, Check, X, Clock } from 'lucide-react';

type GymPlanType = 'free' | 'light' | 'pro';
type AdminTab =
  | 'dashboard'
  | 'mi_gym'
  | 'sensor'
  | 'perfil'
  | 'mi_plan'
  | 'sucursales'
  | 'planes'
  | 'descuentos'
  | 'estadisticas_basicas'
  | 'analytics_pro'
  | 'notificaciones';

interface Props {
  initialTab?: AdminTab;
}

const inp = 'w-full px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm focus:outline-none focus:border-[#CC0000]';
const planLimits: Record<GymPlanType, number> = { free: 1, light: 3, pro: 6 };

export function GymAdminPage({ initialTab }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [gym, setGym] = useState<Gym | null>(null);
  const [branches, setBranches] = useState<GymBranch[]>([]);
  const [discounts, setDiscounts] = useState<GymDiscount[]>([]);
  const [promotions, setPromotions] = useState<GymPromotion[]>([]);
  const [plans, setPlans] = useState<GymPlan[]>([]);
  const [todayLogs, setTodayLogs] = useState<OccupancyLog[]>([]);
  const [subscriptionPlan, setSubscriptionPlan] = useState<GymPlanType>('free');
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab ?? 'dashboard');
  const [editingInfo, setEditingInfo] = useState(false);
  const [infoForm, setInfoForm] = useState({ name: '', address: '', comuna: '', phone: '', website: '', description: '' });
  const [discountForm, setDiscountForm] = useState({ description: '', regular_value: '', premium_value: '', discount_percentage: '' });
  const [editingDiscountId, setEditingDiscountId] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const normalizePlan = (raw: string | null | undefined): GymPlanType => {
    const p = (raw ?? 'free').toLowerCase().trim();
    if (p === 'light' || p === 'basico' || p === 'basic') return 'light';
    if (p === 'pro' || p === 'premium_gym' || p === 'full') return 'pro';
    return 'free';
  };

  const ensureGymAdminLink = async () => {
    if (!user) return null;
    const fallbackName = user.full_name?.trim() || user.email.split('@')[0];
    const { data: createdGym, error: gymError } = await supabase
      .from('gyms')
      .insert({
        name: `${fallbackName} Gym`,
        address: 'Por definir',
        comuna: 'Por definir',
        phone: '',
        website: '',
        description: 'Gym en configuracion inicial',
        is_active: true,
        approval_status: 'pending',
      })
      .select('id')
      .single();

    if (gymError || !createdGym?.id) return null;

    await supabase.from('gym_subscriptions').upsert(
      { gym_id: createdGym.id, plan: 'free', plan_price: 0, status: 'active', valid_until: null },
      { onConflict: 'gym_id' }
    );
    await supabase.from('gym_admins').insert({ user_id: user.id, gym_id: createdGym.id });
    await supabase.from('users').update({ role: 'gym_admin' }).eq('id', user.id);
    return createdGym.id;
  };

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(null);
    try {
      let { data: adminData } = await supabase.from('gym_admins').select('gym_id').eq('user_id', user.id).maybeSingle();
      if (!adminData?.gym_id) {
        const gymId = await ensureGymAdminLink();
        if (!gymId) throw new Error('No se pudo vincular tu cuenta gym_admin');
        adminData = { gym_id: gymId };
      }
      const gymId = adminData.gym_id;

      const [{ data: sub }, { data: gymData }, { data: branchesData }, { data: discountsData }, { data: promotionsData }, { data: plansData }, { data: logsData }] = await Promise.all([
        supabase.from('gym_subscriptions').select('plan').eq('gym_id', gymId).maybeSingle(),
        supabase.from('gyms').select('*').eq('id', gymId).maybeSingle(),
        supabase.from('gym_branches').select('*').eq('gym_id', gymId).order('created_at'),
        supabase.from('gym_discounts').select('*').eq('gym_id', gymId).order('id', { ascending: false }),
        supabase.from('gym_promotions').select('*').eq('gym_id', gymId).order('created_at', { ascending: false }),
        supabase.from('gym_plans').select('*').eq('gym_id', gymId).order('created_at', { ascending: false }),
        supabase.from('occupancy_logs').select('*').eq('gym_id', gymId).order('recorded_at', { ascending: false }).limit(20),
      ]);

      setSubscriptionPlan(normalizePlan(sub?.plan));
      if (gymData) {
        setGym(gymData as Gym);
        setIsPending(gymData.approval_status === 'pending');
        setInfoForm({
          name: gymData.name ?? '',
          address: gymData.address ?? '',
          comuna: gymData.comuna ?? '',
          phone: gymData.phone ?? '',
          website: gymData.website ?? '',
          description: gymData.description ?? '',
        });
      }
      setBranches((branchesData ?? []) as GymBranch[]);
      setDiscounts((discountsData ?? []) as GymDiscount[]);
      setPromotions((promotionsData ?? []) as GymPromotion[]);
      setPlans((plansData ?? []) as GymPlan[]);
      setTodayLogs((logsData ?? []) as OccupancyLog[]);
    } catch (err: any) {
      setLoadError(err?.message ?? 'No se pudo cargar el panel');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!initialTab) return;
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (subscriptionPlan === 'free' && ['sucursales', 'planes', 'descuentos', 'estadisticas_basicas', 'analytics_pro', 'notificaciones'].includes(activeTab)) {
      setActiveTab('dashboard');
    }
    if (subscriptionPlan === 'light' && ['analytics_pro', 'notificaciones'].includes(activeTab)) {
      setActiveTab('dashboard');
    }
  }, [activeTab, subscriptionPlan]);

  const saveGymInfo = async () => {
    if (!gym) return;
    await supabase
      .from('gyms')
      .update({
        name: infoForm.name,
        address: infoForm.address,
        comuna: infoForm.comuna,
        phone: infoForm.phone,
        website: infoForm.website,
        description: infoForm.description,
      })
      .eq('id', gym.id);
    setEditingInfo(false);
    await fetchAll();
  };

  const resetDiscountForm = () => {
    setDiscountForm({ description: '', regular_value: '', premium_value: '', discount_percentage: '' });
    setEditingDiscountId(null);
  };

  const createOrUpdateDiscount = async () => {
    if (!gym || !discountForm.description.trim()) return;
    const payload = {
      gym_id: gym.id,
      description: discountForm.description,
      regular_value: discountForm.regular_value,
      premium_value: discountForm.premium_value,
      discount_percentage: parseInt(discountForm.discount_percentage || '0', 10),
    };

    if (editingDiscountId) {
      await supabase.from('gym_discounts').update(payload).eq('id', editingDiscountId);
    } else {
      await supabase.from('gym_discounts').insert(payload);
    }
    resetDiscountForm();
    await fetchAll();
  };

  const editDiscount = (discount: GymDiscount) => {
    setEditingDiscountId(discount.id);
    setDiscountForm({
      description: discount.description ?? '',
      regular_value: discount.regular_value ?? '',
      premium_value: discount.premium_value ?? '',
      discount_percentage: String(discount.discount_percentage ?? 0),
    });
  };

  const toggleDiscount = async (discount: GymDiscount) => {
    await supabase.from('gym_discounts').update({ is_active: !discount.is_active }).eq('id', discount.id);
    await fetchAll();
  };

  const deleteDiscount = async (id: string) => {
    if (!confirm('¿Eliminar descuento?')) return;
    await supabase.from('gym_discounts').delete().eq('id', id);
    await fetchAll();
  };

  const addGymPlan = async () => {
    if (!gym) return;
    const name = prompt('Nombre del plan');
    if (!name) return;
    await supabase.from('gym_plans').insert({ gym_id: gym.id, name, regular_price: 0, premium_price: 0, description: '', features: [] });
    await fetchAll();
  };

  const deleteGymPlan = async (id: string) => {
    if (!confirm('¿Eliminar plan?')) return;
    await supabase.from('gym_plans').delete().eq('id', id);
    await fetchAll();
  };

  if (loading) {
    return <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center text-[#666]">Cargando panel de administración...</div>;
  }
  if (loadError) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center px-4">
        <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 max-w-md w-full text-center">
          <p className="text-sm font-bold text-[#111] mb-1">No pudimos cargar tu panel gym</p>
          <p className="text-xs text-[#666]">{loadError}</p>
          <button onClick={() => fetchAll()} className="mt-3 px-4 py-2 bg-[#CC0000] text-white rounded-lg text-sm font-bold">
            Reintentar
          </button>
        </div>
      </div>
    );
  }
  if (!gym) {
    return <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center text-[#666]">No encontramos un gimnasio asociado a esta cuenta.</div>;
  }

  const maxBranchesAllowed = planLimits[subscriptionPlan];

  const navItems =
    subscriptionPlan === 'free'
      ? [
          { id: 'dashboard', label: 'Dashboard', icon: '📊' },
          { id: 'mi_gym', label: 'Mi Gym', icon: '🏢' },
          { id: 'sensor', label: 'Aforo en Tiempo Real', icon: '📡' },
          { id: 'perfil', label: 'Perfil', icon: '👤' },
          { id: 'mi_plan', label: 'Actualizar Plan', icon: '💳' },
        ]
      : subscriptionPlan === 'light'
      ? [
          { id: 'dashboard', label: 'Dashboard', icon: '📊' },
          { id: 'sucursales', label: 'Mis Sucursales', icon: '🏢' },
          { id: 'planes', label: 'Planes y Promociones', icon: '⭐' },
          { id: 'descuentos', label: 'Mis Descuentos', icon: '🏷️' },
          { id: 'estadisticas_basicas', label: 'Estadísticas Básicas', icon: '📈' },
          { id: 'perfil', label: 'Perfil', icon: '👤' },
        ]
      : [
          { id: 'dashboard', label: 'Dashboard', icon: '📊' },
          { id: 'sucursales', label: 'Mis Sucursales', icon: '🏢' },
          { id: 'planes', label: 'Planes y Promociones', icon: '⭐' },
          { id: 'descuentos', label: 'Mis Descuentos', icon: '🏷️' },
          { id: 'analytics_pro', label: 'Analytics Pro', icon: '📈' },
          { id: 'notificaciones', label: 'Notificaciones', icon: '🔔' },
          { id: 'perfil', label: 'Perfil', icon: '👤' },
        ];

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar
        navItems={navItems}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as AdminTab)}
        logo="FLUXFIT"
        title="Panel Gym"
      />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[900px] mx-auto w-full px-4 py-4 space-y-4">
          <div className="bg-[#111111] px-4 pt-8 pb-4">
            <p className="text-white/60 text-xs">FluxFit Admin</p>
            <h1 className="text-white font-bold text-lg">{gym.name}</h1>
            <p className="text-white/60 text-xs mt-1">Plan actual: {subscriptionPlan.toUpperCase()}</p>
            {isPending && (
              <div className="mt-2 flex items-center gap-2 bg-amber-500/20 rounded-lg px-3 py-1.5">
                <Clock size={13} className="text-amber-300" />
                <span className="text-amber-300 text-xs font-medium">Perfil pendiente de aprobación</span>
              </div>
            )}
          </div>

          {activeTab === 'dashboard' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 text-center">
                  <p className="text-2xl font-bold text-[#111]">{branches.length}</p>
                  <p className="text-xs text-[#666] mt-1">Sucursales</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 text-center">
                  <p className="text-2xl font-bold text-[#111]">{discounts.filter(d => d.is_active).length}</p>
                  <p className="text-xs text-[#666] mt-1">Descuentos activos</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 text-center">
                  <p className="text-2xl font-bold text-[#111]">{plans.length}</p>
                  <p className="text-xs text-[#666] mt-1">Planes internos</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 text-center">
                  <p className="text-2xl font-bold text-[#111]">{gym.current_count}</p>
                  <p className="text-xs text-[#666] mt-1">Personas actuales</p>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 text-sm text-[#666]">
                Panel básico del administrador gym. Aquí no se muestran gyms recomendados ni contenido de usuario final.
              </div>
            </div>
          )}

          {activeTab === 'mi_gym' && (
            <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 space-y-2">
              <h3 className="font-bold text-[#111] text-sm">Mi Gym (solo lectura)</h3>
              <p className="text-sm text-[#666]">{gym.name}</p>
              <p className="text-sm text-[#666]">{gym.address || 'Dirección por definir'}</p>
              <p className="text-xs text-[#999]">Sucursales registradas: {branches.length}</p>
            </div>
          )}

          {activeTab === 'sensor' && (
            <div className="space-y-3">
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-4">
                <div className="flex items-center gap-2 mb-2">
                  {gym.sensor_online ? (
                    <>
                      <span className="w-3 h-3 rounded-full bg-[#16A34A] animate-pulse" />
                      <span className="text-[#16A34A] font-bold text-sm">Sensor activo</span>
                    </>
                  ) : (
                    <>
                      <span className="w-3 h-3 rounded-full bg-[#CC0000]" />
                      <span className="text-[#CC0000] font-bold text-sm">Sensor sin conexión</span>
                    </>
                  )}
                </div>
                <p className="text-xs text-[#666]">
                  Última señal: {gym.last_sensor_ping ? timeAgo(gym.last_sensor_ping) : 'Sin señales'}
                </p>
              </div>
              <OccupancyGauge
                percentage={gym.occupancy_percentage}
                status={gym.occupancy_status}
                peopleCount={gym.current_count}
                sensorOnline={gym.sensor_online}
                lastSensorPing={gym.last_sensor_ping}
                compact
              />
              {todayLogs.length > 0 && (
                <div className="bg-white rounded-xl border border-[#E5E5E5] p-4">
                  <p className="text-xs text-[#666] mb-2">Registros recientes</p>
                  <div className="space-y-1">
                    {todayLogs.slice(0, 8).map((log) => (
                      <div key={log.id} className="text-xs text-[#666] flex justify-between">
                        <span>{new Date(log.recorded_at).toLocaleTimeString('es-CL')}</span>
                        <span>{Math.round(log.occupancy_percentage)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'sucursales' && (
            <GymBranchesTab
              gymId={gym.id}
              gymName={gym.name}
              branches={branches}
              onRefresh={fetchAll}
              maxBranches={maxBranchesAllowed}
              canManage
              plan={subscriptionPlan}
            />
          )}

          {activeTab === 'planes' && (
            <div className="space-y-3">
              <p className="text-xs text-[#666]">Gestiona planes y promociones del gym.</p>
              {plans.map((p) => (
                <div key={p.id} className="bg-white rounded-xl border border-[#E5E5E5] p-3 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm text-[#111]">{p.name}</p>
                    <p className="text-xs text-[#666]">
                      Regular: {formatCLP(p.regular_price)} / Premium: {formatCLP(p.premium_price)}
                    </p>
                  </div>
                  <button onClick={() => deleteGymPlan(p.id)} className="p-2">
                    <Trash2 size={16} className="text-[#CC0000]" />
                  </button>
                </div>
              ))}
              <button onClick={addGymPlan} className="w-full py-2 border-2 border-dashed border-[#E5E5E5] rounded-xl text-[#666] text-sm flex items-center justify-center gap-1">
                <Plus size={16} /> Agregar plan
              </button>
              <GymPromotionsTab gymId={gym.id} promotions={promotions} onRefresh={fetchAll} />
            </div>
          )}

          {activeTab === 'descuentos' && (
            <div className="space-y-3">
              {discounts.map((discount) => (
                <div key={discount.id} className="bg-white rounded-xl border border-[#E5E5E5] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-sm text-[#111]">{discount.description}</p>
                      <p className="text-xs text-[#666]">Regular: {discount.regular_value || '—'} | Premium: {discount.premium_value || '—'}</p>
                      <p className="text-xs text-[#666]">Descuento: {discount.discount_percentage}%</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleDiscount(discount)} className={`px-2 py-1 rounded text-xs font-bold ${discount.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {discount.is_active ? 'Activo' : 'Inactivo'}
                      </button>
                      <button onClick={() => editDiscount(discount)} className="p-1.5">
                        <Pencil size={14} className="text-[#666]" />
                      </button>
                      <button onClick={() => deleteDiscount(discount.id)} className="p-1.5">
                        <Trash2 size={14} className="text-[#CC0000]" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 space-y-2">
                <p className="font-bold text-sm text-[#111]">{editingDiscountId ? 'Editar descuento' : 'Nuevo descuento'}</p>
                <input placeholder="Descripción" value={discountForm.description} onChange={(e) => setDiscountForm((p) => ({ ...p, description: e.target.value }))} className={inp} />
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="Valor regular" value={discountForm.regular_value} onChange={(e) => setDiscountForm((p) => ({ ...p, regular_value: e.target.value }))} className={inp} />
                  <input placeholder="Valor premium" value={discountForm.premium_value} onChange={(e) => setDiscountForm((p) => ({ ...p, premium_value: e.target.value }))} className={inp} />
                </div>
                <input placeholder="% descuento" type="number" value={discountForm.discount_percentage} onChange={(e) => setDiscountForm((p) => ({ ...p, discount_percentage: e.target.value }))} className={inp} />
                <div className="flex gap-2">
                  <button onClick={createOrUpdateDiscount} className="flex-1 py-2 bg-[#CC0000] text-white font-bold rounded-lg text-sm flex items-center justify-center gap-1">
                    <Check size={14} /> Guardar
                  </button>
                  <button onClick={resetDiscountForm} className="flex-1 py-2 border border-[#E5E5E5] rounded-lg text-sm flex items-center justify-center gap-1">
                    <X size={14} /> Limpiar
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'estadisticas_basicas' && (
            <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 text-sm text-[#666]">
              <p>Sucursales: {branches.length}</p>
              <p>Descuentos activos: {discounts.filter((d) => d.is_active).length}</p>
              <p>Promociones activas: {promotions.filter((p) => p.is_active).length}</p>
            </div>
          )}

          {activeTab === 'analytics_pro' && (
            <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 text-sm text-[#666]">
              Analytics Pro disponible para comparar rendimiento entre sucursales.
            </div>
          )}

          {activeTab === 'notificaciones' && (
            <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 text-sm text-[#666]">
              Centro de notificaciones del gym.
            </div>
          )}

          {activeTab === 'perfil' && (
            <div className="bg-white rounded-xl border border-[#E5E5E5] p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-[#111]">Perfil</h3>
                {!editingInfo ? (
                  <button onClick={() => setEditingInfo(true)} className="px-3 py-1.5 border border-[#111111] text-[#111111] font-bold rounded-lg text-xs">
                    Editar
                  </button>
                ) : null}
              </div>
              {editingInfo ? (
                <div className="space-y-2">
                  <input placeholder="Nombre del gym" value={infoForm.name} onChange={(e) => setInfoForm((p) => ({ ...p, name: e.target.value }))} className={inp} />
                  <input placeholder="Dirección" value={infoForm.address} onChange={(e) => setInfoForm((p) => ({ ...p, address: e.target.value }))} className={inp} />
                  <input placeholder="Comuna" value={infoForm.comuna} onChange={(e) => setInfoForm((p) => ({ ...p, comuna: e.target.value }))} className={inp} />
                  <input placeholder="Teléfono" value={infoForm.phone} onChange={(e) => setInfoForm((p) => ({ ...p, phone: e.target.value }))} className={inp} />
                  <input placeholder="Sitio web" value={infoForm.website} onChange={(e) => setInfoForm((p) => ({ ...p, website: e.target.value }))} className={inp} />
                  <textarea rows={3} placeholder="Descripción" value={infoForm.description} onChange={(e) => setInfoForm((p) => ({ ...p, description: e.target.value }))} className={`${inp} resize-none`} />
                  <div className="flex gap-2">
                    <button onClick={saveGymInfo} className="flex-1 py-2 bg-[#CC0000] text-white font-bold rounded-lg text-sm">Guardar</button>
                    <button onClick={() => setEditingInfo(false)} className="flex-1 py-2 border border-[#E5E5E5] rounded-lg text-sm">Cancelar</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm text-[#666]">{gym.name}</p>
                  <p className="text-sm text-[#666]">{gym.address || '—'}</p>
                  <p className="text-sm text-[#666]">{gym.comuna || '—'}</p>
                  <p className="text-sm text-[#666]">{gym.phone || '—'}</p>
                  <p className="text-sm text-[#666]">{gym.website || '—'}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'mi_plan' && (
            <div className="bg-white rounded-xl border border-[#E5E5E5] p-4">
              <p className="text-sm text-[#666] mb-2">Tu plan actual es {subscriptionPlan.toUpperCase()}.</p>
              <button onClick={() => navigate('/premium')} className="py-2 px-4 bg-[#CC0000] text-white font-bold rounded-lg text-sm">
                Ver / Actualizar Plan
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
