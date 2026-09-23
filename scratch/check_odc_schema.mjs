import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tnypawawgskymquqozgw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRueXBhd2F3Z3NreW1xdXFvemd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEyNzE3ODUsImV4cCI6MjA1Njg0Nzc4NX0.gJgGk2f0Y8H6nZ-_L1K8Z6J-9h9v2g1234567890'; // anonymized key or from env

async function test() {
  const supabase = createClient('https://tnypawawgskymquqozgw.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRueXBhd2F3Z3NreW1xdXFvemd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEyNzE3ODUsImV4cCI6MjA1Njg0Nzc4NX0.3XnS89pTz4n9n6n9n6n9n6n9n6n9n6n9n6n9n6n9n6n');
}
