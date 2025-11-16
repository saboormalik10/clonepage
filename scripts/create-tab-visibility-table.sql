-- Tab Visibility Settings Table
CREATE TABLE IF NOT EXISTS tab_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id TEXT NOT NULL UNIQUE,
  tab_name TEXT NOT NULL,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE tab_visibility ENABLE ROW LEVEL SECURITY;

-- Create policies for tab_visibility
CREATE POLICY "Allow public read access" ON tab_visibility
  FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert access" ON tab_visibility
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated update access" ON tab_visibility
  FOR UPDATE USING (true);
CREATE POLICY "Allow authenticated delete access" ON tab_visibility
  FOR DELETE USING (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON tab_visibility TO authenticated, anon;

-- Insert default tab visibility settings (all visible by default)
INSERT INTO tab_visibility (tab_id, tab_name, is_visible) VALUES
  ('publications', 'PUBLICATIONS', true),
  ('broadcast', 'BROADCAST TELEVISION', true),
  ('digital', 'DIGITAL TELEVISION', true),
  ('listicles', 'LISTICLES', true),
  ('bestsellers', 'BEST SELLERS', true),
  ('print', 'PRINT', true),
  ('socialpost', 'SOCIAL POST', true),
  ('others', 'OTHERS', true)
ON CONFLICT (tab_id) DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tab_visibility_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_tab_visibility_timestamp
  BEFORE UPDATE ON tab_visibility
  FOR EACH ROW
  EXECUTE FUNCTION update_tab_visibility_updated_at();

