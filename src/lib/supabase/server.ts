import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const isUrlValid = url.startsWith('http://') || url.startsWith('https://');

  return createServerClient(
    isUrlValid ? url : 'https://placeholder.supabase.co',
    key || 'dummy',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component'lerde set edilemez, middleware'de handle edilir
          }
        },
      },
    }
  );
}
