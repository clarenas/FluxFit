-- Optional reason when FluxFit admin rejects a gym profile
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS rejection_reason text;
