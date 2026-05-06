/*
  # GoFitNow / platform admin parity + app settings

  - Extends is_fluxfit_admin() to include role gofitnow_admin (DB value for GoFitNow panel admins).
  - Recreates FluxFit-named policies to use the helper (avoids duplicating policy sets).
  - Adds gym_branches UPDATE/DELETE and gyms DELETE for platform admins.
  - Dedupes gym_subscriptions per gym_id and adds a unique index for upsert onConflict.
  - Adds app_settings for dynamic plan prices (Config tab).
*/

-- ── Platform admin helper (SECURITY DEFINER: no RLS recursion on users) ─────
CREATE OR REPLACE FUNCTION public.is_fluxfit_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('fluxfit_admin', 'gofitnow_admin')
  );
$$;

-- ── gym_subscriptions: one row per gym (upsert onConflict: gym_id) ───────────
DO $$
BEGIN
  IF to_regclass('public.gym_subscriptions') IS NOT NULL THEN
    DELETE FROM public.gym_subscriptions g
    WHERE g.id IN (
      SELECT id FROM (
        SELECT id,
               row_number() OVER (PARTITION BY gym_id ORDER BY id) AS rn
        FROM public.gym_subscriptions
      ) t
      WHERE t.rn > 1
    );
    CREATE UNIQUE INDEX IF NOT EXISTS gym_subscriptions_one_per_gym_uidx
      ON public.gym_subscriptions(gym_id);
  END IF;
END $$;

-- ── app_settings (singleton row id = global) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_settings (
  id text PRIMARY KEY DEFAULT 'global',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins read app_settings" ON public.app_settings;
CREATE POLICY "Platform admins read app_settings"
  ON public.app_settings FOR SELECT TO authenticated
  USING (public.is_fluxfit_admin());

DROP POLICY IF EXISTS "Platform admins insert app_settings" ON public.app_settings;
CREATE POLICY "Platform admins insert app_settings"
  ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_fluxfit_admin());

DROP POLICY IF EXISTS "Platform admins update app_settings" ON public.app_settings;
CREATE POLICY "Platform admins update app_settings"
  ON public.app_settings FOR UPDATE TO authenticated
  USING (public.is_fluxfit_admin())
  WITH CHECK (public.is_fluxfit_admin());

INSERT INTO public.app_settings (id, settings)
VALUES (
  'global',
  jsonb_build_object(
    'gym_plans', jsonb_build_object(
      'light', jsonb_build_object('price_clp', 89900, 'max_branches', 3),
      'pro', jsonb_build_object('price_clp', 149900, 'max_branches', 8)
    )
  )
)
ON CONFLICT (id) DO NOTHING;

-- ── gym_subscriptions policies ──────────────────────────────────────────────
DROP POLICY IF EXISTS "FluxFit admins can manage gym subscriptions" ON public.gym_subscriptions;
DROP POLICY IF EXISTS "FluxFit admins can insert gym subscriptions" ON public.gym_subscriptions;
DROP POLICY IF EXISTS "FluxFit admins can read gym subscriptions" ON public.gym_subscriptions;

CREATE POLICY "FluxFit admins can manage gym subscriptions"
  ON public.gym_subscriptions FOR UPDATE TO authenticated
  USING (public.is_fluxfit_admin())
  WITH CHECK (public.is_fluxfit_admin());

CREATE POLICY "FluxFit admins can insert gym subscriptions"
  ON public.gym_subscriptions FOR INSERT TO authenticated
  WITH CHECK (public.is_fluxfit_admin());

CREATE POLICY "FluxFit admins can read gym subscriptions"
  ON public.gym_subscriptions FOR SELECT TO authenticated
  USING (public.is_fluxfit_admin());

-- ── gyms: update + delete ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "FluxFit admins can update gyms" ON public.gyms;
CREATE POLICY "FluxFit admins can update gyms"
  ON public.gyms FOR UPDATE TO authenticated
  USING (public.is_fluxfit_admin())
  WITH CHECK (public.is_fluxfit_admin());

DROP POLICY IF EXISTS "FluxFit admins can insert gyms" ON public.gyms;
CREATE POLICY "FluxFit admins can insert gyms"
  ON public.gyms FOR INSERT TO authenticated
  WITH CHECK (public.is_fluxfit_admin());

DROP POLICY IF EXISTS "Platform admins can delete gyms" ON public.gyms;
CREATE POLICY "Platform admins can delete gyms"
  ON public.gyms FOR DELETE TO authenticated
  USING (public.is_fluxfit_admin());

-- ── commerces (read all + update) ─────────────────────────────────────────────
DROP POLICY IF EXISTS "FluxFit admins can read all gyms" ON public.gyms;
CREATE POLICY "FluxFit admins can read all gyms"
  ON public.gyms FOR SELECT TO authenticated
  USING (public.is_fluxfit_admin());

DROP POLICY IF EXISTS "FluxFit admins can read all commerces" ON public.commerces;
CREATE POLICY "FluxFit admins can read all commerces"
  ON public.commerces FOR SELECT TO authenticated
  USING (public.is_fluxfit_admin());

DROP POLICY IF EXISTS "FluxFit admins can update commerces" ON public.commerces;
CREATE POLICY "FluxFit admins can update commerces"
  ON public.commerces FOR UPDATE TO authenticated
  USING (public.is_fluxfit_admin())
  WITH CHECK (public.is_fluxfit_admin());

-- ── gym_branches ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "FluxFit admins can read all gym_branches" ON public.gym_branches;
CREATE POLICY "FluxFit admins can read all gym_branches"
  ON public.gym_branches FOR SELECT TO authenticated
  USING (public.is_fluxfit_admin());

