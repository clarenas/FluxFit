-- Gym admin push notification log (PRO panel)
CREATE TABLE IF NOT EXISTS gym_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  target_audience text NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all', 'premium', 'free')),
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gym_notifications_gym_id_sent_at ON gym_notifications (gym_id, sent_at DESC);

ALTER TABLE gym_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gym admins manage gym notifications"
  ON gym_notifications
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM gym_admins
      WHERE gym_admins.gym_id = gym_notifications.gym_id
        AND gym_admins.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM gym_admins
      WHERE gym_admins.gym_id = gym_notifications.gym_id
        AND gym_admins.user_id = auth.uid()
    )
  );
