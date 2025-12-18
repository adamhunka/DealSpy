import type { APIRoute } from "astro";
import { checkAdminAccess } from "@/lib/helpers/auth.helper";
import { createErrorResponse, createSuccessResponse, formatZodErrors } from "@/lib/helpers/api-response.helper";
import { adminFlyerListParamsSchema, createFlyerSchema } from "@/lib/schemas/flyer.schema";
import { FlyerService } from "@/lib/services/flyer.service";

export const prerender = false;

/**
 * GET /api/admin/flyers
 *
 * Lista wszystkich gazetek dla administratora.
 * Wspiera filtrowanie po sklepie, statusie i paginację.
 *
 * Query Parameters:
 * - store: slug sklepu (opcjonalne)
 * - status: draft | processing | verification | published (opcjonalne)
 * - include_deleted: true | false (domyślnie false)
 * - limit: 1-100 (domyślnie 20)
 * - offset: >= 0 (domyślnie 0)
 *
 * Przykład:
 * GET /api/admin/flyers?store=biedronka&status=published&limit=10
 */
export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const { isAdmin, error: authError } = await checkAdminAccess(locals.supabase);

    if (!isAdmin) {
      const status = authError === "UNAUTHORIZED" ? 401 : 403;
      const message = authError === "UNAUTHORIZED" ? "Authentication requires" : "Admin access required";
      return createErrorResponse(authError ?? "FORBIDDEN", message, status);
    }

    const rawParams = Object.fromEntries(url.searchParams);
    const validation = adminFlyerListParamsSchema.safeParse(rawParams);

    if (!validation.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Invalid query parameters",
        400,
        formatZodErrors(validation.error)
      );
    }

    const flyerService = new FlyerService(locals.supabase);
    const { flyers, total } = await flyerService.listAdminFlyers(validation.data);

    return createSuccessResponse(flyers, 200, {
      total,
      limit: validation.data.limit,
      offset: validation.data.offset,
    });
  } catch (error) {
    console.error("GET /api/admin/flyers error:", error);
    return createErrorResponse("INTERNAL_SERVER_ERROR", "An unexpected error occurred", 500);
  }
};

/**
 * POST /api/admin/flyers
 *
 * Tworzy nową gazetkę promocyjną.
 *
 * Request Body (JSON):
 * {
 *   "store_id": "uuid",
 *   "valid_from": "YYYY-MM-DD",
 *   "valid_to": "YYYY-MM-DD"
 * }
 *
 * Response:
 * 201 Created - Gazetka została utworzona
 * 400 Bad Request - Nieprawidłowe dane
 * 404 Not Found - Sklep nie istnieje
 */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const { isAdmin, error: authError } = await checkAdminAccess(locals.supabase);

    if (!isAdmin) {
      const status = authError === "UNAUTHORIZED" ? 401 : 403;
      const message = authError === "UNAUTHORIZED" ? "Authentication requires" : "Admin access required";
      return createErrorResponse(authError ?? "FORBIDDEN", message, status);
    }

    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.error("POST /api/admin/flyers error:", error);
      return createErrorResponse("VALIDATION_ERROR", "Invalid request body", 400);
    }

    const validation = createFlyerSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse("VALIDATION_ERROR", "Invalid request body", 400, formatZodErrors(validation.error));
    }
    const flyerService = new FlyerService(locals.supabase);
    const flyer = await flyerService.createFlyer(validation.data);

    if (!flyer) {
      return createErrorResponse("NOT_FOUND", "Store not found", 404);
    }

    return createSuccessResponse(flyer, 201);
  } catch (error) {
    console.error("POST /api/admin/flyers error:", error);
    return createErrorResponse("INTERNAL_SERVER_ERROR", "An unexpected error occurred", 500);
  }
};
