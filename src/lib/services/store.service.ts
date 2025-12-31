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
      ? this.supabase.storage.from("store-logos").getPublicUrl(store.logo_path).data.publicUrl
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
   * Zwraca data URL z prostym SVG placeholder zamiast próbować
   * załadować nieistniejący plik ze storage.
   *
   * @returns Data URL z SVG placeholder
   */
  private getDefaultLogoUrl(): string {
    // SVG placeholder - prosty szary kwadrat z ikoną sklepu
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#f3f4f6"/><path fill="#9ca3af" d="M50 30h100v10H50zm0 20h100v10H50zm0 20h100v80c0 5.523-4.477 10-10 10H60c-5.523 0-10-4.477-10-10z"/></svg>`;
    
    // Koduj SVG dla data URL (URL-safe)
    const encoded = encodeURIComponent(svg)
      .replace(/'/g, "%27")
      .replace(/"/g, "%22");
    
    return `data:image/svg+xml,${encoded}`;
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
   * Pobiera pojedynczy sklep po ID
   *
   * @param id - UUID sklepu
   * @returns Promise<StoreDTO | null> - sklep lub null jeśli nie znaleziono
   * @throws Error gdy zapytanie do bazy się nie powiedzie
   */
  async getStoreById(id: string): Promise<StoreDTO | null> {
    const { data, error } = await this.supabase
      .from("stores")
      .select("id, name, slug, logo_path, created_at")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error(`Failed to fetch store with id "${id}":`, error);
      throw new Error("Database query failed");
    }

    if (!data) {
      return null;
    }

    return this.transformToDTO(data);
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
   * 1. Sprawdzenie unikalności slug
   * 2. Upload logo (jeśli podane)
   * 3. Wstawienie do bazy danych
   * 4. Zwrócenie utworzonego sklepu
   *
   * @param command - CreateStoreCommand (name, slug, logo_file)
   * @returns Promise<StoreDTO> - utworzony sklep
   * @throws Error gdy wstawienie do bazy się nie powiedzie
   */
  async createStore(command: CreateStoreCommand): Promise<StoreDTO | null> {
    const { name, slug, logo_file } = command;

    const exists = await this.checkStoreSlugExists(slug);

    if (exists) {
      throw new Error("SLUG_EXISTS");
    }

    // Upload logo jeśli podane
    let logoPath: string | null = null;
    if (logo_file) {
      try {
        logoPath = await this.uploadLogo(slug, logo_file);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to upload logo:", error);
        // Kontynuujemy bez logo - można to poprawić później
      }
    }

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
      .select("id, slug")
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

    // Sprawdź czy slug nie jest zajęty przez inny sklep
    if (slug !== undefined && slug !== existingStore.slug) {
      const slugExists = await this.checkStoreSlugExists(slug, id);
      if (slugExists) {
        throw new Error("SLUG_EXISTS");
      }
    }

    const updateData: Partial<Store> = {};
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    
    // Upload nowego logo jeśli podane
    if (logo_file !== undefined && logo_file !== null) {
      try {
        const newSlug = slug || existingStore.slug;
        const logoPath = await this.uploadLogo(newSlug, logo_file);
        updateData.logo_path = logoPath;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to upload logo:", error);
        // Kontynuujemy update bez logo
      }
    }

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
      .select("id, logo_path")
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

    // Usuń logo ze storage jeśli istnieje
    if (existingStore.logo_path) {
      try {
        await this.supabase.storage.from("store-logos").remove([existingStore.logo_path]);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to delete logo from storage:", error);
        // Kontynuujemy usuwanie sklepu mimo błędu
      }
    }

    const { error: deleteError } = await this.supabase.from("stores").delete().eq("id", id);

    if (deleteError) {
      // eslint-disable-next-line no-console
      console.error("Failed to delete store in database:", deleteError);
      throw new Error("Database query failed");
    }

    return true;
  }

  /**
   * Upload logo do Supabase Storage
   *
   * @param storeSlug - slug sklepu (używany w nazwie pliku)
   * @param base64Data - logo jako base64 string (data:image/png;base64,...)
   * @returns ścieżka do pliku w storage
   */
  private async uploadLogo(storeSlug: string, base64Data: string): Promise<string> {
    // Wyodrębnij MIME type i dane z base64
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    
    if (!matches || matches.length !== 3) {
      throw new Error("Invalid base64 data format");
    }

    const mimeType = matches[1];
    const base64Content = matches[2];

    // Konwertuj base64 do buffer
    const buffer = Buffer.from(base64Content, "base64");

    // Określ rozszerzenie pliku na podstawie MIME type
    const extension = mimeType.split("/")[1] || "png";
    
    // Unikalna nazwa pliku: slug + timestamp
    const timestamp = Date.now();
    const fileName = `${storeSlug}-${timestamp}.${extension}`;

    // Upload do Supabase Storage
    const { data, error } = await this.supabase.storage
      .from("store-logos")
      .upload(fileName, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      // eslint-disable-next-line no-console
      console.error("Storage upload error:", error);
      throw new Error(`Failed to upload logo: ${error.message}`);
    }

    return data.path;
  }
}
