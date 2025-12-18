import type { SupabaseClient } from "@/db/supabase.client";
import type {
  AdminFlyerDetailDTO,
  AdminFlyerPageDetailDTO,
  FlyerListItemDTO,
  FlyerDetailDTO,
  FlyerPageDTO,
  FlyerProductDTO,
  BBox,
  Flyer,
  FlyerPage,
  FlyerStatus,
  AdminFlyerListItemDTO,
  CreateFlyerCommand,
  UpdateFlyerCommand,
} from "@/types";

/**
 * Typy pomocnicze dla danych zwracanych przez Supabase
 *
 */

// WYbarane pola z tabeli flyers
type FlyerSelect = Pick<Flyer, "id" | "valid_from" | "valid_to" | "created_at">;

// Dane z flyers + zagnieżdżone dane z stores
type FlyerWithStore = FlyerSelect & {
  stores: {
    name: string;
    slug: string;
    logo_path: string;
  };
};

// Dane z flyers + stores + count stron
type FlyerListRow = FlyerWithStore & {
  flyer_pages: { count: number }[];
};

// Wybrane pola z tabeli flyer_pages
type FlyerPageSelect = Pick<FlyerPage, "id" | "page_number" | "web_image_path">;

// Strona z count produktów
type FlyerPageWithCount = FlyerPageSelect & {
  products: { count: number }[];
};

// Product z gazetki razem z wszystkimi relacjami
interface FlyerProductRow {
  id: string;
  name: string;
  price: number;
  currency: string;
  unit: string | null;
  bbox: unknown;
  categories: {
    name: string;
    slug: string;
  };
  flyer_pages: {
    page_number: number;
    web_image_path: string | null;
    flyer_id: string;
  };
}

// Lista gazetek - rezultat query z JOINami
type AdminFlyerListRow = Pick<
  Flyer,
  "id" | "valid_from" | "valid_to" | "status" | "deleted_at" | "created_at" | "updated_at" | "verified_by"
> & {
  stores: {
    name: string;
    slug: string;
  };
  flyer_pages: { count: number }[];
  profiles: {
    full_name: string | null;
  } | null;
};

// Szczegóły gazetki - rezultat query głównej gazetki
type AdminFlyerRow = Pick<
  Flyer,
  "id" | "store_id" | "valid_from" | "valid_to" | "status" | "deleted_at" | "created_at" | "updated_at" | "verified_by"
> & {
  stores: {
    name: string;
    slug: string;
  };
  profiles: {
    full_name: string | null;
  } | null;
};

// Strona gazetki w Admin API
interface AdminFlyerPageRow {
  id: string;
  page_number: number;
  original_image_path: string | null;
  web_image_path: string | null;
  status: FlyerStatus;
  raw_ai_data: unknown;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  products: { count: number }[];
}

/**
 * FlyerService - serwis do zarządzania gazetkami promocyjnymi
 *
 * Odpowiedzialności:
 * - Pobieranie gazetek z bazy danych
 * - Transformacja danych do DTOs
 * - Generowanie URL-i do obrazków z Supabase Storage
 */
