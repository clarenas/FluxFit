import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, Star, TrendingUp } from 'lucide-react';
import { FluxFitLogo } from '../components/FluxFitLogo';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { formatCLP } from '../lib/utils';
import { useToast } from '../hooks/useToast';
import { Toast } from '../components/Toast';

type UserRole = 'user' | 'gym_admin' | 'commerce_admin' | 'fluxfit_admin';

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
            {price === 0 ? 'Gratis' : formatCLP(price)}
            {price > 0 && <span className="text-[#999] text-sm font-normal">/mes</span>}
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
          ? <p className="text-xs text-[#16A34A] font-bold bg-green-50 rounded-xl p-3">Solicitud enviada. Te contactaremos en menos de 24 horas.</p>
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

export function PremiumPage() {
  const navigate = useNavigate();
  const { user, isGuest } = useAuth();
  const { toast, showToast } = useToast();
  const [role, setRole] = useState<UserRole>('user');
  const [currentPlan, setCurrentPlan] = useState<string>('free');
  const [requestSent, setRequestSent] = useState<string | null>(null);
  const [requesting, setRequesting] = useState<string | null>(null);

  const isPremium = user?.is_premium ?? false;
  const isFluxfitAdmin = user?.role === 'fluxfit_admin';

  // Revenue data for fluxfit_admin view
  const [adminRevenue, setAdminRevenue] = useState<{ gymRevenue: number; commerceRevenue: number; premiumUsers: number; totalRedemptions: number } | null>(null);

  useEffect(() => {
    if (!isFluxfitAdmin) return;
    const PLAN_PRICES: Record<string, number> = { basico: 59900, light: 89900, pro: 149900, full: 149900, basic: 39900, premium_commerce: 69900 };
    Promise.all([
      supabase.from('gym_subscriptions').select('plan, status'),
      supabase.from('commerce_subscriptions').select('plan, status'),
      supabase.from('users').select('is_premium'),
      supabase.from('coupon_redemptions').select('id'),
    ]).then(([gymSubs, commerceSubs, users, redemptions]) => {
      const gymRevenue = (gymSubs.data ?? []).filter((s: any) => s.status === 'active' && s.plan !== 'free').reduce((acc: number, s: any) => acc + (PLAN_PRICES[s.plan] ?? 0), 0);
      const commerceRevenue = (commerceSubs.data ?? []).filter((s: any) => s.status === 'active').reduce((acc: number, s: any) => acc + (PLAN_PRICES[s.plan] ?? 0), 0);
      const premiumUsers = (users.data ?? []).filter((u: any) => u.is_premium).length * 2990;
      setAdminRevenue({ gymRevenue, commerceRevenue, premiumUsers, totalRedemptions: redemptions.data?.length ?? 0 });
    });
  }, [isFluxfitAdmin]);

  useEffect(() => {
    if (!user) return;
    const detectedRole = (user.role as UserRole) ?? 'user';
    setRole(detectedRole);

    if (detectedRole === 'gym_admin') {
      supabase.from('gym_admins').select('gym_id').eq('user_id', user.id).maybeSingle()
        .then(({ data }) => {
          if (data?.gym_id) {
            supabase.from('gym_subscriptions').select('plan').eq('gym_id', data.gym_id).maybeSingle()
              .then(({ data: sub }) => { if (sub?.plan) setCurrentPlan(sub.plan); });
          }
        });
    } else if (detectedRole === 'commerce_admin') {
      supabase.from('commerce_admins').select('commerce_id').eq('user_id', user.id).maybeSingle()
        .then(({ data }) => {
          if (data?.commerce_id) {
            supabase.from('commerce_subscriptions').select('plan').eq('commerce_id', data.commerce_id).maybeSingle()
              .then(({ data: sub }) => { if (sub?.plan) setCurrentPlan(sub.plan); });
          }
        });
    } else {
      setCurrentPlan(isPremium ? 'premium' : 'free');
    }
  }, [user, isPremium]);

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

  if (isFluxfitAdmin) {
    const total = (adminRevenue?.gymRevenue ?? 0) + (adminRevenue?.commerceRevenue ?? 0) + (adminRevenue?.premiumUsers ?? 0);
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
        <div className="px-4 -mt-2 space-y-4 pt-4">
          <div className="bg-[#CC0000] rounded-2xl p-5 text-white">
            <p className="text-white/70 text-sm">Ingresos totales estimados / mes</p>
            <p className="text-4xl font-bold mt-1">{formatCLP(total)}</p>
            <p className="text-white/60 text-xs mt-2">Suma de suscripciones activas de gyms, comercios y usuarios Premium</p>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {[
              { label: 'Suscripciones de Gyms', value: adminRevenue?.gymRevenue ?? 0, desc: 'Planes Light, Pro y Full activos' },
              { label: 'Suscripciones de Comercios', value: adminRevenue?.commerceRevenue ?? 0, desc: 'Planes Basic y Premium activos' },
              { label: 'Membresías Premium de Usuarios', value: adminRevenue?.premiumUsers ?? 0, desc: `${Math.round((adminRevenue?.premiumUsers ?? 0) / 2990)} usuarios Premium a $2.990/mes` },
            ].map(item => (
              <div key={item.label} className="bg-white rounded-xl border border-[#E5E5E5] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-[#111] text-sm">{item.label}</p>
                    <p className="text-xs text-[#999] mt-0.5">{item.desc}</p>
                  </div>
                  <p className="text-[#111] font-bold text-base flex-shrink-0 ml-3">{formatCLP(item.value)}</p>
                </div>
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
      </div>
    );
  }

  if (isGuest) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] pb-20">
        <Toast {...toast} />
        <div className="bg-[#CC0000] px-4 pt-12 pb-8 text-center">
          <FluxFitLogo size="sm" />
          <h1 className="text-white font-bold text-2xl mt-4">FluxFit Premium</h1>
        </div>
        <div className="px-4 mt-4">
          <button onClick={() => navigate('/auth?mode=register')} className="w-full py-4 bg-[#CC0000] text-white font-bold rounded-xl text-lg active:scale-[0.98] transition-transform">
            Crea tu cuenta para activar Premium
          </button>
        </div>
      </div>
    );
  }

  // User plans
  const userPlans = [
    {
      key: 'free',
      name: 'Free',
      price: 0,
      features: ['Ver ocupación en tiempo real', 'Buscar gyms por comuna', 'Guardar gyms favoritos'],
    },
    {
      key: 'premium',
      name: 'Premium',
      price: 2990,
      features: [
        'Todo lo del plan Free',
        'Alertas de aforo en tiempo real',
        'Precios rebajados en todos los gyms',
        'Acceso a descuentos en comercios asociados',
        'Generación de QR para canjear beneficios',
        'Distintivo Premium en tu perfil',
      ],
      isPopular: true,
    },
  ];

  // Gym admin plans
  const gymPlans = [
    {
      key: 'free',
      name: 'Free',
      price: 0,
      features: ['1 sucursal', 'Sensor de ocupación en tiempo real', 'Perfil básico visible en FluxFit'],
    },
    {
      key: 'light',
      name: 'Light',
      price: 89900,
      features: ['Hasta 3 sucursales', 'Editar ficha técnica completa', 'Gestión de planes rebajados para Premium', 'Gestión de servicios y descuentos', 'Horarios recomendados'],
    },
    {
      key: 'pro',
      name: 'Pro',
      price: 149900,
      features: ['Hasta 8 sucursales', 'Todo lo del plan Light', 'Métricas de visitas y canjes QR', 'Promociones especiales', 'Badge "Gym Verificado"', 'Analytics 90 días'],
      isPopular: true,
    },
  ];

  // Commerce admin plans
  const commercePlans = [
    {
      key: 'basic',
      name: 'Basic',
      price: 39900,
      features: ['1 cupón activo', 'Perfil visible en FluxFit', 'Métricas básicas de visualización'],
    },
    {
      key: 'premium_commerce',
      name: 'Premium',
      price: 69900,
      features: ['Cupones ilimitados', 'Todo lo del plan Basic', 'Validación QR desde el panel', 'Métricas de canjes e impacto', 'Estadísticas de usuarios que canjean'],
      isPopular: true,
    },
  ];

  const renderUserPlans = () => (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E5E5E5]">
              <th className="text-left p-3 text-[#666] font-normal" />
              <th className="p-3 text-[#666] font-normal text-center">Free</th>
              <th className="p-3 text-center text-[#CC0000] font-bold">✦ Premium</th>
            </tr>
          </thead>
          <tbody>
            {[
              { f: 'Ver ocupación', free: true, prem: true },
              { f: 'Buscar gyms', free: true, prem: true },
              { f: 'Guardar favoritos', free: true, prem: true },
              { f: 'Alertas de aforo', free: false, prem: true },
              { f: 'Precios rebajados en gyms', free: false, prem: true },
              { f: 'Descuentos en comercios', free: false, prem: true },
              { f: 'Generar QR de beneficio', free: false, prem: true },
            ].map(row => (
              <tr key={row.f} className="border-b border-[#E5E5E5] last:border-0">
                <td className="p-3 text-[#111]">{row.f}</td>
                <td className="p-3 text-center">{row.free ? <Check size={16} className="text-[#16A34A] mx-auto" /> : <X size={16} className="text-[#CC0000] mx-auto" />}</td>
                <td className="p-3 text-center">{row.prem ? <Check size={16} className="text-[#16A34A] mx-auto" /> : <X size={16} className="text-[#CC0000] mx-auto" />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {userPlans.map(p => (
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
    </div>
  );

  const renderGymPlans = () => (
    <div className="space-y-4">
      <div className="bg-[#FFFBEB] border border-[#FCD34D] rounded-xl p-4">
        <p className="text-sm text-[#92400E] font-bold">Planes para tu Gym</p>
        <p className="text-xs text-[#92400E] mt-1">Elige el plan que más se adapte al tamaño y necesidades de tu negocio.</p>
      </div>
      {gymPlans.map(p => (
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
    </div>
  );

  const renderCommercePlans = () => (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-800 font-bold">Planes para tu Comercio</p>
        <p className="text-xs text-blue-700 mt-1">Llega a miles de atletas con beneficios exclusivos.</p>
      </div>
      {commercePlans.map(p => (
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
    </div>
  );

  const titles: Record<UserRole, string> = {
    user: 'FluxFit Premium',
    gym_admin: 'Planes para Gyms',
    commerce_admin: 'Planes para Comercios',
    fluxfit_admin: 'Administración',
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-20">
      <Toast {...toast} />
      <div className="bg-[#CC0000] px-4 pt-12 pb-8 text-center">
        <FluxFitLogo size="sm" />
        <h1 className="text-white font-bold text-2xl mt-4">{titles[role]}</h1>
      </div>
      <div className="px-4 -mt-4 space-y-4 pb-4">
        {role === 'gym_admin' && renderGymPlans()}
        {role === 'commerce_admin' && renderCommercePlans()}
        {(role === 'user' || role === 'fluxfit_admin') && renderUserPlans()}
        <p className="text-center text-xs text-[#999]">¿Dudas? Escríbenos a cvlarenas@gmail.com</p>
      </div>
    </div>
  );
}
