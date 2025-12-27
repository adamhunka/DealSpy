import type { SupabaseClient } from "@/db/supabase.client";
import type { Store, StoreDTO, CreateStoreCommand, UpdateStoreCommand } from "@/types";

/**
 * Type reprezentujący Store bez pola updated_at
 * Używany gdy selectujemy tylko konkretne pola z bazy
 */
type StoreSelect = Pick<Store, "id" | "name" | "slug" | "logo_path" | "created_at">;

/**
 * Service do zarządzania danymi sklepów
 *
 * Odpowiedzialność:
 * - Pobieranie danych z bazy przez Supabase
 * - Transformacja Store entity → StoreDTO
 * - Obsługa błędów bazy danych
 *
 * Nie odpowiada za:
 * - Walidację parametrów URL (to robi endpoint)
 * - Formatowanie HTTP response (to robią helpers)
 * - Autoryzację (endpointy są publiczne)
 */
export class StoreService {
  /**
   * Constructor przyjmuje Supabase client
   *
   * Dlaczego przez constructor?
   * - Dependency Injection pattern
   * - Możemy przekazać różne instance (np. mock w testach)
   * - Client jest dostępny we wszystkich metodach
   *
   * @param supabase - Instance Supabase client
   */
  constructor(private supabase: SupabaseClient) {}

  /**
   * Transformuje Store entity do StoreDTO
   *
   * Dlaczego prywatna metoda?
   * - Tylko wewnętrzna implementacja, nie API publiczne
   * - Reużywalna w getAllStores() i getStoreBySlug()
   *
   * Transformacje:
   * 1. logo_path (string | null) → logo_url (string)
   * 2. Usuwamy pole updated_at
   * 3. Generujemy pełny URL do loga
   *
   * @param store - Store entity z bazy danych (bez updated_at)
   * @returns StoreDTO gotowe do wysłania przez API
   */
  private transformToDTO(store: StoreSelect): StoreDTO {
    const logoUrl = store.logo_path
      ? this.supabase.storage.from("storage-logos").getPublicUrl(store.logo_path).data.publicUrl
      : this.getDefaultLogoUrl();

    return {
      id: store.id,
      name: store.name,
      slug: store.slug,
      logo_url: logoUrl,
      created_at: store.created_at,
    };
  }

  /**
   * Zwraca URL domyślnego loga (gdy sklep nie ma własnego)
   *
   * Dlaczego osobna metoda?
   * - Łatwo zmienić domyślne logo w jednym miejscu
   * - Reużywalna
   * - Czytelny kod w transformToDTO()
   *
   * @returns URL do domyślnego loga
   */
  private getDefaultLogoUrl(): string {
    return this.supabase.storage.from("store-logos").getPublicUrl("default.webp").data.publicUrl;
  }

  /**
   * Pobiera wszystkie sklepy z bazy danych
   *
   * Przepływ:
   * 1. Query do Supabase
   * 2. Sprawdzenie błędów
   * 3. Transformacja każdego Store → StoreDTO
   * 4. Zwrócenie tablicy StoreDTO[]
   *
   * @returns Promise<StoreDTO[]> - lista sklepów
   * @throws Error gdy zapytanie do bazy się nie powiedzie
   *
   * Dlaczego rzucamy Error?
   * - Service nie zna HTTP (statusów, Response)
   * - Endpoint złapie Error i zwróci odpowiedni HTTP response
   */
  async getAllStores(): Promise<StoreDTO[]> {
    const { data, error } = await this.supabase
      .from("stores")
      .select("id, name, slug, logo_path, created_at")
      .order("name", { ascending: true });

    if (error) {
      console.error("Failed to fetch stores from database:", error);
      throw new Error("Database query failed");
    }

    if (!data) {
      return [];
    }

    return data.map((store: StoreSelect) => this.transformToDTO(store));
  }

