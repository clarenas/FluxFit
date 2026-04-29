import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { gym_id, sensor_key, people_count } = await req.json();

    if (!gym_id || !sensor_key || people_count === undefined) {
      return new Response(JSON.stringify({ error: "Missing required fields: gym_id, sensor_key, people_count" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify sensor key matches the gym
    const { data: gym, error: gymError } = await supabase
      .from("gyms")
      .select("id, max_capacity, sensor_key")
      .eq("id", gym_id)
      .single();

    if (gymError || !gym) {
      return new Response(JSON.stringify({ error: "Gym not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (gym.sensor_key !== sensor_key) {
      return new Response(JSON.stringify({ error: "Invalid sensor key" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const count = Math.max(0, Math.min(people_count, gym.max_capacity));
    const percentage = Math.round((count / gym.max_capacity) * 1000) / 10;
    const status = percentage < 40 ? "tranquilo" : percentage < 75 ? "moderado" : "lleno";

    // Insert occupancy log
    await supabase.from("occupancy_logs").insert({
      gym_id,
      people_count: count,
      occupancy_percentage: percentage,
      occupancy_status: status,
    });

    // Update gym current state
    await supabase
      .from("gyms")
      .update({
        current_count: count,
        occupancy_percentage: percentage,
        occupancy_status: status,
        last_sensor_ping: new Date().toISOString(),
        sensor_online: true,
      })
      .eq("id", gym_id);

    // Update weekly summary for this hour/day
    const now = new Date();
    const dayOfWeek = now.getDay();
    const hourOfDay = now.getHours();

    // Get existing summary
    const { data: existing } = await supabase
      .from("weekly_occupancy_summary")
      .select("id, avg_percentage, sample_count")
      .eq("gym_id", gym_id)
      .eq("day_of_week", dayOfWeek)
      .eq("hour_of_day", hourOfDay)
      .maybeSingle();

    if (existing) {
      const newCount = existing.sample_count + 1;
      const newAvg = Math.round(((existing.avg_percentage * existing.sample_count + percentage) / newCount) * 10) / 10;
      const newStatus = newAvg < 40 ? "tranquilo" : newAvg < 75 ? "moderado" : "lleno";
      await supabase
        .from("weekly_occupancy_summary")
        .update({ avg_percentage: newAvg, avg_status: newStatus, sample_count: newCount, last_updated: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await supabase.from("weekly_occupancy_summary").insert({
        gym_id,
        day_of_week: dayOfWeek,
        hour_of_day: hourOfDay,
        avg_percentage: percentage,
        avg_status: status,
        sample_count: 1,
      });
    }

    return new Response(JSON.stringify({ success: true, people_count: count, occupancy_percentage: percentage, occupancy_status: status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
