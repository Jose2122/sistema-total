import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkData() {
  const { data, error } = await supabase
    .from('requisiciones')
    .select('solicitante, solicitante_nombre')
    .limit(1)
  
  if (error) {
    console.error('Error fetching data:', error)
  } else {
    console.log('Requisicion Data:', JSON.stringify(data[0], null, 2))
  }
}

checkData()
