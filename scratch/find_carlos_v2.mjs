import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function findCarlos2() {
  const { data, error } = await supabase
    .from('perfiles')
    .select('*')
    .or('correo.ilike.cvega%,nombre.ilike.carlos%')
  
  if (error) {
    console.error('Error fetching perfiles:', error)
  } else {
    console.log('Profiles found:', JSON.stringify(data, null, 2))
  }
}

findCarlos2()
