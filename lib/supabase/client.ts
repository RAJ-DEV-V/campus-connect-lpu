// lib/supabase/client.ts
// Browser client for client-side components using publishable/anon key only
import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseConfig } from './config';

export function createClient() {
  const { url, anonKey, isConfigured } = getSupabaseConfig();

  if (!isConfigured) {
    return null;
  }

  return createBrowserClient(url, anonKey);
}
