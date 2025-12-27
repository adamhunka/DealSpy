import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { emailSchema, passwordSchema } from "@/lib/schemas/auth.schema";

/**
 * Stan formularza logowania
 */
interface LoginFormState {
  email: string;
  password: string;
  isLoading: boolean;
}

/**
 * Błędy walidacji formularza logowania
 */
interface LoginFormErrors {
  email?: string;
  password?: string;
  general?: string;
}

/**
 * Szczegóły błędu z API
 */
interface ErrorDetail {
  field: string;
  message: string;
}

/**
 * Komponent formularza logowania administratora
 *
 * Obsługuje:
 * - Walidację danych wejściowych po stronie klienta
 * - Komunikację z API logowania
 * - Wyświetlanie błędów walidacji i autoryzacji
 * - Przekierowanie po pomyślnym logowaniu
 */
export default function LoginForm() {
  const [formState, setFormState] = useState<LoginFormState>({
    email: "",
    password: "",
    isLoading: false,
  });

  const [errors, setErrors] = useState<LoginFormErrors>({});

  /**
   * Waliduje formularz po stronie klienta używając tych samych schematów Zod co backend
   * @returns true jeśli formularz jest poprawny, false w przeciwnym razie
   */
  const validateForm = (): boolean => {
    const newErrors: LoginFormErrors = {};

    // Walidacja email używając emailSchema
    const emailResult = emailSchema.safeParse(formState.email);
    if (!emailResult.success) {
      newErrors.email = emailResult.error.errors[0]?.message || "Nieprawidłowy email";
    }

    // Walidacja hasła używając passwordSchema
    const passwordResult = passwordSchema.safeParse(formState.password);
    if (!passwordResult.success) {
      newErrors.password = passwordResult.error.errors[0]?.message || "Nieprawidłowe hasło";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Obsługuje submit formularza
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Walidacja client-side
    if (!validateForm()) {
      return;
    }

    setFormState((prev) => ({ ...prev, isLoading: true }));
    setErrors({});

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formState.email,
          password: formState.password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();

        // Obsługa błędów walidacji z serwera
        if (errorData.error?.code === "VALIDATION_ERROR" && errorData.error?.details) {
          const newErrors: LoginFormErrors = {};
          errorData.error.details.forEach((detail: ErrorDetail) => {
            if (detail.field === "email") newErrors.email = detail.message;
            if (detail.field === "password") newErrors.password = detail.message;
          });
          setErrors(newErrors);
          return;
        }

        // Obsługa innych błędów
        throw new Error(errorData.error?.message || "Wystąpił błąd podczas logowania");
      }

      const data = await response.json();

      // Sukces - wyświetl toast i przekieruj
      toast.success("Logowanie pomyślne!");

      // Krótkie opóźnienie dla lepszego UX (pozwól użytkownikowi zobaczyć toast)
      setTimeout(() => {
        // Sprawdź czy jest parametr redirect w URL
        const urlParams = new URLSearchParams(window.location.search);
        const redirectUrl = urlParams.get("redirect") || data.data.redirect_url;
        window.location.href = redirectUrl;
      }, 500);
    } catch (error) {
      // Obsługa błędów sieciowych i nieoczekiwanych
      const errorMessage = error instanceof Error ? error.message : "Wystąpił nieoczekiwany błąd";

      toast.error(errorMessage);
      setErrors({ general: errorMessage });

      // Logowanie błędu dla debugowania
      // eslint-disable-next-line no-console
      console.error("Login error:", error);
    } finally {
      setFormState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      {/* Email field */}
      <div>
        <Label htmlFor="email">Adres email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={formState.email}
          onChange={(e) => setFormState((prev) => ({ ...prev, email: e.target.value }))}
          className="mt-1"
          disabled={formState.isLoading}
        />
        {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
      </div>

      {/* Password field */}
      <div>
        <Label htmlFor="password">Hasło</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={formState.password}
          onChange={(e) => setFormState((prev) => ({ ...prev, password: e.target.value }))}
          className="mt-1"
          disabled={formState.isLoading}
        />
        {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
      </div>

      {/* General error */}
      {errors.general && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{errors.general}</p>
        </div>
      )}

      {/* Submit button */}
      <Button type="submit" className="w-full" disabled={formState.isLoading}>
        {formState.isLoading ? "Logowanie..." : "Zaloguj się"}
      </Button>
    </form>
  );
}
