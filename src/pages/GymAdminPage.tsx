import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { OccupancyGauge } from '../components/OccupancyGauge';
import { GymBranchesTab } from '../components/admin/GymBranchesTab';
import { GymPromotionsTab } from '../components/admin/GymPromotionsTab';
import AdminSidebar from '../components/AdminSidebar';
import { Toast } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { formatCLP, timeAgo } from '../lib/utils';
import type { Gym, GymBranch, GymDiscount, GymPlan, GymPromotion, OccupancyLog } from '../lib/types';
import { Plus, Trash2, Pencil, Check, X, Clock } from 'lucide-react';

type GymPlanType = 'free' | 'light' | 'pro';
type BillingCycle = 'monthly' | 'yearly';
type AdminTab =
  | 'dashboard'
  | 'mi_gym'
  | 'sensor'
  | 'perfil'
  | 'mi_plan'
  | 'sucursales'
  | 'planes'
  | 'descuentos'
  | 'metricas'
  | 'estadisticas_basicas'
  | 'analytics_pro'
  | 'notificaciones';

interface Props {
  initialTab?: AdminTab;
}

const inp = 'w-full px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm focus:outline-none focus:border-[#CC0000]';
const getAnnualPrice = (monthly: number) => monthly * 10;
const gymPlanCards: Record<GymPlanType, { name: string; monthly: number; benefits: string[] }> = {
  free: {
    name: 'FREE',
    monthly: 0,
    benefits: ['1 sucursal máximo', 'Dashboard básico', 'Aforo en tiempo real', 'Perfil de gym'],
  },
  light: {
    name: 'LIGHT',
    monthly: 89900,
    benefits: ['Hasta 3 sucursales', 'Mis Descuentos', 'Planes y promociones', 'Estadísticas básicas'],
  },
  pro: {
    name: 'PRO',
    monthly: 149900,
    benefits: ['Hasta 6 sucursales', 'Analytics Pro', 'Notificaciones', 'Comparativo de rendimiento'],
  },
};

