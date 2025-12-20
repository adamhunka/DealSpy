import type { APIRoute } from "astro";
import { z } from "zod";
import { createErrorResponse, createSuccessResponse, formatZodErrors } from "@/lib/helpers/api-response.helper";
import { flyerProductsParamsSchema } from "@/lib/schemas/flyer.schema";
import { FlyerService } from "@/lib/services/flyer.service";

export const prerender = false;

/**
 * GET /api/flyers/:id/products
 *
 * Zwraca wszystkie produkty z danej gazetki
 *
 * Path params:
 * - id: UUID gazetki
 *
 * Query params:
 * - limit (optional, default 50): liczba wyników na stronę
 * - offset (optional, default 0): przesunięcie dla paginacji
 *
 * Response 200:
 * {
 *   "data": FlyerProductDTO[],
 *   "pagination": { ... }
 * }
 *
 * Response 400: Nieprawidłowe parametry
 * Response 404: Gazetka nie istnieje
 * Response 500: Błąd serwera
 */
export const GET: APIRoute = async ({ params, url, locals }) => {
  try {
    const allParams = { id: params.id, ...Object.fromEntries(url.searchParams) };
    let validatedParams;
    try {
      validatedParams = flyerProductsParamsSchema.parse(allParams);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = formatZodErrors(error);
        return createErrorResponse("VALIDATION_ERROR", "Invalid query parameters", 400, details);
      }
      throw error;
    }

    const supabase = locals.supabase;
    if (!supabase) {
      console.error("Supabase client not available in locals");
      return createErrorResponse("INTERNAL_SERVER_ERROR", "Service temporarily unavailable", 500);
    }

    const flyerService = new FlyerService(supabase);
    const exists = await flyerService.checkFlyerExists(validatedParams.id);
    if (!exists) {
      return createErrorResponse("NOT_FOUND", "Flyer not found or not available", 404);
    }

    const { products, total } = await flyerService.getFlyerProducts(validatedParams.id, {
      limit: validatedParams.limit,
      offset: validatedParams.offset,
    });

    const pagination = {
      limit: validatedParams.limit,
      offset: validatedParams.offset,
      total,
      has_more: validatedParams.offset + validatedParams.limit < total,
    };

    return createSuccessResponse(products, 200, pagination, 300);
  } catch (error) {
    console.error("Error in GET /api/flyers/:id/products:", error);
    return createErrorResponse("INTERNAL_SERVER_ERROR", "Failed to fetch flyer products", 500);
  }
};
