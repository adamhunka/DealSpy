import type { SupabaseClient } from "@/db/supabase.client";
import type { Json } from "@/db/database.types";
import type {
  Product,
  ProductDTO,
  ProductSearchDTO,
  ProductRecentDTO,
  BBox,
  ProductSearchParams,
  PaginationMeta,
  AdminProductDTO,
  CreateProductCommand,
  UpdateProductCommand,
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

  // ============================================================================
  // Admin Methods
  // ============================================================================

  /**
   * Pobiera wszystkie produkty z danej strony gazetki (admin)
   *
   * Endpoint: GET /api/admin/flyer-pages/:pageId/products
   */
  async getProductsByPageId(pageId: string): Promise<AdminProductDTO[]> {
    const { data, error } = await this.supabase
      .from("products")
      .select(
        "id, name, price, currency, unit, description, promo_conditions, bbox, created_at, updated_at, categories!inner(id, name)"
      )
      .eq("flyer_page_id", pageId)
      .order("name", { ascending: true });

    if (error) {
      console.error("Failed to get products by page ID:", { error, pageId });
      throw new Error("Database query failed");
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Transform do AdminProductDTO
    return data.map((row) => {
      const product = row as unknown as {
        id: string;
        name: string;
        price: number;
        currency: string;
        unit: string | null;
        description: string | null;
        promo_conditions: string | null;
        bbox: unknown;
        created_at: string;
        updated_at: string;
        categories: {
          id: string;
          name: string;
        };
      };

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
        updated_at: product.updated_at,
        category_id: product.categories.id,
        category_name: product.categories.name,
      };
    });
  }

  /**
   * Tworzy nowy produkt na stronie gazetki (admin)
   *
   * Endpoint: POST /api/admin/flyer-pages/:pageId/products
   */
  async createProduct(pageId: string, command: CreateProductCommand): Promise<AdminProductDTO | null> {
    // Insert product
    const { data: insertedProduct, error: insertError } = await this.supabase
      .from("products")
      .insert({
        flyer_page_id: pageId,
        category_id: command.category_id,
        name: command.name,
        price: command.price,
        currency: command.currency ?? "PLN",
        unit: command.unit,
        description: command.description,
        promo_conditions: command.promo_conditions,
        bbox: command.bbox as Json,
      })
      .select()
      .single();

    if (insertError) {
      // Foreign key violation (flyer_page_id or category_id)
      if (insertError.code === "23503") {
        console.error("Foreign key violation:", { insertError, pageId, command });
        return null;
      }
      console.error("Failed to create product:", { insertError, pageId, command });
      throw new Error("Database insert failed");
    }

    // Fetch with category name
    const { data: productWithCategory, error: fetchError } = await this.supabase
      .from("products")
      .select(
        "id, name, price, currency, unit, description, promo_conditions, bbox, created_at, updated_at, categories!inner(id, name)"
      )
      .eq("id", insertedProduct.id)
      .single();

    if (fetchError || !productWithCategory) {
      console.error("Failed to fetch created product:", { fetchError, productId: insertedProduct.id });
      throw new Error("Database query failed");
    }

    const product = productWithCategory as unknown as {
      id: string;
      name: string;
      price: number;
      currency: string;
      unit: string | null;
      description: string | null;
      promo_conditions: string | null;
      bbox: unknown;
      created_at: string;
      updated_at: string;
      categories: {
        id: string;
        name: string;
      };
    };

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
      updated_at: product.updated_at,
      category_id: product.categories.id,
      category_name: product.categories.name,
    };
  }

  /**
   * Aktualizuje produkt (admin)
   *
   * Endpoint: PUT /api/admin/products/:id
   */
  async updateProduct(id: string, command: UpdateProductCommand): Promise<AdminProductDTO | null> {
    // Check if product exists
    const { data: existingProduct, error: checkError } = await this.supabase
      .from("products")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (checkError) {
      console.error("Failed to check product existence:", { checkError, id });
      throw new Error("Database query failed");
    }

    if (!existingProduct) {
      return null; // Product not found
    }

    // Build update object only with defined fields
    const updateData: Record<string, Json | string | number> = {};
    if (command.name !== undefined) updateData.name = command.name;
    if (command.price !== undefined) updateData.price = command.price;
    if (command.currency !== undefined) updateData.currency = command.currency;
    if (command.unit !== undefined) updateData.unit = command.unit as Json;
    if (command.description !== undefined) updateData.description = command.description as Json;
    if (command.promo_conditions !== undefined) updateData.promo_conditions = command.promo_conditions as Json;
    if (command.category_id !== undefined) updateData.category_id = command.category_id;
    if (command.bbox !== undefined) updateData.bbox = command.bbox as Json;

    // Update product
    const { error: updateError } = await this.supabase.from("products").update(updateData).eq("id", id);

    if (updateError) {
      // Foreign key violation (category_id)
      if (updateError.code === "23503") {
        console.error("Foreign key violation (category_id):", { updateError, id, command });
        return null;
      }
      console.error("Failed to update product:", { updateError, id, command });
      throw new Error("Database update failed");
    }

    // Fetch updated product with category
    const { data: updatedProduct, error: fetchError } = await this.supabase
      .from("products")
      .select(
        "id, name, price, currency, unit, description, promo_conditions, bbox, created_at, updated_at, categories!inner(id, name)"
      )
      .eq("id", id)
      .single();

    if (fetchError || !updatedProduct) {
      console.error("Failed to fetch updated product:", { fetchError, id });
      throw new Error("Database query failed");
    }

    const product = updatedProduct as unknown as {
      id: string;
      name: string;
      price: number;
      currency: string;
      unit: string | null;
      description: string | null;
      promo_conditions: string | null;
      bbox: unknown;
      created_at: string;
      updated_at: string;
      categories: {
        id: string;
        name: string;
      };
    };

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
      updated_at: product.updated_at,
      category_id: product.categories.id,
      category_name: product.categories.name,
    };
  }

  /**
   * Usuwa produkt (admin)
   *
   * Endpoint: DELETE /api/admin/products/:id
   */
  async deleteProduct(id: string): Promise<boolean> {
    const { error, count } = await this.supabase.from("products").delete({ count: "exact" }).eq("id", id);

    if (error) {
      console.error("Failed to delete product:", { error, id });
      throw new Error("Database delete failed");
    }

    return (count ?? 0) > 0;
  }
}