DROP POLICY IF EXISTS "FluxFit admins can insert gym_branches" ON public.gym_branches;
CREATE POLICY "FluxFit admins can insert gym_branches"
  ON public.gym_branches FOR INSERT TO authenticated
  WITH CHECK (public.is_fluxfit_admin());

DROP POLICY IF EXISTS "Platform admins can update gym_branches" ON public.gym_branches;
CREATE POLICY "Platform admins can update gym_branches"
  ON public.gym_branches FOR UPDATE TO authenticated
  USING (public.is_fluxfit_admin())
  WITH CHECK (public.is_fluxfit_admin());

DROP POLICY IF EXISTS "Platform admins can delete gym_branches" ON public.gym_branches;
CREATE POLICY "Platform admins can delete gym_branches"
  ON public.gym_branches FOR DELETE TO authenticated
  USING (public.is_fluxfit_admin());

-- ── sensor_kits ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "FluxFit admins can select sensor_kits" ON public.sensor_kits;
DROP POLICY IF EXISTS "FluxFit admins can insert sensor_kits" ON public.sensor_kits;
DROP POLICY IF EXISTS "FluxFit admins can update sensor_kits" ON public.sensor_kits;
DROP POLICY IF EXISTS "FluxFit admins can delete sensor_kits" ON public.sensor_kits;

CREATE POLICY "FluxFit admins can select sensor_kits"
  ON public.sensor_kits FOR SELECT TO authenticated
  USING (public.is_fluxfit_admin());

CREATE POLICY "FluxFit admins can insert sensor_kits"
  ON public.sensor_kits FOR INSERT TO authenticated
  WITH CHECK (public.is_fluxfit_admin());

CREATE POLICY "FluxFit admins can update sensor_kits"
  ON public.sensor_kits FOR UPDATE TO authenticated
  USING (public.is_fluxfit_admin())
  WITH CHECK (public.is_fluxfit_admin());

CREATE POLICY "FluxFit admins can delete sensor_kits"
  ON public.sensor_kits FOR DELETE TO authenticated
  USING (public.is_fluxfit_admin());

-- ── sensor_history ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "FluxFit admins can select sensor_history" ON public.sensor_history;
DROP POLICY IF EXISTS "FluxFit admins can insert sensor_history" ON public.sensor_history;

CREATE POLICY "FluxFit admins can select sensor_history"
  ON public.sensor_history FOR SELECT TO authenticated
  USING (public.is_fluxfit_admin());

CREATE POLICY "FluxFit admins can insert sensor_history"
  ON public.sensor_history FOR INSERT TO authenticated
  WITH CHECK (public.is_fluxfit_admin());

-- ── sensors ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "FluxFit admins can read sensors" ON public.sensors;
DROP POLICY IF EXISTS "FluxFit admins can insert sensors" ON public.sensors;
DROP POLICY IF EXISTS "FluxFit admins can update sensors" ON public.sensors;
DROP POLICY IF EXISTS "FluxFit admins can delete sensors" ON public.sensors;

CREATE POLICY "FluxFit admins can read sensors"
  ON public.sensors FOR SELECT TO authenticated
  USING (public.is_fluxfit_admin());

CREATE POLICY "FluxFit admins can insert sensors"
  ON public.sensors FOR INSERT TO authenticated
  WITH CHECK (public.is_fluxfit_admin());

CREATE POLICY "FluxFit admins can update sensors"
  ON public.sensors FOR UPDATE TO authenticated
  USING (public.is_fluxfit_admin())
  WITH CHECK (public.is_fluxfit_admin());

CREATE POLICY "FluxFit admins can delete sensors"
  ON public.sensors FOR DELETE TO authenticated
  USING (public.is_fluxfit_admin());

-- ── gym_admin_requests ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "FluxFit admins can update gym requests" ON public.gym_admin_requests;
DROP POLICY IF EXISTS "FluxFit admins can read all gym requests" ON public.gym_admin_requests;

CREATE POLICY "FluxFit admins can update gym requests"
  ON public.gym_admin_requests FOR UPDATE TO authenticated
  USING (public.is_fluxfit_admin())
  WITH CHECK (public.is_fluxfit_admin());

CREATE POLICY "FluxFit admins can read all gym requests"
  ON public.gym_admin_requests FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id OR public.is_fluxfit_admin()
  );

-- ── gym_requests ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "FluxFit admins can read gym_requests" ON public.gym_requests;
DROP POLICY IF EXISTS "FluxFit admins can insert gym_requests" ON public.gym_requests;
DROP POLICY IF EXISTS "FluxFit admins can update gym_requests" ON public.gym_requests;

CREATE POLICY "FluxFit admins can read gym_requests"
  ON public.gym_requests FOR SELECT TO authenticated
  USING (public.is_fluxfit_admin());

CREATE POLICY "FluxFit admins can insert gym_requests"
  ON public.gym_requests FOR INSERT TO authenticated
  WITH CHECK (public.is_fluxfit_admin());

CREATE POLICY "FluxFit admins can update gym_requests"
  ON public.gym_requests FOR UPDATE TO authenticated
  USING (public.is_fluxfit_admin())
  WITH CHECK (public.is_fluxfit_admin());

-- ── coupon_redemptions + coupon_usage ───────────────────────────────────────
DROP POLICY IF EXISTS "FluxFit admins can view all redemptions" ON public.coupon_redemptions;
CREATE POLICY "FluxFit admins can view all redemptions"
  ON public.coupon_redemptions FOR SELECT TO authenticated
  USING (public.is_fluxfit_admin());

DROP POLICY IF EXISTS "Fluxfit admin read coupon usage" ON public.coupon_usage;
CREATE POLICY "Fluxfit admin read coupon usage"
  ON public.coupon_usage FOR SELECT TO authenticated
  USING (public.is_fluxfit_admin());
