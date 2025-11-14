# Broadcast Messages Feature - Setup Guide

## Overview
This feature allows admins to send broadcast messages to all users or specific users. Users will see these messages as popups on their screen that stay visible until they click the close icon. The system checks for new messages every 5 seconds.

## Database Setup

### Step 1: Run the SQL Schema
1. Go to your Supabase Dashboard → SQL Editor
2. Open and run the file: `scripts/broadcast-messages-schema.sql`

This will create:
- `broadcast_messages` table - Stores the messages
- `broadcast_message_recipients` table - Tracks which users receive which messages
- RLS (Row Level Security) policies for proper access control
- Triggers to automatically create recipients when sending to all users
- Indexes for better query performance

## Features Implemented

### Admin Side
1. **Broadcast Messages Page** (`/admin/broadcast-messages`)
   - View all sent messages
   - Create new broadcast messages
   - Send to all users or select specific users

2. **Message Form**
   - Title field (required)
   - Message content field (required)
   - Option to send to all users
   - Multi-select for specific users

### User Side
1. **Message Popup Component**
   - Automatically checks for new messages every 5 seconds
   - Displays popup with title and message
   - Close icon to dismiss the message
   - Shows multiple messages if there are more than one
   - Navigation between multiple messages (Previous/Next buttons)

## API Routes Created

### Admin Routes
- `GET /api/admin/broadcast-messages` - Fetch all messages (admin only)
- `POST /api/admin/broadcast-messages` - Create and send a message (admin only)

### User Routes
- `GET /api/broadcast-messages` - Fetch unread messages for current user
- `PATCH /api/broadcast-messages` - Mark a message as closed

## Components Created

1. **BroadcastMessageForm** (`components/BroadcastMessageForm.tsx`)
   - Form for admins to create and send messages

2. **BroadcastMessagePopup** (`components/BroadcastMessagePopup.tsx`)
   - Popup component that displays messages to users
   - Polls every 5 seconds for new messages
   - Handles closing messages

## Files Created/Modified

### New Files
- `scripts/broadcast-messages-schema.sql` - Database schema
- `app/api/admin/broadcast-messages/route.ts` - Admin API routes
- `app/api/broadcast-messages/route.ts` - User API routes
- `app/admin/broadcast-messages/page.tsx` - Admin page
- `components/BroadcastMessageForm.tsx` - Admin form component
- `components/BroadcastMessagePopup.tsx` - User popup component

### Modified Files
- `app/page.tsx` - Added BroadcastMessagePopup component
- `app/admin/dashboard/page.tsx` - Added link to broadcast messages page

## How to Use

### For Admins
1. Navigate to Admin Dashboard
2. Click on "Broadcast Messages" in Quick Actions
3. Click "New Message" button
4. Fill in the title and message
5. Choose to send to all users or select specific users
6. Click "Send Message"

### For Users
1. Messages will automatically appear as popups when available
2. The system checks for new messages every 5 seconds
3. Click the X icon to close a message
4. If multiple messages exist, use Previous/Next buttons to navigate

## Database Schema Details

### broadcast_messages
- `id` (UUID, Primary Key)
- `title` (TEXT, Required)
- `message` (TEXT, Required)
- `created_by` (UUID, Foreign Key to auth.users)
- `send_to_all` (BOOLEAN, Default: false)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### broadcast_message_recipients
- `id` (UUID, Primary Key)
- `message_id` (UUID, Foreign Key to broadcast_messages)
- `user_id` (UUID, Foreign Key to auth.users)
- `is_read` (BOOLEAN, Default: false)
- `is_closed` (BOOLEAN, Default: false)
- `read_at` (TIMESTAMP, Nullable)
- `closed_at` (TIMESTAMP, Nullable)
- `created_at` (TIMESTAMP)
- Unique constraint on (message_id, user_id)

## Security
- Row Level Security (RLS) is enabled on both tables
- Admins can create, view, update, and delete messages
- Users can only view and update their own message recipients
- All API routes check for proper authentication and authorization

## Notes
- Messages are checked every 5 seconds on the user side
- Messages stay visible until the user clicks the close icon
- When sending to all users, recipients are automatically created via database trigger
- The popup component only shows unread messages (is_closed = false)

