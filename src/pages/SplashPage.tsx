import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FluxFitLogo } from '../components/FluxFitLogo';
import { supabase } from '../lib/supabase';

export function SplashPage() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [taglineVisible, setTaglineVisible] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 100);
    const t2 = setTimeout(() => setTaglineVisible(true), 500);
    const t3 = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        navigate('/home', { replace: true });
      } else {
        navigate('/auth', { replace: true });
      }
    }, 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
      <div className={`transition-all duration-700 ${
        visible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
      }`}>
        <FluxFitLogo size="lg" />
      </div>
      <p className={`text-[#666666] text-sm transition-all duration-500 ${
        taglineVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}>
        Hecho por Humanas
      </p>
    </div>
  );
}
