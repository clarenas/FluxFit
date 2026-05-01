import { useState, useEffect } from 'react';
import { Check, Star, TrendingUp } from 'lucide-react';
import { FluxFitLogo } from '../components/FluxFitLogo';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { formatCLP } from '../lib/utils';
import { useToast } from '../hooks/useToast';
import { Toast } from '../components/Toast';

// ─── Plan definitions ────────────────────────────────────────────────────────

const USER_PLANS = [
  {
    key: 'premium',
    name: 'Premium',
    price: 2990,
    isPopular: true,
    features: [
      'Alertas de aforo en tiempo real',
      'Precios rebajados en todos los gyms',
      'Descuentos en comercios asociados',
      'Generación de QR para canjear beneficios',
      'Distintivo Premium en tu perfil',
    ],
  },
];

const GYM_PLANS = [
  {
    key: 'light',
    name: 'Light',
    price: 89900,
    features: [
      'Hasta 3 sucursales',
      'Editar ficha técnica completa',
      'Planes rebajados para usuarios Premium',
      'Gestión de servicios y descuentos',
      'Validación de QR',
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    price: 149900,
    isPopular: true,
    features: [
      'Hasta 8 sucursales',
      'Todo lo del plan Light',
      'Métricas de visitas y canjes',
      'Promociones especiales',
      'Badge "Gym Verificado"',
      'Analytics 90 días',
    ],
  },
];

const COMMERCE_PLANS = [
  {
    key: 'basic',
    name: 'Basic',
    price: 39900,
    features: [
      '1 cupón activo',
      'Perfil visible en FluxFit',
      'Métricas básicas de visualización',
    ],
  },
  {
    key: 'premium_commerce',
    name: 'Premium',
    price: 69900,
    isPopular: true,
    features: [
      'Cupones ilimitados',
      'Todo lo del plan Basic',
      'Validación QR desde el panel',
      'Historial de canjes completo',
      'Métricas de impacto comercial',
    ],
  },
];

// ─── PlanCard component ───────────────────────────────────────────────────────

function PlanCard({ name, price, features, isCurrent, isPopular, onRequest, requestSent, requesting }: {
  name: string; price: number; features: string[]; isCurrent: boolean;
  isPopular?: boolean; onRequest: () => void; requestSent: boolean; requesting: boolean;
}) {
  return (
    <div className={`bg-white rounded-2xl border-2 p-5 space-y-4 ${isPopular ? 'border-[#CC0000]' : 'border-[#E5E5E5]'}`}>
      {isPopular && (
        <div className="inline-flex items-center gap-1 bg-[#CC0000] text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
          <Star size={10} fill="white" /> Más popular
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-[#111] text-lg">{name}</p>
          <p className="text-[#CC0000] font-bold text-xl mt-1">
            {formatCLP(price)}<span className="text-[#999] text-sm font-normal">/mes</span>
          </p>
        </div>
        {isCurrent && (
          <span className="px-2.5 py-1 bg-[#16A34A]/10 text-[#16A34A] text-xs font-bold rounded-full flex-shrink-0">Plan actual</span>
        )}
      </div>
      <ul className="space-y-2">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2 text-sm text-[#444]">
            <Check size={14} className="text-[#16A34A] flex-shrink-0 mt-0.5" />
            {f}
          </li>
        ))}
      </ul>
      {!isCurrent && (
        requestSent
          ? <p className="text-xs text-[#16A34A] font-bold bg-green-50 rounded-xl p-3">Solicitud enviada. Te contactaremos pronto.</p>
          : <button
              onClick={onRequest}
              disabled={requesting}
              className="w-full py-3 bg-[#CC0000] text-white font-bold rounded-xl text-sm active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              {requesting ? 'Enviando...' : `Solicitar plan ${name}`}
            </button>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function PremiumPage() {
  const { user, isGuest } = useAuth();
  const { toast, showToast } = useToast();

  // Role is read directly from context — no async needed
  const role = user?.role ?? 'user';
  const isPremium = user?.is_premium ?? false;

  // Current plan for B2B roles
  const [currentPlan, setCurrentPlan] = useState<string>('free');
  const [requestSent, setRequestSent] = useState<string | null>(null);
  const [requesting, setRequesting] = useState<string | null>(null);

  // Revenue data for fluxfit_admin
  const [adminRevenue, setAdminRevenue] = useState<{
    gymRevenue: number; commerceRevenue: number; premiumUsers: number; totalRedemptions: number;
  } | null>(null);

  // Load current plan for B2B roles
  useEffect(() => {
    if (!user) return;
    if (role === 'gym_admin') {
      supabase.from('gym_admins').select('gym_id').eq('user_id', user.id).maybeSingle()
        .then(({ data }) => {
          if (!data?.gym_id) return;
          supabase.from('gym_subscriptions').select('plan').eq('gym_id', data.gym_id).maybeSingle()
            .then(({ data: sub }) => { if (sub?.plan) setCurrentPlan(sub.plan); });
        });
    } else if (role === 'commerce_admin') {
      supabase.from('commerce_admins').select('commerce_id').eq('user_id', user.id).maybeSingle()
        .then(({ data }) => {
          if (!data?.commerce_id) return;
          supabase.from('commerce_subscriptions').select('plan').eq('commerce_id', data.commerce_id).maybeSingle()
            .then(({ data: sub }) => { if (sub?.plan) setCurrentPlan(sub.plan); });
        });
    } else if (role === 'user') {
      setCurrentPlan(isPremium ? 'premium' : 'free');
    }
  }, [user, role, isPremium]);

  // Load revenue metrics for fluxfit_admin
  useEffect(() => {
    if (role !== 'fluxfit_admin') return;
    const PRICES: Record<string, number> = { light: 89900, pro: 149900, full: 149900, basico: 59900, basic: 39900, premium_commerce: 69900 };
    Promise.all([
      supabase.from('gym_subscriptions').select('plan, status'),
      supabase.from('commerce_subscriptions').select('plan, status'),
      supabase.from('users').select('is_premium'),
      supabase.from('coupon_redemptions').select('id'),
    ]).then(([gymSubs, commerceSubs, users, redemptions]) => {
      const gymRevenue = (gymSubs.data ?? [])
        .filter((s: any) => s.status === 'active' && s.plan !== 'free')
        .reduce((acc: number, s: any) => acc + (PRICES[s.plan] ?? 0), 0);
      const commerceRevenue = (commerceSubs.data ?? [])
        .filter((s: any) => s.status === 'active')
        .reduce((acc: number, s: any) => acc + (PRICES[s.plan] ?? 0), 0);
      const premiumCount = (users.data ?? []).filter((u: any) => u.is_premium).length;
      setAdminRevenue({ gymRevenue, commerceRevenue, premiumUsers: premiumCount, totalRedemptions: redemptions.data?.length ?? 0 });
    });
  }, [role]);

  const handleRequest = async (planName: string, planPrice: string) => {
    if (!user) return;
    setRequesting(planName);
    try {
      await supabase.from('contact_messages').insert({
        user_id: user.id,
        name: user.full_name || user.email,
        email: user.email,
        type: 'Solicitud de plan',
        message: `El usuario "${user.email}" (rol: ${role}) solicita contratar el plan ${planName} (${planPrice}/mes).`,
      });
      setRequestSent(planName);
      showToast('Solicitud enviada. Te contactaremos pronto.', 'success');
    } finally {
      setRequesting(null);
    }
  };

  // ── FluxFit Admin: revenue dashboard (no payment options) ──────────────────
  if (role === 'fluxfit_admin') {
    const total = (adminRevenue?.gymRevenue ?? 0) + (adminRevenue?.commerceRevenue ?? 0) + (adminRevenue?.premiumUsers ?? 0) * 2990;
    return (
      <div className="min-h-screen bg-[#F5F5F5] pb-20">
        <div className="bg-[#111111] px-4 pt-12 pb-8">
          <div className="flex items-center gap-3">
            <TrendingUp size={28} className="text-[#CC0000]" />
            <div>
              <p className="text-white/60 text-xs">FluxFit Admin</p>
              <h1 className="text-white font-bold text-xl">Ingresos de la Red</h1>
            </div>
          </div>
        </div>
        <div className="px-4 pt-4 space-y-4 pb-4">
          <div className="bg-[#CC0000] rounded-2xl p-5 text-white">
            <p className="text-white/70 text-sm">Ingresos totales estimados / mes</p>
            <p className="text-4xl font-bold mt-1">{formatCLP(total)}</p>
            <p className="text-white/60 text-xs mt-2">Suma de suscripciones activas</p>
          </div>
          {[
            { label: 'Suscripciones de Gyms', value: adminRevenue?.gymRevenue ?? 0, desc: 'Planes Light y Pro activos' },
            { label: 'Suscripciones de Comercios', value: adminRevenue?.commerceRevenue ?? 0, desc: 'Planes Basic y Premium activos' },
            { label: 'Membresías Premium de Usuarios', value: (adminRevenue?.premiumUsers ?? 0) * 2990, desc: `${adminRevenue?.premiumUsers ?? 0} usuarios × $2.990/mes` },
          ].map(item => (
            <div key={item.label} className="bg-white rounded-xl border border-[#E5E5E5] p-4 flex items-center justify-between">
              <div>
                <p className="font-bold text-[#111] text-sm">{item.label}</p>
                <p className="text-xs text-[#999] mt-0.5">{item.desc}</p>
              </div>
              <p className="text-[#111] font-bold text-base ml-3 flex-shrink-0">{formatCLP(item.value)}</p>
            </div>
          ))}
          <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 flex items-center justify-between">
            <div>
              <p className="font-bold text-[#111] text-sm">Canjes Generados</p>
              <p className="text-xs text-[#999] mt-0.5">Total de cupones redimidos en la red</p>
            </div>
            <p className="text-[#CC0000] font-bold text-2xl">{adminRevenue?.totalRedemptions ?? 0}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Guest ──────────────────────────────────────────────────────────────────
  if (isGuest) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] pb-20">
        <Toast {...toast} />
        <div className="bg-[#CC0000] px-4 pt-12 pb-8 text-center">
          <FluxFitLogo size="sm" />
          <h1 className="text-white font-bold text-2xl mt-4">FluxFit Premium</h1>
          <p className="text-white/80 text-sm mt-2">Crea tu cuenta para activar todos los beneficios</p>
        </div>
        <div className="px-4 mt-6">
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-5 space-y-3">
            {['Alertas de aforo en tiempo real', 'Precios rebajados en gyms', 'Descuentos en comercios asociados'].map(f => (
              <div key={f} className="flex items-center gap-2 text-sm text-[#444]">
                <Check size={14} className="text-[#16A34A]" /> {f}
              </div>
            ))}
            <p className="text-[#CC0000] font-bold text-xl pt-2">{formatCLP(2990)}<span className="text-[#999] text-sm font-normal">/mes</span></p>
          </div>
        </div>
      </div>
    );
  }

  // ── Gym Admin: B2B plans ───────────────────────────────────────────────────
  if (role === 'gym_admin') {
    return (
      <div className="min-h-screen bg-[#F5F5F5] pb-20">
        <Toast {...toast} />
        <div className="bg-[#111111] px-4 pt-12 pb-6">
          <p className="text-white/60 text-xs">FluxFit para Gyms</p>
          <h1 className="text-white font-bold text-2xl mt-1">Planes B2B</h1>
        </div>
        <div className="px-4 pt-4 space-y-4">
          <div className="bg-[#FFFBEB] border border-[#FCD34D] rounded-xl p-4">
            <p className="text-sm text-[#92400E] font-bold">Planes para tu Gym</p>
            <p className="text-xs text-[#92400E] mt-1">Elige el plan según el tamaño y necesidades de tu negocio.</p>
          </div>
          {GYM_PLANS.map(p => (
            <PlanCard
              key={p.key}
              name={p.name}
              price={p.price}
              features={p.features}
              isCurrent={currentPlan === p.key}
              isPopular={p.isPopular}
              onRequest={() => handleRequest(p.name, formatCLP(p.price))}
              requestSent={requestSent === p.name}
              requesting={requesting === p.name}
            />
          ))}
          <p className="text-center text-xs text-[#999]">¿Dudas? Escríbenos a cvlarenas@gmail.com</p>
        </div>
      </div>
    );
  }

  // ── Commerce Admin: B2B plans ──────────────────────────────────────────────
  if (role === 'commerce_admin') {
    return (
      <div className="min-h-screen bg-[#F5F5F5] pb-20">
        <Toast {...toast} />
        <div className="bg-[#111111] px-4 pt-12 pb-6">
          <p className="text-white/60 text-xs">FluxFit para Comercios</p>
          <h1 className="text-white font-bold text-2xl mt-1">Planes B2B</h1>
        </div>
        <div className="px-4 pt-4 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-800 font-bold">Planes para tu Comercio</p>
            <p className="text-xs text-blue-700 mt-1">Llega a miles de usuarios con beneficios exclusivos.</p>
          </div>
          {COMMERCE_PLANS.map(p => (
            <PlanCard
              key={p.key}
              name={p.name}
              price={p.price}
              features={p.features}
              isCurrent={currentPlan === p.key}
              isPopular={p.isPopular}
              onRequest={() => handleRequest(p.name, formatCLP(p.price))}
              requestSent={requestSent === p.name}
              requesting={requesting === p.name}
            />
          ))}
          <p className="text-center text-xs text-[#999]">¿Dudas? Escríbenos a cvlarenas@gmail.com</p>
        </div>
      </div>
    );
  }

  // ── User: B2C premium ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-20">
      <Toast {...toast} />
      <div className="bg-[#CC0000] px-4 pt-12 pb-8 text-center">
        <FluxFitLogo size="sm" />
        <h1 className="text-white font-bold text-2xl mt-4">FluxFit Premium</h1>
        <p className="text-white/80 text-sm mt-1">{formatCLP(2990)}/mes · Cancela cuando quieras</p>
      </div>
      <div className="px-4 -mt-2 pt-4 space-y-4">
        {isPremium ? (
          <div className="bg-[#16A34A]/10 border border-[#16A34A]/30 rounded-2xl p-5 text-center">
            <p className="text-[#16A34A] font-bold text-lg">Ya eres miembro Premium</p>
            {user?.premium_since && (
              <p className="text-[#16A34A] text-sm mt-1">
                Miembro desde {new Date(user.premium_since).toLocaleDateString('es-CL')}
              </p>
            )}
          </div>
        ) : (
          <>
            {USER_PLANS.map(p => (
              <PlanCard
                key={p.key}
                name={p.name}
                price={p.price}
                features={p.features}
                isCurrent={currentPlan === p.key}
                isPopular={p.isPopular}
                onRequest={() => handleRequest(p.name, formatCLP(p.price))}
                requestSent={requestSent === p.name}
                requesting={requesting === p.name}
              />
            ))}
            <p className="text-center text-xs text-[#999]">Pago seguro · Cancela cuando quieras</p>
          </>
        )}
      </div>
    </div>
  );
}
