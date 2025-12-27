import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import type { StoreDTO, CreateStoreCommand, UpdateStoreCommand } from "@/types";
import { createStoreSchema, updateStoreSchema } from "@/lib/schemas/store.schema";
import { fileToBase64, validateLogoFile } from "@/lib/helpers/file-validation.helper";
import { LogoUpload } from "./LogoUpload";
import { toast } from "sonner";

/**
 * Props dla StoreFormDialog
 *
 * Dlaczego tak?
 * - isOpen/onOpenChange - kontrola z rodzica (controlled component)
 * - mode - określa czy dodajemy nowy czy edytujemy
 * - store - dane sklepu do edycji (null jeśli tworzymy nowy)
 * - onSave - callback wywoływany po kliknięciu "Zapisz"
 */
interface StoreFormDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  store: StoreDTO | null;
  onSave: (data: CreateStoreCommand | UpdateStoreCommand) => Promise<void>;
}

/**
 * Typ dla stanu formularza
 * Zawiera wszystkie pola które użytkownik może edytować
 */
interface FormData {
  name: string;
  slug: string;
  logo_file: File | null;
}

/**
 * Typ dla błędów walidacji
 * Każde pole może mieć swój komunikat błędu
 */
interface FormErrors {
  name?: string;
  slug?: string;
  logo_file?: string;
}

/**
 * Dialog z formularzem dodawania/edycji sklepu
 *
 * Odpowiedzialności:
 * - Wyświetlanie dialogu
 * - Zarządzanie stanem formularza
 * - Walidacja danych
 * - Wywołanie onSave z danymi
 */
export function StoreFormDialog({ isOpen, onOpenChange, mode, store, onSave }: StoreFormDialogProps) {
  const [formData, setFormData] = useState<FormData>({
    name: store?.name || "",
    slug: store?.slug || "",
    logo_file: null,
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (mode === "edit" && store) {
        setFormData({
          name: store.name,
          slug: store.slug,
          logo_file: null,
        });
      } else {
        setFormData({
          name: "",
          slug: "",
          logo_file: null,
        });
      }
      setErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen, mode, store]);

  const updateField = (field: keyof FormData, value: string | File | null) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Wyczyść błąd dla tego pola
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: undefined,
      }));
    }
  };

  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const handleNameChange = (value: string) => {
    updateField("name", value);

    if (mode === "create") {
      updateField("slug", generateSlug(value));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    const schema = mode === "create" ? createStoreSchema : updateStoreSchema;

    const dataToValidate = {
      name: formData.name,
      slug: formData.slug,
    };

    const result = schema.safeParse(dataToValidate);

    // 🔍 DEBUG
    console.log("Validation result:", result);
    console.log("Has errors:", !result.success);
    if (!result.success) {
      console.log("Errors:", result.error.issues);
    }

    if (!result.success) {
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof FormErrors;
        newErrors[field] = issue.message;
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateField = (field: keyof FormData, value: string) => {
    const dataToValidate = {
      name: field === "name" ? value : formData.name,
      slug: field === "slug" ? value : formData.slug,
    };

    const schema = mode === "create" ? createStoreSchema : updateStoreSchema;

    const result = schema.safeParse(dataToValidate);

    if (!result.success) {
      const fieldError = result.error.issues.find((issue) => issue.path[0] === field);

      if (fieldError) {
        setErrors((prev) => ({
          ...prev,
          [field]: fieldError.message,
        }));
        return;
      }
    }

    setErrors((prev) => ({
      ...prev,
      [field]: undefined,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (formData.logo_file) {
      const validation = validateLogoFile(formData.logo_file);
      if (!validation.isValid) {
        setLogoError(validation.error || "Nieprawidłowy plik");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const submitData: CreateStoreCommand | UpdateStoreCommand = {
        name: formData.name.trim(),
        slug: formData.slug.trim(),
        logo_file: formData.logo_file ? await fileToBase64(formData.logo_file) : undefined,
      };

      await onSave(submitData);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error submitting store form:", error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Wystąpił nieoczekiwany błąd podczas zapisywania");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Dodaj sklep" : `Edytuj sklep: ${store?.name}`}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Wypełnij ponisze pola aby dodać nowy sklep do systemu."
              : `Zaktualizuj dane sklepu: ${store?.name}. Zmiany zostaną zapisane po kliknięciu "Zapisz".`}
          </DialogDescription>
        </DialogHeader>
        {/* FORMULARZ */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4 py-4">
            {/* Pole: Nazwa */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Nazwa sklepu <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                onBlur={(e) => validateField("name", e.target.value)}
                placeholder="np. Biedronka"
                disabled={isSubmitting}
                className={errors.name ? "border-destructive" : ""}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>

            {/* Pole: Slug */}
            <div className="space-y-2">
              <Label htmlFor="slug">
                Slug (URL) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => updateField("slug", e.target.value)}
                onBlur={(e) => validateField("slug", e.target.value)}
                placeholder="np. biedronka"
                disabled={isSubmitting}
                className={errors.slug ? "border-destructive" : ""}
              />
              <p className="text-xs text-muted-foreground">
                Używane w adresach URL. Tylko małe litery, cyfry i myślniki.
              </p>
              {errors.slug && <p className="text-sm text-destructive">{errors.slug}</p>}
            </div>

            {/* Pole: Logo */}
            <div className="space-y-2">
              <LogoUpload
                value={formData.logo_file}
                currentLogoUrl={mode === "edit" ? store?.logo_url : undefined}
                onChange={(file) => {
                  updateField("logo_file", file);
                  setLogoError(null);
                }}
                error={logoError || undefined}
              />
            </div>
          </div>

          {/* Stopka z przyciskami */}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Anuluj
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Zapisywanie..." : "Zapisz"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
