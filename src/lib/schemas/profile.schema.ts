import { z } from "zod";

/**
 * Schema walidacji body dla aktualizacji profilu admina
 *
 * Używane w:
 * - PATCH /api/admin/profile
 *
 * Pola:
 * - full_name: opcjonalna pełna nazwa użytkownika (1-100 znaków)
 *
 * Uwaga: Pole 'role' nie może być zmieniane przez ten endpoint
 */
export const updateProfileSchema = z.object({
  full_name: z.string().min(1).max(100).optional(),
});
