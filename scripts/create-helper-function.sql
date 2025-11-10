-- Run this FIRST in Supabase SQL Editor to enable automatic schema execution
-- This creates a helper function that allows executing SQL via API

CREATE OR REPLACE FUNCTION exec_sql(sql_text text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_text;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION exec_sql(text) TO anon;
GRANT EXECUTE ON FUNCTION exec_sql(text) TO authenticated;



