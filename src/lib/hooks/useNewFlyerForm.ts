import { useState, useCallback, useMemo, useEffect } from "react";
import type {
  StoreOption,
  FileUploadItem,
  FlyerCreatorFormState,
  FlyerCreatorFormErrors,
  CreateFlyerCommand,
  ApiResponse,
  UploadFlyerPagesResponse,
  UploadedPageInfo,
} from "@/types";

/**
 * useNewFlyerForm - główny hook zarządzający stanem formularza
 *
 * Odpowiedzialności:
 * - Zarządzanie stanem formularza (metadata, pliki, opcje)
 * - Walidacja danych
 * - Orkiestracja wywołań API (create flyer -> upload pages -> process AI)
 * - Tracking postępu uploadu
 * - Obsługa błędów
 * - beforeunload handler (ostrzeżenie przed zamknięciem)
 */
export function useNewFlyerForm(initialStores: StoreOption[]) {
  // Stan główny
  const [state, setState] = useState<FlyerCreatorFormState>({
    storeId: null,
    validFrom: "",
    validTo: "",
    files: [],
    autoProcess: true,
    flyerId: null,
    uploadStatus: "idle",
    currentStep: "",
    overallProgress: 0,
    uploadError: null,
  });

  // Stan sklepów
  const [stores] = useState<StoreOption[]>(initialStores);

  // Walidacja (computed)
  const errors = useMemo<FlyerCreatorFormErrors>(() => {
    const err: FlyerCreatorFormErrors = {};

    if (!state.storeId) {
      err.store = "Wybierz sklep";
    }

    if (!state.validFrom) {
      err.validFrom = "Podaj datę początku obowiązywania";
    }

    if (!state.validTo) {
      err.validTo = "Podaj datę końca obowiązywania";
    }

    if (state.validFrom && state.validTo && state.validFrom > state.validTo) {
      err.dateRange = "Data końcowa musi być późniejsza lub równa dacie początkowej";
    }

    if (state.files.length === 0) {
      err.files = "Dodaj przynajmniej jeden plik";
    }

    const invalidFiles = state.files.filter((f) => f.status === "invalid");
    if (invalidFiles.length > 0) {
      err.fileValidation = invalidFiles.map((f) => ({
        fileName: f.file.name,
        error: f.error || "Nieprawidłowy plik",
        code: "INVALID_TYPE" as const,
      }));
    }

    return err;
  }, [state]);

  // Czy można submitować
  const canSubmit = useMemo(() => {
    return (
      state.uploadStatus === "idle" &&
      Object.keys(errors).length === 0 &&
      state.files.every((f) => f.status === "pending")
    );
  }, [state, errors]);

  // Funkcje do zarządzania stanem

  const setStore = useCallback((storeId: string) => {
    setState((prev) => ({ ...prev, storeId }));
  }, []);

  const setDateRange = useCallback((validFrom: string, validTo: string) => {
    setState((prev) => ({ ...prev, validFrom, validTo }));
  }, []);

  const setAutoProcess = useCallback((autoProcess: boolean) => {
    setState((prev) => ({ ...prev, autoProcess }));
  }, []);

  /**
   * Walidacja pojedynczego pliku
   */
  const validateFile = useCallback((file: File): { valid: boolean; error?: string } => {
    // Sprawdzenie typu MIME
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: "Nieprawidłowy format. Dozwolone: JPG, PNG, WEBP",
      };
    }

    // Sprawdzenie rozmiaru (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return {
        valid: false,
        error: "Plik jest za duży. Maksymalny rozmiar: 10MB",
      };
    }

    return { valid: true };
  }, []);

  /**
   * Generowanie podglądu pliku (miniatura)
   */
  const generatePreview = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  /**
   * Dodanie plików do listy
   */
  const addFiles = useCallback(
    async (files: File[]) => {
      const newItems: FileUploadItem[] = [];

      for (const file of files) {
        const validation = validateFile(file);
        let preview: string;

        try {
          preview = await generatePreview(file);
        } catch (error) {
          console.error("Failed to generate preview:", error);
          preview = "/placeholder-image.png";
        }

        newItems.push({
          id: crypto.randomUUID(),
          file,
          preview,
          status: validation.valid ? "pending" : "invalid",
          error: validation.error,
        });
      }

      setState((prev) => ({
        ...prev,
        files: [...prev.files, ...newItems],
      }));
    },
    [validateFile, generatePreview]
  );

  /**
   * Usunięcie pliku z listy
   */
  const removeFile = useCallback((fileId: string) => {
    setState((prev) => ({
      ...prev,
      files: prev.files.filter((f) => f.id !== fileId),
    }));
  }, []);

  /**
   * Czyszczenie formularza
   */
  const resetForm = useCallback(() => {
    setState({
      storeId: null,
      validFrom: "",
      validTo: "",
      files: [],
      autoProcess: true,
      flyerId: null,
      uploadStatus: "idle",
      currentStep: "",
      overallProgress: 0,
      uploadError: null,
    });
  }, []);

  /**
   * Główna funkcja submit - orkiestracja całego procesu
   */
  const submitFlyer = useCallback(async () => {
    if (!canSubmit) return;

    try {
      // Krok 1: Utworzenie gazetki
      setState((prev) => ({
        ...prev,
        uploadStatus: "creating_flyer",
        currentStep: "Tworzenie gazetki...",
        overallProgress: 10,
      }));

      const createPayload: CreateFlyerCommand = {
        store_id: state.storeId!,
        valid_from: state.validFrom,
        valid_to: state.validTo,
      };

      const createResponse = await fetch("/api/admin/flyers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createPayload),
      });

      if (!createResponse.ok) {
        if (createResponse.status === 401 || createResponse.status === 403) {
          window.location.href = "/admin/login";
          return;
        }
        throw new Error("Nie udało się utworzyć gazetki");
      }

      const createData: ApiResponse<{
        id: string;
        store_id: string;
        store_name: string;
        valid_from: string;
        valid_to: string;
        status: string;
        created_at: string;
      }> = await createResponse.json();
      const flyerId = createData.data.id;

      setState((prev) => ({
        ...prev,
        flyerId,
        overallProgress: 20,
      }));

      // Krok 2: Upload plików
      setState((prev) => ({
        ...prev,
        uploadStatus: "uploading_files",
        currentStep: "Wysyłanie plików...",
      }));

      const formData = new FormData();
      state.files.forEach((item) => {
        formData.append("files", item.file);
      });

      // Użycie XMLHttpRequest dla tracking progressu
      const uploadedPages = await uploadWithProgress(`/api/admin/flyers/${flyerId}/pages`, formData, (progress) => {
        setState((prev) => ({
          ...prev,
          overallProgress: 20 + progress * 0.6, // 20-80%
        }));
      });

      setState((prev) => ({
        ...prev,
        overallProgress: 80,
      }));

      // Krok 3: Opcjonalne uruchomienie AI
      if (state.autoProcess) {
        setState((prev) => ({
          ...prev,
          uploadStatus: "processing_ai",
          currentStep: "Uruchamianie przetwarzania AI...",
        }));

        // Uruchomienie przetwarzania dla każdej strony (fire and forget - 202 Accepted)
        const processPromises = uploadedPages.map((page) =>
          fetch(`/api/admin/flyer-pages/${page.id}/process`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reprocess: false }),
          })
        );

        // Nie czekamy na zakończenie (202 = async processing)
        const results = await Promise.allSettled(processPromises);

        // Logowanie błędów
        results.forEach((result, index) => {
          if (result.status === "rejected") {
            console.error(`Failed to process page ${index + 1}:`, result.reason);
          }
        });
      }

      // Sukces
      setState((prev) => ({
        ...prev,
        uploadStatus: "success",
        currentStep: "Gazetka została utworzona!",
        overallProgress: 100,
      }));

      // Redirect po 2 sekundach
      setTimeout(() => {
        window.location.href = `/admin/gazetki/${flyerId}`;
      }, 2000);
    } catch (error) {
      console.error("Upload error:", error);
      setState((prev) => ({
        ...prev,
        uploadStatus: "error",
        uploadError: error instanceof Error ? error.message : "Wystąpił nieoczekiwany błąd",
        currentStep: "Błąd",
      }));
    }
  }, [state, canSubmit]);

  // beforeunload handler - ostrzeżenie przed zamknięciem
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (
        state.uploadStatus === "creating_flyer" ||
        state.uploadStatus === "uploading_files" ||
        state.uploadStatus === "processing_ai"
      ) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [state.uploadStatus]);

  // Cleanup - revoke object URLs on unmount
  useEffect(() => {
    return () => {
      state.files.forEach((item) => {
        if (item.preview.startsWith("blob:")) {
          URL.revokeObjectURL(item.preview);
        }
      });
    };
  }, [state.files]);

  return {
    state,
    stores,
    errors,
    canSubmit,
    setStore,
    setDateRange,
    setAutoProcess,
    addFiles,
    removeFile,
    resetForm,
    submitFlyer,
  };
}

/**
 * Helper: Upload z tracking progressu
 */
function uploadWithProgress(
  url: string,
  formData: FormData,
  onProgress: (progress: number) => void
): Promise<UploadedPageInfo[]> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Timeout - 5 minut
    const timeoutId = setTimeout(
      () => {
        xhr.abort();
        reject(new Error("Upload timeout - przekroczono czas oczekiwania"));
      },
      5 * 60 * 1000
    );

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        const progress = (e.loaded / e.total) * 100;
        onProgress(progress);
      }
    });

    xhr.addEventListener("load", () => {
      clearTimeout(timeoutId);
      if (xhr.status >= 200 && xhr.status < 300) {
        const response: ApiResponse<UploadFlyerPagesResponse> = JSON.parse(xhr.responseText);
        resolve(response.data.uploaded_pages);
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => {
      clearTimeout(timeoutId);
      reject(new Error("Network error during upload"));
    });

    xhr.open("POST", url);
    xhr.send(formData);
  });
}
