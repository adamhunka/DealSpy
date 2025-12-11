import type { APIRoute } from "astro";
import { z } from "zod";
import { CategoryService } from "@/lib/services/category.service";
import { categorySlugParamSchema } from "@/lib/schemas/category.schema";
import { createErrorResponse, createSuccessResponse, formatZodErrors } from "@/lib/halpers/api-response.helper";

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    let validatedParams;

    try {
      validatedParams = categorySlugParamSchema.parse({
        slug: params.slug,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = formatZodErrors(error);
        return createErrorResponse("VALIDATION_ERROR", "Invalid category slug format", 400, details);
      }
      throw error;
    }

    const supabase = locals.supabase;

    if (!supabase) {
      console.error("Supabase client not available in locals");
      return createErrorResponse("INTERNAL_SERVER_ERROR", "Service temporarily unavailable", 500);
    }

    const categoryService = new CategoryService(supabase);
    const category = await categoryService.getCategoryBySlug(validatedParams.slug);

    if (!category) {
      return createErrorResponse("NOT_FOUND", "Category not found", 404);
    }

    return createSuccessResponse(category, 200, 3600);
  } catch (error) {
    console.error(`Error in GET /api/categories/${params.slug}:`, error);
    return createErrorResponse("INTERNAL_SERVER_ERROR", "Failed to fetch category", 500);
  }
};
