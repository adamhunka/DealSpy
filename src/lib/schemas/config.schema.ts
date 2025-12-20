import { z } from "zod";

/**
 * Schema walidacji klucza konfiguracji
 *
 * Używane w:
 * - GET /api/admin/config/:key
 * - PUT /api/admin/config/:key
 */
export const configKeySchema = z.string().min(1).max(100);

/**
 * Schema walidacji body dla aktualizacji konfiguracji
 *
 * Używane w:
 * - PUT /api/admin/config/:key
 *
 * Pola:
 * - value: obiekt JSONB (dowolna struktura JSON)
 * - description: opcjonalny opis (max 500 znaków)
 */
export const updateConfigSchema = z.object({
  value: z.record(z.unknown()),
  description: z.string().max(500).optional(),
});
