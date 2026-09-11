import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error(
    'Supabase-Konfiguration fehlt. Bitte VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY in .env setzen.'
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
