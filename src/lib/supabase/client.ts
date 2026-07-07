import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const isUrlValid = url.startsWith('http://') || url.startsWith('https://');
  
  return createBrowserClient(
    isUrlValid ? url : 'https://placeholder.supabase.co',
    key || 'dummy'
  );
}
