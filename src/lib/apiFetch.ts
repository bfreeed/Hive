import { supabase } from './supabase';

/** Authenticated POST to a Vercel API function. Automatically attaches the Supabase Bearer token. */
export async function apiFetch(path: string, body: unknown): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  return fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}
