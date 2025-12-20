import type { APIRoute } from "astro";
import { ConfigService } from "@/lib/services/config.service";
import { createSuccessResponse, createErrorResponse } from "@/lib/helpers/api-response.helper";
import { checkAdminAccess } from "@/lib/helpers/auth.helper";

/**
 * GET /api/admin/config
 *
 * Pobiera wszystkie ustawienia konfiguracyjne systemu
 *
 * Authorization: Admin only (sprawdzane przez checkAdminAccess)
 *
 * Response:
 * - 200: ApiResponse<ConfigDTO[]>
 * - 401: Unauthorized (brak autentykacji)
 * - 403: Forbidden (brak roli admin)
 * - 500: Internal Server Error
 */

export const prerender = false;

export const GET: APIRoute = async (context) => {
  // Sprawdzenie uprawnień admin
  const { isAdmin, error: authError } = await checkAdminAccess(context.locals.supabase);

  if (!isAdmin) {
    const status = authError === "UNAUTHORIZED" ? 401 : 403;
    const message = authError === "UNAUTHORIZED" ? "Authentication required" : "Admin access required";
    return createErrorResponse(authError ?? "FORBIDDEN", message, status);
  }

  try {
    const configService = new ConfigService(context.locals.supabase);
    const configs = await configService.getAllConfigs();

    return createSuccessResponse(configs);
  } catch (error) {
    console.error("Error fetching configs:", error);
    return createErrorResponse("INTERNAL_SERVER_ERROR", "Failed to fetch configuration", 500);
  }
};
