// Script to set up Supabase database tables
// Run this script to create the necessary tables in your Supabase database

const { createClient } = require('@supabase/supabase-js');

// Hardcoded credentials as requested
const SUPABASE_URL = 'https://bnmqxyitvecoxxnzyeot.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJubXF4eWl0dmVjb3h4bnp5ZW90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NDg3OTMsImV4cCI6MjA3MzUyNDc5M30.212HA4rJQuDXs-snR3mCPATIeUXqaZNBDihD4fjaHIk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function setupTables() {
  console.log('Setting up Supabase tables...');
  
  // Note: The anon key cannot create tables directly
  // You need to run the SQL commands in supabase_schema.sql 
  // directly in the Supabase dashboard SQL editor
  
  console.log(`
    Please go to your Supabase dashboard:
    1. Navigate to: ${SUPABASE_URL}
    2. Go to the SQL Editor
    3. Copy and paste the contents of supabase_schema.sql
    4. Execute the SQL commands
    
    This will create:
    - chat_sessions table
    - chat_messages table
    - Necessary indexes
    - Row Level Security policies
  `);
  
  // Test the connection
  try {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .limit(1);
    
    if (error && error.code === '42P01') {
      console.log('❌ Tables do not exist yet. Please create them using the SQL editor.');
    } else if (error) {
      console.log('❌ Error connecting to Supabase:', error.message);
    } else {
      console.log('✅ Successfully connected to Supabase!');
      console.log('✅ Tables exist and are accessible.');
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

setupTables();