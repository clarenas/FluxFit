import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Plus, X, CheckCircle, XCircle, ChevronLeft, ChevronRight, TrendingUp, Users, Building2, Store, ShoppingBag, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatCLP } from '../lib/utils';
import { useToast } from '../hooks/useToast';
import { Toast } from '../components/Toast';

const COMUNAS = ['Ñuñoa', 'Las Condes', 'Vitacura', 'Providencia', 'La Reina', 'Peñalolén'];
const PLAN_PRICES: Record<string, number> = { basico: 59900, pro: 89900, full: 149900 };

const planBadge = (plan: string) => {
  const styles: Record<string, string> = {
    free: 'bg-[#F5F5F5] text-[#666]',
    basico: 'bg-green-100 text-green-700',
    pro: 'bg-blue-100 text-blue-700',
    full: 'bg-[#7C3AED]/10 text-[#7C3AED]',
  };
  const labels: Record<string, string> = { free: 'Free', basico: 'Básico', pro: 'Pro', full: 'Full' };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${styles[plan] ?? styles.free}`}>
      {labels[plan] ?? plan}
    </span>
  );
};

const expiryWarning = (valid_until: string | null) => {
  if (!valid_until) return null;
  const diff = (new Date(valid_until).getTime() - Date.now()) / 86400000;
  if (diff < 0) return <span className="text-xs font-bold text-[#CC0000]">Vencido</span>;
  if (diff < 7) return <span className="text-xs font-bold text-amber-500">Vence {Math.ceil(diff)}d</span>;
  return <span className="text-xs text-[#666]">{new Date(valid_until).toLocaleDateString('es-CL')}</span>;
};

const EMPTY_FORM = {
  name: '', address: '', comuna: '', phone: '', website: '',
  description: '', manager_email: '', plan: 'free', valid_days: '30',
};

interface AdminFluxFitProps { initialTab?: string; }

export function AdminFluxFitPage({ initialTab }: AdminFluxFitProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab ?? 'dashboard');
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [gyms, setGyms] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [commerces, setCommerces] = useState<any[]>([]);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [pendingGyms, setPendingGyms] = useState<any[]>([]);
  const [pendingCommerces, setPendingCommerces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGymModal, setShowGymModal] = useState(false);
  const [editingGym, setEditingGym] = useState<any>(null);
  const [gymForm, setGymForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [approvingRequest, setApprovingRequest] = useState<any>(null);
  const [approvalPlan, setApprovalPlan] = useState('basico');
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState('todos');
  const [selectedUserHistory, setSelectedUserHistory] = useState<string | null>(null);
  const [requestFilter, setRequestFilter] = useState('all');
  const [messageFilter, setMessageFilter] = useState('todos');
  const [updatingPlan, setUpdatingPlan] = useState<string | null>(null);

  const { toast, showToast } = useToast();

  const fetchAll = async () => {
    setLoading(true);
    const [gymsRes, usersRes, messagesRes, requestsRes, commercesRes, redemptionsRes] = await Promise.all([
      supabase.from('gyms').select('*, gym_subscriptions(plan,plan_price,status,valid_until), gym_branches(id), gym_admins(id)').order('name'),
      supabase.from('users').select('*').order('created_at', { ascending: false }),
      supabase.from('contact_messages').select('*').order('created_at', { ascending: false }),
      supabase.from('gym_admin_requests').select('*, users(email,full_name)').order('created_at', { ascending: false }),
      supabase.from('commerces').select('*, commerce_subscriptions(plan,status,valid_until)').order('name'),
      supabase.from('coupon_redemptions').select('*').order('redeemed_at', { ascending: false }),
    ]);

    const mappedGyms = (gymsRes.data ?? []).map((g: any) => {
      const sub = g.gym_subscriptions?.[0];
      return {
        ...g,
        plan: sub?.plan ?? 'free',
        plan_price: sub?.plan_price ?? 0,
        sub_status: sub?.status ?? null,
        valid_until: sub?.valid_until ?? null,
        branch_count: g.gym_branches?.length ?? 0,
        admin_count: g.gym_admins?.length ?? 0,
      };
    });

    setGyms(mappedGyms);
    setUsers(usersRes.data ?? []);
    setMessages(messagesRes.data ?? []);
    setRequests(requestsRes.data ?? []);
    setCommerces(commercesRes.data ?? []);
    setRedemptions(redemptionsRes.data ?? []);
    setPendingGyms(mappedGyms.filter((g: any) => g.approval_status === 'pending'));
    setPendingCommerces((commercesRes.data ?? []).filter((c: any) => c.approval_status === 'pending'));
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (user && user.role !== 'fluxfit_admin') {
      navigate('/home', { replace: true });
    }
  }, [user, navigate]);

  const approveRequest = async () => {
    if (!approvingRequest) return;
    const req = approvingRequest;
    const { data: newGym, error } = await supabase
      .from('gyms')
      .insert({ name: req.gym_name, comuna: req.comunas?.[0] ?? '', phone: req.phone, is_active: true })
      .select('id')
      .single();
    if (error) return;
    const gymId = newGym.id;
    const valid_until = new Date(Date.now() + 30 * 86400000).toISOString();
    await Promise.all([
      supabase.from('gym_admins').insert({ user_id: req.user_id, gym_id: gymId }),
      supabase.from('gym_subscriptions').insert({ gym_id: gymId, plan: approvalPlan, status: 'active', valid_until }),
      supabase.from('gym_admin_requests').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', req.id),
    ]);
    setApprovingRequest(null);
    fetchAll();
  };

  const rejectRequest = async (req: any) => {
    await supabase.from('gym_admin_requests').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', req.id);
    fetchAll();
  };

  const updateUserRole = async (userId: string, role: string) => {
    await supabase.from('users').update({ role }).eq('id', userId);
    fetchAll();
  };

  const toggleUserPremium = async (userId: string, current: boolean) => {
    await supabase.from('users').update({
      is_premium: !current,
      premium_since: !current ? new Date().toISOString() : null,
    }).eq('id', userId);
    fetchAll();
  };

  const markMessageRead = async (id: string) => {
    await supabase.from('contact_messages').update({ is_read: true }).eq('id', id);
    fetchAll();
  };

  const toggleCommerceActive = async (commerce: any) => {
    await supabase.from('commerces').update({ is_active: !commerce.is_active }).eq('id', commerce.id);
    fetchAll();
  };

  const toggleGymActive = async (gym: any) => {
    await supabase.from('gyms').update({ is_active: !gym.is_active }).eq('id', gym.id);
    fetchAll();
  };

  const PLAN_CONFIG: Record<string, { plan_price: number; max_branches: number }> = {
    free:  { plan_price: 0,      max_branches: 1 },
    light: { plan_price: 89900,  max_branches: 3 },
    pro:   { plan_price: 149900, max_branches: 8 },
  };

  const updatePartnerPlan = async (gym: any, newPlan: string) => {
    const config = PLAN_CONFIG[newPlan];
    if (!config) return;
    setUpdatingPlan(gym.id);
    try {
      const valid_until = new Date(Date.now() + 30 * 86400000).toISOString();
      // Upsert gym_subscriptions (unique on gym_id)
      const { data: existing } = await supabase
        .from('gym_subscriptions')
        .select('id')
        .eq('gym_id', gym.id)
        .maybeSingle();

      if (existing) {
        await supabase.from('gym_subscriptions').update({
          plan: newPlan,
          plan_price: config.plan_price,
          status: newPlan === 'free' ? 'inactive' : 'active',
          valid_until: newPlan === 'free' ? null : valid_until,
        }).eq('gym_id', gym.id);
      } else {
        await supabase.from('gym_subscriptions').insert({
          gym_id: gym.id,
          plan: newPlan,
          plan_price: config.plan_price,
          status: newPlan === 'free' ? 'inactive' : 'active',
          valid_until: newPlan === 'free' ? null : valid_until,
        });
      }

      // Update gyms.max_branches
      await supabase.from('gyms').update({ max_branches: config.max_branches }).eq('id', gym.id);
      fetchAll();
    } finally {
      setUpdatingPlan(null);
    }
  };

  const openNewGym = () => {
    setEditingGym(null);
    setGymForm({ ...EMPTY_FORM });
    setShowGymModal(true);
  };

  const openEditGym = (gym: any) => {
    setEditingGym(gym);
    setGymForm({
      name: gym.name ?? '',
      address: gym.address ?? '',
      comuna: gym.comuna ?? '',
      phone: gym.phone ?? '',
      website: gym.website ?? '',
      description: gym.description ?? '',
      manager_email: '',
      plan: gym.plan ?? 'free',
      valid_days: '30',
    });
    setShowGymModal(true);
  };

  const saveGym = async () => {
    setSaving(true);
    try {
      const gymPayload = {
        name: gymForm.name,
        address: gymForm.address,
        comuna: gymForm.comuna,
        phone: gymForm.phone,
        website: gymForm.website,
        description: gymForm.description,
      };

      if (editingGym) {
        await supabase.from('gyms').update(gymPayload).eq('id', editingGym.id);
        const valid_until = gymForm.plan === 'free'
          ? null
          : new Date(Date.now() + Number(gymForm.valid_days) * 86400000).toISOString();
        const { error: subErr } = await supabase
          .from('gym_subscriptions')
          .upsert(
            { gym_id: editingGym.id, plan: gymForm.plan, status: 'active', valid_until },
            { onConflict: 'gym_id' }
          );
        if (subErr) {
          alert('Error al actualizar plan: ' + subErr.message);
          return;
        }
      } else {
        const { data: newGym, error: gymErr } = await supabase
          .from('gyms')
          .insert({ ...gymPayload, is_active: true })
          .select('id')
          .single();
        if (gymErr) throw gymErr;
        const gymId = newGym.id;

        if (gymForm.plan !== 'free') {
          const valid_until = new Date(Date.now() + Number(gymForm.valid_days) * 86400000).toISOString();
          await supabase.from('gym_subscriptions').insert({ gym_id: gymId, plan: gymForm.plan, status: 'active', valid_until });
        }

        if (gymForm.manager_email) {
          const { data: managerUser } = await supabase
            .from('users')
            .select('id')
            .eq('email', gymForm.manager_email)
            .maybeSingle();
          if (managerUser) {
            await supabase.from('gym_admins').insert({ user_id: managerUser.id, gym_id: gymId });
          }
        }
      }

      setShowGymModal(false);
      await fetchAll();
      showToast(editingGym ? 'Gym actualizado correctamente' : 'Gym creado correctamente', 'success');
    } catch (err: any) {
      showToast('Error al guardar: ' + (err?.message ?? 'intenta de nuevo'), 'error');
    } finally {
      setSaving(false);
    }
  };


  // Metrics
  const activeGyms = gyms.filter(g => g.is_active).length;
  const offlineSensors = gyms.filter(g => !g.sensor_online).length;
  const expiringSoon = gyms.filter(g => {
    if (!g.valid_until) return false;
    const diff = (new Date(g.valid_until).getTime() - Date.now()) / 86400000;
    return diff >= 0 && diff < 7;
  }).length;
  const monthlyRevenue = gyms
    .filter(g => g.sub_status === 'active' && g.plan !== 'free')
    .reduce((sum, g) => sum + (PLAN_PRICES[g.plan] ?? 0), 0);
  const totalRedemptions = redemptions.length;
  const thisMonthRedemptions = redemptions.filter((r: any) => new Date(r.redeemed_at) > new Date(Date.now() - 30 * 86400000)).length;
  const premiumUsers = users.filter((u: any) => u.is_premium).length;

  const pendingCount = pendingGyms.length + pendingCommerces.length;

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'gyms', label: 'Gyms' },
    { id: 'solicitudes', label: 'Solicitudes' },
    { id: 'pendientes', label: pendingCount > 0 ? `Pendientes (${pendingCount})` : 'Pendientes' },
    { id: 'impacto', label: 'Impacto' },
    { id: 'socios', label: 'Socios' },
    { id: 'mensajes', label: 'Mensajes' },
    { id: 'comercios', label: 'Comercios' },
  ];

  const tabClass = (id: string) =>
    `flex-shrink-0 px-4 py-2.5 text-sm font-bold rounded-full transition-colors ${
      activeTab === id ? 'bg-[#CC0000] text-white' : 'bg-white text-[#666] border border-[#E5E5E5]'
    }`;

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <Toast {...toast} />
      {/* Header */}
      <div className="bg-white border-b border-[#E5E5E5] px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/profile')} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#F5F5F5] transition-colors">
          <ArrowLeft size={20} className="text-[#111111]" />
        </button>
        <h1 className="font-bold text-[#111111] text-lg flex-1">Panel Admin</h1>
        <Shield size={22} className="text-[#CC0000]" />
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-[#E5E5E5] px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
        {tabs.map(t => (
          <button key={t.id} className={tabClass(t.id)} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 max-w-[900px] mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#666]">Cargando...</div>
        ) : activeTab === 'dashboard' ? (
          <div className="space-y-4">
            {/* Month selector */}
            <div className="flex items-center justify-between bg-white rounded-2xl border border-[#E5E5E5] px-4 py-3">
              <div>
                <p className="text-xs text-[#666]">Panel Admin</p>
                <h2 className="font-bold text-[#111] text-base">Dashboard Global</h2>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSelectedMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F5F5F5] transition-colors"
                >
                  <ChevronLeft size={16} className="text-[#666]" />
                </button>
                <select
                  value={`${selectedMonth.getFullYear()}-${selectedMonth.getMonth()}`}
                  onChange={e => {
                    const [y, mo] = e.target.value.split('-').map(Number);
                    setSelectedMonth(new Date(y, mo, 1));
                  }}
                  className="px-2 py-1 rounded-lg border border-[#E5E5E5] text-xs font-bold text-[#111] focus:outline-none focus:border-[#CC0000] bg-white"
                >
                  {Array.from({ length: 12 }, (_, i) => {
                    const d = new Date(new Date().getFullYear(), new Date().getMonth() - i, 1);
                    return (
                      <option key={i} value={`${d.getFullYear()}-${d.getMonth()}`}>
                        {d.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}
                      </option>
                    );
                  })}
                </select>
                <button
                  onClick={() => setSelectedMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F5F5F5] transition-colors"
                >
                  <ChevronRight size={16} className="text-[#666]" />
                </button>
              </div>
            </div>

            {/* Revenue card */}
            <div className="bg-gradient-to-br from-[#CC0000] to-[#A00000] rounded-2xl p-5 text-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-white/70 text-xs font-medium">Ingresos del mes</p>
                  <p className="text-3xl font-bold mt-1">$12.450.000</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <TrendingUp size={13} className="text-white/80" />
                    <span className="text-sm font-bold text-white">+15%</span>
                    <span className="text-xs text-white/60">vs mes anterior</span>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center">
                  <TrendingUp size={22} className="text-white" />
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Socios Premium', value: '248', delta: '+12', color: 'text-[#CC0000]', bg: 'bg-[#CC0000]/5', icon: Users },
                { label: 'Gyms Activos', value: String(activeGyms || 35), delta: '+3', color: 'text-[#16A34A]', bg: 'bg-[#16A34A]/5', icon: Building2 },
                { label: 'Comercios Activos', value: '18', delta: '+2', color: 'text-[#0EA5E9]', bg: 'bg-[#0EA5E9]/5', icon: Store },
                { label: 'Canjes Totales', value: totalRedemptions > 0 ? (totalRedemptions >= 1000 ? `${(totalRedemptions / 1000).toFixed(1)}K` : String(totalRedemptions)) : '5.2K', delta: '+8%', color: 'text-[#8B5CF6]', bg: 'bg-[#8B5CF6]/5', icon: ShoppingBag },
              ].map(({ label, value, delta, color, bg, icon: Icon }) => (
                <div key={label} className="bg-white rounded-2xl border border-[#E5E5E5] p-4">
                  <div className="flex items-start justify-between gap-1 mb-3">
                    <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center`}>
                      <Icon size={16} className={color} />
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${bg} ${color}`}>{delta}</span>
                  </div>
                  <p className="text-2xl font-bold text-[#111]">{value}</p>
                  <p className="text-xs text-[#666] mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Alerts */}
            <div className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#F5F5F5] flex items-center gap-2">
                <AlertCircle size={15} className="text-[#CC0000]" />
                <p className="font-bold text-[#111] text-sm">Alertas</p>
              </div>
              <div className="divide-y divide-[#F5F5F5]">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full bg-[#CC0000]" />
                    <p className="text-sm text-[#111]">15 socios vencen en 7 días</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#CC0000]/10 text-[#CC0000]">Urgente</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <p className="text-sm text-[#111]">3 gyms vencen en 15 días</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Aviso</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full bg-[#16A34A]" />
                    <p className="text-sm text-[#111]">2 comercios vencen en 20 días</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#16A34A]/10 text-[#16A34A]">Info</span>
                </div>
              </div>
            </div>

            {/* Summary table */}
            <div className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#F5F5F5]">
                <p className="font-bold text-[#111] text-sm">Resumen de la red</p>
              </div>
              <div className="divide-y divide-[#F5F5F5]">
                <div className="grid grid-cols-4 px-4 py-2 text-[10px] font-bold text-[#999] uppercase tracking-wider">
                  <span>Categoría</span>
                  <span className="text-center">Total</span>
                  <span className="text-center">Activos</span>
                  <span className="text-right">Ingresos</span>
                </div>
                {[
                  { label: 'Socios', total: users.length || 456, active: users.filter((u: any) => u.is_premium).length || 420, revenue: '$1.2M', color: 'text-[#CC0000]' },
                  { label: 'Gyms', total: gyms.length || 42, active: activeGyms || 35, revenue: '$5.2M', color: 'text-[#16A34A]' },
                  { label: 'Comercios', total: commerces.length || 25, active: commerces.filter((c: any) => c.is_active).length || 18, revenue: '$890K', color: 'text-[#0EA5E9]' },
                ].map(row => (
                  <div key={row.label} className="grid grid-cols-4 px-4 py-3 items-center">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${row.color === 'text-[#CC0000]' ? 'bg-[#CC0000]' : row.color === 'text-[#16A34A]' ? 'bg-[#16A34A]' : 'bg-[#0EA5E9]'}`} />
                      <span className="text-sm font-bold text-[#111]">{row.label}</span>
                    </div>
                    <span className="text-sm text-[#666] text-center">{row.total}</span>
                    <span className={`text-sm font-bold text-center ${row.color}`}>{row.active}</span>
                    <span className="text-sm font-bold text-[#111] text-right">{row.revenue}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : activeTab === 'gyms' ? (
          <div className="space-y-4">
            {/* Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 text-center">
                <p className="text-2xl font-bold text-[#111]">{activeGyms}</p>
                <p className="text-xs text-[#666] mt-0.5">Gyms activos</p>
              </div>
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 text-center">
                <p className={`text-2xl font-bold ${offlineSensors > 0 ? 'text-[#CC0000]' : 'text-[#111]'}`}>{offlineSensors}</p>
                <p className="text-xs text-[#666] mt-0.5">Sensores offline</p>
              </div>
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 text-center">
                <p className={`text-2xl font-bold ${expiringSoon > 0 ? 'text-amber-500' : 'text-[#111]'}`}>{expiringSoon}</p>
                <p className="text-xs text-[#666] mt-0.5">Vencen en &lt;7 días</p>
              </div>
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 text-center">
                <p className="text-lg font-bold text-[#111]">${monthlyRevenue.toLocaleString('es-CL')}</p>
                <p className="text-xs text-[#666] mt-0.5">Ingresos est. mes</p>
              </div>
              <div className="bg-[#CC0000] rounded-xl p-4 text-center col-span-2">
                <p className="text-2xl font-bold text-white">{totalRedemptions}</p>
                <p className="text-xs text-white/80 mt-0.5">Ventas Generadas (canjes totales)</p>
                <p className="text-xs text-white/60 mt-0.5">{thisMonthRedemptions} este mes · {premiumUsers} usuarios Premium</p>
              </div>
            </div>

            {/* Add gym button */}
            <div className="flex justify-end">
              <button
                onClick={openNewGym}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#CC0000] text-white text-sm font-bold rounded-xl active:scale-[0.98] transition-transform"
              >
                <Plus size={16} />
                Agregar gym
              </button>
            </div>

            {/* Gym cards */}
            {gyms.length === 0 && (
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-8 text-center text-sm text-[#666]">
                No hay gyms registrados
              </div>
            )}
            {gyms.map(gym => (
              <div key={gym.id} className={`bg-white rounded-xl border border-[#E5E5E5] p-4 space-y-3 ${!gym.is_active ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-[#111]">{gym.name}</p>
                    <p className="text-xs text-[#666] mt-0.5">{gym.comuna}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {planBadge(gym.plan)}
                    <span className={`w-2 h-2 rounded-full ${gym.sensor_online ? 'bg-green-500' : 'bg-[#CC0000]'}`} />
                  </div>
                </div>

                {/* Occupancy bar */}
                <div>
                  <div className="flex justify-between text-xs text-[#666] mb-1">
                    <span>Ocupación</span>
                    <span>{gym.current_count ?? 0}/{gym.max_capacity ?? '?'}</span>
                  </div>
                  <div className="h-1.5 bg-[#F5F5F5] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#CC0000] rounded-full transition-all"
                      style={{ width: gym.max_capacity ? `${Math.min(100, ((gym.current_count ?? 0) / gym.max_capacity) * 100)}%` : '0%' }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-[#666]">
                  <span>{gym.branch_count} sucursal{gym.branch_count !== 1 ? 'es' : ''}</span>
                  <span>{gym.admin_count} admin{gym.admin_count !== 1 ? 's' : ''}</span>
                  {expiryWarning(gym.valid_until)}
                  {gym.max_branches != null && (
                    <span className="text-[#999]">máx. {gym.max_branches} suc.</span>
                  )}
                </div>

                {/* Plan upgrade selector */}
                <div className="bg-[#F5F5F5] rounded-xl p-3 space-y-2">
                  <p className="text-[10px] font-bold text-[#666] uppercase tracking-wider">Cambiar plan</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['free', 'light', 'pro'] as const).map(p => {
                      const labels: Record<string, string> = { free: 'Free', light: 'Light', pro: 'Pro' };
                      const prices: Record<string, string> = { free: '$0', light: '$89.900', pro: '$149.900' };
                      const isCurrent = gym.plan === p;
                      const isUpdating = updatingPlan === gym.id;
                      return (
                        <button
                          key={p}
                          disabled={isCurrent || isUpdating}
                          onClick={() => updatePartnerPlan(gym, p)}
                          className={`py-2 rounded-lg text-xs font-bold transition-all active:scale-[0.97] disabled:cursor-default ${
                            isCurrent
                              ? 'bg-[#CC0000] text-white'
                              : 'bg-white border border-[#E5E5E5] text-[#444] hover:border-[#CC0000] hover:text-[#CC0000] disabled:opacity-50'
                          }`}
                        >
                          <span className="block">{labels[p]}</span>
                          <span className={`block text-[9px] font-normal ${isCurrent ? 'text-white/70' : 'text-[#999]'}`}>{prices[p]}</span>
                        </button>
                      );
                    })}
                  </div>
                  {updatingPlan === gym.id && (
                    <p className="text-[10px] text-[#666] text-center">Actualizando plan...</p>
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => openEditGym(gym)}
                    className="flex-1 py-2 border border-[#E5E5E5] text-[#111] text-sm font-bold rounded-xl active:scale-[0.98] transition-transform"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => toggleGymActive(gym)}
                    className={`flex-1 py-2 text-sm font-bold rounded-xl active:scale-[0.98] transition-transform ${
                      gym.is_active
                        ? 'border border-[#CC0000] text-[#CC0000]'
                        : 'bg-[#16A34A] text-white'
                    }`}
                  >
                    {gym.is_active ? 'Desactivar' : 'Activar'}
                  </button>
                  <button
                    onClick={() => navigate(`/gym/${gym.id}`)}
                    className="flex-1 py-2 bg-[#111] text-white text-sm font-bold rounded-xl active:scale-[0.98] transition-transform"
                  >
                    Ver perfil
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === 'solicitudes' ? (
          <div className="space-y-4">
            {/* Filter chips */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {[
                { id: 'all', label: 'Todas' },
                { id: 'pending', label: 'Pendientes' },
                { id: 'approved', label: 'Aprobadas' },
                { id: 'rejected', label: 'Rechazadas' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setRequestFilter(f.id)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                    requestFilter === f.id ? 'bg-[#CC0000] text-white' : 'bg-white text-[#666] border border-[#E5E5E5]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {(() => {
              const filtered = requests.filter(r => requestFilter === 'all' || r.status === requestFilter);
              if (filtered.length === 0) return (
                <div className="bg-white rounded-xl border border-[#E5E5E5] p-8 text-center text-sm text-[#666]">
                  No hay solicitudes
                </div>
              );
              return filtered.map((req: any) => (
                <div key={req.id} className="bg-white rounded-xl border border-[#E5E5E5] p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-[#111]">{req.gym_name}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(req.comunas ?? []).map((c: string) => (
                          <span key={c} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F5F5F5] text-[#666]">{c}</span>
                        ))}
                      </div>
                    </div>
                    {req.status === 'pending' && <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">Pendiente</span>}
                    {req.status === 'approved' && <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">Aprobado</span>}
                    {req.status === 'rejected' && <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-[#CC0000]">Rechazado</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs text-[#666]">
                    <span>{req.users?.email ?? ''}</span>
                    <span>{req.phone}</span>
                    <span className="col-span-2">{new Date(req.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                  {req.status === 'pending' && (
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => { setApprovingRequest(req); setApprovalPlan('basico'); }}
                        className="flex-1 py-2 bg-[#16A34A] text-white text-sm font-bold rounded-xl active:scale-[0.98] transition-transform"
                      >
                        Aprobar
                      </button>
                      <button
                        onClick={() => rejectRequest(req)}
                        className="flex-1 py-2 border-2 border-[#CC0000] text-[#CC0000] text-sm font-bold rounded-xl active:scale-[0.98] transition-transform"
                      >
                        Rechazar
                      </button>
                    </div>
                  )}
                </div>
              ));
            })()}
          </div>

        ) : activeTab === 'socios' ? (
          <div className="space-y-4">
            {/* Search */}
            <input
              type="text"
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              placeholder="Buscar por nombre, RUT o email..."
              className="w-full px-4 py-2.5 rounded-xl border border-[#E5E5E5] bg-white text-sm text-[#111] focus:outline-none focus:border-[#CC0000]"
            />

            {/* Filter chips */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {[
                { id: 'todos', label: 'Todos' },
                { id: 'activos', label: 'Activos' },
                { id: 'inactivos', label: 'Inactivos' },
                { id: 'por_vencer', label: 'Por vencer' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setUserFilter(f.id)}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
                    userFilter === f.id ? 'bg-[#CC0000] text-white' : 'bg-white text-[#666] border border-[#E5E5E5]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {(() => {
              const now = Date.now();

              const getUserStatus = (u: any): 'activo' | 'por_vencer' | 'vencido' | 'inactivo' => {
                if (!u.is_active) return 'inactivo';
                if (u.is_premium && u.plan_valid_until) {
                  const diff = (new Date(u.plan_valid_until).getTime() - now) / 86400000;
                  if (diff < 0) return 'vencido';
                  if (diff <= 7) return 'por_vencer';
                }
                return 'activo';
              };

              const q = userSearch.toLowerCase();
              let filtered = users.filter((u: any) => {
                if (q) {
                  const matchName = u.full_name?.toLowerCase().includes(q);
                  const matchEmail = u.email?.toLowerCase().includes(q);
                  const matchRut = u.rut?.toLowerCase().includes(q);
                  if (!matchName && !matchEmail && !matchRut) return false;
                }
                if (userFilter === 'activos') return u.is_active === true;
                if (userFilter === 'inactivos') return u.is_active === false;
                if (userFilter === 'por_vencer') {
                  if (!u.is_premium || !u.plan_valid_until) return false;
                  const diff = (new Date(u.plan_valid_until).getTime() - now) / 86400000;
                  return diff >= 0 && diff <= 7;
                }
                return true;
              });

              // Stats
              const totalCount = users.length;
              const activeCount = users.filter((u: any) => u.is_active).length;
              const premiumCount = users.filter((u: any) => u.is_premium).length;
              const expiringCount = users.filter((u: any) => {
                if (!u.is_premium || !u.plan_valid_until) return false;
                const diff = (new Date(u.plan_valid_until).getTime() - now) / 86400000;
                return diff >= 0 && diff <= 7;
              }).length;

              const statusConfig = {
                activo: { dot: 'bg-[#16A34A]', text: 'text-[#16A34A]', badge: 'bg-[#16A34A]/10 text-[#16A34A]', label: 'ACTIVO' },
                por_vencer: { dot: 'bg-amber-400', text: 'text-amber-500', badge: 'bg-amber-100 text-amber-700', label: 'POR VENCER' },
                vencido: { dot: 'bg-[#CC0000]', text: 'text-[#CC0000]', badge: 'bg-[#CC0000]/10 text-[#CC0000]', label: 'VENCIDO' },
                inactivo: { dot: 'bg-[#999]', text: 'text-[#666]', badge: 'bg-[#F5F5F5] text-[#666]', label: 'INACTIVO' },
              };

              return (
                <>
                  {/* Stats grid */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'Total', value: totalCount, color: 'text-[#111]' },
                      { label: 'Activos', value: activeCount, color: 'text-[#16A34A]' },
                      { label: 'Premium', value: premiumCount, color: 'text-[#CC0000]' },
                      { label: 'Por vencer', value: expiringCount, color: 'text-amber-500' },
                    ].map(s => (
                      <div key={s.label} className="bg-white rounded-xl border border-[#E5E5E5] p-3 text-center">
                        <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-[10px] text-[#666] mt-0.5 leading-tight">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* User list */}
                  {filtered.length === 0 && (
                    <div className="bg-white rounded-xl border border-[#E5E5E5] p-8 text-center text-sm text-[#666]">
                      No se encontraron socios
                    </div>
                  )}
                  {filtered.map((u: any) => {
                    const status = getUserStatus(u);
                    const cfg = statusConfig[status];
                    const daysLeft = u.plan_valid_until
                      ? Math.ceil((new Date(u.plan_valid_until).getTime() - now) / 86400000)
                      : null;

                    return (
                      <div
                        key={u.id}
                        className={`bg-white rounded-xl border p-4 space-y-3 ${
                          status === 'inactivo' ? 'border-[#E5E5E5] opacity-60' : 'border-[#E5E5E5]'
                        }`}
                      >
                        {/* Header row */}
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#CC0000] flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-bold text-sm">
                              {(u.full_name ?? u.email ?? '?')[0].toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-[#111] text-sm">{u.full_name ?? 'Sin nombre'}</p>
                              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.badge}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                {cfg.label}
                              </span>
                            </div>
                            {u.rut && <p className="text-xs text-[#666] mt-0.5">RUT: {u.rut}</p>}
                            <p className="text-xs text-[#666] truncate">{u.email}</p>
                            <p className="text-[10px] text-[#999] mt-0.5">
                              Ingreso: {new Date(u.created_at).toLocaleDateString('es-CL')}
                            </p>
                          </div>
                        </div>

                        {/* Plan info */}
                        <div className="flex items-center justify-between bg-[#F5F5F5] rounded-lg px-3 py-2">
                          <div>
                            <p className="text-xs font-bold text-[#111]">
                              {u.is_premium ? 'Premium — $2.990/mes' : 'Free'}
                            </p>
                            {u.plan_valid_until && (
                              <p className="text-[10px] text-[#666] mt-0.5">
                                Vence: {new Date(u.plan_valid_until).toLocaleDateString('es-CL')}
                              </p>
                            )}
                          </div>
                          {daysLeft !== null && daysLeft >= 0 && daysLeft <= 7 && (
                            <span className="text-xs font-bold text-amber-500 bg-amber-100 px-2 py-0.5 rounded-full">
                              {daysLeft === 0 ? 'Vence hoy' : `${daysLeft}d restantes`}
                            </span>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => setSelectedUserHistory(selectedUserHistory === u.id ? null : u.id)}
                            className={`py-2 text-xs font-bold rounded-xl active:scale-[0.98] transition-all border ${
                              selectedUserHistory === u.id
                                ? 'bg-[#8B5CF6]/10 border-[#8B5CF6] text-[#8B5CF6]'
                                : 'border-[#E5E5E5] text-[#111]'
                            }`}
                          >
                            {selectedUserHistory === u.id ? 'Ocultar historial' : 'Ver historial'}
                          </button>
                          <button
                            onClick={() => toggleUserPremium(u.id, u.is_active)}
                            className={`py-2 text-xs font-bold rounded-xl active:scale-[0.98] transition-transform ${
                              u.is_active
                                ? 'border border-[#CC0000] text-[#CC0000]'
                                : 'bg-[#16A34A] text-white'
                            }`}
                          >
                            {u.is_active ? 'Dar de baja' : 'Dar de alta'}
                          </button>
                          <button
                            onClick={() => showToast(`Aviso enviado a ${u.email}`, 'success')}
                            className="py-2 border border-[#0EA5E9] text-[#0EA5E9] text-xs font-bold rounded-xl active:scale-[0.98] transition-transform"
                          >
                            Avisar vcto.
                          </button>
                        </div>

                        {/* History panel */}
                        {selectedUserHistory === u.id && (
                          <div className="border-2 border-[#8B5CF6]/30 rounded-lg overflow-hidden transition-all">
                            {/* Panel header */}
                            <div className="flex items-center justify-between px-4 py-3 bg-[#8B5CF6]/5 border-b border-[#8B5CF6]/15">
                              <div>
                                <p className="text-sm font-bold text-[#111]">
                                  Historial de {u.full_name?.split(' ')[0] ?? 'socio'}
                                </p>
                                <p className="text-[10px] text-[#666] mt-0.5">
                                  Cliente desde {new Date(u.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </p>
                              </div>
                              <button
                                onClick={() => setSelectedUserHistory(null)}
                                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[#8B5CF6]/10 text-[#666] transition-colors"
                              >
                                <X size={14} />
                              </button>
                            </div>

                            {/* Timeline */}
                            <div className="px-4 py-4 bg-white">
                              <div className="relative border-l-2 border-[#E5E5E5] pl-6 space-y-4">

                                {/* Event: Pago recibido */}
                                <div className="relative">
                                  <span className="absolute -left-[25px] top-1 w-3 h-3 rounded-full bg-[#8B5CF6] border-2 border-white shadow" />
                                  <div className="bg-[#F5F5F5] rounded-lg px-3 py-2.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-xs font-bold text-[#111]">Pago recibido</p>
                                      <span className="text-[10px] font-bold text-[#16A34A]">+$2.990 CLP</span>
                                    </div>
                                    <p className="text-[10px] text-[#666] mt-0.5">Plan Premium — Mes 4</p>
                                    <p className="text-[10px] text-[#999] mt-1">15/04/2026</p>
                                  </div>
                                </div>

                                {/* Event: Upgrade */}
                                <div className="relative">
                                  <span className="absolute -left-[25px] top-1 w-3 h-3 rounded-full bg-[#8B5CF6] border-2 border-white shadow" />
                                  <div className="bg-[#F5F5F5] rounded-lg px-3 py-2.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-xs font-bold text-[#111]">Upgrade a Premium</p>
                                      <span className="text-[10px] font-bold text-[#8B5CF6]">+$2.990/mes</span>
                                    </div>
                                    <p className="text-[10px] text-[#666] mt-0.5">Cambio de Free a Premium</p>
                                    <p className="text-[10px] text-[#999] mt-1">15/01/2026</p>
                                  </div>
                                </div>

                                {/* Event: Registro */}
                                <div className="relative">
                                  <span className="absolute -left-[25px] top-1 w-3 h-3 rounded-full bg-[#0EA5E9] border-2 border-white shadow" />
                                  <div className="bg-[#F5F5F5] rounded-lg px-3 py-2.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-xs font-bold text-[#111]">Registro inicial</p>
                                      <span className="text-[10px] text-[#666]">Plan Free</span>
                                    </div>
                                    <p className="text-[10px] text-[#999] mt-1">
                                      {new Date(u.created_at).toLocaleDateString('es-CL')}
                                    </p>
                                  </div>
                                </div>

                              </div>
                            </div>

                            {/* Footer summary */}
                            <div className="grid grid-cols-3 divide-x divide-[#E5E5E5] border-t border-[#E5E5E5]">
                              <div className="py-3 text-center">
                                <p className="text-base font-bold text-[#16A34A]">4</p>
                                <p className="text-[10px] text-[#666] mt-0.5">Pagos</p>
                              </div>
                              <div className="py-3 text-center">
                                <p className="text-base font-bold text-[#CC0000]">0</p>
                                <p className="text-[10px] text-[#666] mt-0.5">Atrasos</p>
                              </div>
                              <div className="py-3 text-center">
                                <p className="text-base font-bold text-[#8B5CF6]">1</p>
                                <p className="text-[10px] text-[#666] mt-0.5">Cambios</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </div>

        ) : activeTab === 'mensajes' ? (
          <div className="space-y-4">
            {/* Filter chips */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {['todos', 'Soporte', 'Comercial', 'Solicitud de plan', 'Otro'].map(f => (
                <button
                  key={f}
                  onClick={() => setMessageFilter(f)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                    messageFilter === f ? 'bg-[#CC0000] text-white' : 'bg-white text-[#666] border border-[#E5E5E5]'
                  }`}
                >
                  {f === 'todos' ? 'Todos' : f}
                </button>
              ))}
            </div>

            {(() => {
              const filtered = messages.filter((m: any) => messageFilter === 'todos' || m.type === messageFilter);
              const typeBadge = (type: string) => {
                const styles: Record<string, string> = {
                  'Soporte': 'bg-amber-100 text-amber-700',
                  'Comercial': 'bg-blue-100 text-blue-700',
                  'Solicitud de plan': 'bg-[#7C3AED]/10 text-[#7C3AED]',
                  'Otro': 'bg-[#F5F5F5] text-[#666]',
                };
                return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${styles[type] ?? styles['Otro']}`}>{type}</span>;
              };
              if (filtered.length === 0) return (
                <div className="bg-white rounded-xl border border-[#E5E5E5] p-8 text-center text-sm text-[#666]">
                  No hay mensajes
                </div>
              );
              return filtered.map((m: any) => (
                <div
                  key={m.id}
                  className={`bg-white rounded-xl border border-[#E5E5E5] p-4 space-y-2 border-l-4 ${
                    !m.is_read ? 'border-l-[#CC0000]' : 'border-l-[#E5E5E5]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-[#111] text-sm">{m.name}</p>
                      <p className="text-xs text-[#666] truncate">{m.email}</p>
                    </div>
                    {typeBadge(m.type)}
                  </div>
                  <p className="text-sm text-[#444] leading-relaxed">{m.message}</p>
                  <p className="text-xs text-[#999]">
                    {new Date(m.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                  {!m.is_read && (
                    <button
                      onClick={() => markMessageRead(m.id)}
                      className="w-full py-2 border border-[#E5E5E5] text-[#666] text-sm font-bold rounded-xl active:scale-[0.98] transition-transform"
                    >
                      Marcar leído
                    </button>
                  )}
                </div>
              ));
            })()}
          </div>

        ) : activeTab === 'pendientes' ? (
          <div className="space-y-4">
            {pendingCount === 0 && (
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-8 text-center text-sm text-[#666]">
                No hay perfiles pendientes de aprobación
              </div>
            )}
            {pendingGyms.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-bold text-[#666] uppercase tracking-wider">Gyms pendientes ({pendingGyms.length})</p>
                {pendingGyms.map((gym: any) => (
                  <div key={gym.id} className="bg-white rounded-xl border-2 border-amber-400 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-[#111]">{gym.name}</p>
                        <p className="text-xs text-[#666]">{gym.comuna}</p>
                        {gym.address && <p className="text-xs text-[#999] mt-0.5">{gym.address}</p>}
                      </div>
                      <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">Pendiente</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => { await supabase.from('gyms').update({ approval_status: 'approved', is_active: true }).eq('id', gym.id); fetchAll(); }}
                        className="flex-1 py-2 bg-[#16A34A] text-white text-sm font-bold rounded-xl flex items-center justify-center gap-1"
                      >
                        <CheckCircle size={14} /> Aprobar
                      </button>
                      <button
                        onClick={async () => { await supabase.from('gyms').update({ approval_status: 'rejected', is_active: false }).eq('id', gym.id); fetchAll(); }}
                        className="flex-1 py-2 border-2 border-[#CC0000] text-[#CC0000] text-sm font-bold rounded-xl flex items-center justify-center gap-1"
                      >
                        <XCircle size={14} /> Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {pendingCommerces.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-bold text-[#666] uppercase tracking-wider">Comercios pendientes ({pendingCommerces.length})</p>
                {pendingCommerces.map((c: any) => (
                  <div key={c.id} className="bg-white rounded-xl border-2 border-amber-400 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-[#111]">{c.name}</p>
                        <p className="text-xs text-[#666]">{c.category}</p>
                        {c.description && <p className="text-xs text-[#999] mt-0.5">{c.description}</p>}
                      </div>
                      <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">Pendiente</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => { await supabase.from('commerces').update({ approval_status: 'approved', is_active: true }).eq('id', c.id); fetchAll(); }}
                        className="flex-1 py-2 bg-[#16A34A] text-white text-sm font-bold rounded-xl flex items-center justify-center gap-1"
                      >
                        <CheckCircle size={14} /> Aprobar
                      </button>
                      <button
                        onClick={async () => { await supabase.from('commerces').update({ approval_status: 'rejected', is_active: false }).eq('id', c.id); fetchAll(); }}
                        className="flex-1 py-2 border-2 border-[#CC0000] text-[#CC0000] text-sm font-bold rounded-xl flex items-center justify-center gap-1"
                      >
                        <XCircle size={14} /> Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        ) : activeTab === 'impacto' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#CC0000] rounded-xl p-4 text-center col-span-2">
                <p className="text-3xl font-bold text-white">{totalRedemptions}</p>
                <p className="text-sm text-white/80 mt-1">Ventas Generadas</p>
                <p className="text-xs text-white/60 mt-0.5">Suma total de cupones redimidos en la red FluxFit</p>
              </div>
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 text-center">
                <p className="text-2xl font-bold text-[#111]">{thisMonthRedemptions}</p>
                <p className="text-xs text-[#666] mt-0.5">Canjes este mes</p>
              </div>
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 text-center">
                <p className="text-2xl font-bold text-[#111]">{premiumUsers}</p>
                <p className="text-xs text-[#666] mt-0.5">Usuarios Premium</p>
              </div>
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 text-center">
                <p className="text-2xl font-bold text-[#111]">{redemptions.filter((r: any) => r.gym_id).length}</p>
                <p className="text-xs text-[#666] mt-0.5">Canjes en Gyms</p>
              </div>
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 text-center">
                <p className="text-2xl font-bold text-[#111]">{redemptions.filter((r: any) => r.commerce_id).length}</p>
                <p className="text-xs text-[#666] mt-0.5">Canjes en Comercios</p>
              </div>
            </div>
            {redemptions.length > 0 && (
              <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#F5F5F5]">
                  <p className="font-bold text-sm text-[#111]">Últimos canjes registrados</p>
                </div>
                <div className="divide-y divide-[#F5F5F5]">
                  {redemptions.slice(0, 15).map((r: any) => (
                    <div key={r.id} className="px-4 py-2.5 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-[#111] font-mono">{r.coupon_code.slice(0, 28)}...</p>
                        <p className="text-[10px] text-[#999]">{new Date(r.redeemed_at).toLocaleString('es-CL')} · {r.gym_id ? 'Gym' : 'Comercio'}</p>
                      </div>
                      <span className="text-[10px] font-bold text-[#16A34A]">Canjeado</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {redemptions.length === 0 && (
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-8 text-center text-sm text-[#666]">
                Aún no hay canjes registrados en la red
              </div>
            )}
          </div>

        ) : activeTab === 'comercios' ? (
          <div className="space-y-3">
            <div className="flex justify-end mb-2">
              <button
                onClick={() => alert('Próximamente: agregar comercio desde admin')}
                className="px-4 py-2 bg-[#CC0000] text-white text-sm font-bold rounded-xl active:scale-[0.98] transition-transform">
                + Agregar comercio
              </button>
            </div>
            {(() => {
              const mappedCommerces = commerces.map((c: any) => {
                const sub = c.commerce_subscriptions?.[0];
                return { ...c, plan: sub?.plan ?? 'free', sub_status: sub?.status ?? null, valid_until: sub?.valid_until ?? null };
              });
              if (mappedCommerces.length === 0) return (
                <div className="bg-white rounded-xl border border-[#E5E5E5] p-8 text-center text-sm text-[#666]">
                  No hay comercios registrados
                </div>
              );
              return mappedCommerces.map((c: any) => (
                <div key={c.id} className={`bg-white rounded-xl border border-[#E5E5E5] p-4 space-y-3 ${!c.is_active ? 'opacity-50' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-[#111]">{c.name}</p>
                      {c.category && <p className="text-xs text-[#666] mt-0.5">{c.category}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {planBadge(c.plan)}
                      {c.is_active
                        ? <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">Activo</span>
                        : <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-[#CC0000]">Inactivo</span>
                      }
                    </div>
                  </div>
                  {c.valid_until && (
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-[#666]">Vigencia:</span>
                      {expiryWarning(c.valid_until)}
                    </div>
                  )}
                  <button
                    onClick={() => toggleCommerceActive(c)}
                    className={`w-full py-2 text-sm font-bold rounded-xl active:scale-[0.98] transition-transform ${
                      c.is_active ? 'border border-[#CC0000] text-[#CC0000]' : 'bg-[#16A34A] text-white'
                    }`}
                  >
                    {c.is_active ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              ));
            })()}
          </div>

        ) : null}

      </div>

      {/* Approval Modal */}
      {approvingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="font-bold text-[#111] text-base">Aprobar solicitud</h2>
            <p className="text-sm text-[#444]">Gym: <span className="font-bold">{approvingRequest.gym_name}</span></p>
            <div>
              <label className="text-xs text-[#666] mb-1 block">Plan de suscripción</label>
              <select
                value={approvalPlan}
                onChange={e => setApprovalPlan(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E5E5E5] bg-[#F5F5F5] text-sm text-[#111] focus:outline-none focus:border-[#16A34A]"
              >
                <option value="basico">Básico — $59.900/mes</option>
                <option value="pro">Pro — $89.900/mes</option>
                <option value="full">Full — $149.900/mes</option>
              </select>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setApprovingRequest(null)}
                className="flex-1 py-2.5 border border-[#E5E5E5] text-[#666] text-sm font-bold rounded-xl active:scale-[0.98] transition-transform"
              >
                Cancelar
              </button>
              <button
                onClick={approveRequest}
                className="flex-1 py-2.5 bg-[#16A34A] text-white text-sm font-bold rounded-xl active:scale-[0.98] transition-transform"
              >
                Confirmar aprobación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gym Modal */}
      {showGymModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-[#E5E5E5]">
              <h2 className="font-bold text-[#111] text-base">{editingGym ? 'Editar gym' : 'Agregar gym'}</h2>
              <button onClick={() => setShowGymModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F5F5F5]">
                <X size={18} className="text-[#666]" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              {[
                { label: 'Nombre *', key: 'name', placeholder: 'Nombre del gym', required: true },
                { label: 'Dirección', key: 'address', placeholder: 'Calle 123' },
                { label: 'Teléfono', key: 'phone', placeholder: '+56 9 1234 5678' },
                { label: 'Sitio web', key: 'website', placeholder: 'https://...' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="text-xs text-[#666] mb-1 block">{label}</label>
                  <input
                    type="text"
                    value={(gymForm as any)[key]}
                    onChange={e => setGymForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E5E5E5] bg-[#F5F5F5] text-sm text-[#111] focus:outline-none focus:border-[#CC0000]"
                  />
                </div>
              ))}
              <div>
                <label className="text-xs text-[#666] mb-1 block">Comuna</label>
                <select
                  value={gymForm.comuna}
                  onChange={e => setGymForm(f => ({ ...f, comuna: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E5E5E5] bg-[#F5F5F5] text-sm text-[#111] focus:outline-none focus:border-[#CC0000]"
                >
                  <option value="">Seleccionar</option>
                  {COMUNAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#666] mb-1 block">Descripción</label>
                <textarea
                  value={gymForm.description}
                  onChange={e => setGymForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Descripción del gym"
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E5E5E5] bg-[#F5F5F5] text-sm text-[#111] focus:outline-none focus:border-[#CC0000] resize-none"
                />
              </div>
              {!editingGym && (
                <div>
                  <label className="text-xs text-[#666] mb-1 block">Email responsable</label>
                  <input
                    type="email"
                    value={gymForm.manager_email}
                    onChange={e => setGymForm(f => ({ ...f, manager_email: e.target.value }))}
                    placeholder="admin@gym.com"
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E5E5E5] bg-[#F5F5F5] text-sm text-[#111] focus:outline-none focus:border-[#CC0000]"
                  />
                </div>
              )}
              <div>
                <label className="text-xs text-[#666] mb-1 block">Plan</label>
                <select
                  value={gymForm.plan}
                  onChange={e => setGymForm(f => ({ ...f, plan: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E5E5E5] bg-[#F5F5F5] text-sm text-[#111] focus:outline-none focus:border-[#CC0000]"
                >
                  <option value="free">Free</option>
                  <option value="basico">Básico</option>
                  <option value="pro">Pro</option>
                  <option value="full">Full</option>
                </select>
              </div>
              {gymForm.plan !== 'free' && (
                <div>
                  <label className="text-xs text-[#666] mb-1 block">Días de vigencia</label>
                  <input
                    type="number"
                    value={gymForm.valid_days}
                    onChange={e => setGymForm(f => ({ ...f, valid_days: e.target.value }))}
                    min="1"
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E5E5E5] bg-[#F5F5F5] text-sm text-[#111] focus:outline-none focus:border-[#CC0000]"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-3 px-6 pb-6 pt-2">
              <button
                onClick={() => setShowGymModal(false)}
                className="flex-1 py-2.5 border border-[#E5E5E5] text-[#666] text-sm font-bold rounded-xl active:scale-[0.98] transition-transform"
              >
                Cancelar
              </button>
              <button
                onClick={saveGym}
                disabled={saving || !gymForm.name}
                className="flex-1 py-2.5 bg-[#CC0000] text-white text-sm font-bold rounded-xl active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
