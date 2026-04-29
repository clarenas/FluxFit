import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
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
  // Prevent getSession + onAuthStateChange race condition on initial load
  const initializedRef = useRef(false);

  const fetchProfile = async (userId: string): Promise<User | null> => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    return data;
  };

  const ensureProfile = async (userId: string, email: string): Promise<User | null> => {
    let profile = await fetchProfile(userId);
    // Profile may not exist yet if user just confirmed email
    if (!profile) {
      await supabase.from('users').insert({ id: userId, email, full_name: '' });
      profile = await fetchProfile(userId);
    }
    return profile;
  };

  const refreshProfile = async () => {
    if (session?.user) {
      const profile = await fetchProfile(session.user.id);
      if (profile) setUser(profile);
    }
  };

  useEffect(() => {
    // onAuthStateChange fires on mount with current session — use it as the
    // single source of truth so we don't race with getSession().
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);

      if (s?.user) {
        (async () => {
          if (!initializedRef.current) {
            initializedRef.current = true;
          }
          setLoading(true);
          const profile = await ensureProfile(s.user.id, s.user.email ?? '');
          setUser(profile);
          setIsGuest(false);
          setLoading(false);
        })();
      } else {
        initializedRef.current = true;
        setUser(null);
        setIsGuest(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    // If email confirmation is disabled, user is immediately available
    if (data.user && data.session) {
      const existing = await fetchProfile(data.user.id);
      if (!existing) {
        await supabase.from('users').insert({ id: data.user.id, email, full_name: fullName });
      }
    } else if (data.user && !data.session) {
      // Email confirmation required — store fullName so we can use it when they confirm
      // We insert a placeholder profile so ensureProfile can update it later
      await supabase.from('users').upsert({ id: data.user.id, email, full_name: fullName });
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // onAuthStateChange handles the rest
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsGuest(false);
  };

  const enterAsGuest = () => {
    setUser(GUEST_USER);
    setIsGuest(true);
    setLoading(false);
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
