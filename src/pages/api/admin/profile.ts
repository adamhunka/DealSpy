import type { APIRoute } from "astro";
import { z } from "zod";
import { ProfileService } from "@/lib/services/profile.service";
import { updateProfileSchema } from "@/lib/schemas/profile.schema";
import { createSuccessResponse, createErrorResponse, formatZodErrors } from "@/lib/helpers/api-response.helper";
import { checkAdminAccess } from "@/lib/helpers/auth.helper";

/**
 * GET /api/admin/profile
 *
 * Pobiera profil aktualnie zalogowanego administratora
 *
 * Authorization: Admin only (sprawdzane przez checkAdminAccess)
 *
 * Response:
 * - 200: ApiResponse<ProfileDTO>
 * - 401: Unauthorized (brak autentykacji)
 * - 403: Forbidden (brak roli admin)
 * - 404: Not Found (profil nie istnieje - edge case)
 * - 500: Internal Server Error
 */

export const prerender = false;

export const GET: APIRoute = async (context) => {
  // Sprawdzenie uprawnień admin
  const { isAdmin, userId, error: authError } = await checkAdminAccess(context.locals.supabase);

  if (!isAdmin || !userId) {
    const status = authError === "UNAUTHORIZED" ? 401 : 403;
    const message = authError === "UNAUTHORIZED" ? "Authentication required" : "Admin access required";
    return createErrorResponse(authError ?? "FORBIDDEN", message, status);
  }

  try {
    // Pobierz email z auth.users
    const {
      data: { user },
    } = await context.locals.supabase.auth.getUser();

    if (!user?.email) {
      return createErrorResponse("INTERNAL_SERVER_ERROR", "Failed to fetch user email", 500);
    }

    const profileService = new ProfileService(context.locals.supabase);
    const profile = await profileService.getProfileByIdWithEmail(userId, user.email);

    return createSuccessResponse(profile);
  } catch (error) {
    console.error("Error fetching profile:", error);
    return createErrorResponse("INTERNAL_SERVER_ERROR", "Failed to fetch profile", 500);
  }
};

/**
 * PATCH /api/admin/profile
 *
 * Aktualizuje profil aktualnie zalogowanego administratora
 *
 * Authorization: Admin only (sprawdzane przez checkAdminAccess)
 *
 * Request body:
 * - full_name: string | undefined (1-100 znaków, opcjonalne)
 *
 * Uwaga: Pole 'role' nie może być zmieniane przez ten endpoint
 *
 * Response:
 * - 200: ApiResponse<ProfileDTO>
 * - 400: Bad Request (nieprawidłowa walidacja)
 * - 401: Unauthorized (brak autentykacji)
 * - 403: Forbidden (brak roli admin)
 * - 500: Internal Server Error
 */

export const PATCH: APIRoute = async (context) => {
  // Sprawdzenie uprawnień admin
  const { isAdmin, userId, error: authError } = await checkAdminAccess(context.locals.supabase);

  if (!isAdmin || !userId) {
    const status = authError === "UNAUTHORIZED" ? 401 : 403;
    const message = authError === "UNAUTHORIZED" ? "Authentication required" : "Admin access required";
    return createErrorResponse(authError ?? "FORBIDDEN", message, status);
  }

  try {
    // Parsowanie i walidacja body
    let body;
    try {
      body = await context.request.json();
    } catch {
      return createErrorResponse("VALIDATION_ERROR", "Invalid JSON in request body", 400);
    }

    const validatedBody = updateProfileSchema.parse(body);

    const profileService = new ProfileService(context.locals.supabase);

    // Aktualizuj profil
    await profileService.updateProfile(userId, validatedBody);

    // Pobierz zaktualizowany profil z emailem
    const {
      data: { user },
    } = await context.locals.supabase.auth.getUser();

    if (!user?.email) {
      return createErrorResponse("INTERNAL_SERVER_ERROR", "Failed to fetch user email", 500);
    }

    const profile = await profileService.getProfileByIdWithEmail(userId, user.email);

    return createSuccessResponse(profile);
  } catch (error) {
    console.error("Error updating profile:", error);

    // Obsługa błędów walidacji Zod
    if (error instanceof z.ZodError) {
      return createErrorResponse("VALIDATION_ERROR", "Invalid request data", 400, formatZodErrors(error));
    }

    return createErrorResponse("INTERNAL_SERVER_ERROR", "Failed to update profile", 500);
  }
};
