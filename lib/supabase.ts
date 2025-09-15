import { createClient } from '@supabase/supabase-js';

// Hardcoded Supabase credentials as requested
const SUPABASE_URL = 'https://bnmqxyitvecoxxnzyeot.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJubXF4eWl0dmVjb3h4bnp5ZW90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NDg3OTMsImV4cCI6MjA3MzUyNDc5M30.212HA4rJQuDXs-snR3mCPATIeUXqaZNBDihD4fjaHIk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Database types
export interface ChatSession {
  id: string;
  sandbox_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: any;
  parts?: any[];
  created_at: string;
}

// Functions to interact with Supabase
export async function createChatSession(sandboxId: string | null) {
  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({
      sandbox_id: sandboxId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating chat session:', error);
    throw error;
  }

  return data;
}

export async function saveMessage(sessionId: string, message: any) {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      session_id: sessionId,
      role: message.role,
      content: message.content || null,
      parts: message.parts || null,
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving message:', error);
    throw error;
  }

  return data;
}

export async function getSessionMessages(sessionId: string) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching messages:', error);
    throw error;
  }

  return data;
}

export async function getLatestSession(sandboxId: string | null) {
  const query = supabase
    .from('chat_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (sandboxId) {
    query.eq('sandbox_id', sandboxId);
  }

  const { data, error } = await query.single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error('Error fetching latest session:', error);
    throw error;
  }

  return data;
}

export async function updateSessionSandbox(sessionId: string, sandboxId: string) {
  const { data, error } = await supabase
    .from('chat_sessions')
    .update({
      sandbox_id: sandboxId,
      updated_at: new Date().toISOString()
    })
    .eq('id', sessionId)
    .select()
    .single();

  if (error) {
    console.error('Error updating session sandbox:', error);
    throw error;
  }

  return data;
}