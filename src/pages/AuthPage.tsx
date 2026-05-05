/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { User, Building2, Store, Clock } from 'lucide-react';
import { GoFitNowLogo } from '../components/GoFitNowLogo';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

type AccountType = 'usuario' | 'gym' | 'comercio';

const COMUNAS = ['Ñuñoa', 'Las Condes', 'Vitacura', 'Providencia', 'La Reina', 'Peñalolén'];
const TEST_MODE_SKIP_VERIFICATION = true;

const waitForProfile = async (userId: string) => {
  for (let i = 0; i < 10; i++) {
    const { data } = await supabase.from('users').select('id').eq('id', userId).maybeSingle();
    if (data) return data;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return null;
};

const ensureGymAdminAccess = async (params: {
  userId: string;
  email: string;
  fallbackName?: string;
  gymName?: string;
  comunas?: string[];
  phone?: string;
}) => {
  const { userId, email, fallbackName, gymName, comunas, phone } = params;
  const { data: existingAdmin } = await supabase
    .from('gym_admins')
    .select('gym_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingAdmin?.gym_id) return true;

  const { data: latestRequest } = await supabase
    .from('gym_admin_requests')
    .select('gym_name, comunas, phone')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const resolvedGymName =
    gymName?.trim() ||
    latestRequest?.gym_name?.trim() ||
    `${fallbackName?.trim() || email.split('@')[0]} Gym`;

  const requestComunas = Array.isArray(latestRequest?.comunas) ? latestRequest.comunas : [];
  const resolvedComuna = comunas?.[0] || requestComunas[0] || 'Por definir';
  const resolvedPhone = phone || latestRequest?.phone || '';

  const { data: createdGym, error: gymError } = await supabase
    .from('gyms')
    .insert({
      name: resolvedGymName,
      address: 'Por definir',
      comuna: resolvedComuna,
      phone: resolvedPhone,
      website: '',
      description: 'Gym en configuracion inicial',
      is_active: true,
      approval_status: 'pending',
    })
    .select('id')
    .single();

  if (gymError || !createdGym?.id) throw gymError || new Error('No se pudo crear gym inicial');

  await supabase.from('gym_subscriptions').upsert(
    {
      gym_id: createdGym.id,
      plan: 'free',
      plan_price: 0,
      status: 'active',
      valid_until: null,
    },
    { onConflict: 'gym_id' }
  );

  await supabase.from('gym_admins').insert({ user_id: userId, gym_id: createdGym.id });
  await supabase.from('users').update({ role: 'gym_admin' }).eq('id', userId);
  return true;
};

const ensureCommerceAdminAccess = async (params: {
  userId: string;
  email: string;
  fallbackName?: string;
}) => {
  const { userId, email, fallbackName } = params;
  const { data: existingAdmin } = await supabase
    .from('commerce_admins')
    .select('commerce_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingAdmin?.commerce_id) return true;

  const { data: createdCommerce, error: commerceError } = await supabase
    .from('commerces')
    .insert({
      name: `${fallbackName?.trim() || email.split('@')[0]} Comercio`,
      category: 'otro',
      phone: '',
      description: 'Comercio en configuracion inicial',
      is_active: true,
      approval_status: 'pending',
    })
    .select('id')
    .single();

  if (commerceError || !createdCommerce?.id) throw commerceError || new Error('No se pudo crear comercio inicial');

  await supabase.from('commerce_subscriptions').upsert(
    {
      commerce_id: createdCommerce.id,
      plan: 'free',
      status: 'active',
      valid_until: null,
    },
    { onConflict: 'commerce_id' }
  );

  await supabase.from('commerce_admins').insert({ user_id: userId, commerce_id: createdCommerce.id });
  await supabase.from('users').update({ role: 'commerce_admin' }).eq('id', userId);
  return true;
};

export function AuthPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { signUp, signIn, user, loading, refreshProfile } = useAuth();
  const isLogin = params.get('mode') !== 'register';
  const isReset = params.get('mode') === 'reset';

  // Shared state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [rut, setRut] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [loginType, setLoginType] = useState<AccountType>('usuario');
  const [resolvingLogin, setResolvingLogin] = useState(false);

  // Account type selection
  const [accountType, setAccountType] = useState<AccountType | null>(null);

  // Gym-specific state
  const [gymName, setGymName] = useState('');
  const [gymComunas, setGymComunas] = useState<string[]>([]);
  const [gymPhone, setGymPhone] = useState('');
  const [gymRequestSent] = useState(false);

  // Commerce-specific state
  const [commerceName, setCommerceName] = useState('');
  const [commerceCategory, setCommerceCategory] = useState('nutricion');
  const [commercePhone, setCommercePhone] = useState('');

  // Redirect to role-appropriate home immediately after login — no flash
  const roleHome = (role: string | undefined) => {
    if (role === 'gofitnow_admin') return '/admin/gofitnow';
    if (role === 'gym_admin') return '/gym-admin';
    if (role === 'commerce_admin') return '/admin/commerce';
    return '/home';
  };

  useEffect(() => {
    if (!loading && user && !isReset && !resolvingLogin) {
      navigate(roleHome(user.role), { replace: true });
    }
  }, [user, loading, navigate, isReset, resolvingLogin]);

  useEffect(() => {
    if (params.get('mode') !== 'register' && params.get('mode') !== 'reset') {
      setAccountType(null);
    }
  }, [params]);

  const inputClass = 'w-full px-4 py-3 rounded-xl border border-[#E5E5E5] bg-[#F5F5F5] text-[#111111] focus:outline-none focus:border-[#CC0000] transition-colors';
  const labelClass = 'text-sm text-[#666666] mb-1 block';
  const submitClass = 'w-full py-3.5 bg-[#CC0000] text-white font-bold rounded-xl text-base active:scale-[0.98] transition-transform disabled:opacity-50';

  // ── Reset password mode ──
  if (isReset) {
    if (resetSuccess) {
      return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
          <GoFitNowLogo size="sm" />
          <div className="mt-8 w-full max-w-xs text-center">
            <div className="w-14 h-14 rounded-full bg-[#16A34A]/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-[#16A34A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-[#111111] mb-2">Contraseña actualizada</h2>
            <p className="text-sm text-[#666666] leading-relaxed">
              Tu contraseña fue actualizada. Ya podés iniciar sesión.
            </p>
            <button onClick={() => navigate('/auth?mode=login')} className="mt-6 text-sm text-[#CC0000] font-bold">
              Ir al inicio de sesión
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-white flex flex-col items-center px-6 pt-12">
        <GoFitNowLogo size="sm" />
        <h1 className="text-xl font-bold text-[#111111] mt-6 mb-6">Nueva contraseña</h1>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (password !== confirmPassword) { setError('Las contraseñas no coinciden'); return; }
            setError(''); setSubmitting(true);
            try {
              const { error: updateError } = await supabase.auth.updateUser({ password });
              if (updateError) throw updateError;
              setResetSuccess(true);
            } catch (err: any) {
              setError(err.message || 'No se pudo actualizar la contraseña.');
            } finally { setSubmitting(false); }
          }}
          className="w-full max-w-xs space-y-4"
        >
          <div>
            <label className={labelClass}>Nueva contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className={inputClass} placeholder="Mínimo 6 caracteres" required minLength={6} />
          </div>
          <div>
            <label className={labelClass}>Confirmar contraseña</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputClass} placeholder="Repite la contraseña" required minLength={6} />
          </div>
          {error && <p className="text-[#CC0000] text-sm">{error}</p>}
          <button type="submit" disabled={submitting} className={submitClass}>
            {submitting ? 'Actualizando...' : 'Actualizar contraseña'}
          </button>
        </form>
      </div>
    );
  }

  // ── Awaiting email confirmation ──
  if (awaitingConfirmation && !user) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
        <GoFitNowLogo size="sm" />
        <div className="mt-8 w-full max-w-xs text-center">
          <div className="w-14 h-14 rounded-full bg-[#CC0000]/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[#CC0000]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-[#111111] mb-2">Revisa tu email</h2>
          <p className="text-sm text-[#666666] leading-relaxed">
            Te enviamos un enlace de confirmacion a{' '}
            <span className="font-semibold text-[#111111]">{email}</span>.
            Haz click en el enlace para activar tu cuenta.
          </p>
          <button onClick={() => { setAwaitingConfirmation(false); setError(''); }} className="mt-6 text-sm text-[#CC0000] font-bold">
            Volver al inicio de sesion
          </button>
        </div>
      </div>
    );
  }

  // ── Gym request sent success ──
  if (gymRequestSent) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
        <GoFitNowLogo size="sm" />
        <div className="mt-8 w-full max-w-xs text-center">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <Clock size={28} className="text-amber-500" />
          </div>
          <h2 className="text-lg font-bold text-[#111111] mb-2">Solicitud enviada</h2>
          <p className="text-sm text-[#666666] leading-relaxed">
            Revisaremos tu solicitud y te contactaremos a{' '}
            <span className="font-semibold text-[#111111]">{email}</span>{' '}
            en menos de 48 horas para activar tu panel de administración.
          </p>
          <button onClick={() => navigate('/home')} className={`mt-6 ${submitClass}`}>
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  // ── Recovery flow ──
  if (isRecovery) {
    if (recoverySuccess) {
      return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
          <GoFitNowLogo size="sm" />
          <div className="mt-8 w-full max-w-xs text-center">
            <div className="w-14 h-14 rounded-full bg-[#CC0000]/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-[#CC0000]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-[#111111] mb-2">Revisa tu email</h2>
            <p className="text-sm text-[#666666] leading-relaxed">
              Te enviamos las instrucciones a{' '}
              <span className="font-semibold text-[#111111]">{email}</span>.
              Revisá tu bandeja de entrada.
            </p>
            <button onClick={() => { setIsRecovery(false); setRecoverySuccess(false); setError(''); }} className="mt-6 text-sm text-[#CC0000] font-bold">
              Volver al inicio de sesión
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-white flex flex-col items-center px-6 pt-12">
        <GoFitNowLogo size="sm" />
        <h1 className="text-xl font-bold text-[#111111] mt-6 mb-6">Recuperar contraseña</h1>
        <form
          onSubmit={async (e) => {
            e.preventDefault(); setSubmitting(true); setError('');
            try {
              await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/auth?mode=reset' });
              setRecoverySuccess(true);
            } catch { setError('No se pudo enviar el email. Intenta de nuevo.'); }
            finally { setSubmitting(false); }
          }}
          className="w-full max-w-xs space-y-4"
        >
          <div>
            <label className={labelClass}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} placeholder="tu@email.com" required />
          </div>
          {error && <p className="text-[#CC0000] text-sm">{error}</p>}
          <button type="submit" disabled={submitting} className={submitClass}>
            {submitting ? 'Enviando...' : 'Enviar instrucciones'}
          </button>
        </form>
        <button type="button" onClick={() => setIsRecovery(false)} className="mt-4 text-sm text-[#666666]">
          Volver
        </button>
      </div>
    );
  }

  // ── Login ──
  if (isLogin) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center px-6 pt-12">
        <GoFitNowLogo size="sm" />
        <h1 className="text-xl font-bold text-[#111111] mt-6 mb-6">Inicia sesión</h1>
        <form
          onSubmit={async (e) => {
            e.preventDefault(); setError(''); setSubmitting(true); setResolvingLogin(true);
            try {
              await signIn(email, password);
              await refreshProfile();

              const { data: authData } = await supabase.auth.getUser();
              const authUser = authData.user;
              if (!authUser) throw new Error('No se pudo validar tu sesión');

              const { data: profile } = await supabase
                .from('users')
                .select('role')
                .eq('id', authUser.id)
                .maybeSingle();

              let resolvedRole = profile?.role ?? 'user';
              if (['user', 'gym_pending', 'commerce_pending'].includes(resolvedRole)) {
                const [{ data: gymAdmin }, { data: commerceAdmin }] = await Promise.all([
                  supabase.from('gym_admins').select('id').eq('user_id', authUser.id).maybeSingle(),
                  supabase.from('commerce_admins').select('id').eq('user_id', authUser.id).maybeSingle(),
                ]);
                if (gymAdmin) resolvedRole = 'gym_admin';
                else if (commerceAdmin) resolvedRole = 'commerce_admin';
              }

              if (TEST_MODE_SKIP_VERIFICATION && loginType === 'gym' && resolvedRole !== 'gym_admin') {
                await ensureGymAdminAccess({
                  userId: authUser.id,
                  email: authUser.email ?? email,
                  fallbackName: profile?.role ? undefined : fullName,
                });
                resolvedRole = 'gym_admin';
              }

              if (TEST_MODE_SKIP_VERIFICATION && loginType === 'comercio' && resolvedRole !== 'commerce_admin') {
                await ensureCommerceAdminAccess({
                  userId: authUser.id,
                  email: authUser.email ?? email,
                  fallbackName: profile?.role ? undefined : fullName,
                });
                resolvedRole = 'commerce_admin';
              }

              if (resolvedRole === 'fluxfit_admin') resolvedRole = 'gofitnow_admin';

              navigate(roleHome(resolvedRole), { replace: true });
            }
            catch (err: any) {
              setError(err.message === 'Invalid login credentials' ? 'Credenciales inválidas' : err.message || 'Error al iniciar sesión');
            } finally { setSubmitting(false); setResolvingLogin(false); }
          }}
          className="w-full max-w-xs space-y-4"
        >
          <div>
            <label className={labelClass}>Ingresar como</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setLoginType('usuario')}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${loginType === 'usuario' ? 'bg-[#CC0000] text-white border-[#CC0000]' : 'bg-white text-[#666666] border-[#E5E5E5]'}`}
              >
                Usuario
              </button>
              <button
                type="button"
                onClick={() => setLoginType('gym')}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${loginType === 'gym' ? 'bg-[#CC0000] text-white border-[#CC0000]' : 'bg-white text-[#666666] border-[#E5E5E5]'}`}
              >
                Gym
              </button>
              <button
                type="button"
                onClick={() => setLoginType('comercio')}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${loginType === 'comercio' ? 'bg-[#CC0000] text-white border-[#CC0000]' : 'bg-white text-[#666666] border-[#E5E5E5]'}`}
              >
                Comercio
              </button>
            </div>
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} placeholder="tu@email.com" required />
          </div>
          <div>
            <label className={labelClass}>Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className={inputClass} placeholder="Mínimo 6 caracteres" required minLength={6} />
          </div>
          {error && <p className="text-[#CC0000] text-sm">{error}</p>}
          <button type="submit" disabled={submitting} className={submitClass}>
            {submitting ? 'Cargando...' : 'Iniciar sesión'}
          </button>
          <button type="button" onClick={() => setIsRecovery(true)} className="mt-2 text-sm text-[#666666] w-full text-center">
            ¿Olvidaste tu <span className="text-[#CC0000] font-bold">contraseña?</span>
          </button>
        </form>
        <button onClick={() => { navigate('/auth?mode=register'); setAccountType(null); }} className="mt-4 text-sm text-[#666666]">
          ¿No tienes cuenta? <span className="text-[#CC0000] font-bold">Regístrate</span>
        </button>
      </div>
    );
  }

  // ── Register: account type selection ──
  if (accountType === null) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center px-6 pt-12">
        <GoFitNowLogo size="sm" />
        <h1 className="text-xl font-bold text-[#111111] mt-6 mb-2">¿Cómo quieres usar GoFitNow?</h1>
        <p className="text-sm text-[#666666] mb-8">Elige el tipo de cuenta para continuar</p>
        <div className="w-full max-w-xs space-y-3">
          <button
            onClick={() => setAccountType('usuario')}
            className="w-full bg-white border-2 border-[#E5E5E5] rounded-xl p-5 cursor-pointer active:scale-[0.98] transition-transform text-left hover:border-[#CC0000] hover:shadow-sm"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-[#CC0000]/10 flex items-center justify-center shrink-0">
                <User size={20} className="text-[#CC0000]" />
              </div>
              <div>
                <p className="font-bold text-[#111111] text-sm mb-1">Soy usuario</p>
                <p className="text-xs text-[#666666] leading-relaxed">Busca gyms, compara precios y accede a descuentos exclusivos</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => setAccountType('gym')}
            className="w-full bg-white border-2 border-[#E5E5E5] rounded-xl p-5 cursor-pointer active:scale-[0.98] transition-transform text-left hover:border-[#CC0000] hover:shadow-sm"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-[#CC0000]/10 flex items-center justify-center shrink-0">
                <Building2 size={20} className="text-[#CC0000]" />
              </div>
              <div>
                <p className="font-bold text-[#111111] text-sm mb-1">Tengo un gym</p>
                <p className="text-xs text-[#666666] leading-relaxed">Registra tu gimnasio y llega a más clientes con GoFitNow</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => setAccountType('comercio')}
            className="w-full bg-white border-2 border-[#E5E5E5] rounded-xl p-5 cursor-pointer active:scale-[0.98] transition-transform text-left hover:border-[#CC0000] hover:shadow-sm"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-[#CC0000]/10 flex items-center justify-center shrink-0">
                <Store size={20} className="text-[#CC0000]" />
              </div>
              <div>
                <p className="font-bold text-[#111111] text-sm mb-1">Tengo un comercio</p>
                <p className="text-xs text-[#666666] leading-relaxed">Ofrece descuentos exclusivos a los usuarios premium de GoFitNow</p>
              </div>
            </div>
          </button>
        </div>
        <button onClick={() => navigate('/auth?mode=login')} className="mt-6 text-sm text-[#666666]">
          Volver
        </button>
        <button onClick={() => navigate('/auth?mode=login')} className="mt-4 text-sm text-[#666666]">
          ¿Ya tienes cuenta? <span className="text-[#CC0000] font-bold">Inicia sesión</span>
        </button>
      </div>
    );
  }

  // ── Register: usuario ──
  if (accountType === 'usuario') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center px-6 pt-12">
        <GoFitNowLogo size="sm" />
        <h1 className="text-xl font-bold text-[#111111] mt-6 mb-6">Crea tu cuenta</h1>
        <form
          onSubmit={async (e) => {
            e.preventDefault(); setError(''); setSubmitting(true);
            try {
              await signUp(email, password, fullName, rut.trim() || undefined);
              setRut('');
              navigate('/home');
            } catch (err: any) {
              setError(err.message || 'Error al crear cuenta');
            } finally { setSubmitting(false); }
          }}
          className="w-full max-w-xs space-y-4"
        >
          <div>
            <label className={labelClass}>Nombre completo</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className={inputClass} placeholder="Tu nombre" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#111] mb-1.5">RUT (opcional)</label>
            <input
              type="text"
              value={rut}
              onChange={e => setRut(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[#E5E5E5] text-sm focus:outline-none focus:border-[#CC0000] bg-white text-[#111]"
              placeholder="12.345.678-9"
              maxLength={12}
            />
            <p className="text-xs text-[#666] mt-1">Formato: 12.345.678-9</p>
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} placeholder="tu@email.com" required />
          </div>
          <div>
            <label className={labelClass}>Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className={inputClass} placeholder="Mínimo 6 caracteres" required minLength={6} />
          </div>
          {error && <p className="text-[#CC0000] text-sm">{error}</p>}
          <button type="submit" disabled={submitting} className={submitClass}>
            {submitting ? 'Cargando...' : 'Crear cuenta'}
          </button>
        </form>
        <button type="button" onClick={() => setAccountType(null)} className="mt-4 text-sm text-[#666666]">
          Cambiar tipo de cuenta
        </button>
      </div>
    );
  }

  // ── Register: gym ──
  if (accountType === 'gym') {
    const toggleComuna = (c: string) => {
      setGymComunas(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
    };
    return (
      <div className="min-h-screen bg-white flex flex-col items-center px-6 pt-12 pb-12">
        <GoFitNowLogo size="sm" />
        <h1 className="text-xl font-bold text-[#111111] mt-6 mb-6">Registra tu gym</h1>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (gymComunas.length === 0) { setError('Selecciona al menos una comuna'); return; }
            setError(''); setSubmitting(true);
            try {
              const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
              if (signUpError) throw signUpError;
              const userId = signUpData.user?.id;
              if (!userId) throw new Error('No se pudo crear la cuenta');
              const gymProfile = await waitForProfile(userId);
              if (gymProfile) {
                await supabase.from('users').update({ full_name: fullName, role: 'gym_admin' }).eq('id', userId);
              }
              await supabase.from('gym_admin_requests').insert({
                user_id: userId, gym_name: gymName, comunas: gymComunas, phone: gymPhone, plan_interest: 'por_definir', status: 'pending',
              });
              await ensureGymAdminAccess({
                userId,
                email,
                fallbackName: fullName,
                gymName,
                comunas: gymComunas,
                phone: gymPhone,
              });
              await refreshProfile();
              navigate('/gym-admin', { replace: true });
            } catch (err: any) {
              setError(err.message || 'Error al enviar solicitud');
            } finally { setSubmitting(false); }
          }}
          className="w-full max-w-xs space-y-4"
        >
          <div>
            <label className={labelClass}>Nombre completo del responsable</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className={inputClass} placeholder="Tu nombre" required />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} placeholder="tu@email.com" required />
          </div>
          <div>
            <label className={labelClass}>Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className={inputClass} placeholder="Mínimo 6 caracteres" required minLength={6} />
          </div>
          <div>
            <label className={labelClass}>Nombre del gym o cadena</label>
            <input type="text" value={gymName} onChange={e => setGymName(e.target.value)} className={inputClass} placeholder="Nombre de tu gym" required />
          </div>
          <div>
            <label className={labelClass}>Comunas donde opera</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {COMUNAS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleComuna(c)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${gymComunas.includes(c) ? 'bg-[#CC0000] text-white border-[#CC0000]' : 'bg-white text-[#666666] border-[#E5E5E5]'}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelClass}>Teléfono de contacto</label>
            <input type="tel" value={gymPhone} onChange={e => setGymPhone(e.target.value)} className={inputClass} placeholder="+56 9 1234 5678" required />
          </div>
          {error && <p className="text-[#CC0000] text-sm">{error}</p>}
          <button type="submit" disabled={submitting} className={submitClass}>
            {submitting ? 'Enviando...' : 'Enviar solicitud'}
          </button>
          <p className="text-xs text-[#666] text-center mt-3">
            En modo prueba: acceso inmediato al panel Gym Free para configurar tu cuenta y luego elegir plan.
          </p>
        </form>
        <button type="button" onClick={() => setAccountType(null)} className="mt-4 text-sm text-[#666666]">
          Cambiar tipo de cuenta
        </button>
      </div>
    );
  }

  // ── Register: comercio ──
  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-6 pt-12 pb-12">
      <GoFitNowLogo size="sm" />
      <h1 className="text-xl font-bold text-[#111111] mt-6 mb-6">Registra tu comercio</h1>
      <form
        onSubmit={async (e) => {
          e.preventDefault(); setError(''); setSubmitting(true);
          try {
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
            if (signUpError) throw signUpError;
            const userId = signUpData.user?.id;
            if (!userId) throw new Error('No se pudo crear la cuenta');
            const commerceProfile = await waitForProfile(userId);
            if (commerceProfile) {
              await supabase.from('users').update({ full_name: fullName, role: 'commerce_admin' }).eq('id', userId);
            }
            const { data: commerceData, error: commerceError } = await supabase
              .from('commerces')
              .insert({ name: commerceName, category: commerceCategory, phone: commercePhone, description: '', is_active: true })
              .select('id')
              .single();
            if (commerceError) throw commerceError;
            const { error: adminError } = await supabase
              .from('commerce_admins')
              .insert({ user_id: userId, commerce_id: commerceData.id });
            if (adminError) throw adminError;
            await supabase.from('commerce_subscriptions').upsert(
              { commerce_id: commerceData.id, plan: 'free', status: 'active', valid_until: null },
              { onConflict: 'commerce_id' }
            );
            await refreshProfile();
            navigate('/admin/commerce', { replace: true });
          } catch (err: any) {
            setError(err.message || 'Error al registrar comercio');
          } finally { setSubmitting(false); }
        }}
        className="w-full max-w-xs space-y-4"
      >
        <div>
          <label className={labelClass}>Nombre completo del responsable</label>
          <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className={inputClass} placeholder="Tu nombre" required />
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} placeholder="tu@email.com" required />
        </div>
        <div>
          <label className={labelClass}>Contraseña</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} className={inputClass} placeholder="Mínimo 6 caracteres" required minLength={6} />
        </div>
        <div>
          <label className={labelClass}>Nombre del comercio</label>
          <input type="text" value={commerceName} onChange={e => setCommerceName(e.target.value)} className={inputClass} placeholder="Nombre de tu negocio" required />
        </div>
        <div>
          <label className={labelClass}>Categoría</label>
          <select value={commerceCategory} onChange={e => setCommerceCategory(e.target.value)} className={inputClass}>
            <option value="nutricion">Nutrición</option>
            <option value="suplementos">Suplementos</option>
            <option value="indumentaria">Indumentaria</option>
            <option value="fisioterapia">Fisioterapia</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Teléfono de contacto</label>
          <input type="tel" value={commercePhone} onChange={e => setCommercePhone(e.target.value)} className={inputClass} placeholder="+56 9 1234 5678" required />
        </div>
        {error && <p className="text-[#CC0000] text-sm">{error}</p>}
        <button type="submit" disabled={submitting} className={submitClass}>
          {submitting ? 'Registrando...' : 'Registrar comercio'}
        </button>
      </form>
      <button type="button" onClick={() => setAccountType(null)} className="mt-4 text-sm text-[#666666]">
        Cambiar tipo de cuenta
      </button>
    </div>
  );
}
