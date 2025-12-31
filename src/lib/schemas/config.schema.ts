import { z } from "zod";

/**
 * Schema walidacji klucza konfiguracji (wartość)
 *
 * Wymagania:
 * - Klucz nie może być pusty
 * - Maksymalnie 100 znaków
 */
export const configKeySchema = z.string().min(1, "Klucz nie może być pusty").max(100, "Klucz może mieć maksymalnie 100 znaków");

/**
 * Schema walidacji parametru key z URL
 *
 * Używane w:
 * - GET /api/admin/config/:key
 * - PUT /api/admin/config/:key
 */
export const configKeyParamSchema = z.object({
  key: configKeySchema,
});

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
  description: z.string().max(500, "Opis może mieć maksymalnie 500 znaków").optional(),
});

/**
 * TypeScript types wygenerowane ze schematów
 */
export type ConfigKeyParams = z.infer<typeof configKeyParamSchema>;
export type UpdateConfigCommand = z.infer<typeof updateConfigSchema>;
