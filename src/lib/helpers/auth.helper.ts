import type { SupabaseClient } from "@/db/supabase.client";

/**
 * Wynik sprawdzenia dostępu admina
 */
interface AdminAccessResult {
  isAdmin: boolean;
  userId: string | null;
  error?: "UNAUTHORIZED" | "FORBIDDEN";
}

/**
 * Sprawdza czy użytkownik jest zalogowany i ma uprawnienia admina
 *
 * @param supabase - Klient Supabase z context.locals
 * @returns Obiekt z wynikiem sprawdzenia
 *
 * @example
 * const { isAdmin, userId, error } = await checkAdminAccess(supabase);
 *
 * if (!isAdmin) {
 *   const status = error === 'UNAUTHORIZED' ? 401 : 403;
 *   return createErrorResponse(error, getErrorMessage(error), status);
 * }
 */
export async function checkAdminAccess(supabase: SupabaseClient): Promise<AdminAccessResult> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    return {
      isAdmin: false,
      userId: null,
      error: "UNAUTHORIZED",
    };
  }

  const userId = session.user.id;
  const isAdmin = await checkUserRole(supabase, userId);

  if (!isAdmin) {
    return {
      isAdmin: false,
      userId,
      error: "FORBIDDEN",
    };
  }

  return {
    isAdmin: true,
    userId,
  };
}

/**
 * Sprawdza czy użytkownik ma rolę admin
 *
 * Implementacja zależy od architektury projektu.
 * Poniżej dwie możliwe opcje:
 */
async function checkUserRole(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();

  if (error) {
    console.error("Failed to check user role:", { error, userId });
    return false;
  }

  return data?.role === "admin";
}

function getAuthErrorMessage(error: "UNAUTHORIZED" | "FORBIDDEN"): string {
  return error === "UNAUTHORIZED"
    ? "Authentication required. Please log in."
    : "Admin access required. You do not have permission to perform this action.";
}

function getAuthErrorStatus(error: "UNAUTHORIZED" | "FORBIDDEN"): number {
  return error === "UNAUTHORIZED" ? 401 : 403;
}

export { getAuthErrorMessage, getAuthErrorStatus };
