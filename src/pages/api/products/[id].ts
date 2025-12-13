import type { APIRoute } from "astro";
import { z } from "zod";
import { ProductService } from "@/lib/services/product.service";
import { createErrorResponse, createSuccessResponse, formatZodErrors } from "@/lib/helpers/api-response.helper";
import { productIdParamSchema } from "@/lib/schemas/product.schema";
export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    let validatedParams;
    try {
      validatedParams = productIdParamSchema.parse({ id: params.id });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = formatZodErrors(error);
        return createErrorResponse("VALIDATION_ERROR", "Invalid product ID", 400, details);
      }
      throw error;
    }

    const supabase = locals.supabase;
    if (!supabase) {
      console.error("Supabase client not available in locals");
      return createErrorResponse("INTERNAL_SERVER_ERROR", "Service temporarily unavailable", 500);
    }

    const productService = new ProductService(supabase);
    const product = await productService.getProductById(validatedParams.id);
    if (!product) {
      return createErrorResponse("NOT_FOUND", "Product not found", 404);
    }
    return createSuccessResponse(product, 200, undefined, 600);
  } catch (error) {
    console.error("Error in GET /api/products/:id:", error);
    return createErrorResponse("INTERNAL_SERVER_ERROR", "Failed to fetch product", 500);
  }
};
