import { z } from "zod";

/**
 * Walidacja adresu email
 */
export const emailSchema = z
  .string({ required_error: "Email jest wymagany" })
  .email("Nieprawidłowy format email")
  .min(3, "Email musi mieć minimum 3 znaki")
  .max(255, "Email jest zbyt długi");

/**
 * Walidacja hasła
 */
export const passwordSchema = z
  .string({ required_error: "Hasło jest wymagane" })
  .min(6, "Hasło musi mieć minimum 6 znaków")
  .max(255, "Hasło jest zbyt długie");

/**
 * Schema walidacji dla logowania
 *
 * Endpoint: POST /api/auth/login
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

/**
 * Type dla LoginCommand wyekstrahowany ze schema
 */
export type LoginCommandSchema = z.infer<typeof loginSchema>;
