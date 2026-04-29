import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FluxFitLogo } from '../components/FluxFitLogo';
import { useAuth } from '../context/AuthContext';

export function AuthPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { signUp, signIn, user, loading } = useAuth();
  const isLogin = params.get('mode') !== 'register';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  // Navigate only when the context has a real authenticated user loaded
  useEffect(() => {
    if (!loading && user) {
      navigate('/home', { replace: true });
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (isLogin) {
        await signIn(email, password);
        // navigation handled by useEffect above once onAuthStateChange fires
      } else {
        await signUp(email, password, fullName);
        // If email confirmation is required, no session is created yet
        setAwaitingConfirmation(true);
      }
    } catch (err: any) {
      setError(
        err.message === 'Invalid login credentials'
          ? 'Credenciales invalidas'
          : err.message || 'Error al iniciar sesion'
      );
    } finally {
      setSubmitting(false);
    }
  };

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

  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-6 pt-12">
      <FluxFitLogo size="sm" />
      <h1 className="text-xl font-bold text-[#111111] mt-6 mb-6">
        {isLogin ? 'Inicia sesion' : 'Crea tu cuenta'}
      </h1>
      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-4">
        {!isLogin && (
          <div>
            <label className="text-sm text-[#666666] mb-1 block">Nombre completo</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-[#E5E5E5] bg-[#F5F5F5] text-[#111111] focus:outline-none focus:border-[#CC0000] transition-colors"
              placeholder="Tu nombre"
              required
            />
          </div>
        )}
        <div>
          <label className="text-sm text-[#666666] mb-1 block">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-[#E5E5E5] bg-[#F5F5F5] text-[#111111] focus:outline-none focus:border-[#CC0000] transition-colors"
            placeholder="tu@email.com"
            required
          />
        </div>
        <div>
          <label className="text-sm text-[#666666] mb-1 block">Contrasena</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-[#E5E5E5] bg-[#F5F5F5] text-[#111111] focus:outline-none focus:border-[#CC0000] transition-colors"
            placeholder="Minimo 6 caracteres"
            required
            minLength={6}
          />
        </div>
        {error && <p className="text-[#CC0000] text-sm">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 bg-[#CC0000] text-white font-bold rounded-xl text-base active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {submitting ? 'Cargando...' : isLogin ? 'Iniciar sesion' : 'Crear cuenta'}
        </button>
      </form>
      <button
        onClick={() => navigate(isLogin ? '/auth?mode=register' : '/auth?mode=login')}
        className="mt-4 text-sm text-[#666666]"
      >
        {isLogin ? 'No tienes cuenta? ' : 'Ya tienes cuenta? '}
        <span className="text-[#CC0000] font-bold">{isLogin ? 'Registrate' : 'Inicia sesion'}</span>
      </button>
    </div>
  );
}
