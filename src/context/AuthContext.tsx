import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '../lib/types';
import type { Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isGuest: boolean;
  signUp: (email: string, password: string, fullName: string, rut?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  enterAsGuest: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  const fetchProfile = async (userId: string): Promise<User | null> => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (!data) return null;

    // Fallback role resolution: some historical accounts may still have role='user'
    // even when linked to gym_admins/commerce_admins.
    if (data.role === 'user') {
      const [{ data: gymAdmin }, { data: commerceAdmin }] = await Promise.all([
        supabase.from('gym_admins').select('id').eq('user_id', userId).maybeSingle(),
        supabase.from('commerce_admins').select('id').eq('user_id', userId).maybeSingle(),
      ]);

      if (gymAdmin) return { ...data, role: 'gym_admin' };
      if (commerceAdmin) return { ...data, role: 'commerce_admin' };
    }

    return data;
  };

  const waitForProfile = async (userId: string): Promise<User | null> => {
    for (let i = 0; i < 10; i++) {
      const profile = await fetchProfile(userId);
      if (profile) return profile;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    return null;
  };

  const refreshProfile = async () => {
    if (session?.user) {
      const profile = await fetchProfile(session.user.id);
      if (profile) setUser(profile);
    }
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();

      if (!mounted) return;

      setSession(currentSession);

      if (currentSession?.user) {
        const profile = await waitForProfile(currentSession.user.id);
        if (mounted) {
          setUser(profile);
          setIsGuest(false);
        }
      } else {
        const savedGuest = sessionStorage.getItem('fluxfit_guest');
        if (savedGuest === 'true' && mounted) setIsGuest(true);
      }

      if (mounted) setLoading(false);
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;

      setSession(newSession);

      if (newSession?.user) {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          (async () => {
            const profile = await waitForProfile(newSession.user.id);
            if (mounted) {
              setUser(profile);
              setIsGuest(false);
              setLoading(false);
            }
          })();
        }
      } else {
        if (mounted) {
          setUser(null);
          setIsGuest(false);
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string, rut?: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (data.user) {
      const profile = await waitForProfile(data.user.id);
      if (profile && fullName) {
        const updates: Record<string, string | null> = { full_name: fullName };
        if (rut !== undefined) updates.rut = rut || null;
        await supabase.from('users').update(updates).eq('id', data.user.id);
        setUser({ ...profile, full_name: fullName });
      } else {
        setUser(profile);
      }
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsGuest(false);
    sessionStorage.removeItem('fluxfit_guest');
  };

  const enterAsGuest = () => {
    setIsGuest(true);
    setLoading(false);
    sessionStorage.setItem('fluxfit_guest', 'true');
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isGuest, signUp, signIn, signOut, enterAsGuest, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
