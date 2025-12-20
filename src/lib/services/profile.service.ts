import type { SupabaseClient } from "@/db/supabase.client";
import type { ProfileDTO, UpdateProfileCommand } from "@/types";

/**
 * ProfileService - serwis do zarządzania profilami użytkowników
 *
 * Obsługuje operacje na tabeli profiles
 *
 * Endpointy:
 * - GET /api/admin/profile
 * - PATCH /api/admin/profile
 */
export class ProfileService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Pobiera profil użytkownika z emailem
   *
   * @param userId - ID użytkownika z auth.users
   * @param email - Email użytkownika (z auth.users)
   * @returns Pełny profil użytkownika w formacie ProfileDTO
   * @throws Error jeśli wystąpi błąd bazy danych lub profil nie istnieje
   */
  async getProfileByIdWithEmail(userId: string, email: string): Promise<ProfileDTO> {
    const { data, error } = await this.supabase
      .from("profiles")
      .select("id, role, full_name, created_at, updated_at")
      .eq("id", userId)
      .single();

    if (error) throw error;

    return {
      id: data.id,
      email: email,
      role: data.role,
      full_name: data.full_name,
      created_at: data.created_at,
      updated_at: data.updated_at,
    } as ProfileDTO;
  }

  /**
   * Aktualizuje profil użytkownika
   *
   * @param userId - ID użytkownika
   * @param command - Dane do aktualizacji (obecnie tylko full_name)
   * @throws Error jeśli wystąpi błąd bazy danych
   *
   * Uwaga: Pole 'role' nie może być zmieniane przez ten serwis
   */
  async updateProfile(userId: string, command: UpdateProfileCommand): Promise<void> {
    const { error } = await this.supabase
      .from("profiles")
      .update({
        full_name: command.full_name,
      })
      .eq("id", userId);

    if (error) throw error;
  }
}
