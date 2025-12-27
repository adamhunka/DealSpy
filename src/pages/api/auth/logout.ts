import type { APIRoute } from "astro";
import { createErrorResponse, createSuccessResponse } from "@/lib/helpers/api-response.helper";

export const prerender = false;

/**
 * Endpoint wylogowania użytkownika
 *
 * Wylogowuje użytkownika z Supabase Auth i zwraca URL przekierowania
 */
export const POST: APIRoute = async ({ locals }) => {
  try {
    const supabase = locals.supabase;

    // Wyloguj użytkownika
    const { error } = await supabase.auth.signOut();

    if (error) {
      // eslint-disable-next-line no-console
      console.error("Logout error:", error);
      return createErrorResponse("INTERNAL_SERVER_ERROR", "Wystąpił błąd podczas wylogowania", 500);
    }

    // Sukces
    return createSuccessResponse({
      success: true,
      redirect_url: "/admin/login",
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Logout error:", error);
    return createErrorResponse("INTERNAL_SERVER_ERROR", "Wystąpił błąd serwera", 500);
  }
};
