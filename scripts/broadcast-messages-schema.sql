-- Broadcast Messages Schema
-- Run this in your Supabase SQL Editor

-- ============================================
-- BROADCAST MESSAGES TABLES
-- ============================================

-- Messages Table
-- Stores the broadcast messages created by admins
CREATE TABLE IF NOT EXISTS broadcast_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  send_to_all BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Message Recipients Table
-- Tracks which users should receive which messages and if they've seen/closed them
CREATE TABLE IF NOT EXISTS broadcast_message_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES broadcast_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT false,
  is_closed BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_broadcast_messages_created_at ON broadcast_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcast_messages_send_to_all ON broadcast_messages(send_to_all);
CREATE INDEX IF NOT EXISTS idx_message_recipients_message_id ON broadcast_message_recipients(message_id);
CREATE INDEX IF NOT EXISTS idx_message_recipients_user_id ON broadcast_message_recipients(user_id);
CREATE INDEX IF NOT EXISTS idx_message_recipients_user_closed ON broadcast_message_recipients(user_id, is_closed);

-- Enable Row Level Security (RLS)
ALTER TABLE broadcast_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_message_recipients ENABLE ROW LEVEL SECURITY;

-- RLS Policies for broadcast_messages
-- Users can read messages they have recipients for
CREATE POLICY "Users can read messages they have recipients for"
  ON broadcast_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM broadcast_message_recipients
      WHERE broadcast_message_recipients.message_id = broadcast_messages.id
      AND broadcast_message_recipients.user_id = auth.uid()
    )
  );

-- Admins can do everything
CREATE POLICY "Admins can view all broadcast messages"
  ON broadcast_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can create broadcast messages"
  ON broadcast_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update broadcast messages"
  ON broadcast_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete broadcast messages"
  ON broadcast_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- RLS Policies for broadcast_message_recipients
-- Users can view their own message recipients
CREATE POLICY "Users can view their own message recipients"
  ON broadcast_message_recipients FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all message recipients
CREATE POLICY "Admins can view all message recipients"
  ON broadcast_message_recipients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- System can insert message recipients (via service role)
-- This will be handled by the API using admin client
-- Users can update their own message recipients (to mark as read/closed)
CREATE POLICY "Users can update their own message recipients"
  ON broadcast_message_recipients FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins can insert message recipients
CREATE POLICY "Admins can insert message recipients"
  ON broadcast_message_recipients FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Function to automatically create recipients when a message is created with send_to_all = true
CREATE OR REPLACE FUNCTION create_recipients_for_all_users()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create recipients if send_to_all is true
  IF NEW.send_to_all = true THEN
    -- Insert a recipient record for each user in the system
    INSERT INTO broadcast_message_recipients (message_id, user_id)
    SELECT NEW.id, id
    FROM auth.users
    WHERE id NOT IN (
      SELECT user_id 
      FROM broadcast_message_recipients 
      WHERE message_id = NEW.id
    )
    ON CONFLICT (message_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create recipients when a message is created
CREATE TRIGGER trigger_create_recipients_for_all
  AFTER INSERT ON broadcast_messages
  FOR EACH ROW
  EXECUTE FUNCTION create_recipients_for_all_users();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on broadcast_messages
CREATE TRIGGER update_broadcast_messages_updated_at
  BEFORE UPDATE ON broadcast_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

