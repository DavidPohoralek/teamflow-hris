import { createClient } from '@supabase/supabase-js';

// On Amplify, NEXT_PUBLIC_ vars are inlined into the client bundle at build time
// but may not be available as process.env in the Lambda runtime.
// We add SUPABASE_URL and SUPABASE_ANON_KEY (without prefix) as runtime fallbacks.
export function getSupabaseUrl(): string {
  return (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)!;
}

export function createServiceClient() {
  return createClient(getSupabaseUrl(), process.env.SUPABASE_SERVICE_ROLE_KEY!);
}
