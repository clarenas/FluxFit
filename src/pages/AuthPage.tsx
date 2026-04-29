import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FluxFitLogo } from '../components/FluxFitLogo';
import { useAuth } from '../context/AuthContext';

export function AuthPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { signUp, signIn } = useAuth();
  const isLogin = params.get('mode') !== 'register';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) { await signIn(email, password); } else { await signUp(email, password, fullName); }
      navigate('/home');
    } catch (err: any) {
      setError(err.message === 'Invalid login credentials' ? 'Credenciales inválidas' : err.message || 'Error al iniciar sesión');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-6 pt-12">
      <FluxFitLogo size="sm" />
      <h1 className="text-xl font-bold text-[#111111] mt-6 mb-6">{isLogin ? 'Inicia sesión' : 'Crea tu cuenta'}</h1>
      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-4">
        {!isLogin && (
          <div>
            <label className="text-sm text-[#666666] mb-1 block">Nombre completo</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-[#E5E5E5] bg-[#F5F5F5] text-[#111111] focus:outline-none focus:border-[#CC0000] transition-colors" placeholder="Tu nombre" required />
          </div>
        )}
        <div>
          <label className="text-sm text-[#666666] mb-1 block">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-[#E5E5E5] bg-[#F5F5F5] text-[#111111] focus:outline-none focus:border-[#CC0000] transition-colors" placeholder="tu@email.com" required />
        </div>
        <div>
          <label className="text-sm text-[#666666] mb-1 block">Contraseña</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-[#E5E5E5] bg-[#F5F5F5] text-[#111111] focus:outline-none focus:border-[#CC0000] transition-colors" placeholder="Mínimo 6 caracteres" required minLength={6} />
        </div>
        {error && <p className="text-[#CC0000] text-sm">{error}</p>}
        <button type="submit" disabled={loading} className="w-full py-3.5 bg-[#CC0000] text-white font-bold rounded-xl text-base active:scale-[0.98] transition-transform disabled:opacity-50">
          {loading ? 'Cargando...' : isLogin ? 'Iniciar sesión' : 'Crear cuenta'}
        </button>
      </form>
      <button onClick={() => navigate(isLogin ? '/auth?mode=register' : '/auth?mode=login')} className="mt-4 text-sm text-[#666666]">
        {isLogin ? 'No tienes cuenta? ' : 'Ya tienes cuenta? '}
        <span className="text-[#CC0000] font-bold">{isLogin ? 'Regístrate' : 'Inicia sesión'}</span>
      </button>
    </div>
  );
}
