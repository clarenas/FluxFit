import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '../lib/types';
import type { Session } from '@supabase/supabase-js';

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

const fetchProfile = async (userId: string): Promise<User | null> => {
const { data } = await supabase
.from('users')
.select('*')
.eq('id', userId)
.maybeSingle();
return data;
};

const ensureProfile = async (userId: string, email: string): Promise<User | null> => {
const existing = await fetchProfile(userId);
if (existing) return existing;
await supabase.from('users').insert({ id: userId, email, full_name: '' });
return fetchProfile(userId);
};

const refreshProfile = async () => {
if (session?.user) {
const profile = await fetchProfile(session.user.id);
if (profile) setUser(profile);
}
};

useEffect(() => {
const init = async () => {
const { data: { session } } = await supabase.auth.getSession();

```
  setSession(session);

  if (session?.user) {
    const profile = await ensureProfile(session.user.id, session.user.email ?? '');
    setUser(profile);
    setIsGuest(false);
  }

  setLoading(false);
};

init();

const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
  setSession(s);

  if (s?.user) {
    (async () => {
      setLoading(true);
      const profile = await ensureProfile(s.user.id, s.user.email ?? '');
      setUser(profile);
      setIsGuest(false);
      setLoading(false);
    })();
  } else {
    setUser(null);
    setIsGuest(false);
    setLoading(false);
  }
});

return () => subscription.unsubscribe();
```

}, []);

const signUp = async (email: string, password: string, fullName: string) => {
const { data, error } = await supabase.auth.signUp({ email, password });
if (error) throw error;

```
if (data.user) {
  const existing = await fetchProfile(data.user.id);
  if (!existing) {
    await supabase.from('users').insert({ id: data.user.id, email, full_name: fullName });
  }
}
```

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
};

const enterAsGuest = () => {
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
