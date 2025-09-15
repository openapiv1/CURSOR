-- Create chat_sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sandbox_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content JSONB,
  parts JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_sandbox_id ON chat_sessions(sandbox_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for anonymous access (since we're using anon key)
CREATE POLICY "Allow anonymous read access to chat_sessions" ON chat_sessions
  FOR SELECT USING (true);

CREATE POLICY "Allow anonymous insert to chat_sessions" ON chat_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous update to chat_sessions" ON chat_sessions
  FOR UPDATE USING (true);

CREATE POLICY "Allow anonymous read access to chat_messages" ON chat_messages
  FOR SELECT USING (true);

CREATE POLICY "Allow anonymous insert to chat_messages" ON chat_messages
  FOR INSERT WITH CHECK (true);