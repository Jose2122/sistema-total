import { createClient } from '@supabase/supabase-js'

// Estas líneas le dicen a tu código que busque las llaves en la configuración de Vercel
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)