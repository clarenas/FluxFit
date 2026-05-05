import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BottomNav } from './components/BottomNav';
import { SplashPage } from './pages/SplashPage';
import { AuthPage } from './pages/AuthPage';
import { HomePage } from './pages/HomePage';
import { GymProfilePage } from './pages/GymProfilePage';
import { PremiumPage } from './pages/PremiumPage';
import { DiscountsPage } from './pages/DiscountsPage';
import { ComparePage } from './pages/ComparePage';
import { FavoritesPage } from './pages/FavoritesPage';
import { ProfilePage } from './pages/ProfilePage';
import { GymAdminPage } from './pages/GymAdminPage';
import { CommerceAdminPage } from './pages/CommerceAdminPage';
import { ContactPage } from './pages/ContactPage';
import { AdminFluxFitPage } from './pages/AdminFluxFitPage';
import { SensorInventoryPage } from './pages/SensorInventoryPage';

// Resolves where an authenticated user should land when hitting "/"
function roleHome(role: string | undefined): string {
  if (role === 'fluxfit_admin') return '/admin/fluxfit';
  if (role === 'gym_admin') return '/admin/gym';
  if (role === 'commerce_admin') return '/admin/commerce';
  return '/home';
}

// Loading screen shared across gate components
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#CC0000] border-t-transparent rounded-full animate-spin" />
        <span className="text-[#666] text-sm">Cargando...</span>
      </div>
    </div>
  );
}

// Guards any route that requires authentication.
// While loading: show spinner. Not auth'd: redirect to /auth.
// Authenticated: render children (role-specific redirect handled at route level).
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, isGuest } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user && !isGuest) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

// Guards routes that must only be accessible by a specific role.
// Wrong role → send to that role's home.
function RoleGuard({ role, children }: { role: string; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  if (user.role !== role) return <Navigate to={roleHome(user.role)} replace />;
  return <>{children}</>;
}

function AppShell() {
  const { user, loading } = useAuth();
  const location = useLocation();

  const showNav = [
    '/home', '/favorites', '/premium', '/profile', '/discounts', '/compare',
  ].some(p => location.pathname.startsWith(p)); // /admin/fluxfit covers /admin/fluxfit/sensores too

  // While auth is resolving, render nothing to avoid flash
  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      {showNav && <BottomNav />}
      <div className={showNav ? 'md:ml-[200px] md:min-h-screen' : ''}>
        <div className="max-w-[430px] mx-auto md:max-w-[900px]">
          <Routes>
            {/* Public */}
            <Route path="/" element={<SplashPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/contact" element={<ContactPage />} />

            {/* Role-based root redirect: /home goes to role home */}
            <Route
              path="/home"
              element={
                user && user.role !== 'user'
                  ? <Navigate to={roleHome(user.role)} replace />
                  : <AuthGuard><HomePage /></AuthGuard>
              }
            />

            {/* User-only routes */}
            <Route path="/gym/:id"   element={<AuthGuard><GymProfilePage /></AuthGuard>} />
            <Route path="/favorites" element={<AuthGuard><FavoritesPage /></AuthGuard>} />
            <Route path="/profile"   element={<AuthGuard><ProfilePage /></AuthGuard>} />
            <Route path="/discounts" element={<AuthGuard><DiscountsPage /></AuthGuard>} />
            <Route path="/compare"   element={<AuthGuard><ComparePage /></AuthGuard>} />

            {/* Premium page — accessible by all roles, shows role-specific content */}
            <Route path="/premium" element={<AuthGuard><PremiumPage /></AuthGuard>} />

            {/* Gym admin routes — role-gated */}
            <Route path="/admin/gym"          element={<RoleGuard role="gym_admin"><GymAdminPage /></RoleGuard>} />
            <Route path="/admin/gym/branches" element={<RoleGuard role="gym_admin"><GymAdminPage initialTab="sucursales" /></RoleGuard>} />
            <Route path="/admin/gym/offers"   element={<RoleGuard role="gym_admin"><GymAdminPage initialTab="planes" /></RoleGuard>} />
            <Route path="/admin/gym/premium"  element={<RoleGuard role="gym_admin"><GymAdminPage initialTab="mi_plan" /></RoleGuard>} />

            {/* Commerce admin routes — role-gated */}
            <Route path="/admin/commerce"          element={<RoleGuard role="commerce_admin"><CommerceAdminPage /></RoleGuard>} />
            <Route path="/admin/commerce/coupons"  element={<RoleGuard role="commerce_admin"><CommerceAdminPage initialTab="cupones" /></RoleGuard>} />
            <Route path="/admin/commerce/stats"    element={<RoleGuard role="commerce_admin"><CommerceAdminPage initialTab="estadisticas" /></RoleGuard>} />
            <Route path="/admin/commerce/premium"  element={<RoleGuard role="commerce_admin"><CommerceAdminPage initialTab="mi_plan" /></RoleGuard>} />

            {/* FluxFit super-admin routes — role-gated */}
            <Route path="/admin/fluxfit"           element={<RoleGuard role="fluxfit_admin"><AdminFluxFitPage /></RoleGuard>} />
            <Route path="/admin/fluxfit/socios"    element={<RoleGuard role="fluxfit_admin"><AdminFluxFitPage initialTab="pendientes" /></RoleGuard>} />
            <Route path="/admin/fluxfit/impacto"   element={<RoleGuard role="fluxfit_admin"><AdminFluxFitPage initialTab="impacto" /></RoleGuard>} />
            <Route path="/admin/fluxfit/config"    element={<RoleGuard role="fluxfit_admin"><AdminFluxFitPage initialTab="usuarios" /></RoleGuard>} />
            <Route path="/admin/fluxfit/sensores"  element={<RoleGuard role="fluxfit_admin"><SensorInventoryPage /></RoleGuard>} />

            {/* Catch-all: send to role home */}
            <Route path="*" element={<Navigate to={user ? roleHome(user.role) : '/auth'} replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </BrowserRouter>
  );
}
