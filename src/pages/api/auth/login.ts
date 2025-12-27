import type { APIRoute } from "astro";
import { createErrorResponse, createSuccessResponse, formatZodErrors } from "@/lib/helpers/api-response.helper";
import { loginSchema } from "@/lib/schemas/auth.schema";
import { supabaseAdmin } from "@/db/supabase.client";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // Parsowanie body
    const body = await request.json();

    // Walidacja danych wejściowych
    const result = loginSchema.safeParse(body);
    if (!result.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Nieprawidłowe dane wejściowe",
        400,
        formatZodErrors(result.error)
      );
    }

    const { email, password } = result.data;
    const supabase = locals.supabase;

    // Logowanie przez Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      // eslint-disable-next-line no-console
      console.error("Supabase auth error:", authError);
      return createErrorResponse("UNAUTHORIZED", "Nieprawidłowy email lub hasło", 401);
    }

    if (!authData.user || !authData.session) {
      // eslint-disable-next-line no-console
      console.error("No user data or session returned from Supabase");
      return createErrorResponse("UNAUTHORIZED", "Nieprawidłowy email lub hasło", 401);
    }

    // Sprawdź rolę użytkownika używając supabaseAdmin (omija RLS)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .single();

    if (profileError) {
      // eslint-disable-next-line no-console
      console.error("Profile fetch error:", profileError);
      // Wyloguj użytkownika w przypadku błędu
      await supabase.auth.signOut();
      return createErrorResponse("INTERNAL_SERVER_ERROR", "Wystąpił błąd podczas weryfikacji konta", 500);
    }

    if (!profile) {
      // eslint-disable-next-line no-console
      console.error("No profile found for user:", authData.user.id);
      await supabase.auth.signOut();
      return createErrorResponse("INTERNAL_SERVER_ERROR", "Nie znaleziono profilu użytkownika", 500);
    }

    if (profile.role !== "admin") {
      // eslint-disable-next-line no-console
      console.log("User is not admin:", authData.user.id, "role:", profile.role);
      // Wyloguj użytkownika jeśli nie jest adminem
      await supabase.auth.signOut();
      return createErrorResponse("FORBIDDEN", "Brak uprawnień administratora", 403);
    }

    // Sukces - zwróć URL przekierowania
    return createSuccessResponse({
      success: true,
      redirect_url: "/admin",
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Login error:", error);
    return createErrorResponse("INTERNAL_SERVER_ERROR", "Wystąpił błąd serwera", 500);
  }
};