export function GymAdminPage({ initialTab }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast, showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [gym, setGym] = useState<Gym | null>(null);
  const [branches, setBranches] = useState<GymBranch[]>([]);
  const [discounts, setDiscounts] = useState<GymDiscount[]>([]);
  const [promotions, setPromotions] = useState<GymPromotion[]>([]);
  const [plans, setPlans] = useState<GymPlan[]>([]);
  const [todayLogs, setTodayLogs] = useState<OccupancyLog[]>([]);
  const [couponUsage, setCouponUsage] = useState<any[]>([]);
  const [subscription, setSubscription] = useState<{ plan: string | null; valid_until: string | null } | null>(null);
  const [subscriptionPlan, setSubscriptionPlan] = useState<GymPlanType>('free');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab ?? 'dashboard');
  const [editingInfo, setEditingInfo] = useState(false);
  const [infoForm, setInfoForm] = useState({ name: '', address: '', comuna: '', phone: '', website: '', description: '' });
  const [discountForm, setDiscountForm] = useState({
    branch_id: '',
    title: '',
    type: 'plan_gym',
    description: '',
    discount_value: '',
  });
  const [editingDiscountId, setEditingDiscountId] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const normalizePlan = (planName: string | null | undefined): GymPlanType => {
    if (!planName) return 'free';
    const normalized = planName.toLowerCase().trim();
    if (normalized === 'basico' || normalized === 'basic' || normalized === 'light') return 'light';
    if (normalized === 'pro' || normalized === 'profesional' || normalized === 'premium_gym' || normalized === 'full')
      return 'pro';
    if (normalized === 'free') return 'free';
    return 'free';
  };

  const ensureGymAdminLink = async () => {
    if (!user?.id) return null;
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
    if (!user?.id) return;
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

      const [{ data: sub }, { data: gymData }, { data: branchesData }, { data: discountsData }, { data: promotionsData }, { data: plansData }, { data: logsData }, { data: usageData }] = await Promise.all([
        supabase.from('gym_subscriptions').select('plan, valid_until').eq('gym_id', gymId).maybeSingle(),
        supabase.from('gyms').select('*').eq('id', gymId).maybeSingle(),
        supabase.from('gym_branches').select('*').eq('gym_id', gymId).order('created_at'),
        supabase.from('gym_discounts').select('*').eq('gym_id', gymId).order('id', { ascending: false }),
        supabase.from('gym_promotions').select('*').eq('gym_id', gymId).order('created_at', { ascending: false }),
        supabase.from('gym_plans').select('*').eq('gym_id', gymId).order('created_at', { ascending: false }),
        supabase.from('occupancy_logs').select('*').eq('gym_id', gymId).order('recorded_at', { ascending: false }).limit(20),
        supabase.from('coupon_usage').select('*').eq('gym_id', gymId).order('used_at', { ascending: false }).limit(100),
      ]);

      const resolvedPlan = normalizePlan((gymData as Gym | null)?.plan ?? sub?.plan);
      setSubscription(sub ? { plan: sub.plan, valid_until: sub.valid_until } : null);
      setSubscriptionPlan(resolvedPlan);
      if (gymData) {
        let resolvedBilling = ((gymData as Gym).billing_cycle ?? 'monthly') as BillingCycle;
        if (resolvedPlan === 'free' && resolvedBilling === 'yearly') {
          resolvedBilling = 'monthly';
          await supabase.from('gyms').update({ billing_cycle: 'monthly' }).eq('id', gymId);
        }
        setGym({ ...(gymData as Gym), plan: resolvedPlan, billing_cycle: resolvedBilling });
        setBillingCycle(resolvedBilling);
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
      setCouponUsage((usageData ?? []) as any[]);
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
    const rolePlan = (gym?.plan ?? subscriptionPlan) as GymPlanType;
    if (rolePlan === 'free' && ['sucursales', 'planes', 'metricas', 'estadisticas_basicas', 'analytics_pro', 'notificaciones'].includes(activeTab)) {
      setActiveTab('dashboard');
    }
    if (rolePlan === 'light' && ['analytics_pro', 'notificaciones'].includes(activeTab)) {
      setActiveTab('dashboard');
    }
  }, [activeTab, subscriptionPlan, gym?.plan]);

  const saveGymInfo = async () => {
    if (!gym?.id) return;
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
    setDiscountForm({ branch_id: '', title: '', type: 'plan_gym', description: '', discount_value: '' });
    setEditingDiscountId(null);
  };

  const createOrUpdateDiscount = async () => {
    if (!gym?.id || !discountForm.title.trim()) return;
    const resolvedDiscountValue = parseInt(discountForm.discount_value || '0', 10);
    const couponCode = `GF-${Date.now().toString(36).toUpperCase()}`;
    const existing = editingDiscountId ? discounts.find((d) => d.id === editingDiscountId) : null;
    const keepActive = existing ? (existing.active ?? existing.is_active) : true;
    const keepCoupon = existing?.coupon_code?.trim() || couponCode;
    const payload = {
      gym_id: gym.id,
      branch_id: discountForm.branch_id || null,
      title: discountForm.title,
      type: discountForm.type,
      description: discountForm.description,
      discount_value: resolvedDiscountValue,
      active: keepActive,
      regular_value: `${resolvedDiscountValue}%`,
      premium_value: `${resolvedDiscountValue}%`,
      discount_percentage: resolvedDiscountValue,
      is_active: keepActive,
      coupon_code: editingDiscountId ? keepCoupon : couponCode,
      qr_payload: editingDiscountId ? (existing?.qr_payload ?? `qr://${gym.id}/${keepCoupon}`) : `qr://${gym.id}/${couponCode}`,
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
      branch_id: discount.branch_id ?? '',
      title: discount.title ?? '',
      type: discount.type ?? 'plan_gym',
      description: discount.description ?? '',
      discount_value: String(discount.discount_value ?? discount.discount_percentage ?? 0),
    });
  };

  const toggleDiscount = async (discount: GymDiscount) => {
    const nextActive = !(discount.active ?? discount.is_active);
    await supabase.from('gym_discounts').update({ is_active: nextActive, active: nextActive }).eq('id', discount.id);
    await fetchAll();
  };

  const deleteDiscount = async (id: string) => {
    if (!confirm('¿Eliminar descuento?')) return;
    await supabase.from('gym_discounts').delete().eq('id', id);
    await fetchAll();
  };

  const addGymPlan = async () => {
    if (!gym?.id) return;
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

  const changePlan = async (newPlan: string) => {
    if (!gym?.id) return;
    if (isPending) {
      showToast('No puedes cambiar de plan con el perfil pendiente de aprobación.', 'error');
      return;
    }

    const normalized = normalizePlan(newPlan);
    const planPrices: Record<GymPlanType, number> = {
      free: 0,
      light: 89900,
      pro: 149900,
    };
    const planPrice = planPrices[normalized] ?? 0;
    const validUntil =
      normalized === 'free' ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { error: subError } = await supabase.from('gym_subscriptions').upsert(
      {
        gym_id: gym.id,
        plan: normalized,
        plan_price: planPrice,
        status: 'active',
        valid_until: validUntil,
      },
      { onConflict: 'gym_id' }
    );

    if (subError) {
      console.error('Error updating subscription:', subError);
      showToast('Error al cambiar plan. Intenta de nuevo.', 'error');
      return;
    }

    const { error: gymError } = await supabase.from('gyms').update({ plan: normalized }).eq('id', gym.id);

    if (gymError) {
      console.error('Error updating gym:', gymError);
      showToast('Error al actualizar gym. Intenta de nuevo.', 'error');
      return;
    }

    console.log('Plan changed successfully:', {
      newPlan: normalized,
      gymId: gym.id,
      planPrice,
      validUntil,
    });

    setSubscription({ plan: normalized, valid_until: validUntil });
    setGym((prev) => (prev ? { ...prev, plan: normalized } : prev));
    setSubscriptionPlan(normalized);

    showToast(`Plan cambiado exitosamente a ${normalized.toUpperCase()}`, 'success');
    await fetchAll();
  };

  const confirmPlanChange = (newPlan: string) => {
    if (!gym) return;

    if (isPending) {
      alert(
        'No puedes cambiar de plan mientras tu perfil esté pendiente de aprobación por FluxFit.\n\nEspera a que tu gym sea aprobado primero.'
      );
      return;
    }

    const planNames: Record<string, string> = {
      free: 'FREE (Gratis)',
      light: 'LIGHT ($89.900/mes)',
      pro: 'PRO ($149.900/mes)',
    };

    const currentKey = normalizePlan(subscription?.plan ?? gym.plan ?? 'free');
    const newKey = normalizePlan(newPlan);

    const currentName = planNames[currentKey] || currentKey;
    const newName = planNames[newKey] || newKey;

    const confirmed = window.confirm(
      `¿Confirmas cambiar de plan?\n\nActual: ${currentName}\nNuevo: ${newName}\n\nEsta acción actualizará tu suscripción inmediatamente.`
    );

    if (!confirmed) return;

    void changePlan(newKey);
  };

  const handleChangePlan = async (planId: GymPlanType, billing: BillingCycle) => {
    if (!gym?.id) return;
    if (isPending) {
      showToast('No puedes cambiar de plan con el perfil pendiente de aprobación.', 'error');
      return;
    }
    const currentPlan = (gym?.plan ?? subscriptionPlan) as GymPlanType;
    const effectiveBilling = planId === 'free' ? 'monthly' : billing;
    if (currentPlan === planId && billingCycle === effectiveBilling) return;

    await supabase
      .from('gyms')
      .update({
        plan: planId,
        billing_cycle: effectiveBilling,
      })
      .eq('id', gym.id);

    await supabase
      .from('gym_subscriptions')
      .upsert(
        {
          gym_id: gym.id,
          plan: planId,
          plan_price: gymPlanCards[planId].monthly,
          status: 'active',
          valid_until: null,
        },
        { onConflict: 'gym_id' }
      );

    setGym((prev) => (prev ? { ...prev, plan: planId, billing_cycle: effectiveBilling } : prev));
    setSubscriptionPlan(planId);
    setBillingCycle(effectiveBilling);
  };

  const persistBillingCycle = async (next: BillingCycle) => {
    const rolePlan = (gym?.plan ?? subscriptionPlan) as GymPlanType;
    if (rolePlan === 'free') return;
    setBillingCycle(next);
    if (!gym?.id) return;
    await supabase.from('gyms').update({ billing_cycle: next }).eq('id', gym.id);
    setGym((prev) => (prev ? { ...prev, billing_cycle: next } : prev));
  };

  const handleSidebarTab = (tab: string) => {
    const t = tab as AdminTab;
    setActiveTab(t);
    if (t === 'descuentos') navigate('/gym-admin/discounts');
    else if (t === 'mi_plan') navigate('/gym-admin/plan');
    else navigate('/gym-admin');
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

  const plan = normalizePlan(subscription?.plan ?? gym?.plan ?? 'free');
  const canEditInfo = ['light', 'pro'].includes(plan);
  const canManagePlans = ['light', 'pro'].includes(plan);
  const canManageServices = ['light', 'pro'].includes(plan);
  const canManageDiscounts = ['light', 'pro'].includes(plan);
  const canManageHours = ['light', 'pro'].includes(plan);
  const canManageBranches = ['light', 'pro'].includes(plan);
  const canSeePromotions = ['light', 'pro'].includes(plan);
  const canValidateQr = ['light', 'pro'].includes(plan);
  const maxBranchesCap = plan === 'free' ? 1 : plan === 'light' ? 3 : 6;

  void canManageServices;
  void canManageHours;

  const navItems =
    plan === 'free'
      ? [
          { id: 'dashboard', label: 'Dashboard', icon: '📊' },
          { id: 'mi_gym', label: 'Mi Gym', icon: '🏢' },
          { id: 'descuentos', label: 'Mis Descuentos', icon: '🏷️' },
          { id: 'mi_plan', label: 'Actualizar Plan', icon: '💳' },
          { id: 'sensor', label: 'Aforo en Tiempo Real', icon: '📡' },
          { id: 'perfil', label: 'Perfil', icon: '👤' },
        ]
      : plan === 'light'
      ? [
          { id: 'dashboard', label: 'Dashboard', icon: '📊' },
          { id: 'sucursales', label: 'Mis Sucursales', icon: '🏢' },
          { id: 'planes', label: 'Planes y Promociones', icon: '⭐' },
          { id: 'descuentos', label: 'Mis Descuentos', icon: '🏷️' },
          { id: 'metricas', label: 'Métricas', icon: '📌' },
          { id: 'estadisticas_basicas', label: 'Estadísticas Básicas', icon: '📈' },
          { id: 'mi_plan', label: 'Actualizar Plan', icon: '💳' },
          { id: 'perfil', label: 'Perfil', icon: '👤' },
        ]
      : [
          { id: 'dashboard', label: 'Dashboard', icon: '📊' },
          { id: 'sucursales', label: 'Mis Sucursales', icon: '🏢' },
          { id: 'planes', label: 'Planes y Promociones', icon: '⭐' },
          { id: 'descuentos', label: 'Mis Descuentos', icon: '🏷️' },
          { id: 'metricas', label: 'Métricas', icon: '📌' },
          { id: 'analytics_pro', label: 'Analytics Pro', icon: '📈' },
          { id: 'notificaciones', label: 'Notificaciones', icon: '🔔' },
          { id: 'mi_plan', label: 'Actualizar Plan', icon: '💳' },
          { id: 'perfil', label: 'Perfil', icon: '👤' },
        ];

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar
        navItems={navItems}
        activeTab={activeTab}
        onTabChange={(tab) => handleSidebarTab(tab)}
        logo="FLUXFIT"
        title="Panel Gym"
      />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[900px] mx-auto w-full px-4 py-4 space-y-4">
          <div className="bg-[#CC0000] px-4 pt-8 pb-4">
            <p className="text-white/60 text-xs">FluxFit Admin</p>
            <h1 className="text-white font-bold text-lg">{gym.name}</h1>
            <p className="text-white/60 text-xs mt-1">Plan actual: {plan.toUpperCase()}</p>
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
                  <p className="text-2xl font-bold text-[#111]">{discounts.filter((d) => d.active ?? d.is_active).length}</p>
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
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-bold text-sm text-[#111]">Planes Gym</p>
                  {plan !== 'free' && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => persistBillingCycle('monthly')}
                        className={`px-3 py-1 rounded text-xs font-bold ${billingCycle === 'monthly' ? 'bg-[#111] text-white' : 'bg-[#F5F5F5] text-[#666]'}`}
                      >
                        Mensual
                      </button>
                      <button
                        type="button"
                        onClick={() => persistBillingCycle('yearly')}
                        className={`px-3 py-1 rounded text-xs font-bold ${billingCycle === 'yearly' ? 'bg-[#111] text-white' : 'bg-[#F5F5F5] text-[#666]'}`}
                      >
                        Anual
                      </button>
                    </div>
                  )}
                </div>
                <div className="grid md:grid-cols-3 gap-3">
                  {(['free', 'light', 'pro'] as GymPlanType[]).map((planId) => {
                    const card = gymPlanCards[planId];
                    const isCurrent = plan === planId;
                    const useYearly = plan !== 'free' && billingCycle === 'yearly';
                    const price = useYearly ? getAnnualPrice(card.monthly) : card.monthly;
                    return (
                      <div key={planId} className={`rounded-xl border p-4 ${isCurrent ? 'border-[#CC0000]' : 'border-[#E5E5E5]'}`}>
                        <p className="font-bold text-sm text-[#111]">{card.name}</p>
                        {planId === 'free' ? (
                          <>
                            <p className="text-[#CC0000] font-bold text-lg mt-1">{formatCLP(card.monthly)}</p>
                            <p className="text-xs text-[#666]">mensual</p>
                          </>
                        ) : (
                          <>
                            <p className="text-[#CC0000] font-bold text-lg mt-1">{formatCLP(price)}</p>
                            <p className="text-xs text-[#666]">{useYearly ? 'anual (10 meses)' : 'mensual'}</p>
                            {useYearly && <p className="text-[11px] text-[#16A34A] font-bold mt-1">Ahorra 2 meses</p>}
                          </>
                        )}
                        <ul className="mt-2 space-y-1">
                          {card.benefits.map((benefit) => (
                            <li key={benefit} className="text-xs text-[#666]">• {benefit}</li>
                          ))}
                        </ul>
                        <button
                          disabled={
                            isCurrent &&
                            (planId === 'free' || billingCycle === (gym?.billing_cycle ?? 'monthly'))
                          }
                          onClick={() => handleChangePlan(planId, billingCycle)}
                          className={`mt-3 w-full py-2 rounded-lg text-sm font-bold ${
                            isCurrent &&
                            (planId === 'free' || billingCycle === (gym?.billing_cycle ?? 'monthly'))
                              ? 'bg-[#F5F5F5] text-[#999]'
                              : 'bg-[#CC0000] text-white'
                          }`}
                        >
                          {isCurrent &&
                          (planId === 'free' || billingCycle === (gym?.billing_cycle ?? 'monthly'))
                            ? 'Plan actual'
                            : 'Cambiar Plan'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'mi_gym' && (
            <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 space-y-3">
              <h3 className="font-bold text-[#111] text-sm">Mi Gym</h3>
              <div>
                <p className="text-[10px] font-bold text-[#999] uppercase tracking-wider">Cadena</p>
                <p className="text-sm text-[#111] font-medium">{gym.name}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#999] uppercase tracking-wider mb-1">Sucursales</p>
                {branches.length === 0 ? (
                  <p className="text-xs text-[#999]">Sin sucursales registradas.</p>
                ) : (
                  <ul className="space-y-2">
                    {branches.map((b) => (
                      <li key={b.id} className="text-sm text-[#666] border-b border-[#F5F5F5] pb-2 last:border-0 last:pb-0">
                        <span className="font-medium text-[#111]">{b.name}</span>
                        {b.address ? <span className="block text-xs text-[#999] mt-0.5">{b.address}</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="text-xs text-[#999]">Dirección sede principal: {gym.address || '—'}</p>
              {canManageBranches && branches.length < maxBranchesCap ? (
                <button
                  type="button"
                  onClick={async () => {
                    const name = typeof window !== 'undefined' ? window.prompt('Nombre de la sucursal') : null;
                    if (!name?.trim() || !gym?.id) return;
                    await supabase.from('gym_branches').insert({ gym_id: gym.id, name: name.trim() });
                    await fetchAll();
                  }}
                  className="w-full py-2 border-2 border-dashed border-[#E5E5E5] rounded-xl text-[#666] text-sm flex items-center justify-center gap-1"
                >
                  <Plus size={16} /> Agregar sucursal
                </button>
              ) : canManageBranches ? (
                <p className="text-xs text-[#999] text-center">Límite de sucursales alcanzado ({maxBranchesCap}).</p>
              ) : (
                <p className="text-xs text-[#999] text-center">Actualiza a Light o Pro para gestionar sucursales.</p>
              )}
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
              maxBranches={maxBranchesCap}
              canManage={canManageBranches}
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
                  {canManagePlans ? (
                    <button type="button" onClick={() => deleteGymPlan(p.id)} className="p-2">
                      <Trash2 size={16} className="text-[#CC0000]" />
                    </button>
                  ) : null}
                </div>
              ))}
              {canManagePlans ? (
                <button type="button" onClick={addGymPlan} className="w-full py-2 border-2 border-dashed border-[#E5E5E5] rounded-xl text-[#666] text-sm flex items-center justify-center gap-1">
                  <Plus size={16} /> Agregar plan
                </button>
              ) : (
                <p className="text-xs text-[#999] text-center py-2">Plan Light o Pro requerido para editar planes internos.</p>
              )}
              {canSeePromotions ? (
                <GymPromotionsTab gymId={gym.id} promotions={promotions} onRefresh={fetchAll} />
              ) : (
                <p className="text-xs text-[#999]">Las promociones avanzadas están disponibles en el plan Pro.</p>
              )}
            </div>
          )}

          {activeTab === 'descuentos' && (
            <div className="space-y-3">
              {!canManageDiscounts && (
                <p className="text-xs text-[#666] bg-amber-50 border border-amber-100 rounded-lg p-3">
                  Tu plan actual no incluye creación de descuentos. Actualiza a Light o Pro para gestionarlos.
                </p>
              )}
              {discounts.map((discount) => (
                <div key={discount.id} className="bg-white rounded-xl border border-[#E5E5E5] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-sm text-[#111]">{discount.title || discount.description}</p>
                      <p className="text-xs text-[#666]">Tipo: {discount.type || 'plan_gym'}</p>
                      <p className="text-xs text-[#666]">{discount.description}</p>
                      <p className="text-xs text-[#666]">Descuento: {discount.discount_value ?? discount.discount_percentage}%</p>
                      <p className="text-xs text-[#999]">Código: {discount.coupon_code || 'Pendiente'}</p>
                      {canValidateQr ? (
                        <p className="text-xs text-[#999]">QR: {discount.qr_payload || 'qr://pendiente'}</p>
                      ) : null}
                    </div>
                    {canManageDiscounts ? (
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => toggleDiscount(discount)} className={`px-2 py-1 rounded text-xs font-bold ${(discount.active ?? discount.is_active) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {(discount.active ?? discount.is_active) ? 'Activo' : 'Inactivo'}
                        </button>
                        <button type="button" onClick={() => editDiscount(discount)} className="p-1.5">
                          <Pencil size={14} className="text-[#666]" />
                        </button>
                        <button type="button" onClick={() => deleteDiscount(discount.id)} className="p-1.5">
                          <Trash2 size={14} className="text-[#CC0000]" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}

              {canManageDiscounts ? (
                <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 space-y-2">
                  <p className="font-bold text-sm text-[#111]">{editingDiscountId ? 'Editar descuento' : 'Nuevo descuento'}</p>
                  <select value={discountForm.branch_id} onChange={(e) => setDiscountForm((p) => ({ ...p, branch_id: e.target.value }))} className={inp}>
                    <option value="">Sucursal principal</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                  <input placeholder="Título promoción" value={discountForm.title} onChange={(e) => setDiscountForm((p) => ({ ...p, title: e.target.value }))} className={inp} />
                  <select value={discountForm.type} onChange={(e) => setDiscountForm((p) => ({ ...p, type: e.target.value }))} className={inp}>
                    <option value="plan_gym">Plan gym</option>
                    <option value="nutricion">Nutrición</option>
                    <option value="evaluacion_corporal">Evaluación corporal</option>
                    <option value="personal_training">Personal training</option>
                  </select>
                  <input placeholder="Descripción" value={discountForm.description} onChange={(e) => setDiscountForm((p) => ({ ...p, description: e.target.value }))} className={inp} />
                  <input placeholder="% descuento" type="number" value={discountForm.discount_value} onChange={(e) => setDiscountForm((p) => ({ ...p, discount_value: e.target.value }))} className={inp} />
                  <div className="flex gap-2">
                    <button type="button" onClick={createOrUpdateDiscount} className="flex-1 py-2 bg-[#CC0000] text-white font-bold rounded-lg text-sm flex items-center justify-center gap-1">
                      <Check size={14} /> Guardar
                    </button>
                    <button type="button" onClick={resetDiscountForm} className="flex-1 py-2 border border-[#E5E5E5] rounded-lg text-sm flex items-center justify-center gap-1">
                      <X size={14} /> Limpiar
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {activeTab === 'metricas' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 text-center">
                  <p className="text-2xl font-bold text-[#111]">{couponUsage.length}</p>
                  <p className="text-xs text-[#666] mt-1">Cupones usados</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 text-center">
                  <p className="text-2xl font-bold text-[#111]">{new Set(couponUsage.map((row) => row.branch_id).filter(Boolean)).size}</p>
                  <p className="text-xs text-[#666] mt-1">Sucursales con uso</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 text-center">
                  <p className="text-2xl font-bold text-[#111]">{new Set(couponUsage.map((row) => row.type).filter(Boolean)).size}</p>
                  <p className="text-xs text-[#666] mt-1">Tipos de canje</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 text-center">
                  <p className="text-2xl font-bold text-[#111]">{formatCLP(couponUsage.reduce((acc, row) => acc + Number(row.amount || 0), 0))}</p>
                  <p className="text-xs text-[#666] mt-1">Monto descuentos</p>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 space-y-2">
                {couponUsage.slice(0, 20).map((row) => (
                  <div key={row.id} className="text-xs text-[#666] flex items-center justify-between border-b border-[#F5F5F5] pb-1">
                    <span>{row.type || 'tipo'}</span>
                    <span>{row.branch_id ? `Sucursal ${row.branch_id.slice(0, 6)}` : 'Principal'}</span>
                    <span>{formatCLP(Number(row.amount || 0))}</span>
                  </div>
                ))}
                {couponUsage.length === 0 && <p className="text-xs text-[#999]">Sin uso de cupones todavía.</p>}
              </div>
            </div>
          )}

          {activeTab === 'estadisticas_basicas' && (
            <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 text-sm text-[#666]">
              <p>Sucursales: {branches.length}</p>
              <p>Descuentos activos: {discounts.filter((d) => d.active ?? d.is_active).length}</p>
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
                {canEditInfo && !editingInfo ? (
                  <button type="button" onClick={() => setEditingInfo(true)} className="px-3 py-1.5 border border-[#111111] text-[#111111] font-bold rounded-lg text-xs">
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
            <div className="space-y-4">
              {isPending && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock size={16} className="text-amber-600" />
                    <p className="font-bold text-sm text-amber-900">Perfil pendiente de aprobación</p>
                  </div>
                  <p className="text-xs text-amber-800">
                    No puedes cambiar de plan hasta que FluxFit apruebe tu perfil. Esto sucede dentro de 24-48 horas hábiles.
                  </p>
                </div>
              )}
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-4">
                <h3 className="font-bold text-[#111] mb-3">Plan Actual</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold text-[#CC0000] uppercase">{plan}</p>
                    <p className="text-xs text-[#666]">
                      {plan === 'free' && 'Plan gratuito - 1 sucursal'}
                      {plan === 'light' && '$89.900/mes - 3 sucursales'}
                      {plan === 'pro' && '$149.900/mes - 6 sucursales'}
                    </p>
                  </div>
                  {subscription?.valid_until && (
                    <p className="text-xs text-[#666]">
                      Válido hasta: {new Date(subscription.valid_until).toLocaleDateString('es-CL')}
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#F5F5F5]">
                  <h3 className="font-bold text-[#111]">Planes Disponibles</h3>
                </div>
                <div className="p-4 space-y-3">
                  <div className={`border rounded-lg p-3 ${plan === 'free' ? 'border-[#CC0000] bg-[#CC0000]/5' : 'border-[#E5E5E5]'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-sm">FREE</h4>
                      <span className="text-xs text-[#666]">Gratis</span>
                    </div>
                    <ul className="text-xs text-[#666] space-y-1 mb-2">
                      <li>✓ 1 sucursal</li>
                      <li>✓ Ver ocupación tiempo real</li>
                      <li>✗ Sin descuentos</li>
                      <li>✗ Sin promociones</li>
                    </ul>
                    {plan !== 'free' && (
                      <button
                        type="button"
                        onClick={() => confirmPlanChange('free')}
                        className="w-full py-1.5 text-xs font-bold border border-[#E5E5E5] rounded-lg hover:bg-[#F5F5F5]"
                      >
                        Cambiar a FREE
                      </button>
                    )}
                    {plan === 'free' && (
                      <div className="bg-[#CC0000]/10 text-[#CC0000] text-xs font-bold py-1 px-2 rounded text-center">
                        Plan actual
                      </div>
                    )}
                  </div>

                  <div className={`border rounded-lg p-3 ${plan === 'light' ? 'border-[#CC0000] bg-[#CC0000]/5' : 'border-[#E5E5E5]'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-sm">LIGHT</h4>
                      <span className="text-xs text-[#666]">$89.900/mes</span>
                    </div>
                    <ul className="text-xs text-[#666] space-y-1 mb-2">
                      <li>✓ 3 sucursales</li>
                      <li>✓ Crear descuentos</li>
                      <li>✓ Crear promociones</li>
                      <li>✓ Estadísticas básicas</li>
                    </ul>
                    {plan !== 'light' && (
                      <button
                        type="button"
                        onClick={() => confirmPlanChange('light')}
                        className="w-full py-1.5 text-xs font-bold bg-[#CC0000] text-white rounded-lg hover:bg-[#990000]"
                      >
                        Cambiar a LIGHT
                      </button>
                    )}
                    {plan === 'light' && (
                      <div className="bg-[#CC0000]/10 text-[#CC0000] text-xs font-bold py-1 px-2 rounded text-center">
                        Plan actual
                      </div>
                    )}
                  </div>

                  <div className={`border rounded-lg p-3 ${plan === 'pro' ? 'border-[#CC0000] bg-[#CC0000]/5' : 'border-[#E5E5E5]'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-sm">PRO</h4>
                      <span className="text-xs text-[#666]">$149.900/mes</span>
                    </div>
                    <ul className="text-xs text-[#666] space-y-1 mb-2">
                      <li>✓ 6 sucursales</li>
                      <li>✓ Todo de LIGHT +</li>
                      <li>✓ Analytics avanzados</li>
                      <li>✓ Notificaciones push</li>
                      <li>✓ Exportar reportes</li>
                    </ul>
                    {plan !== 'pro' && (
                      <button
                        type="button"
                        onClick={() => confirmPlanChange('pro')}
                        className="w-full py-1.5 text-xs font-bold bg-[#CC0000] text-white rounded-lg hover:bg-[#990000]"
                      >
                        Cambiar a PRO
                      </button>
                    )}
                    {plan === 'pro' && (
                      <div className="bg-[#CC0000]/10 text-[#CC0000] text-xs font-bold py-1 px-2 rounded text-center">
                        Plan actual
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      <Toast {...toast} />
    </div>
  );
}
