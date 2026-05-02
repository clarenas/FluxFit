import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Gym } from '../lib/types';

export function useGyms() {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGyms = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('gyms')
      .select('id, name, address, comuna, current_count, max_capacity, occupancy_percentage, occupancy_status, sensor_online, last_sensor_ping, is_active, logo_url, cover_image_url')
      .eq('is_active', true);
    if (error) setError('No se pudieron cargar los gyms.');
    if (data) setGyms(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchGyms();
    const channel = supabase
      .channel('gyms-global')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'gyms' },
        payload => {
          setGyms(prev => prev.map(g =>
            g.id === payload.new.id ? { ...g, ...payload.new } as Gym : g
          ));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return { gyms, loading, error, refetch: fetchGyms };
}
