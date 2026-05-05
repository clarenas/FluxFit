-- Canjes manuales sin usuario app: opcional user_id + vínculo a descuento
ALTER TABLE coupon_redemptions ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE coupon_redemptions ADD COLUMN IF NOT EXISTS discount_id uuid REFERENCES commerce_discounts(id) ON DELETE SET NULL;
ALTER TABLE coupon_redemptions ADD COLUMN IF NOT EXISTS customer_email text;

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_discount_id ON coupon_redemptions(discount_id);

-- Commerce admins: gestionar descuentos de su comercio (no solo lectura pública)
DROP POLICY IF EXISTS "Commerce admins select own commerce_discounts" ON commerce_discounts;
CREATE POLICY "Commerce admins select own commerce_discounts"
  ON commerce_discounts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM commerce_admins
      WHERE commerce_admins.commerce_id = commerce_discounts.commerce_id
        AND commerce_admins.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Commerce admins insert commerce_discounts" ON commerce_discounts;
CREATE POLICY "Commerce admins insert commerce_discounts"
  ON commerce_discounts FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM commerce_admins
      WHERE commerce_admins.commerce_id = commerce_discounts.commerce_id
        AND commerce_admins.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Commerce admins update commerce_discounts" ON commerce_discounts;
CREATE POLICY "Commerce admins update commerce_discounts"
  ON commerce_discounts FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM commerce_admins
      WHERE commerce_admins.commerce_id = commerce_discounts.commerce_id
        AND commerce_admins.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM commerce_admins
      WHERE commerce_admins.commerce_id = commerce_discounts.commerce_id
        AND commerce_admins.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Commerce admins delete commerce_discounts" ON commerce_discounts;
CREATE POLICY "Commerce admins delete commerce_discounts"
  ON commerce_discounts FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM commerce_admins
      WHERE commerce_admins.commerce_id = commerce_discounts.commerce_id
        AND commerce_admins.user_id = auth.uid()
    )
  );
