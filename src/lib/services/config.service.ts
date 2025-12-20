import type { SupabaseClient } from "@/db/supabase.client";
import type { ConfigDTO, UpdateConfigCommand } from "@/types";

/**
 * ConfigService - serwis do zarządzania konfiguracją systemu
 *
 * Obsługuje operacje CRUD na tabeli app_config
 *
 * Endpointy:
 * - GET /api/admin/config
 * - GET /api/admin/config/:key
 * - PUT /api/admin/config/:key
 */
export class ConfigService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Pobiera wszystkie ustawienia konfiguracyjne
   *
   * @returns Array wszystkich konfiguracji posortowanych po kluczu
   * @throws Error jeśli wystąpi błąd bazy danych
   */
  async getAllConfigs(): Promise<ConfigDTO[]> {
    const { data, error } = await this.supabase
      .from("app_config")
      .select("key, value, description, updated_at")
      .order("key");

    if (error) throw error;
    return data as ConfigDTO[];
  }

  /**
   * Pobiera pojedyncze ustawienie konfiguracyjne
   *
   * @param key - Klucz konfiguracji
   * @returns Obiekt konfiguracji lub null jeśli nie znaleziono
   * @throws Error jeśli wystąpi błąd bazy danych (poza NOT FOUND)
   */
  async getConfigByKey(key: string): Promise<ConfigDTO | null> {
    const { data, error } = await this.supabase
      .from("app_config")
      .select("key, value, description, updated_at")
      .eq("key", key)
      .single();

    if (error) {
      // PGRST116 = NOT FOUND w Supabase
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return data as ConfigDTO;
  }

  /**
   * Tworzy lub aktualizuje ustawienie konfiguracyjne
   *
   * @param key - Klucz konfiguracji
   * @param command - Dane do zapisania (value + opcjonalny description)
   * @returns Zaktualizowany obiekt konfiguracji
   * @throws Error jeśli wystąpi błąd bazy danych
   */
  async upsertConfig(key: string, command: UpdateConfigCommand): Promise<ConfigDTO> {
    const { data, error } = await this.supabase
      .from("app_config")
      .upsert({
        key,
        value: command.value as unknown as never,
        description: command.description,
      })
      .select("key, value, description, updated_at")
      .single();

    if (error) throw error;
    return data as ConfigDTO;
  }
}
