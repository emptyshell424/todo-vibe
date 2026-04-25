import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type AccessTokenProvider = () => Promise<string | null>;

export function createServerClerkSupabaseClient(getToken: AccessTokenProvider) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    accessToken: getToken,
  });
}
