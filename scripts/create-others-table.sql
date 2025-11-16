-- Others Table
CREATE TABLE IF NOT EXISTS others (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  items JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- If table exists with old schema (bundles), migrate it
DO $$
BEGIN
  -- Check if bundles column exists and items doesn't
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'others' AND column_name = 'bundles'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'others' AND column_name = 'items'
  ) THEN
    -- Add items column
    ALTER TABLE others ADD COLUMN items JSONB DEFAULT '[]'::jsonb;
    
    -- Migrate data from bundles to items
    UPDATE others
    SET items = (
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', 
          CASE 
            WHEN bundle->>'name' IS NOT NULL AND bundle->>'retailValue' IS NOT NULL 
            THEN (bundle->>'name') || ' — ' || (bundle->>'retailValue')
            WHEN bundle->>'name' IS NOT NULL THEN bundle->>'name'
            WHEN bundle->>'retailValue' IS NOT NULL THEN bundle->>'retailValue'
            ELSE ''
          END,
          'description',
          COALESCE(
            (SELECT string_agg(pub, ', ') 
             FROM jsonb_array_elements_text(bundle->'publications') AS pub),
            ''
          )
        )
      )
      FROM jsonb_array_elements(bundles) AS bundle
    )
    WHERE bundles IS NOT NULL AND jsonb_array_length(bundles) > 0;
    
    -- Drop old bundles column (optional - comment out if you want to keep it for backup)
    -- ALTER TABLE others DROP COLUMN bundles;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE others ENABLE ROW LEVEL SECURITY;

-- Create policies for others
CREATE POLICY "Allow public read access" ON others
  FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON others
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON others
  FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON others
  FOR DELETE USING (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON others TO authenticated, anon;


