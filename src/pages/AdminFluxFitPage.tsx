import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, CheckCircle, XCircle, Mail, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface GymRequest {
  id: string;
  user_id: string;
  gym_name: string;
  comunas: string[];
  phone: string;
  plan_interest: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  user_email?: string;
}

interface ContactMessage {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  type: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

type Tab = 'requests' | 'messages';

export function AdminFluxFitPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('requests');
  const [requests, setRequests] = useState<GymRequest[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    const { data } = await supabase
      .from('gym_admin_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (!data) return;

    const userIds = [...new Set(data.map(r => r.user_id))];
    const { data: usersData } = await supabase
      .from('users')
      .select('id, email')
      .in('id', userIds);

    const emailMap: Record<string, string> = {};
    usersData?.forEach(u => { emailMap[u.id] = u.email; });

    setRequests(data.map(r => ({ ...r, user_email: emailMap[r.user_id] ?? '' })));
  }, []);

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setMessages(data);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchRequests(), fetchMessages()]);
      setLoading(false);
    })();
  }, [fetchRequests, fetchMessages]);

  const approveRequest = async (req: GymRequest) => {
    setActionLoading(req.id);
    try {
      const { data: gymData, error: gymError } = await supabase
        .from('gyms')
        .insert({ name: req.gym_name, comuna: req.comunas[0] ?? '', is_active: true })
        .select('id')
        .single();
      if (gymError) throw gymError;

      const gymId = gymData.id;

      await Promise.all([
        supabase.from('gym_admins').insert({ user_id: req.user_id, gym_id: gymId }),
        supabase.from('gym_subscriptions').insert({ gym_id: gymId, plan: req.plan_interest, status: 'active' }),
      ]);

      await supabase
        .from('gym_admin_requests')
        .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: user?.id })
        .eq('id', req.id);

      await fetchRequests();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const rejectRequest = async (req: GymRequest) => {
    setActionLoading(req.id);
    try {
      await supabase
        .from('gym_admin_requests')
        .update({ status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: user?.id })
        .eq('id', req.id);
      await fetchRequests();
    } finally {
      setActionLoading(null);
    }
  };

  const markRead = async (msg: ContactMessage) => {
    setActionLoading(msg.id);
    try {
      await supabase.from('contact_messages').update({ is_read: true }).eq('id', msg.id);
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_read: true } : m));
    } finally {
      setActionLoading(null);
    }
  };

  const statusBadge = (status: string) => {
    if (status === 'pending') return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">Pendiente</span>;
    if (status === 'approved') return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">Aprobado</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-[#CC0000]">Rechazado</span>;
  };

  const tabClass = (t: Tab) =>
    `flex-1 py-2.5 text-sm font-bold transition-colors ${tab === t ? 'text-[#CC0000] border-b-2 border-[#CC0000]' : 'text-[#666]'}`;

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <div className="bg-white border-b border-[#E5E5E5] px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/profile')} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#F5F5F5] transition-colors">
          <ArrowLeft size={20} className="text-[#111111]" />
        </button>
        <h1 className="font-bold text-[#111111] text-lg">Panel FluxFit Admin</h1>
      </div>

      <div className="bg-white border-b border-[#E5E5E5] flex">
        <button className={tabClass('requests')} onClick={() => setTab('requests')}>
          Solicitudes gym
          {requests.filter(r => r.status === 'pending').length > 0 && (
            <span className="ml-1.5 bg-amber-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5">
              {requests.filter(r => r.status === 'pending').length}
            </span>
          )}
        </button>
        <button className={tabClass('messages')} onClick={() => setTab('messages')}>
          Mensajes
          {messages.filter(m => !m.is_read).length > 0 && (
            <span className="ml-1.5 bg-[#CC0000] text-white text-xs font-bold rounded-full px-1.5 py-0.5">
              {messages.filter(m => !m.is_read).length}
            </span>
          )}
        </button>
      </div>

      <div className="px-4 py-4 max-w-[900px] mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#666]">Cargando...</div>
        ) : tab === 'requests' ? (
          <div className="space-y-3">
            {requests.length === 0 && (
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-8 text-center text-sm text-[#666]">
                No hay solicitudes aún
              </div>
            )}
            {requests.map(req => (
              <div key={req.id} className="bg-white rounded-xl border border-[#E5E5E5] p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-[#111111]">{req.gym_name}</p>
                    <p className="text-xs text-[#666] mt-0.5">{req.comunas.join(', ')}</p>
                  </div>
                  {statusBadge(req.status)}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-[#666]">
                  <div className="flex items-center gap-1.5">
                    <Mail size={12} />
                    <span className="truncate">{req.user_email}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MessageSquare size={12} />
                    <span>{req.phone}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle size={12} />
                    <span>{req.plan_interest}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock size={12} />
                    <span>{new Date(req.created_at).toLocaleDateString('es-CL')}</span>
                  </div>
                </div>
                {req.status === 'pending' && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => approveRequest(req)}
                      disabled={actionLoading === req.id}
                      className="flex-1 py-2 bg-[#16A34A] text-white text-sm font-bold rounded-xl active:scale-[0.98] transition-transform disabled:opacity-50"
                    >
                      {actionLoading === req.id ? 'Procesando...' : 'Aprobar'}
                    </button>
                    <button
                      onClick={() => rejectRequest(req)}
                      disabled={actionLoading === req.id}
                      className="flex-1 py-2 border-2 border-[#CC0000] text-[#CC0000] text-sm font-bold rounded-xl active:scale-[0.98] transition-transform disabled:opacity-50"
                    >
                      Rechazar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {messages.length === 0 && (
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-8 text-center text-sm text-[#666]">
                No hay mensajes aún
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} className="bg-white rounded-xl border border-[#E5E5E5] p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-[#111111]">{msg.name}</p>
                    <p className="text-xs text-[#666] mt-0.5">{msg.email}</p>
                  </div>
                  {msg.is_read
                    ? <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#F5F5F5] text-[#666]">Leído</span>
                    : <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#CC0000]/10 text-[#CC0000]">No leído</span>
                  }
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#F5F5F5] text-[#666]">{msg.type}</span>
                  <span className="text-xs text-[#999]">{new Date(msg.created_at).toLocaleDateString('es-CL')}</span>
                </div>
                <p className="text-sm text-[#444] leading-relaxed">{msg.message}</p>
                {!msg.is_read && (
                  <button
                    onClick={() => markRead(msg)}
                    disabled={actionLoading === msg.id}
                    className="w-full py-2 border border-[#E5E5E5] text-[#666] text-sm font-bold rounded-xl active:scale-[0.98] transition-transform disabled:opacity-50"
                  >
                    {actionLoading === msg.id ? 'Marcando...' : 'Marcar como leído'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
