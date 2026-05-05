ALTER TABLE gym_discounts ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES gym_branches(id) ON DELETE SET NULL;
ALTER TABLE gym_discounts ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE gym_discounts ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'plan_gym';
ALTER TABLE gym_discounts ADD COLUMN IF NOT EXISTS discount_value numeric NOT NULL DEFAULT 0;
ALTER TABLE gym_discounts ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE gym_discounts ADD COLUMN IF NOT EXISTS qr_payload text;

UPDATE gym_discounts
SET
  title = COALESCE(NULLIF(title, ''), description),
  discount_value = COALESCE(NULLIF(discount_value, 0), discount_percentage, 0),
  active = COALESCE(active, is_active)
WHERE true;

CREATE TABLE IF NOT EXISTS coupon_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES gym_branches(id) ON DELETE SET NULL,
  discount_id uuid REFERENCES gym_discounts(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'plan_gym',
  amount numeric NOT NULL DEFAULT 0,
  used_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coupon_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gym admins manage coupon usage" ON coupon_usage;
CREATE POLICY "Gym admins manage coupon usage"
ON coupon_usage
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM gym_admins ga
    WHERE ga.user_id = auth.uid()
      AND ga.gym_id = coupon_usage.gym_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM gym_admins ga
    WHERE ga.user_id = auth.uid()
      AND ga.gym_id = coupon_usage.gym_id
  )
);

DROP POLICY IF EXISTS "Fluxfit admin read coupon usage" ON coupon_usage;
CREATE POLICY "Fluxfit admin read coupon usage"
ON coupon_usage
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid()
      AND u.role = 'fluxfit_admin'
  )
);
