import type { APIRoute } from "astro";
import { FlyerService } from "@/lib/services/flyer.service";
import { createErrorResponse, createSuccessResponse, formatZodErrors } from "@/lib/helpers/api-response.helper";
import { checkAdminAccess } from "@/lib/helpers/auth.helper";
import { flyerIdParamsSchema, updateFlyerSchema } from "@/lib/schemas/flyer.schema";

export const prerender = false;

/**
 * GET /api/admin/flyers/:id
 *
 * Pobiera szczegóły gazetki wraz z listą stron.
 *
 * Path Parameters:
 * - id: UUID gazetki
 *
 * Response:
 * 200 OK - Zwraca szczegóły gazetki
 * 400 Bad Request - Nieprawidłowy UUID
 * 404 Not Found - Gazetka nie istnieje
 */
export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const { isAdmin, error: authError } = await checkAdminAccess(locals.supabase);
    if (!isAdmin) {
      const status = authError === "UNAUTHORIZED" ? 401 : 403;
      const message = authError === "UNAUTHORIZED" ? "Authentication requires" : "Admin access required";
      return createErrorResponse(authError ?? "FORBIDDEN", message, status);
    }

    const validation = flyerIdParamsSchema.safeParse(params);

    if (!validation.success) {
      return createErrorResponse("VALIDATION_ERROR", "Invalid request data", 400, formatZodErrors(validation.error));
    }

    const flyerService = new FlyerService(locals.supabase);
    const flyer = await flyerService.getAdminFlyerById(validation.data.id);

    if (!flyer) {
      return createErrorResponse("NOT_FOUND", "Flyer not found", 404);
    }

    return createSuccessResponse(flyer, 200);
  } catch (error) {
    console.error("GET /api/admin/flyers/:id error:", error);
    return createErrorResponse("INTERNAL_SERVER_ERROR", "An unexpected error occurred", 500);
  }
};

/**
 * PATCH /api/admin/flyers/:id
 *
 * Aktualizuje metadane lub status gazetki.
 * Wszystkie pola są opcjonalne, ale przynajmniej jedno musi być obecne.
 *
 * Request Body (JSON):
 * {
 *   "valid_from"?: "YYYY-MM-DD",
 *   "valid_to"?: "YYYY-MM-DD",
 *   "status"?: draft | processing | verification | published
 * }
 *
 * Response:
 * 200 OK - Gazetka została zaktualizowana
 * 400 Bad Request - Nieprawidłowe dane lub brak pól
 * 404 Not Found - Gazetka nie istnieje
 */
export const PATCH: APIRoute = async ({ params, request, locals }) => {
  try {
    const { isAdmin, error: authError } = await checkAdminAccess(locals.supabase);
    if (!isAdmin) {
      const status = authError === "UNAUTHORIZED" ? 401 : 403;
      const message = authError === "UNAUTHORIZED" ? "Authentication requires" : "Admin access required";
      return createErrorResponse(authError ?? "FORBIDDEN", message, status);
    }

    const validationParams = flyerIdParamsSchema.safeParse(params);

    if (!validationParams.success) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "Invalid request data",
        400,
        formatZodErrors(validationParams.error)
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.error("PATCH /api/admin/flyers/:id error:", error);
      return createErrorResponse("VALIDATION_ERROR", "Invalid request body", 400);
    }

    const validation = updateFlyerSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse("VALIDATION_ERROR", "Invalid request body", 400, formatZodErrors(validation.error));
    }

    const flyerService = new FlyerService(locals.supabase);
    const flyer = await flyerService.upadateFlyer(validationParams.data.id, validation.data);

    if (!flyer) {
      return createErrorResponse("NOT_FOUND", "Flyer not found", 404);
    }

    return createSuccessResponse(flyer, 200);
  } catch (error) {
    console.error("PATCH /api/admin/flyers/:id error:", error);
    return createErrorResponse("INTERNAL_SERVER_ERROR", "An unexpected error occurred", 500);
  }
};

// src/pages/api/admin/flyers/[id].ts (rozszerzenie)

/**
 * DELETE /api/admin/flyers/:id
 *
 * Usuwa gazetkę (soft delete - ustawia deleted_at).
 *
 * Response:
 * 200 OK - Gazetka została usunięta
 * 404 Not Found - Gazetka nie istnieje lub jest już usunięta
 */
export const DELETE: APIRoute = async ({ params, locals }) => {
  try {
    const { isAdmin, error: authError } = await checkAdminAccess(locals.supabase);

    if (!isAdmin) {
      const status = authError === "UNAUTHORIZED" ? 401 : 403;
      const message = authError === "UNAUTHORIZED" ? "Authentication required" : "Admin access required";
      return createErrorResponse(authError ?? "FORBIDDEN", message, status);
    }

    const validation = flyerIdParamsSchema.safeParse(params);

    if (!validation.success) {
      return createErrorResponse("VALIDATION_ERROR", "Invalid request data", 400, formatZodErrors(validation.error));
    }

    const flyerService = new FlyerService(locals.supabase);
    const result = await flyerService.deleteFlyer(validation.data.id);

    if (!result) {
      return createErrorResponse("NOT_FOUND", "Flyer not found or already deleted", 404);
    }

    return createSuccessResponse(result);
  } catch (error) {
    console.error("DELETE /api/admin/flyers/:id error:", error);
    return createErrorResponse("INTERNAL_SERVER_ERROR", "An unexpected error occurred", 500);
  }
};
