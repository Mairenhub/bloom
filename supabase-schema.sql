-- Supabase Database Schema for Levensloop Video App

-- Create videos table
CREATE TABLE IF NOT EXISTS videos (
  id BIGSERIAL PRIMARY KEY,
  task_id TEXT UNIQUE NOT NULL,
  frame_id TEXT,
  session_id TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  video_url TEXT,
  error_message TEXT,
  is_combined BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create video_sessions table
CREATE TABLE IF NOT EXISTS video_sessions (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_videos INTEGER DEFAULT 0,
  completed_videos INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create video_queue table for managing concurrent video generation
CREATE TABLE IF NOT EXISTS video_queue (
  id BIGSERIAL PRIMARY KEY,
  task_id TEXT UNIQUE NOT NULL,
  session_id TEXT,
  frame_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued', -- queued, processing, completed, failed
  priority INTEGER DEFAULT 0, -- higher number = higher priority
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  task_data JSONB, -- store the full task parameters
  account_id TEXT DEFAULT 'default' -- for future multi-tenant support
);

-- Create codes table for redeemable video generation codes
CREATE TABLE IF NOT EXISTS codes (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  package_type TEXT NOT NULL, -- '5-photos' or '10-photos'
  is_redeemed BOOLEAN DEFAULT FALSE,
  redeemed_at TIMESTAMP WITH TIME ZONE,
  redeemed_by TEXT, -- IP address or user identifier
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE, -- optional expiration
  metadata JSONB -- additional data like source, campaign, etc.
);

-- Fix existing table if session_id column has NOT NULL constraint
ALTER TABLE video_queue ALTER COLUMN session_id DROP NOT NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_videos_task_id ON videos(task_id);
CREATE INDEX IF NOT EXISTS idx_videos_session_id ON videos(session_id);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
CREATE INDEX IF NOT EXISTS idx_video_sessions_session_id ON video_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_video_queue_status ON video_queue(status);
CREATE INDEX IF NOT EXISTS idx_video_queue_priority ON video_queue(priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_video_queue_account_id ON video_queue(account_id);
CREATE INDEX IF NOT EXISTS idx_video_queue_session_id ON video_queue(session_id);
CREATE INDEX IF NOT EXISTS idx_codes_code ON codes(code);
CREATE INDEX IF NOT EXISTS idx_codes_is_redeemed ON codes(is_redeemed);
CREATE INDEX IF NOT EXISTS idx_codes_package_type ON codes(package_type);

-- Enable Row Level Security (RLS)
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE codes ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (adjust as needed for your security requirements)
-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Allow all operations on videos" ON videos;
DROP POLICY IF EXISTS "Allow all operations on video_sessions" ON video_sessions;
DROP POLICY IF EXISTS "Allow all operations on video_queue" ON video_queue;
DROP POLICY IF EXISTS "Allow all operations on codes" ON codes;

-- Create policies
CREATE POLICY "Allow all operations on videos" ON videos
  FOR ALL USING (true);

CREATE POLICY "Allow all operations on video_sessions" ON video_sessions
  FOR ALL USING (true);

CREATE POLICY "Allow all operations on video_queue" ON video_queue
  FOR ALL USING (true);

CREATE POLICY "Allow all operations on codes" ON codes
  FOR ALL USING (true);

-- Create storage bucket for videos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy for videos bucket
-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Allow public access to videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update videos" ON storage.objects;

-- Create storage policies
CREATE POLICY "Allow public access to videos" ON storage.objects
  FOR SELECT USING (bucket_id = 'videos');

CREATE POLICY "Allow authenticated users to upload videos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'videos');

CREATE POLICY "Allow authenticated users to update videos" ON storage.objects
  FOR UPDATE USING (bucket_id = 'videos');
