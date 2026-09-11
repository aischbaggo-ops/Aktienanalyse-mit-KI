/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_ANALYSE_WEBHOOK_URL: string
  readonly VITE_SYMBOL_SEARCH_WEBHOOK_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
