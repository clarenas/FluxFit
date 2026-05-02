import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FluxFitLogo } from '../components/FluxFitLogo';
import { supabase } from '../lib/supabase';

export function SplashPage() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 100);
    const t2 = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        navigate('/home', { replace: true });
      } else {
        navigate('/auth', { replace: true });
      }
    }, 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className={`transition-all duration-700 ${
        visible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
      }`}>
        <FluxFitLogo size="lg" />
      </div>
    </div>
  );
}
