import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkPolicies() {
  const { data, error } = await supabase
    .rpc('get_policies_for_table', { table_name: 'requisiciones' }) // This might not exist
  
  if (error) {
    // Try another way: inspect the pg_policies table
    const { data: policies, error: pError } = await supabase
      .from('pg_policies') // Not sure if this is accessible via anon/service role without RPC
      .select('*')
      .eq('tablename', 'requisiciones')
    
    if (pError) {
      console.error('Error fetching policies:', pError)
    } else {
      console.log('Policies for requisiciones:', JSON.stringify(policies, null, 2))
    }
  } else {
    console.log('Policies for requisiciones (RPC):', JSON.stringify(data, null, 2))
  }
}

// Alternatively, just try to update a record with the service role to see if it works (it should)
// but that doesn't help with Carlos's RLS.

checkPolicies()
