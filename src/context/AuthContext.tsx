useEffect(() => {
  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession();

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
}, []);