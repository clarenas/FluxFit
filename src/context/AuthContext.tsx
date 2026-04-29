import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '../lib/types';
import type { Session } from '@supabase/supabase-js';

const GUEST_USER: User = {
  id: 'guest',
  email: 'invitado@fluxfit.cl',
  full_name: 'Invitado',
  is_premium: false,
  premium_since: null,
  avatar_url: '',
  created_at: new Date().toISOString(),
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isGuest: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
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

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
    return data;
  };

  const refreshProfile = async () => {
    if (session?.user) {
      const profile = await fetchProfile(session.user.id);
      setUser(profile);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        fetchProfile(s.user.id).then(profile => { setUser(profile); setLoading(false); });
      } else { setLoading(false); }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) { (async () => { const profile = await fetchProfile(s.user.id); setUser(profile); setIsGuest(false); })(); }
      else { setUser(null); }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) { await supabase.from('users').insert({ id: authUser.id, email, full_name: fullName }); }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null); setSession(null); setIsGuest(false);
  };

  const enterAsGuest = () => {
    setUser(GUEST_USER);
    setIsGuest(true);
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
