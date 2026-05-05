-- commerce_discounts: cupones B2C para comercios (PremiumPage)
CREATE TABLE IF NOT EXISTS commerce_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commerce_id uuid NOT NULL REFERENCES commerces(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  coupon_code text NOT NULL DEFAULT 'SHOP20',
  discount_percentage integer NOT NULL DEFAULT 0,
  valid_until timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE commerce_discounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active commerce discounts" ON commerce_discounts;
CREATE POLICY "Anyone can read active commerce discounts"
  ON commerce_discounts FOR SELECT
  USING (is_active = true);

-- gym_discounts: código y vigencia para UI Premium
ALTER TABLE gym_discounts ADD COLUMN IF NOT EXISTS coupon_code text NOT NULL DEFAULT '';
ALTER TABLE gym_discounts ADD COLUMN IF NOT EXISTS valid_until timestamptz;

UPDATE gym_discounts SET coupon_code = 'FLUX' || discount_percentage::text
WHERE coupon_code IS NULL OR trim(coupon_code) = '';

-- Usuarios autenticados: leer sucursales de gyms activos (comparador Premium)
DROP POLICY IF EXISTS "Authenticated read gym_branches active gyms" ON gym_branches;
CREATE POLICY "Authenticated read gym_branches active gyms"
  ON gym_branches FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM gyms
      WHERE gyms.id = gym_branches.gym_id
        AND gyms.is_active = true
    )
  );
