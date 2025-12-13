import type { APIRoute } from "astro";
import { CategoryService } from "@/lib/services/category.service";
import { createErrorResponse, createSuccessResponse } from "@/lib/helpers/api-response.helper";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  try {
    const supabase = locals.supabase;

    if (!supabase) {
      console.error("Supabase client not available in locals");
      return createErrorResponse("INTERNAL_SERVER_ERROR", "Service temporarily unavailable", 500);
    }
    const categoryService = new CategoryService(supabase);
    const categories = await categoryService.getAllCategories();

    return createSuccessResponse(categories, 200, 3600);
  } catch (error) {
    console.error("Error in GET /api/categories:", error);
    return createErrorResponse("INTERNAL_SERVER_ERROR", "Failed to fetch categories", 500);
  }
};
