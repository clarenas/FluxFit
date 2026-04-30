import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { getCommerceCategoryEmoji, getCommerceCategoryLabel, formatCLP } from '../lib/utils';
import type { Commerce, CommerceStore, CommerceProduct, CommerceCoupon, CouponRedemption } from '../lib/types';
import { CommerceStoresTab } from '../components/admin/CommerceStoresTab';
import { CommerceProductsTab } from '../components/admin/CommerceProductsTab';
import { CommerceCouponsTab } from '../components/admin/CommerceCouponsTab';
import { Store, Package, Ticket, Settings, LayoutDashboard, QrCode, CheckCircle, XCircle, BarChart2, Clock } from 'lucide-react';

type Tab = 'dashboard' | 'tiendas' | 'productos' | 'cupones' | 'estadisticas' | 'mi_plan';

interface Props { initialTab?: Tab; }

const inp = 'w-full px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm focus:outline-none focus:border-[#CC0000]';

export function CommerceAdminPage({ initialTab }: Props) {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>(initialTab ?? 'dashboard');
  const [commerce, setCommerce] = useState<Commerce | null>(null);
  const [stores, setStores] = useState<CommerceStore[]>([]);
  const [products, setProducts] = useState<CommerceProduct[]>([]);
  const [coupons, setCoupons] = useState<CommerceCoupon[]>([]);
  const [redemptions, setRedemptions] = useState<CouponRedemption[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', category: 'nutricion', address: '', website: '', discount_percentage: '', discount_description: '', is_active: true });
  const [subscription, setSubscription] = useState<{ plan: string } | null>(null);
  const [requestingPlan, setRequestingPlan] = useState<string | null>(null);
  const [planRequestSent, setPlanRequestSent] = useState<string | null>(null);

  // QR validation
  const [qrInput, setQrInput] = useState('');
  const [qrResult, setQrResult] = useState<{ ok: boolean; message: string; userEmail?: string } | null>(null);
  const [validatingQr, setValidatingQr] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    const { data: adminData } = await supabase.from('commerce_admins').select('commerce_id').eq('user_id', user.id).maybeSingle();
    if (!adminData) return;
    const cid = adminData.commerce_id;
    const [{ data: c }, { data: st }, { data: pr }, { data: cp }, { data: sub }, { data: red }] = await Promise.all([
      supabase.from('commerces').select('*').eq('id', cid).maybeSingle(),
      supabase.from('commerce_stores').select('*').eq('commerce_id', cid).order('created_at'),
      supabase.from('commerce_products').select('*').eq('commerce_id', cid).order('created_at'),
      supabase.from('commerce_coupons').select('*').eq('commerce_id', cid).order('created_at'),
      supabase.from('commerce_subscriptions').select('plan').eq('commerce_id', cid).maybeSingle(),
      supabase.from('coupon_redemptions').select('*').eq('commerce_id', cid).order('redeemed_at', { ascending: false }).limit(50),
    ]);
    if (c) {
      setCommerce(c);
      setForm({ name: c.name, description: c.description, category: c.category, address: c.address, website: c.website, discount_percentage: String(c.discount_percentage), discount_description: c.discount_description, is_active: c.is_active });
      setIsPending(c.approval_status === 'pending');
    }
    setStores(st ?? []);
    setProducts(pr ?? []);
    setCoupons(cp ?? []);
    setSubscription(sub);
    setRedemptions((red ?? []) as CouponRedemption[]);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  const save = async () => {
    if (!commerce) return;
    await supabase.from('commerces').update({
      name: form.name, description: form.description, category: form.category,
      address: form.address, website: form.website,
      discount_percentage: parseInt(form.discount_percentage) || 0,
      discount_description: form.discount_description,
      is_active: form.is_active,
      approval_status: 'pending',
    }).eq('id', commerce.id);
    setIsPending(true);
    setEditMode(false);
    fetchAll();
  };

  const toggleActive = async () => {
    if (!commerce) return;
    const v = !form.is_active;
    setForm(f => ({ ...f, is_active: v }));
    await supabase.from('commerces').update({ is_active: v }).eq('id', commerce.id);
    fetchAll();
  };

  const validateQr = async () => {
    if (!commerce || !qrInput.trim()) return;
    setValidatingQr(true);
    setQrResult(null);
    try {
      const parts = qrInput.trim().split(':');
      if (parts.length < 2) {
        setQrResult({ ok: false, message: 'Código QR inválido. Formato incorrecto.' });
        return;
      }
      const [userId] = parts;
      const { data: userData } = await supabase.from('users').select('email, is_premium').eq('id', userId).maybeSingle();
      if (!userData) {
        setQrResult({ ok: false, message: 'Usuario no encontrado.' });
        return;
      }
      if (!userData.is_premium) {
        setQrResult({ ok: false, message: `El usuario ${userData.email} no tiene membresía Premium activa.` });
        return;
      }
      const { data: existing } = await supabase.from('coupon_redemptions').select('id').eq('coupon_code', qrInput.trim()).eq('commerce_id', commerce.id).maybeSingle();
      if (existing) {
        setQrResult({ ok: false, message: 'Este cupón ya fue canjeado en este comercio.' });
        return;
      }
      await supabase.from('coupon_redemptions').insert({
        user_id: userId, commerce_id: commerce.id, coupon_code: qrInput.trim(), validated_by: user?.id,
      });
      setQrResult({ ok: true, message: 'Canje registrado correctamente.', userEmail: userData.email });
      setQrInput('');
      fetchAll();
    } finally {
      setValidatingQr(false);
    }
  };

  const requestPlan = async (planName: string, planPrice: string) => {
    if (!commerce || !user) return;
    setRequestingPlan(planName);
    try {
      await supabase.from('contact_messages').insert({
        user_id: user.id, name: commerce.name, email: user.email, type: 'Solicitud de plan',
        message: `El comercio "${commerce.name}" solicita contratar el plan ${planName} (${planPrice}/mes). Contactar a: ${user.email}`,
      });
      setPlanRequestSent(planName);
    } finally {
      setRequestingPlan(null);
    }
  };

  if (!commerce) return (
    <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center text-[#666] text-sm">
      Cargando panel de administración...
    </div>
  );

  const plan = subscription?.plan ?? 'free';
  const canValidateQr = ['premium_commerce', 'pro'].includes(plan);
  const totalRedemptions = redemptions.length;
  const thisMonthRedemptions = redemptions.filter(r => new Date(r.redeemed_at) > new Date(Date.now() - 30 * 86400000)).length;

  const tabs: { id: Tab; label: string; Icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Panel', Icon: LayoutDashboard },
    { id: 'cupones', label: 'Cupones', Icon: Ticket },
    { id: 'estadisticas', label: 'Estadísticas', Icon: BarChart2 },
    { id: 'tiendas', label: 'Tiendas', Icon: Store },
    { id: 'productos', label: 'Productos', Icon: Package },
    { id: 'mi_plan', label: 'Mi Plan', Icon: QrCode },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-24">
      <div className="bg-[#111111] px-4 pt-10 pb-4">
        <p className="text-white/50 text-xs mb-0.5">FluxFit Admin</p>
        <h1 className="text-white font-bold text-xl">{commerce.name}</h1>
        <p className="text-white/60 text-xs mt-0.5">{getCommerceCategoryEmoji(commerce.category)} {getCommerceCategoryLabel(commerce.category)}</p>
        {isPending && (
          <div className="mt-2 flex items-center gap-2 bg-amber-500/20 rounded-lg px-3 py-1.5">
            <Clock size={13} className="text-amber-300" />
            <span className="text-amber-300 text-xs font-medium">Perfil pendiente de aprobación — no visible para usuarios</span>
          </div>
        )}
      </div>

      <div className="flex border-b border-[#E5E5E5] bg-white sticky top-0 z-10 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1 px-3 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition-colors ${tab === t.id ? 'border-[#CC0000] text-[#CC0000]' : 'border-transparent text-[#999]'}`}>
            <t.Icon size={13} />{t.label}
          </button>
        ))}
      </div>

      <div className="px-4 pt-4">
        {tab === 'dashboard' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Tiendas', value: stores.length },
                { label: 'Cupones', value: coupons.length },
                { label: 'Canjes totales', value: totalRedemptions },
              ].map(k => (
                <div key={k.label} className="bg-white rounded-xl border border-[#E5E5E5] p-3 text-center">
                  <p className="text-xl font-bold text-[#111]">{k.value}</p>
                  <p className="text-[10px] text-[#999] mt-0.5">{k.label}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-[#111]">Comercio activo</p>
                <p className="text-xs text-[#999]">{form.is_active ? 'Visible para usuarios' : 'Oculto para usuarios'}</p>
              </div>
              <button onClick={toggleActive} className={`w-12 h-7 rounded-full transition-colors relative flex-shrink-0 ${form.is_active ? 'bg-[#16A34A]' : 'bg-[#E5E5E5]'}`}>
                <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${form.is_active ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>

            <div className="bg-white rounded-xl border border-[#E5E5E5] p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-[#111]">Información del comercio</h3>
                <button onClick={() => setEditMode(!editMode)} className="flex items-center gap-1 text-xs text-[#CC0000] font-bold">
                  <Settings size={12} />{editMode ? 'Cancelar' : 'Editar'}
                </button>
              </div>
              {editMode ? (
                <div className="space-y-2">
                  <input placeholder="Nombre" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} />
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inp}>
                    <option value="nutricion">Nutrición</option>
                    <option value="suplementos">Suplementos</option>
                    <option value="indumentaria">Indumentaria</option>
                    <option value="fisioterapia">Fisioterapia</option>
                    <option value="otro">Otro</option>
                  </select>
                  <textarea placeholder="Descripción" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inp} rows={3} />
                  <input placeholder="Dirección" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className={inp} />
                  <input placeholder="Sitio web" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} className={inp} />
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="% descuento" type="number" value={form.discount_percentage} onChange={e => setForm(f => ({ ...f, discount_percentage: e.target.value }))} className={inp} />
                    <input placeholder="Descripción descuento" value={form.discount_description} onChange={e => setForm(f => ({ ...f, discount_description: e.target.value }))} className={inp} />
                  </div>
                  <p className="text-[10px] text-amber-600">Al guardar, el perfil quedará pendiente de aprobación por FluxFit.</p>
                  <div className="flex gap-2 pt-1">
                    <button onClick={save} className="flex-1 py-2.5 bg-[#CC0000] text-white font-bold rounded-xl text-sm">Guardar y enviar a revisión</button>
                    <button onClick={() => setEditMode(false)} className="flex-1 py-2.5 border border-[#E5E5E5] rounded-xl text-sm">Cancelar</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {[
                    { label: 'Categoría', value: getCommerceCategoryLabel(commerce.category) },
                    { label: 'Descripción', value: commerce.description || '—' },
                    { label: 'Dirección', value: commerce.address || '—' },
                    { label: 'Sitio web', value: commerce.website || '—' },
                    { label: 'Descuento', value: `${commerce.discount_percentage}% — ${commerce.discount_description || '—'}` },
                  ].map(r => (
                    <div key={r.label}>
                      <p className="text-[10px] text-[#999]">{r.label}</p>
                      <p className="text-sm text-[#111]">{r.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* QR Validator */}
            <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 space-y-3">
              <div className="flex items-center gap-2">
                <QrCode size={18} className="text-[#CC0000]" />
                <h3 className="font-bold text-sm text-[#111]">Validar QR de cliente</h3>
              </div>
              {!canValidateQr ? (
                <p className="text-xs text-[#999]">Activa el plan Premium para validar cupones QR.</p>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input type="text" value={qrInput} onChange={e => setQrInput(e.target.value)} placeholder="Código QR del cliente..." className={inp} onKeyDown={e => e.key === 'Enter' && validateQr()} />
                    <button onClick={validateQr} disabled={validatingQr || !qrInput.trim()} className="px-4 py-2 bg-[#CC0000] text-white font-bold rounded-lg text-sm disabled:opacity-50 flex-shrink-0">
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
                </>
              )}
            </div>
          </div>
        )}

        {tab === 'cupones' && <CommerceCouponsTab commerceId={commerce.id} coupons={coupons} onRefresh={fetchAll} />}
        {tab === 'tiendas' && <CommerceStoresTab commerceId={commerce.id} stores={stores} onRefresh={fetchAll} />}
        {tab === 'productos' && <CommerceProductsTab commerceId={commerce.id} products={products} onRefresh={fetchAll} />}

        {tab === 'estadisticas' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 text-center">
                <p className="text-3xl font-bold text-[#111]">{totalRedemptions}</p>
                <p className="text-xs text-[#666] mt-1">Canjes totales</p>
              </div>
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 text-center">
                <p className="text-3xl font-bold text-[#CC0000]">{thisMonthRedemptions}</p>
                <p className="text-xs text-[#666] mt-1">Últimos 30 días</p>
              </div>
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 text-center">
                <p className="text-3xl font-bold text-[#111]">{coupons.filter(c => c.is_active).length}</p>
                <p className="text-xs text-[#666] mt-1">Cupones activos</p>
              </div>
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 text-center">
                <p className="text-3xl font-bold text-[#111]">{products.length}</p>
                <p className="text-xs text-[#666] mt-1">Productos</p>
              </div>
            </div>

            {redemptions.length > 0 && (
              <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#F5F5F5]">
                  <p className="font-bold text-sm text-[#111]">Historial de canjes</p>
                </div>
                <div className="divide-y divide-[#F5F5F5]">
                  {redemptions.slice(0, 15).map(r => (
                    <div key={r.id} className="px-4 py-2.5 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-[#111] font-mono">{r.coupon_code.slice(0, 24)}...</p>
                        <p className="text-[10px] text-[#999]">{new Date(r.redeemed_at).toLocaleString('es-CL')}</p>
                      </div>
                      <CheckCircle size={14} className="text-[#16A34A]" />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {redemptions.length === 0 && (
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-8 text-center text-sm text-[#666]">
                Aún no hay canjes registrados
              </div>
            )}
          </div>
        )}

        {tab === 'mi_plan' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-[#111]">Mi Plan</h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#F5F5F5] text-[#666]">{plan === 'premium_commerce' ? 'Premium' : plan === 'basic' ? 'Basic' : 'Free'}</span>
            </div>
            {[
              { key: 'basic', name: 'Basic', price: 39900, features: ['1 cupón activo', 'Perfil visible en FluxFit', 'Métricas básicas'] },
              { key: 'premium_commerce', name: 'Premium', price: 69900, features: ['Cupones ilimitados', 'Todo lo del Basic', 'Validación QR', 'Historial de canjes', 'Métricas completas'], popular: true },
            ].map(p => {
              const isCurrent = plan === p.key;
              const sent = planRequestSent === p.name;
              return (
                <div key={p.key} className={`bg-white rounded-xl border-2 p-5 space-y-3 ${p.popular ? 'border-[#CC0000]' : 'border-[#E5E5E5]'}`}>
                  {p.popular && <div className="inline-block bg-[#111111] text-white text-xs font-bold px-2 py-0.5 rounded-full">Más popular</div>}
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-[#111] text-base">{p.name}</p>
                    {isCurrent && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">Plan actual</span>}
                  </div>
                  <p className="text-[#CC0000] font-bold text-lg">{formatCLP(p.price)}<span className="text-[#666] text-sm font-normal">/mes</span></p>
                  <ul className="space-y-1.5">{p.features.map(f => <li key={f} className="text-xs text-[#444] flex items-start gap-1.5"><span className="text-[#16A34A] font-bold">✓</span>{f}</li>)}</ul>
                  {!isCurrent && (
                    sent
                      ? <p className="text-xs text-[#16A34A] font-bold bg-green-50 rounded-lg p-3">✓ Solicitud enviada.</p>
                      : <button onClick={() => requestPlan(p.name, formatCLP(p.price))} disabled={requestingPlan === p.name} className="w-full py-2.5 bg-[#CC0000] text-white font-bold rounded-xl text-sm disabled:opacity-50">
                          {requestingPlan === p.name ? 'Enviando...' : `Solicitar ${p.name}`}
                        </button>
                  )}
                </div>
              );
            })}
            <p className="text-xs text-[#666] text-center">¿Dudas? Escríbenos a cvlarenas@gmail.com</p>
          </div>
        )}
      </div>
    </div>
  );
}
