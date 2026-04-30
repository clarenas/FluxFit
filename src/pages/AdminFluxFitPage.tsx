import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Plus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

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

export function AdminFluxFitPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('gyms');
  const [gyms, setGyms] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [commerces, setCommerces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGymModal, setShowGymModal] = useState(false);
  const [editingGym, setEditingGym] = useState<any>(null);
  const [gymForm, setGymForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [approvingRequest, setApprovingRequest] = useState<any>(null);
  const [approvalPlan, setApprovalPlan] = useState('basico');
  const [userSearch, setUserSearch] = useState('');
  const [requestFilter, setRequestFilter] = useState('all');

  const fetchAll = async () => {
    setLoading(true);
    const [gymsRes, usersRes, messagesRes, requestsRes, commercesRes] = await Promise.all([
      supabase.from('gyms').select('*, gym_subscriptions(plan,status,valid_until), gym_branches(id), gym_admins(id)').order('name'),
      supabase.from('users').select('*').order('created_at', { ascending: false }),
      supabase.from('contact_messages').select('*').order('created_at', { ascending: false }),
      supabase.from('gym_admin_requests').select('*, users(email,full_name)').order('created_at', { ascending: false }),
      supabase.from('commerces').select('*, commerce_subscriptions(plan,status,valid_until)').order('name'),
    ]);

    const mappedGyms = (gymsRes.data ?? []).map((g: any) => {
      const sub = g.gym_subscriptions?.[0];
      return {
        ...g,
        plan: sub?.plan ?? 'free',
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
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

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

  const toggleGymActive = async (gym: any) => {
    await supabase.from('gyms').update({ is_active: !gym.is_active }).eq('id', gym.id);
    fetchAll();
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
        if (gymForm.plan !== 'free') {
          const valid_until = new Date(Date.now() + Number(gymForm.valid_days) * 86400000).toISOString();
          await supabase.from('gym_subscriptions').upsert(
            { gym_id: editingGym.id, plan: gymForm.plan, status: 'active', valid_until },
            { onConflict: 'gym_id' }
          );
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

  const tabs = [
    { id: 'gyms', label: 'Gyms' },
    { id: 'solicitudes', label: 'Solicitudes' },
    { id: 'usuarios', label: 'Usuarios' },
    { id: 'mensajes', label: 'Mensajes' },
    { id: 'comercios', label: 'Comercios' },
  ];

  const tabClass = (id: string) =>
    `flex-shrink-0 px-4 py-2.5 text-sm font-bold rounded-full transition-colors ${
      activeTab === id ? 'bg-[#CC0000] text-white' : 'bg-white text-[#666] border border-[#E5E5E5]'
    }`;

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
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
                    <span>{gym.current_occupancy ?? 0}/{gym.max_capacity ?? '?'}</span>
                  </div>
                  <div className="h-1.5 bg-[#F5F5F5] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#CC0000] rounded-full transition-all"
                      style={{ width: gym.max_capacity ? `${Math.min(100, ((gym.current_occupancy ?? 0) / gym.max_capacity) * 100)}%` : '0%' }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-[#666]">
                  <span>{gym.branch_count} sucursal{gym.branch_count !== 1 ? 'es' : ''}</span>
                  <span>{gym.admin_count} admin{gym.admin_count !== 1 ? 's' : ''}</span>
                  {expiryWarning(gym.valid_until)}
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

        ) : activeTab === 'usuarios' ? (
          <div className="space-y-4">
            <input
              type="text"
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              placeholder="Buscar por nombre o email..."
              className="w-full px-4 py-2.5 rounded-xl border border-[#E5E5E5] bg-white text-sm text-[#111] focus:outline-none focus:border-[#CC0000]"
            />
            {(() => {
              const q = userSearch.toLowerCase();
              const filtered = users.filter((u: any) =>
                !q || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
              );
              if (filtered.length === 0) return (
                <div className="bg-white rounded-xl border border-[#E5E5E5] p-8 text-center text-sm text-[#666]">
                  No hay usuarios
                </div>
              );
              return filtered.map((u: any) => (
                <div key={u.id} className="bg-white rounded-xl border border-[#E5E5E5] p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#CC0000] flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-sm">
                        {(u.full_name ?? u.email ?? '?')[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-[#111] text-sm">{u.full_name ?? 'Sin nombre'}</p>
                        {u.role === 'gym_admin' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">Gym Admin</span>}
                        {u.role === 'fluxfit_admin' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-[#CC0000]">FluxFit Admin</span>}
                      </div>
                      <p className="text-xs text-[#666] mt-0.5 truncate">{u.email}</p>
                      <p className="text-xs text-[#999] mt-0.5">{new Date(u.created_at).toLocaleDateString('es-CL')}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex-1">
                      <label className="text-[10px] text-[#666] mb-1 block">Rol</label>
                      <select
                        value={u.role ?? 'user'}
                        onChange={e => updateUserRole(u.id, e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-[#E5E5E5] bg-[#F5F5F5] text-xs text-[#111] focus:outline-none focus:border-[#CC0000]"
                      >
                        <option value="user">user</option>
                        <option value="gym_admin">gym_admin</option>
                        <option value="fluxfit_admin">fluxfit_admin</option>
                      </select>
                    </div>
                    <div className="flex-shrink-0">
                      <label className="text-[10px] text-[#666] mb-1 block">Premium</label>
                      <button
                        onClick={() => toggleUserPremium(u.id, u.is_premium)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          u.is_premium ? 'bg-[#CC0000]' : 'bg-[#E5E5E5]'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          u.is_premium ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                  </div>
                </div>
              ));
            })()}
          </div>

        ) : (
          <div className="bg-white rounded-xl border border-[#E5E5E5] p-8 text-center text-sm text-[#666]">
            Próximamente
          </div>
        )}
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
