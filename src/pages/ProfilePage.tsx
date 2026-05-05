import { useNavigate } from 'react-router-dom';
import { LogOut, Eye, Mail, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getInitials, getRoleBadge } from '../lib/utils';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useGyms } from '../hooks/useGyms';

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, signOut, isGuest } = useAuth();
  const [profileData, setProfileData] = useState<{ role: string; full_name: string; email: string } | null>(null);
  const role = profileData?.role ?? user?.role ?? 'user';
  const roleBadge = getRoleBadge(role);
  const isAdminRole = ['fluxfit_admin', 'gym_admin', 'commerce_admin'].includes(role);
  const isPremium = user?.is_premium ?? false;

  // User-only: favorites
  const [favIds, setFavIds] = useState<string[]>([]);
  const { gyms: allGyms } = useGyms();
  const favGyms = allGyms.filter(g => favIds.includes(g.id));

  const fetchProfileData = useCallback(async () => {
    if (!user || isGuest) return;
    const { data } = await supabase
      .from('users')
      .select('role, full_name, email')
      .eq('id', user.id)
      .single();
    if (data) setProfileData(data);
  }, [user, isGuest]);

  const fetchFavGyms = useCallback(async () => {
    if (!user || isGuest || isAdminRole) return;
    const { data } = await supabase.from('user_favorite_gyms').select('gym_id').eq('user_id', user.id);
    setFavIds(data ? data.map(f => f.gym_id) : []);
  }, [user, isGuest, isAdminRole]);

  useEffect(() => { fetchProfileData(); }, [fetchProfileData]);
  useEffect(() => { fetchFavGyms(); }, [fetchFavGyms]);

  const handleSignOut = async () => { await signOut(); navigate('/'); };

  // ── Guest ──────────────────────────────────────────────────────────────────
  if (isGuest) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] pb-20">
        <div className="bg-white border-b border-[#E5E5E5] px-4 py-3">
          <h1 className="text-[#111111] font-bold text-lg">Perfil</h1>
        </div>
        <div className="px-4 pt-6 space-y-4">
          <div className="bg-white rounded-xl border border-[#E5E5E5] p-5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#E5E5E5] flex items-center justify-center text-[#666]">
              <Eye size={24} />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-[#111111]">Modo invitado</h2>
              <p className="text-sm text-[#666666]">Estás explorando la app sin cuenta</p>
            </div>
          </div>
          <div className="bg-[#CC0000]/10 border border-[#CC0000]/30 rounded-xl p-4">
            <p className="text-[#CC0000] font-bold">Crea tu cuenta para acceder a todo</p>
            <p className="text-[#CC0000] text-sm mt-1">Guarda gyms, activa Premium y obtén descuentos exclusivos</p>
          </div>
          <button onClick={() => navigate('/auth?mode=register')} className="w-full py-3.5 bg-[#CC0000] text-white font-bold rounded-xl text-base active:scale-[0.98] transition-transform">Crear cuenta</button>
          <button onClick={() => navigate('/auth?mode=login')} className="w-full py-3.5 border-2 border-[#111111] text-[#111111] font-bold rounded-xl text-base active:scale-[0.98] transition-transform">Ya tengo cuenta</button>
          <button onClick={() => navigate('/')} className="w-full py-3.5 border-2 border-[#CC0000]/30 text-[#CC0000] font-bold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
            <LogOut size={18} /> Salir del modo invitado
          </button>
        </div>
      </div>
    );
  }

  // ── Admin roles: clean profile with admin panel access only ───────────────
  if (isAdminRole) {
    const adminPath = role === 'fluxfit_admin' ? '/admin/fluxfit' : role === 'gym_admin' ? '/admin/gym' : '/admin/commerce';
    const adminLabel = role === 'fluxfit_admin' ? 'Panel Global FluxFit' : role === 'gym_admin' ? 'Panel de mi Gym' : 'Panel de mi Comercio';
    return (
      <div className="min-h-screen bg-[#F5F5F5] pb-20">
        <div className="bg-white border-b border-[#E5E5E5] px-4 py-3">
          <h1 className="text-[#111111] font-bold text-lg">Perfil</h1>
        </div>
        <div className="px-4 pt-6 space-y-4">
          {/* Identity card */}
          <div className="bg-white rounded-xl border border-[#E5E5E5] p-5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#CC0000] flex items-center justify-center text-white font-bold text-lg">
              {user ? getInitials(user.full_name) : '?'}
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-[#111111]">{profileData?.full_name || user?.full_name || 'Administrador'}</h2>
              <p className="text-sm text-[#666666]">{profileData?.email || user?.email}</p>
              <span className={`inline-block mt-1 px-3 py-1 rounded-full text-sm font-medium ${roleBadge.className}`}>
                {roleBadge.label}
              </span>
            </div>
          </div>

          {/* Quick access to admin panel */}
          <button
            onClick={() => navigate(adminPath)}
            className="w-full bg-[#CC0000] text-white font-bold rounded-xl p-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
          >
            <LayoutDashboard size={20} />
            <div className="text-left">
              <p className="font-bold">{adminLabel}</p>
              <p className="text-white/70 text-xs font-normal">Volver al panel de control</p>
            </div>
          </button>

          <button
            onClick={handleSignOut}
            className="w-full py-3.5 border-2 border-[#111111] text-[#111111] font-bold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <LogOut size={18} /> Cerrar sesión
          </button>
          <button
            onClick={() => navigate('/contact')}
            className="w-full py-3.5 border border-[#E5E5E5] text-[#666666] rounded-xl flex items-center justify-center gap-2 text-sm active:scale-[0.98] transition-transform"
          >
            <Mail size={16} /> Contáctanos
          </button>
        </div>
      </div>
    );
  }

  // ── User: full profile with favorites and premium ─────────────────────────
  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-20">
      <div className="bg-white border-b border-[#E5E5E5] px-4 py-3">
        <h1 className="text-[#111111] font-bold text-lg">Perfil</h1>
      </div>
      <div className="px-4 pt-6 space-y-4">
        {/* Identity card */}
        <div className="bg-white rounded-xl border border-[#E5E5E5] p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[#CC0000] flex items-center justify-center text-white font-bold text-lg">
            {user ? getInitials(user.full_name) : '?'}
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-[#111111]">{profileData?.full_name || user?.full_name || 'Usuario'}</h2>
            <p className="text-sm text-[#666666]">{profileData?.email || user?.email}</p>
            <span className={`inline-block mt-1 px-3 py-1 rounded-full text-sm font-medium ${roleBadge.className}`}>
              {roleBadge.label}
            </span>
            {isPremium && (
              <span className="inline-block mt-1 bg-[#CC0000] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                FluxFit Premium
              </span>
            )}
          </div>
        </div>

        {/* Premium status / CTA */}
        {isPremium && user?.premium_since ? (
          <div className="bg-[#16A34A]/10 border border-[#16A34A]/30 rounded-xl p-4">
            <p className="text-[#16A34A] font-bold">Miembro Premium activo</p>
            <p className="text-[#16A34A] text-sm mt-1">
              Miembro desde {new Date(user.premium_since).toLocaleDateString('es-CL')}
            </p>
          </div>
        ) : (
          <button
            onClick={() => navigate('/premium')}
            className="w-full bg-[#CC0000] text-white font-bold rounded-xl p-4 text-left active:scale-[0.98] transition-transform"
          >
            <p className="font-bold text-lg">Hazte Premium</p>
            <p className="text-white/80 text-sm mt-1">Desbloquea descuentos y precios especiales</p>
          </button>
        )}

        {/* Saved gyms */}
        <div>
          <h3 className="font-bold text-[#111111] mb-3">Mis gyms guardados</h3>
          {favGyms.length === 0 ? (
            <p className="text-sm text-[#666666]">Aún no tienes gyms guardados</p>
          ) : (
            <div className="space-y-2">
              {favGyms.map(gym => (
                <button
                  key={gym.id}
                  onClick={() => navigate(`/gym/${gym.id}`)}
                  className="w-full bg-white rounded-xl border border-[#E5E5E5] p-3 flex items-center justify-between active:scale-[0.98] transition-transform"
                >
                  <div className="text-left">
                    <p className="font-bold text-[#111111] text-sm">{gym.name}</p>
                    <p className="text-xs text-[#666666]">{gym.comuna}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${gym.sensor_online ? 'bg-[#16A34A] text-white' : 'bg-[#E5E5E5] text-[#666]'}`}>
                    {gym.sensor_online ? gym.occupancy_status : 'Sin datos'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleSignOut}
          className="w-full py-3.5 border-2 border-[#111111] text-[#111111] font-bold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <LogOut size={18} /> Cerrar sesión
        </button>
        <button
          onClick={() => navigate('/contact')}
          className="w-full py-3.5 border border-[#E5E5E5] text-[#666666] rounded-xl flex items-center justify-center gap-2 text-sm active:scale-[0.98] transition-transform"
        >
          <Mail size={16} /> Contáctanos
        </button>
      </div>
    </div>
  );
}
