import type { SupabaseClient } from "@/db/supabase.client";
import type { Category, CategoryDTO } from "@/types";

type CategorySelect = Pick<Category, "id" | "name" | "slug" | "display_order" | "created_at">;

export class CategoryService {
  constructor(private supabase: SupabaseClient) {}

  private transformToDTO(category: CategorySelect): CategoryDTO {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      display_order: category.display_order,
      created_at: category.created_at,
    };
  }

  async getAllCategories(): Promise<CategoryDTO[]> {
    const { data, error } = await this.supabase
      .from("categories")
      .select("id, name, slug, display_order, created_at")
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Failed to fetch categories from database:", error);
      throw new Error("Database query failed");
    }

    if (!data) {
      return [];
    }

    return data.map((category: CategorySelect) => this.transformToDTO(category));
  }

  async getCategoryBySlug(slug: string): Promise<CategoryDTO | null> {
    const { data, error } = await this.supabase
      .from("categories")
      .select("id, name, slug, display_order, created_at")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      console.error(`Failed to fetch category with slug "${slug}":`, error);
      throw new Error("Database query failed");
    }

    if (!data) {
      return null;
    }

    return this.transformToDTO(data);
  }

  /**
   * Sprawdza czy kategoria istnieje
   * 
   * Używane w admin endpoints do walidacji category_id
   */
  async checkCategoryExists(categoryId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("categories")
      .select("id")
      .eq("id", categoryId)
      .maybeSingle();

    if (error) {
      console.error("Failed to check category existence:", { error, categoryId });
      throw new Error("Database query failed");
    }

    return data !== null;
  }
}