  /**
   * Pobiera pojedynczy sklep po slug
   *
   * Przepływ:
   * 1. Query z WHERE slug = $slug
   * 2. Sprawdzenie błędów
   * 3. Jeśli nie znaleziono, zwróć null
   * 4. Jeśli znaleziono, transformuj do DTO
   *
   * @param slug - URL-friendly identyfikator sklepu
   * @returns Promise<StoreDTO | null> - sklep lub null jeśli nie znaleziono
   * @throws Error gdy zapytanie do bazy się nie powiedzie
   *
   * Dlaczego zwracamy null, a nie rzucamy błędem?
   * - "Not found" to prawidłowy przypadek biznesowy, nie błąd
   * - Endpoint zdecyduje czy zwrócić 404
   */
  async getStoreBySlug(slug: string): Promise<StoreDTO | null> {
    const { data, error } = await this.supabase
      .from("stores")
      .select("id, name, slug, logo_path, created_at")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      console.error(`Failed to fetch store with slug "${slug}":`, error);
      throw new Error("Database query failed");
    }

    if (!data) {
      return null;
    }

    return this.transformToDTO(data);
  }

  /**
   * Sprawdza czy sklep o podanym slug już istnieje
   * @param slug - slug do sprawdzenia
   * @param excludeId - opcjonalnie wyklucz sklep o tym ID (dla update)
   * @returns true jeśli slug jest zajęty
   */
  async checkStoreSlugExists(slug: string, excludeId?: string): Promise<boolean> {
    let query = this.supabase.from("stores").select("id").eq("slug", slug);

    if (excludeId) {
      query = query.neq("id", excludeId);
    }
    const { data, error } = await query.maybeSingle();

    if (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to check slug existence:", { error, slug, excludeId });
      throw new Error("Database query failed");
    }
    return !!data;
  }

  /**
   * Tworzy nowy sklep w bazie danych
   *
   * Przeplływ:
   * 1. Wstawienie do bazy danych
   * 2. Przygotowanie logo (jeśli podane)
   * 3. Zwrócenie utworzonego sklepu
   *
   * @param command - CreateStoreCommand (name, slug, logo_file)
   * @returns Promise<StoreDTO> - utworzony sklep
   * @throws Error gdy wstawienie do bazy się nie powiedzie
   */
  async createStore(command: CreateStoreCommand): Promise<StoreDTO | null> {
    const { name, slug } = command;

    const exists = await this.checkStoreSlugExists(slug);

    if (exists) {
      throw new Error("Sklep o podanym slug już istnieje");
    }

    const logoPath = null;

    const { data: storeData, error: insertError } = await this.supabase
      .from("stores")
      .insert({ name, slug, logo_path: logoPath })
      .select("id, name, slug, logo_path, created_at")
      .single();

    if (insertError) {
      // eslint-disable-next-line no-console
      console.error("Failed to create store in database:", insertError);
      throw new Error("Database query failed");
    }

    return this.transformToDTO(storeData);
  }

  async updateStore(id: string, command: UpdateStoreCommand): Promise<StoreDTO | null> {
    const { name, slug, logo_file } = command;

    const { data: existingStore, error: checkError } = await this.supabase
      .from("stores")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (checkError) {
      // eslint-disable-next-line no-console
      console.error("Failed to check store existence:", { error: checkError, id });
      throw new Error("Database query failed");
    }

    if (!existingStore) {
      return null;
    }

    const updateData: Partial<Store> = {};
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (logo_file !== undefined) updateData.logo_path = logo_file;

    const { data, error } = await this.supabase
      .from("stores")
      .update(updateData)
      .eq("id", id)
      .select("id, name, slug, logo_path, created_at")
      .single();

    if (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to update store in database:", error);
      throw new Error("Database query failed");
    }

    return this.transformToDTO(data);
  }

  async deleteStore(id: string): Promise<boolean> {
    const { data: existingStore, error: checkError } = await this.supabase
      .from("stores")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (checkError) {
      // eslint-disable-next-line no-console
      console.error("Failed to check store existence:", { error: checkError, id });
      throw new Error("Database query failed");
    }

    if (!existingStore) {
      return false;
    }

    const { error: deleteError } = await this.supabase.from("stores").delete().eq("id", id);

    if (deleteError) {
      // eslint-disable-next-line no-console
      console.error("Failed to delete store in database:", deleteError);
      throw new Error("Database query failed");
    }

    return true;
  }
}
