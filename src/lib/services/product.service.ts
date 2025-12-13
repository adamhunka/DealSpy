import type { SupabaseClient } from "@/db/supabase.client";
import type {
  Product,
  ProductDTO,
  ProductSearchDTO,
  ProductRecentDTO,
  BBox,
  ProductSearchParams,
  PaginationMeta,
} from "@/types";

type ProductSelect = Pick<
  Product,
  "id" | "name" | "price" | "currency" | "unit" | "description" | "promo_conditions" | "bbox" | "created_at"
>;

type ProductWithRelations = ProductSelect & {
  category_name: string;
  category_slug: string;
  store_name: string;
  store_slug: string;
  store_logo: string;
  valid_from: string;
  valid_to: string;
  web_image_path: string;
  page_number: number;
};

type ProductSearchResult = ProductWithRelations & {
  relevance_score: number;
  total_count: number;
};

type ProductRecentSelect = Omit<ProductWithRelations, "bbox" | "description" | "promo_conditions">;

export class ProductService {
  constructor(private supabase: SupabaseClient) {}

  private transformToProductDTO(product: ProductWithRelations): ProductDTO {
    return {
      id: product.id,
      name: product.name,
      price: product.price,
      currency: product.currency,
      unit: product.unit,
      description: product.description,
      promo_conditions: product.promo_conditions,
      bbox: product.bbox as BBox | null,
      created_at: product.created_at,
      category_name: product.category_name,
      category_slug: product.category_slug,
      store_name: product.store_name,
      store_slug: product.store_slug,
      store_logo: product.store_logo,
      valid_from: product.valid_from,
      valid_to: product.valid_to,
      web_image_url: product.web_image_path,
      page_number: product.page_number,
    };
  }

  private transformToProductSearchDTO(product: ProductSearchResult): ProductSearchDTO {
    return {
      ...this.transformToProductDTO(product),
      relevance_score: product.relevance_score,
    };
  }

  private transformToProductRecentDTO(product: ProductRecentSelect): ProductRecentDTO {
    return {
      id: product.id,
      name: product.name,
      price: product.price,
      currency: product.currency,
      unit: product.unit,
      created_at: product.created_at,
      category_name: product.category_name,
      category_slug: product.category_slug,
      store_name: product.store_name,
      store_slug: product.store_slug,
      store_logo: product.store_logo,
      valid_from: product.valid_from,
      valid_to: product.valid_to,
      web_image_url: product.web_image_path,
      page_number: product.page_number,
    };
  }

  async searchProducts(params: ProductSearchParams): Promise<{ data: ProductSearchDTO[]; pagination: PaginationMeta }> {
    const { q, store, category, sort, limit, offset } = params;

    const { data, error } = await this.supabase
      .rpc("search_products", {
        search_query: q ?? "",
        filter_store_slug: store,
        filter_category_slug: category,
        sort_by: sort,
        limit_count: limit,
        offset_count: offset,
      })
      .select();

    if (error) {
      console.error("Failed to search products:", {
        error,
        params: { q, store, category, sort, limit, offset },
      });
      throw new Error("Database query failed");
    }

    if (!data || data.length === 0) {
      return {
        data: [],
        pagination: {
          limit: limit ?? 0,
          offset: offset ?? 0,
          total: 0,
          has_more: false,
        },
      };
    }

    const result = data as ProductSearchResult[];
    const total = result[0].total_count || 0;
    return {
      data: result.map((product) => this.transformToProductSearchDTO(product)),
      pagination: {
        limit: limit ?? 10,
        offset: offset ?? 0,
        total: Number(total),
        has_more: (offset ?? 0) + (limit ?? 20) < total,
      },
    };
  }

  async getProductById(id: string): Promise<ProductDTO | null> {
    const { data, error } = await this.supabase
      .from("v_active_products")
      .select(
        "id, name, price, currency, unit, description, promo_conditions, bbox, created_at, category_name, category_slug, store_name, store_slug, store_logo, valid_from, valid_to, web_image_path, page_number"
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Failed to get product by id:", error);
      throw new Error("Database query failed");
    }
    if (!data) {
      return null;
    }

    return this.transformToProductDTO(data as ProductWithRelations);
  }

  async getRecentProducts(limit: number): Promise<ProductRecentDTO[]> {
    const { data, error } = await this.supabase
      .from("v_active_products")
      .select(
        "id, name, price, currency, unit, created_at, category_name, category_slug, store_name, store_slug, store_logo, valid_from, valid_to, web_image_path, page_number"
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Failed to get recent products:", error);
      throw new Error("Database query failed");
    }
    if (!data) {
      return [];
    }

    return data.map((product) => this.transformToProductRecentDTO(product as ProductRecentSelect));
  }
}
