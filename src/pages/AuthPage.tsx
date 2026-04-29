import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FluxFitLogo } from '../components/FluxFitLogo';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export function AuthPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { signUp, signIn, user, loading } = useAuth();
  const isLogin = params.get('mode') !== 'register';
  const isReset = params.get('mode') === 'reset';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    if (!loading && user && !isReset) {
      navigate('/home', { replace: true });
    }
  }, [user, loading, navigate, isReset]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(email, password, fullName);
        setAwaitingConfirmation(true);
      }
    } catch (err: any) {
      setError(
        err.message === 'Invalid login credentials'
          ? 'Credenciales inválidas'
          : err.message || 'Error al iniciar sesión'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/auth?mode=reset',
      });
      setRecoverySuccess(true);
    } catch {
      setError('No se pudo enviar el email. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setResetSuccess(true);
    } catch (err: any) {
      setError(err.message || 'No se pudo actualizar la contraseña.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'w-full px-4 py-3 rounded-xl border border-[#E5E5E5] bg-[#F5F5F5] text-[#111111] focus:outline-none focus:border-[#CC0000] transition-colors';
  const labelClass = 'text-sm text-[#666666] mb-1 block';
  const submitClass = 'w-full py-3.5 bg-[#CC0000] text-white font-bold rounded-xl text-base active:scale-[0.98] transition-transform disabled:opacity-50';

  // ── Reset password mode (from email link) ──
  if (isReset) {
    if (resetSuccess) {
      return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
          <FluxFitLogo size="sm" />
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
            <button
              onClick={() => navigate('/auth?mode=login')}
              className="mt-6 text-sm text-[#CC0000] font-bold"
            >
              Ir al inicio de sesión
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-white flex flex-col items-center px-6 pt-12">
        <FluxFitLogo size="sm" />
        <h1 className="text-xl font-bold text-[#111111] mt-6 mb-6">Nueva contraseña</h1>
        <form onSubmit={handleResetPassword} className="w-full max-w-xs space-y-4">
          <div>
            <label className={labelClass}>Nueva contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className={inputClass}
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
            />
          </div>
          <div>
            <label className={labelClass}>Confirmar contraseña</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className={inputClass}
              placeholder="Repite la contraseña"
              required
              minLength={6}
            />
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
        <FluxFitLogo size="sm" />
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
          <button
            onClick={() => { setAwaitingConfirmation(false); setError(''); }}
            className="mt-6 text-sm text-[#CC0000] font-bold"
          >
            Volver al inicio de sesion
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
          <FluxFitLogo size="sm" />
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
            <button
              onClick={() => { setIsRecovery(false); setRecoverySuccess(false); setError(''); }}
              className="mt-6 text-sm text-[#CC0000] font-bold"
            >
              Volver al inicio de sesión
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-white flex flex-col items-center px-6 pt-12">
        <FluxFitLogo size="sm" />
        <h1 className="text-xl font-bold text-[#111111] mt-6 mb-6">Recuperar contraseña</h1>
        <form onSubmit={handleRecovery} className="w-full max-w-xs space-y-4">
          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className={inputClass}
              placeholder="tu@email.com"
              required
            />
          </div>
          {error && <p className="text-[#CC0000] text-sm">{error}</p>}
          <button type="submit" disabled={submitting} className={submitClass}>
            {submitting ? 'Enviando...' : 'Enviar instrucciones'}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setIsRecovery(false)}
          className="mt-4 text-sm text-[#666666]"
        >
          Volver
        </button>
      </div>
    );
  }

  // ── Normal login / register ──
  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-6 pt-12">
      <FluxFitLogo size="sm" />
      <h1 className="text-xl font-bold text-[#111111] mt-6 mb-6">
        {isLogin ? 'Inicia sesión' : 'Crea tu cuenta'}
      </h1>
      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-4">
        {!isLogin && (
          <div>
            <label className={labelClass}>Nombre completo</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className={inputClass}
              placeholder="Tu nombre"
              required
            />
          </div>
        )}
        <div>
          <label className={labelClass}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className={inputClass}
            placeholder="tu@email.com"
            required
          />
        </div>
        <div>
          <label className={labelClass}>Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className={inputClass}
            placeholder="Mínimo 6 caracteres"
            required
            minLength={6}
          />
        </div>
        {error && <p className="text-[#CC0000] text-sm">{error}</p>}
        <button type="submit" disabled={submitting} className={submitClass}>
          {submitting ? 'Cargando...' : isLogin ? 'Iniciar sesión' : 'Crear cuenta'}
        </button>
        {isLogin && (
          <button
            type="button"
            onClick={() => setIsRecovery(true)}
            className="mt-2 text-sm text-[#666666] w-full text-center"
          >
            ¿Olvidaste tu <span className="text-[#CC0000] font-bold">contraseña?</span>
          </button>
        )}
      </form>
      <button
        onClick={() => navigate(isLogin ? '/auth?mode=register' : '/auth?mode=login')}
        className="mt-4 text-sm text-[#666666]"
      >
        {isLogin ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
        <span className="text-[#CC0000] font-bold">{isLogin ? 'Regístrate' : 'Inicia sesión'}</span>
      </button>
    </div>
  );
}
