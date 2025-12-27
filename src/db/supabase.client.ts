import { createClient, type SupabaseClient as SupabaseClientType } from "@supabase/supabase-js";

import type { Database } from "../db/database.types.ts";

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_KEY;
const supabaseServiceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey);

/**
 * Supabase client z uprawnieniami service_role
 * Używany tylko po stronie serwera do operacji administratorskich
 * UWAGA: Ten klient omija Row Level Security (RLS)
 */
export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Type alias dla Supabase client z naszą Database schema
 *
 * Używany w services do type-safety
 */
export type SupabaseClient = SupabaseClientType<Database>;
