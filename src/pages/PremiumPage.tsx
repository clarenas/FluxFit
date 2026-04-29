import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { FluxFitLogo } from '../components/FluxFitLogo';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { formatCLP } from '../lib/utils';

export function PremiumPage() {
  const navigate = useNavigate();
  const { user, refreshProfile, isGuest } = useAuth();
  const [loading, setLoading] = useState(false);
  const isPremium = user?.is_premium ?? false;

  const activatePremium = async () => {
    if (!user || isGuest) return;
    setLoading(true);
    try {
      await supabase.from('users').update({ is_premium: true, premium_since: new Date().toISOString() }).eq('id', user.id);
      await refreshProfile();
    } finally { setLoading(false); }
  };

  const features = ['Precios especiales en todos los gyms', 'Descuentos en comercios asociados', 'Precios rebajados en servicios internos', 'Distintivo Premium en tu perfil'];
  const comparison = [
    { feature: 'Ver ocupación', free: true, premium: true }, { feature: 'Buscar gyms', free: true, premium: true },
    { feature: 'Precios rebajados', free: false, premium: true }, { feature: 'Descuentos comercios', free: false, premium: true },
    { feature: 'Precio especial servicios', free: false, premium: true },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-20">
      <div className="bg-[#CC0000] px-4 pt-12 pb-8 text-center">
        <FluxFitLogo size="sm" />
        <h1 className="text-white font-bold text-2xl mt-4">FluxFit Premium</h1>
      </div>
      <div className="px-4 -mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border-2 border-[#E5E5E5] p-4 text-center"><p className="text-[#111111] font-bold text-lg">{formatCLP(3990)}</p><p className="text-[#666666] text-sm">/ mes</p></div>
          <div className="bg-[#CC0000] rounded-xl p-4 text-center relative">
            <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-[#111111] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">MEJOR VALOR</span>
            <p className="text-white font-bold text-lg">{formatCLP(35900)}</p><p className="text-white/70 text-sm">/ año</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#E5E5E5] p-4">
          <ul className="space-y-3">{features.map((f, i) => <li key={i} className="flex items-center gap-2 text-sm text-[#111111]"><Check size={16} className="text-[#CC0000] flex-shrink-0" />{f}</li>)}</ul>
        </div>
        <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[#E5E5E5]"><th className="text-left p-3 text-[#666666] font-normal" /><th className="p-3 text-[#666666] font-normal text-center">Sin membresía</th><th className="p-3 text-center text-[#CC0000] font-bold">✦ FluxFit</th></tr></thead>
            <tbody>
              {comparison.map((row, i) => (
                <tr key={i} className="border-b border-[#E5E5E5] last:border-0">
                  <td className="p-3 text-[#111111]">{row.feature}</td>
                  <td className="p-3 text-center">{row.free ? <Check size={16} className="text-[#16A34A] mx-auto" /> : <X size={16} className="text-[#CC0000] mx-auto" />}</td>
                  <td className="p-3 text-center">{row.premium ? <Check size={16} className="text-[#16A34A] mx-auto" /> : <X size={16} className="text-[#CC0000] mx-auto" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isPremium ? (
          <div className="bg-[#16A34A]/10 border border-[#16A34A]/30 rounded-xl p-4 text-center">
            <p className="text-[#16A34A] font-bold">Ya eres miembro FluxFit Premium</p>
            {user?.premium_since && <p className="text-[#16A34A] text-sm mt-1">Miembro desde {new Date(user.premium_since).toLocaleDateString('es-CL')}</p>}
          </div>
        ) : isGuest ? (
          <button onClick={() => navigate('/auth?mode=register')} className="w-full py-4 bg-[#CC0000] text-white font-bold rounded-xl text-lg active:scale-[0.98] transition-transform">Crea tu cuenta para activar Premium</button>
        ) : (
          <button onClick={activatePremium} disabled={loading} className="w-full py-4 bg-[#CC0000] text-white font-bold rounded-xl text-lg active:scale-[0.98] transition-transform disabled:opacity-50">{loading ? 'Activando...' : 'Activar FluxFit Premium'}</button>
        )}
        <p className="text-center text-xs text-[#999]">Pago seguro. Cancela cuando quieras.</p>
      </div>
    </div>
  );
}
