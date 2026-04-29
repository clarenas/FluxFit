import { FluxFitLogo } from '../components/FluxFitLogo';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye } from 'lucide-react';

export function SplashPage() {
  const navigate = useNavigate();
  const { enterAsGuest } = useAuth();

  const handleGuest = () => {
    enterAsGuest();
    navigate('/home');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-8">
      <FluxFitLogo size="lg" />
      <div className="w-full max-w-xs mt-12 space-y-3">
        <button onClick={() => navigate('/auth?mode=register')} className="w-full py-3.5 bg-[#CC0000] text-white font-bold rounded-xl text-base active:scale-[0.98] transition-transform">Crear cuenta</button>
        <button onClick={() => navigate('/auth?mode=login')} className="w-full py-3.5 border-2 border-[#111111] text-[#111111] font-bold rounded-xl text-base active:scale-[0.98] transition-transform">Ya tengo cuenta</button>
        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#E5E5E5]" /></div>
          <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-[#999]">o</span></div>
        </div>
        <button onClick={handleGuest} className="w-full py-3.5 border-2 border-[#CC0000]/30 text-[#CC0000] font-bold rounded-xl text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform bg-[#CC0000]/5">
          <Eye size={18} />
          Explorar como invitado
        </button>
      </div>
    </div>
  );
}
