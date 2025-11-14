-- Fix RLS policies for broadcast messages
-- This allows users to read messages they have recipients for
-- Run this in your Supabase SQL Editor

-- Add policy to allow users to read messages they have recipients for
CREATE POLICY "Users can read messages they have recipients for"
  ON broadcast_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM broadcast_message_recipients
      WHERE broadcast_message_recipients.message_id = broadcast_messages.id
      AND broadcast_message_recipients.user_id = auth.uid()
    )
  );