export class FlyerService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Generuje pełny URL do pliku w Supabase Storage
   *
   * @param bucket - nazwa bucketa (np. 'store-logos', 'public_flyers')
   * @param path - relatywna ścieżka do pliku
   * @returns Pełny publiczny URL
   *
   * Przykład:
   * generateStorageUrl('store-logos', 'biedronka.webp')
   * → 'https://xxx.supabase.co/storage/v1/object/public/store-logos/biedronka.webp'
   */
  private generateStorageUrl(bucket: string, path: string): string {
    const { data } = this.supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  /**
   * Pobiera listę aktywnych, opublikowanych gazetek
   *
   * @param params - parametry filtrowania i paginacji
   * @returns Lista gazetek + łączna liczba
   *
   * Logika biznesowa:
   * 1. Tylko opublikowane gazetki (status = 'published')
   * 2. Tylko nieusunięte (deleted_at IS NULL)
   * 3. Tylko aktywne (valid_to >= dzisiaj)
   * 4. Opcjonalnie filtruj po sklepie
   * 5. Sortuj po valid_from DESC (najnowsze pierwsze)
   */
  async listFlyers(params: {
    store?: string;
    limit: number;
    offset: number;
  }): Promise<{ flyers: FlyerListItemDTO[]; total: number }> {
    const { store, limit, offset } = params;

    let query = this.supabase
      .from("flyers")
      .select("id, valid_from, valid_to, created_at, stores!inner ( name, slug, logo_path ), flyer_pages (count)", {
        count: "exact",
      })
      .eq("status", "published")
      .is("deleted_at", null)
      .gte("valid_to", new Date().toISOString().split("T")[0]);

    if (store) {
      query = query.eq("stores.slug", store);
    }

    const { data, error, count } = await query
      .order("valid_from", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Failed to list flyers:", {
        error,
        params: { store, limit, offset },
      });
      throw new Error("Database query failed");
    }

    if (!data || data.length === 0) {
      return { flyers: [], total: 0 };
    }

    const flyers = data.map((row) => {
      const flyerRow = row as FlyerListRow;

      return {
        id: flyerRow.id,
        store_name: flyerRow.stores.name,
        store_slug: flyerRow.stores.slug,
        store_logo: this.generateStorageUrl("store-logos", flyerRow.stores.logo_path),
        valid_from: flyerRow.valid_from,
        valid_to: flyerRow.valid_to,
        page_count: flyerRow.flyer_pages?.[0]?.count ?? 0,
        created_at: flyerRow.created_at,
      } satisfies FlyerListItemDTO;
    });

    return {
      flyers,
      total: count ?? 0,
    };
  }

  /**
   * Pobiera szczegóły pojedynczej gazetki ze stronami
   *
   * @param id - UUID gazetki
   * @returns Szczegóły gazetki lub null jeśli nie znaleziono
   *
   * Logika:
   * 1. Pobierz gazetkę (tylko published i nieusunięte)
   * 2. Jeśli nie ma - return null (endpoint zwróci 404)
   * 3. Pobierz strony gazetki z liczbą produktów
   * 4. Zbuduj FlyerDetailDTO
   */
  async getFlyerById(id: string): Promise<FlyerDetailDTO | null> {
    const { data: flyerData, error: flyerError } = await this.supabase
      .from("flyers")
      .select("id, valid_from, valid_to, created_at, stores!inner ( name, slug, logo_path ) ")
      .eq("id", id)
      .eq("status", "published")
      .is("deleted_at", null)
      .maybeSingle();

    if (flyerError) {
      console.error("Failed to get flyer:", { error: flyerError, id });
      throw new Error("Database query failed");
    }

    if (!flyerData) {
      return null;
    }

    const { data: pagesData, error: pagesError } = await this.supabase
      .from("flyer_pages")
      .select("id, page_number, web_image_path, products (count)")
      .eq("flyer_id", id)
      .order("page_number", { ascending: true });

    if (pagesError) {
      console.error("Failed to get flyer pages:", { error: pagesError, id });
      throw new Error("Database query failed");
    }

    const pages: FlyerPageDTO[] = (pagesData ?? []).map((page) => {
      const pageRow = page as FlyerPageWithCount;

      return {
        id: pageRow.id,
        page_number: pageRow.page_number,
        web_image_url: this.generateStorageUrl("public_flyers", pageRow.web_image_path ?? ""),
        product_count: pageRow.products?.[0]?.count ?? 0,
      };
    });

    const pageCount = pages.length;

    const flyerRow = flyerData as FlyerWithStore;
    return {
      id: flyerRow.id,
      store_name: flyerRow.stores.name,
      store_slug: flyerRow.stores.slug,
      store_logo: this.generateStorageUrl("store-logos", flyerRow.stores.logo_path),
      valid_from: flyerRow.valid_from,
      valid_to: flyerRow.valid_to,
      page_count: pageCount,
      created_at: flyerRow.created_at,
      pages,
    };
  }

  /**
   * Sprawdza czy gazetka istnieje i jest published
   *
   * Pomocnicza metoda używana przez /api/flyers/:id/products
   * żeby sprawdzić czy gazetka jest dostępna przed pobraniem produktów
   */
  async checkFLyerExists(id: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("flyers")
      .select("id")
      .eq("id", id)
      .eq("status", "published")
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      console.error("Failed to check flyer exists:", { error, id });
      throw new Error("Database query failed");
    }

    return data !== null;
  }

  /**
   * Pobiera wszystkie produkty z danej gazetki
   *
   * @param flyerId - UUID gazetki
   * @param params - parametry paginacji
   * @returns Lista produktów + łączna liczba
   *
   * Logika:
   * 1. JOIN products → flyer_pages → categories
   * 2. Filtruj po flyer_id
   * 3. Sortuj po page_number, potem po name
   * 4. Paginacja
   */
  async getFlyerProducts(
    flyerId: string,
    params: { limit: number; offset: number }
  ): Promise<{ products: FlyerProductDTO[]; total: number }> {
    const { limit, offset } = params;

    const { data, error, count } = await this.supabase
      .from("products")
      .select(
        "id, name, price, currency, unit, bbox, categories!inner ( name, slug ), flyer_pages!inner ( page_number, web_image_path, flyer_id )",
        { count: "exact" }
      )
      .eq("flyer_pages.flyer_id", flyerId)
      .order("flyer_pages.page_number", { ascending: true })
      .order("name", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Failed to get flyer products:", { error, flyerId, params });
      throw new Error("Database query failed");
    }

    if (!data || data.length === 0) {
      return { products: [], total: 0 };
    }

    const products = data.map((row) => {
      const productRow = row as FlyerProductRow;

      return {
        id: productRow.id,
        name: productRow.name,
        price: productRow.price,
        currency: productRow.currency,
        unit: productRow.unit,
        category_name: productRow.categories.name,
        category_slug: productRow.categories.slug,
        page_number: productRow.flyer_pages.page_number,
        web_image_url: this.generateStorageUrl("public_flyers", productRow.flyer_pages.web_image_path ?? ""),
        bbox: productRow.bbox as BBox | null,
      };
    }) satisfies FlyerProductDTO[];

    return {
      products,
      total: count ?? 0,
    };
  }

  async listAdminFlyers(params: {
    store?: string;
    status?: FlyerStatus;
    include_deleted?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ flyers: AdminFlyerListItemDTO[]; total: number }> {
    const { store, status, include_deleted = false, limit = 20, offset = 0 } = params;

    let query = this.supabase
      .from("flyers")
      .select(
        "id, valid_from, valid_to, status, deleted_at, created_at, updated_at, verified_by, stores!inner ( name, slug ), flyer_pages (count), profiles!flyers_verified_by_fkey ( full_name )",
        { count: "exact" }
      );

    if (!include_deleted) {
      query = query.is("deleted_at", null);
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (store) {
      query = query.eq("stores.slug", store);
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Failed to list admin flyers:", { error, params });
      throw new Error("Database query failed");
    }

    if (!data || data.length === 0) {
      return { flyers: [], total: 0 };
    }

    const flyers = data.map((row): AdminFlyerListItemDTO => {
      const flyerRow = row as AdminFlyerListRow;

      return {
        id: flyerRow.id,
        store_name: flyerRow.stores.name,
        store_slug: flyerRow.stores.slug,
        valid_from: flyerRow.valid_from,
        valid_to: flyerRow.valid_to,
        status: flyerRow.status,
        page_count: flyerRow.flyer_pages?.[0]?.count ?? 0,
        verified_pages: 0, // TODO: Dodać query dla verified_pages
        deleted_at: flyerRow.deleted_at,
        created_at: flyerRow.created_at,
        updated_at: flyerRow.updated_at,
        verified_by: flyerRow.verified_by,
        verified_by_name: flyerRow.profiles?.full_name ?? null,
      };
    });

    return {
      flyers,
      total: count ?? 0,
    };
  }

  async getAdminFlyerById(id: string): Promise<AdminFlyerDetailDTO | null> {
    const { data: flyerData, error: flyerError } = await this.supabase
      .from("flyers")
      .select(
        "id, store_id, valid_from, valid_to, status, deleted_at, created_at, updated_at, verified_by, stores!inner ( name, slug ), profiles!flyers_verified_by_fkey ( full_name)"
      )
      .eq("id", id)
      .maybeSingle();

    if (flyerError) {
      console.error("Failed to get admin flyer:", { error: flyerError, id });
      throw new Error("Database query failed");
    }

    if (!flyerData) {
      return null;
    }

    const { data: pagesData, error: pagesError } = await this.supabase
      .from("flyer_pages")
      .select(
        "id, page_number, original_image_path, web_image_path, status, raw_ai_data, error_message, created_at, updated_at, products (count)"
      )
      .eq("flyer_id", id)
      .order("page_number", { ascending: true });

    if (pagesError) {
      console.error("Failed to get admin flyer pages:", { error: pagesError, id });
      throw new Error("Database query failed");
    }

    const pages: AdminFlyerPageDetailDTO[] = (pagesData ?? []).map((page): AdminFlyerPageDetailDTO => {
      const pageRow = page as AdminFlyerPageRow;

      return {
        id: pageRow.id,
        page_number: pageRow.page_number,
        original_image_url: this.generateStorageUrl("flyer_originals", pageRow.original_image_path ?? ""),
        web_image_url: this.generateStorageUrl("public_flyers", pageRow.web_image_path ?? ""),
        status: pageRow.status,
        product_count: pageRow.products?.[0]?.count ?? 0,
        has_raw_ai_data: pageRow.raw_ai_data !== null,
        error_message: pageRow.error_message,
        created_at: pageRow.created_at,
        updated_at: pageRow.updated_at,
      };
    });

    const flyerRow = flyerData as AdminFlyerRow;

    return {
      id: flyerRow.id,
      store_id: flyerRow.store_id,
      store_name: flyerRow.stores.name,
      store_slug: flyerRow.stores.slug,
      valid_from: flyerRow.valid_from,
      valid_to: flyerRow.valid_to,
      status: flyerRow.status,
      deleted_at: flyerRow.deleted_at,
      verified_by: flyerRow.verified_by,
      verified_by_name: flyerRow.profiles?.full_name ?? null,
      created_at: flyerRow.created_at,
      updated_at: flyerRow.updated_at,
      pages,
    };
  }

  async createFlyer(command: CreateFlyerCommand): Promise<AdminFlyerDetailDTO | null> {
    const { store_id, valid_from, valid_to } = command;

    const storeExists = await this.checkFLyerExists(store_id);
    if (!storeExists) {
      return null;
    }

    const { data: flyerData, error: insertError } = await this.supabase
      .from("flyers")
      .insert({
        store_id,
        valid_from,
        valid_to,
        status: "draft",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Failed to create flyer:", { error: insertError, command });
      throw new Error("Database query failed");
    }
    const flyer = await this.getAdminFlyerById(flyerData.id);

    return flyer;
  }

  private async checkStoreExists(store_id: string): Promise<boolean> {
    const { data, error } = await this.supabase.from("stores").select("id").eq("id", store_id).maybeSingle();

    if (error) {
      console.error("Failed to check store exists:", { error, store_id });
      throw new Error("Database query failed");
    }

    return data !== null;
  }

  async upadateFlyer(id: string, command: UpdateFlyerCommand): Promise<AdminFlyerDetailDTO | null> {
    const { data: existingFlyer, error: checkError } = await this.supabase
      .from("flyers")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (checkError) {
      console.error("Failed to check flyer exists:", { error: checkError, id });
      throw new Error("Database query failed");
    }

    if (!existingFlyer) {
      return null;
    }

    const updateData: Partial<Pick<Flyer, "valid_from" | "valid_to" | "status">> & {
      updated_at: string;
    } = {
      updated_at: new Date().toISOString(),
    };

    if (command.valid_from !== undefined) {
      updateData.valid_from = command.valid_from;
    }

    if (command.valid_to !== undefined) {
      updateData.valid_to = command.valid_to;
    }

    if (command.status !== undefined) {
      updateData.status = command.status;
    }

    const { error: updateError } = await this.supabase.from("flyers").update(updateData).eq("id", id);

    if (updateError) {
      console.error("Failed to update flyer:", { error: updateError, id, command });
      throw new Error("Database query failed");
    }

    const flyer = await this.getAdminFlyerById(id);

    return flyer;
  }

  async deleteFlyer(id: string): Promise<{
    id: string;
    deleted: boolean;
    deleted_at: string;
  } | null> {
    const { data: existingFlyer, error: checkError } = await this.supabase
      .from("flyers")
      .select("id, deleted_at")
      .eq("id", id)
      .maybeSingle();

    if (checkError) {
      console.error("Failed to check flyer exists:", { error: checkError, id });
      throw new Error("Database query failed");
    }

    if (!existingFlyer) {
      return null;
    }

    if (existingFlyer.deleted_at !== null) {
      return null;
    }

    const deleted_at = new Date().toISOString();

    const { error: deleteError } = await this.supabase
      .from("flyers")
      .update({
        deleted_at,
        updated_at: deleted_at,
      })
      .eq("id", id);

    if (deleteError) {
      console.error("Failed to delete flyer:", { error: deleteError, id });
      throw new Error("Database query failed");
    }

    return {
      id,
      deleted: true,
      deleted_at,
    };
  }
}
