import { createClient } from '@supabase/supabase-js'

// Asegúrate de que la URL empiece con https:// y no tenga espacios al final
const supabaseUrl = 'https://pugwgdqgsqjtbeouodpo.supabase.co' 
const supabaseAnonKey = 'sb_publishable_oBdXZE0PPSnj9lv-1qzalA_uB6kHtVu'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)