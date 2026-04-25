import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type ClerkGetToken = (options?: { template?: string }) => Promise<string | null>;

function decodeJwtPart(part: string) {
  if (typeof window === 'undefined') {
    return null;
  }

  const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  return JSON.parse(window.atob(padded)) as Record<string, unknown>;
}

function logSupabaseJwt(token: string | null) {
  if (process.env.NODE_ENV !== 'development' || !token) {
    return;
  }

  const [header, payload] = token.split('.');
  if (!header || !payload) {
    console.warn('[Supabase Auth] Clerk returned an invalid JWT shape.');
    return;
  }

  try {
    console.info('[Supabase Auth] Clerk JWT header', decodeJwtPart(header));
    console.info('[Supabase Auth] Clerk JWT payload', decodeJwtPart(payload));
  } catch (error) {
    console.warn('[Supabase Auth] Failed to decode Clerk JWT for debugging.', error);
  }
}

export function createClerkSupabaseClient(getToken: ClerkGetToken) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    accessToken: async () => {
      try {
        const token = await getToken({ template: 'supabase' });
        logSupabaseJwt(token);
        return token;
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[Supabase Auth] Failed to retrieve Clerk Supabase JWT.', error);
        }

        return null;
      }
    },
  });
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
