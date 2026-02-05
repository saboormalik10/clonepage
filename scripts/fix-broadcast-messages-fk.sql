-- Fix foreign key relationship between broadcast_message_recipients and broadcast_messages
-- Run this in your Supabase SQL Editor

-- First, check if the foreign key exists
DO $$
BEGIN
  -- Drop existing constraint if it exists (to recreate it properly)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'broadcast_message_recipients_message_id_fkey'
    AND table_name = 'broadcast_message_recipients'
  ) THEN
    ALTER TABLE broadcast_message_recipients 
    DROP CONSTRAINT broadcast_message_recipients_message_id_fkey;
  END IF;
END $$;

-- Add the foreign key constraint
ALTER TABLE broadcast_message_recipients
ADD CONSTRAINT broadcast_message_recipients_message_id_fkey
FOREIGN KEY (message_id) REFERENCES broadcast_messages(id) ON DELETE CASCADE;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
