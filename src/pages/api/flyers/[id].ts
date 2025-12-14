import type { APIRoute } from "astro";
import { z } from "zod";
import { FlyerService } from "@/lib/services/flyer.service";
import { createErrorResponse, createSuccessResponse, formatZodErrors } from "@/lib/helpers/api-response.helper";
import { flyerIdParamsSchema } from "@/lib/schemas/flyer.schema";

export const prerender = false;

/**
 * GET /api/flyers/:id
 *
 * Zwraca szczegóły pojedynczej gazetki ze stronami
 *
 * Path params:
 * - id: UUID gazetki
 *
 * Response 200:
 * {
 *   "data": FlyerDetailDTO (z tablicą pages)
 * }
 *
 * Response 400: Nieprawidłowy format UUID
 * Response 404: Gazetka nie istnieje lub nie jest published
 * Response 500: Błąd serwera
 */
export const GET: APIRoute = async ({ params, locals }) => {
  try {
    let validatedParams;
    try {
      validatedParams = flyerIdParamsSchema.parse(params);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = formatZodErrors(error);
        return createErrorResponse("VALIDATION_ERROR", "Invalid flyer ID", 400, details);
      }
      throw error;
    }

    const supabase = locals.supabase;
    if (!supabase) {
      console.error("Supabase client not available in locals");
      return createErrorResponse("INTERNAL_SERVER_ERROR", "Service temporarily unavailable", 500);
    }

    const flyerService = new FlyerService(supabase);
    const flyer = await flyerService.getFlyerById(validatedParams.id);

    if (!flyer) {
      return createErrorResponse("NOT_FOUND", "Flyer not found or not available", 404);
    }

    return createSuccessResponse(flyer, 200, undefined, 600);
  } catch (error) {
    console.error("Error in GET /api/flyers/:id:", error);
    return createErrorResponse("INTERNAL_SERVER_ERROR", "Failed to fetch flyer details", 500);
  }
};
