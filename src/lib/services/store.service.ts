import type { SupabaseClient } from "@/db/supabase.client";
import type { Store, StoreDTO } from "@/types";

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
}
