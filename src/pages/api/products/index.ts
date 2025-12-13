import type { APIRoute } from "astro";
import { z } from "zod";
import { ProductService } from "@/lib/services/product.service";
import { createErrorResponse, createSuccessResponse, formatZodErrors } from "@/lib/helpers/api-response.helper";
import { productSearchQuerySchema } from "@/lib/schemas/product.schema";

export const prerender = false;

export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const queryParams = Object.fromEntries(url.searchParams);

    let params;
    try {
      params = productSearchQuerySchema.parse(queryParams);
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

    const productService = new ProductService(supabase);
    const results = await productService.searchProducts(params);
    return createSuccessResponse(results.data, 200, results.pagination, 300);
  } catch (error) {
    console.error("Error in GET /api/products:", error);
    return createErrorResponse("INTERNAL_SERVER_ERROR", "Failed to search products", 500);
  }
};
