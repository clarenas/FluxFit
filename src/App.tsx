import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BottomNav } from './components/BottomNav';
import { SplashPage } from './pages/SplashPage';
import { AuthPage } from './pages/AuthPage';
import { HomePage } from './pages/HomePage';
import { GymProfilePage } from './pages/GymProfilePage';
import { PremiumPage } from './pages/PremiumPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { ProfilePage } from './pages/ProfilePage';
import { GymAdminPage } from './pages/GymAdminPage';
import { CommerceAdminPage } from './pages/CommerceAdminPage';
import { ContactPage } from './pages/ContactPage';
import { AdminFluxFitPage } from './pages/AdminFluxFitPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isGuest } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#666]">
        Cargando...
      </div>
    );
  }

  if (!user && !isGuest) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function AppShell() {
  const location = useLocation();
  const showNav = ['/home', '/favorites', '/premium', '/profile', '/admin/gym', '/admin/commerce'].some(p =>
    location.pathname.startsWith(p)
  );
  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      {showNav && <BottomNav />}
      <div className={showNav ? 'md:ml-[200px] md:min-h-screen' : ''}>
        <div className="max-w-[430px] mx-auto md:max-w-[900px]">
          <Routes>
            <Route path="/" element={<SplashPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
            <Route path="/gym/:id" element={<ProtectedRoute><GymProfilePage /></ProtectedRoute>} />
            <Route path="/favorites" element={<ProtectedRoute><FavoritesPage /></ProtectedRoute>} />
            <Route path="/premium" element={<ProtectedRoute><PremiumPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/contact" element={<ContactPage />} />
            {/* Gym admin routes — all render GymAdminPage with tab param */}
            <Route path="/admin/gym" element={<ProtectedRoute><GymAdminPage /></ProtectedRoute>} />
            <Route path="/admin/gym/branches" element={<ProtectedRoute><GymAdminPage initialTab="sucursales" /></ProtectedRoute>} />
            <Route path="/admin/gym/offers" element={<ProtectedRoute><GymAdminPage initialTab="planes" /></ProtectedRoute>} />
            <Route path="/admin/gym/premium" element={<ProtectedRoute><GymAdminPage initialTab="mi_plan" /></ProtectedRoute>} />
            {/* Commerce admin routes */}
            <Route path="/admin/commerce" element={<ProtectedRoute><CommerceAdminPage /></ProtectedRoute>} />
            <Route path="/admin/commerce/coupons" element={<ProtectedRoute><CommerceAdminPage initialTab="cupones" /></ProtectedRoute>} />
            <Route path="/admin/commerce/stats" element={<ProtectedRoute><CommerceAdminPage initialTab="estadisticas" /></ProtectedRoute>} />
            <Route path="/admin/commerce/premium" element={<ProtectedRoute><CommerceAdminPage initialTab="mi_plan" /></ProtectedRoute>} />
            {/* FluxFit super admin */}
            <Route path="/admin/fluxfit" element={<ProtectedRoute><AdminFluxFitPage /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/home" replace />} />
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
