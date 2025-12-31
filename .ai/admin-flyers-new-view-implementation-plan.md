# Plan implementacji widoku Kreator Nowej Gazetki

## 1. Przegląd

Widok "Kreator Nowej Gazetki" to interfejs administratora służący do wgrywania nowych gazetek promocyjnych do systemu. Umożliwia administratorowi:
- Wybór sklepu, którego dotyczy gazetka
- Określenie okresu ważności promocji (data od-do)
- Upload wielu plików graficznych (stron gazetki) jednocześnie przez drag & drop lub wybór plików
- Podgląd wgrywanych plików przed wysłaniem
- Śledzenie postępu uploadu w czasie rzeczywistym
- Opcjonalne automatyczne uruchomienie przetwarzania AI po zakończeniu uploadu

Widok realizuje User Stories US-003 (Dodawanie nowej gazetki) oraz częściowo US-004 (Uruchomienie przetwarzania AI).

## 2. Routing widoku

**Ścieżka:** `/admin/gazetki/nowa`

**Typ strony:** Astro page (SSR)

**Plik:** `src/pages/admin/gazetki/nowa.astro`

**Wymagania autoryzacji:** Użytkownik musi być zalogowany jako administrator. Middleware powinien weryfikować sesję i role przed wyświetleniem widoku.

## 3. Struktura komponentów

```
nowa.astro (Astro page)
└── Layout.astro (Layout administratora)
    └── FlyerCreatorForm.tsx (React - główny kontener)
        ├── MetadataSection.tsx (sekcja metadanych)
        │   ├── StoreSelector.tsx (wybór sklepu)
        │   └── DateRangeInputs.tsx (pola dat)
        ├── FileUploadSection.tsx (sekcja uploadu)
        │   ├── DropZone.tsx (obszar drag & drop)
        │   └── FileList.tsx (lista wybranych plików)
        │       └── FileListItem.tsx (pojedynczy plik z podglądem)
        ├── ProcessingOptionsSection.tsx (opcje przetwarzania)
        │   └── Checkbox (auto-process AI)
        ├── UploadProgress.tsx (progress bar i komunikaty)
        └── FormActions.tsx (przyciski akcji)
```

## 4. Szczegóły komponentów

### 4.1. FlyerCreatorForm.tsx

**Opis:** Główny komponent kontenerowy zarządzający całym procesem tworzenia gazetki. Zawiera logikę biznesową, zarządzanie stanem i orkiestrację wywołań API.

**Główne elementy:**
- Wrapper `<div>` z klasami Tailwind dla layoutu
- Card component z shadcn/ui jako główny kontener wizualny
- Wszystkie sekcje potomne (MetadataSection, FileUploadSection, etc.)
- UploadProgress (warunkowo wyświetlany podczas uploadu)
- FormActions na dole formularza

**Obsługiwane interakcje:**
- Submit formularza (wywołanie procesu tworzenia gazetki i uploadu)
- Reset formularza (czyszczenie wszystkich pól)
- beforeunload event (ostrzeżenie przed zamknięciem podczas uploadu)

**Obsługiwana walidacja:**
- Sprawdzenie kompletności danych przed submitem (canSubmit)
- Walidacja zakresu dat (validTo >= validFrom)
- Walidacja obecności przynajmniej jednego pliku
- Agregacja błędów walidacji z komponentów potomnych

**Typy:**
- `FlyerCreatorFormState` (stan wewnętrzny)
- `FlyerCreatorFormErrors` (błędy walidacji)
- `CreateFlyerCommand` (request do API)
- `UploadFlyerPagesResponse` (response z API)
- `ProcessPageResponse` (response z API)

**Propsy:**
```typescript
interface FlyerCreatorFormProps {
  stores: StoreOption[]; // Lista sklepów przekazana z Astro
  initialAutoProcess?: boolean; // Domyślna wartość dla auto-process
}
```

### 4.2. MetadataSection.tsx

**Opis:** Sekcja zawierająca pola metadanych gazetki - wybór sklepu oraz zakres dat ważności.

**Główne elementy:**
- Section header z tytułem "Informacje podstawowe"
- StoreSelector (komponent potomny)
- DateRangeInputs (komponent potomny)
- Komunikaty błędów walidacji (jeśli występują)

**Obsługiwane interakcje:**
- Przekazywanie zmian z komponentów potomnych do rodzica
- Wyświetlanie komunikatów błędów

**Obsługiwana walidacja:**
- Brak bezpośredniej walidacji (delegowana do komponentów potomnych)

**Typy:**
- `StoreOption` (dla StoreSelector)
- `DateRange` (dla DateRangeInputs)

**Propsy:**
```typescript
interface MetadataSectionProps {
  stores: StoreOption[];
  selectedStoreId: string | null;
  onStoreChange: (storeId: string) => void;
  validFrom: string;
  validTo: string;
  onDateRangeChange: (from: string, to: string) => void;
  errors?: {
    store?: string;
    validFrom?: string;
    validTo?: string;
    dateRange?: string;
  };
}
```

### 4.3. StoreSelector.tsx

**Opis:** Dropdown/select umożliwiający wybór sklepu z listy dostępnych sklepów w systemie.

**Główne elementy:**
- Label z shadcn/ui ("Sklep")
- Select component z shadcn/ui
- Lista opcji (SelectItem dla każdego sklepu)
- Komunikat błędu (jeśli store nie jest wybrany)

**Obsługiwane interakcje:**
- onChange - zmiana wybranego sklepu
- Wyświetlanie nazwy i loga sklepu w opcjach (opcjonalnie)

**Obsługiwana walidacja:**
- Pole wymagane (musi być wybrany sklep)

**Typy:**
- `StoreOption`

**Propsy:**
```typescript
interface StoreSelectorProps {
  stores: StoreOption[];
  selectedStoreId: string | null;
  onChange: (storeId: string) => void;
  error?: string;
  disabled?: boolean;
}
```

### 4.4. DateRangeInputs.tsx

**Opis:** Para pól input type="date" dla określenia zakresu ważności gazetki.

**Główne elementy:**
- Wrapper div z grid layout (2 kolumny na desktop, 1 na mobile)
- Input "Data od" z Label
- Input "Data do" z Label
- Komunikaty błędów dla każdego pola i zakresu

**Obsługiwane interakcje:**
- onChange dla validFrom
- onChange dla validTo
- Walidacja podczas zmiany wartości

**Obsługiwana walidacja:**
- Oba pola wymagane
- validTo >= validFrom
- Format daty ISO (YYYY-MM-DD)

**Typy:**
- Standardowe string (ISO date format)

**Propsy:**
```typescript
interface DateRangeInputsProps {
  validFrom: string;
  validTo: string;
  onChange: (from: string, to: string) => void;
  errors?: {
    validFrom?: string;
    validTo?: string;
    dateRange?: string;
  };
  disabled?: boolean;
}
```

### 4.5. FileUploadSection.tsx

**Opis:** Sekcja odpowiedzialna za wybór i zarządzanie plikami do uploadu.

**Główne elementy:**
- Section header z tytułem "Strony gazetki"
- Informacja o wymaganiach (formaty, rozmiar)
- DropZone (obszar drag & drop)
- Hidden input type="file" z multiple
- FileList (lista wybranych plików)

**Obsługiwane interakcje:**
- Dodawanie plików przez drag & drop
- Dodawanie plików przez kliknięcie i wybór
- Usuwanie plików z listy
- Wyświetlanie komunikatów błędów walidacji plików

**Obsługiwana walidacja:**
- Przynajmniej jeden plik wymagany
- Typ MIME: image/jpeg, image/png, image/webp
- Rozmiar: max 10MB per plik

**Typy:**
- `FileUploadItem`
- `FileValidationError`

**Propsy:**
```typescript
interface FileUploadSectionProps {
  files: FileUploadItem[];
  onFilesAdd: (files: File[]) => void;
  onFileRemove: (fileId: string) => void;
  disabled?: boolean;
  maxFiles?: number;
}
```

### 4.6. DropZone.tsx

**Opis:** Interaktywny obszar do przeciągania i upuszczania plików.

**Główne elementy:**
- Div z obsługą drag events
- Ikona upload (z lucide-react)
- Tekst instrukcji
- Przycisk "Wybierz pliki" (trigger dla hidden input)
- Wizualna zmiana stanu podczas hover/drag

**Obsługiwane interakcje:**
- onDragEnter - podświetlenie strefy
- onDragLeave - usunięcie podświetlenia
- onDragOver - preventDefault (aby umożliwić drop)
- onDrop - walidacja i przekazanie plików do rodzica
- onClick - trigger input file dialog

**Obsługiwana walidacja:**
- Sprawdzenie czy upuszczony element to pliki
- Wstępna walidacja typu (na podstawie rozszerzenia)

**Typy:**
- Standardowe React DragEvent i File

**Propsy:**
```typescript
interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  accept?: string; // MIME types
}
```

### 4.7. FileList.tsx

**Opis:** Lista wybranych plików z podglądami, statusami i możliwością usunięcia.

**Główne elementy:**
- Wrapper div lub ul
- FileListItem dla każdego pliku
- Komunikat "Brak plików" jeśli lista pusta

**Obsługiwane interakcje:**
- Przekazywanie akcji usunięcia do rodzica
- Wyświetlanie różnych stanów plików (pending, uploading, success, error)

**Obsługiwana walidacja:**
- Brak bezpośredniej walidacji (wyświetla status z rodzica)

**Typy:**
- `FileUploadItem[]`

**Propsy:**
```typescript
interface FileListProps {
  files: FileUploadItem[];
  onRemove: (fileId: string) => void;
  disabled?: boolean;
}
```

### 4.8. FileListItem.tsx

**Opis:** Pojedynczy element listy reprezentujący plik z podglądem, informacjami i kontrolkami.

**Główne elementy:**
- Wrapper div z grid layout
- Miniatura obrazu (thumbnail)
- Nazwa pliku i rozmiar
- Status indicator (ikona/spinner/progress bar w zależności od statusu)
- Przycisk usunięcia (X)
- Komunikat błędu (jeśli status = 'error')

**Obsługiwane interakcje:**
- onRemove - kliknięcie przycisku usunięcia
- Wyświetlanie różnych stanów wizualnych w zależności od statusu

**Obsługiwana walidacja:**
- Brak - otrzymuje status z rodzica

**Typy:**
- `FileUploadItem`

**Propsy:**
```typescript
interface FileListItemProps {
  file: FileUploadItem;
  onRemove: (fileId: string) => void;
  disabled?: boolean;
}
```

### 4.9. ProcessingOptionsSection.tsx

**Opis:** Sekcja z opcjami dotyczącymi automatycznego przetwarzania AI.

**Główne elementy:**
- Section header z tytułem "Przetwarzanie"
- Checkbox z Label "Automatycznie uruchom przetwarzanie AI"
- Tekst pomocniczy wyjaśniający co się stanie

**Obsługiwane interakcje:**
- onChange - zmiana wartości checkboxa

**Obsługiwana walidacja:**
- Brak (opcjonalne pole)

**Typy:**
- boolean

**Propsy:**
```typescript
interface ProcessingOptionsSectionProps {
  autoProcess: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}
```

### 4.10. UploadProgress.tsx

**Opis:** Komponent wyświetlający postęp uploadu i komunikaty o statusie operacji.

**Główne elementy:**
- Alert z shadcn/ui (różne warianty w zależności od stanu)
- Progress bar (overall progress)
- Lista statusów per plik (opcjonalnie, dla szczegółów)
- Spinner podczas operacji
- Komunikaty tekstowe o bieżącym etapie

**Obsługiwane interakcje:**
- Tylko wyświetlanie (brak interakcji)

**Obsługiwana walidacja:**
- Brak

**Typy:**
- `UploadProgressInfo`

**Propsy:**
```typescript
interface UploadProgressProps {
  status: UploadStatus;
  progress: number; // 0-100
  currentStep?: string; // np. "Tworzenie gazetki...", "Wysyłanie plików (3/5)..."
  error?: string;
}
```

### 4.11. FormActions.tsx

**Opis:** Sekcja z przyciskami akcji (Submit, Reset/Anuluj).

**Główne elementy:**
- Wrapper div z flexbox (justify-end)
- Button "Anuluj" (secondary)
- Button "Utwórz gazetkę" (primary)

**Obsługiwane interakcje:**
- onCancel - reset formularza lub redirect
- onSubmit - uruchomienie procesu tworzenia

**Obsługiwana walidacja:**
- Disabled state na podstawie canSubmit z rodzica

**Typy:**
- Brak (tylko callbacks)

**Propsy:**
```typescript
interface FormActionsProps {
  onSubmit: () => void;
  onCancel: () => void;
  canSubmit: boolean;
  isLoading: boolean;
}
```

## 5. Typy

### 5.1. Istniejące typy (z src/types.ts)

```typescript
// Command types
CreateFlyerCommand {
  store_id: string;
  valid_from: string; // ISO date
  valid_to: string; // ISO date
}

ProcessFlyerPageCommand {
  reprocess?: boolean;
}

// Response types
UploadFlyerPagesResponse {
  flyer_id: string;
  uploaded_pages: UploadedPageInfo[];
}

UploadedPageInfo {
  id: string;
  page_number: number;
  original_image_url: string;
  web_image_url: string;
  status: FlyerStatus; // 'draft'
  created_at: string;
}

ProcessPageResponse {
  id: string;
  status: FlyerStatus;
  message: string;
}

// Entity types
FlyerStatus = 'draft' | 'processing' | 'verification' | 'published';
```

### 5.2. Nowe typy ViewModel

```typescript
/**
 * StoreOption - uproszczona reprezentacja sklepu dla selecta
 * 
 * Źródło: mapowanie z StoreDTO lub Store entity
 */
interface StoreOption {
  id: string;        // UUID sklepu
  name: string;      // Nazwa wyświetlana (np. "Biedronka")
  slug: string;      // Slug dla URL
  logo_url?: string; // Opcjonalnie URL do loga (dla wizualizacji w select)
}

/**
 * FileUploadItem - reprezentacja pojedynczego pliku w uploaderze
 * 
 * Zawiera plik, jego stan, podgląd i informacje o uploadzie
 */
interface FileUploadItem {
  id: string;               // Unikalny identyfikator (UUID v4)
  file: File;               // Obiekt File z przeglądarki
  preview: string;          // Data URL dla podglądu miniatury
  status: FileUploadStatus; // Status uploadu
  progress?: number;        // Postęp uploadu 0-100 (tylko dla 'uploading')
  error?: string;           // Komunikat błędu (tylko dla 'error')
  pageId?: string;          // ID strony po uploadzie (tylko dla 'success')
}

/**
 * FileUploadStatus - możliwe stany pliku
 */
type FileUploadStatus = 
  | 'pending'    // Plik wybrany, czeka na upload
  | 'validating' // Walidacja w toku
  | 'invalid'    // Plik nie przeszedł walidacji
  | 'uploading'  // Upload w toku
  | 'success'    // Upload zakończony sukcesem
  | 'error';     // Błąd podczas uploadu

/**
 * FileValidationError - błąd walidacji pliku
 */
interface FileValidationError {
  fileName: string;
  error: string; // Komunikat błędu
  code: 'INVALID_TYPE' | 'FILE_TOO_LARGE' | 'INVALID_NAME';
}

/**
 * FlyerCreatorFormState - główny stan formularza
 * 
 * Zawiera wszystkie dane potrzebne do utworzenia gazetki
 */
interface FlyerCreatorFormState {
  // Metadane
  storeId: string | null;
  validFrom: string;        // ISO date string (YYYY-MM-DD)
  validTo: string;          // ISO date string (YYYY-MM-DD)
  
  // Pliki
  files: FileUploadItem[];
  
  // Opcje
  autoProcess: boolean;
  
  // Stan procesu
  flyerId: string | null;   // ID utworzonej gazetki (po POST /api/admin/flyers)
  uploadStatus: UploadStatus;
  currentStep: string;      // Komunikat o bieżącym kroku
  overallProgress: number;  // Całkowity postęp 0-100
  uploadError: string | null;
}

/**
 * UploadStatus - status całego procesu uploadu
 */
type UploadStatus = 
  | 'idle'             // Początkowy stan
  | 'creating_flyer'   // Tworzenie rekordu gazetki (POST /api/admin/flyers)
  | 'uploading_files'  // Upload plików (POST /api/admin/flyers/:id/pages)
  | 'processing_ai'    // Uruchamianie AI (POST /api/admin/flyer-pages/:id/process)
  | 'success'          // Wszystko zakończone sukcesem
  | 'error';           // Błąd krytyczny

/**
 * FlyerCreatorFormErrors - błędy walidacji formularza
 */
interface FlyerCreatorFormErrors {
  store?: string;
  validFrom?: string;
  validTo?: string;
  dateRange?: string;     // Błąd związany z zakresem dat
  files?: string;         // Ogólny błąd plików
  fileValidation?: FileValidationError[]; // Szczegółowe błędy per plik
}

/**
 * UploadProgressInfo - informacje o postępie dla UploadProgress component
 */
interface UploadProgressInfo {
  status: UploadStatus;
  progress: number;       // 0-100
  currentStep: string;
  filesTotal: number;
  filesUploaded: number;
  error?: string;
}
```

### 5.3. Typy dla API calls

```typescript
// GET /api/admin/stores (lub /api/stores)
type GetStoresResponse = ApiResponse<StoreDTO[]>;

// POST /api/admin/flyers
type CreateFlyerRequest = CreateFlyerCommand;
type CreateFlyerResponse = ApiResponse<{
  id: string;
  store_id: string;
  store_name: string;
  valid_from: string;
  valid_to: string;
  status: FlyerStatus;
  created_at: string;
}>;

// POST /api/admin/flyers/:flyerId/pages
type UploadPagesRequest = FormData; // klucz 'files', wartości: File[]
type UploadPagesResponse = ApiResponse<UploadFlyerPagesResponse>;

// POST /api/admin/flyer-pages/:id/process
type ProcessPageRequest = ProcessFlyerPageCommand;
type ProcessPageResponse = ApiResponse<{
  id: string;
  status: FlyerStatus;
  message: string;
}>;
```

## 6. Zarządzanie stanem

Stan widoku będzie zarządzany przez custom hook `useNewFlyerForm`, który enkapsuluje całą logikę biznesową i zarządzanie stanem.

### 6.1. Custom Hook: useNewFlyerForm

```typescript
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
function useNewFlyerForm(initialStores: StoreOption[]) {
  // Stan główny
  const [state, setState] = useState<FlyerCreatorFormState>({
    storeId: null,
    validFrom: '',
    validTo: '',
    files: [],
    autoProcess: true,
    flyerId: null,
    uploadStatus: 'idle',
    currentStep: '',
    overallProgress: 0,
    uploadError: null,
  });
  
  // Stan sklepów
  const [stores] = useState<StoreOption[]>(initialStores);
  
  // Walidacja (computed)
  const errors = useMemo<FlyerCreatorFormErrors>(() => {
    const err: FlyerCreatorFormErrors = {};
    
    if (!state.storeId) {
      err.store = 'Wybierz sklep';
    }
    
    if (!state.validFrom) {
      err.validFrom = 'Podaj datę początku obowiązywania';
    }
    
    if (!state.validTo) {
      err.validTo = 'Podaj datę końca obowiązywania';
    }
    
    if (state.validFrom && state.validTo && state.validFrom > state.validTo) {
      err.dateRange = 'Data końcowa musi być późniejsza lub równa dacie początkowej';
    }
    
    if (state.files.length === 0) {
      err.files = 'Dodaj przynajmniej jeden plik';
    }
    
    const invalidFiles = state.files.filter(f => f.status === 'invalid');
    if (invalidFiles.length > 0) {
      err.fileValidation = invalidFiles.map(f => ({
        fileName: f.file.name,
        error: f.error || 'Nieprawidłowy plik',
        code: 'INVALID_TYPE',
      }));
    }
    
    return err;
  }, [state]);
  
  // Czy można submitować
  const canSubmit = useMemo(() => {
    return (
      state.uploadStatus === 'idle' &&
      Object.keys(errors).length === 0 &&
      state.files.every(f => f.status === 'pending')
    );
  }, [state, errors]);
  
  // Funkcje do zarządzania stanem
  
  const setStore = useCallback((storeId: string) => {
    setState(prev => ({ ...prev, storeId }));
  }, []);
  
  const setDateRange = useCallback((validFrom: string, validTo: string) => {
    setState(prev => ({ ...prev, validFrom, validTo }));
  }, []);
  
  const setAutoProcess = useCallback((autoProcess: boolean) => {
    setState(prev => ({ ...prev, autoProcess }));
  }, []);
  
  /**
   * Walidacja pojedynczego pliku
   */
  const validateFile = useCallback((file: File): { valid: boolean; error?: string } => {
    // Sprawdzenie typu MIME
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return { 
        valid: false, 
        error: 'Nieprawidłowy format. Dozwolone: JPG, PNG, WEBP' 
      };
    }
    
    // Sprawdzenie rozmiaru (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return { 
        valid: false, 
        error: 'Plik jest za duży. Maksymalny rozmiar: 10MB' 
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
  const addFiles = useCallback(async (files: File[]) => {
    const newItems: FileUploadItem[] = [];
    
    for (const file of files) {
      const validation = validateFile(file);
      const preview = await generatePreview(file);
      
      newItems.push({
        id: crypto.randomUUID(),
        file,
        preview,
        status: validation.valid ? 'pending' : 'invalid',
        error: validation.error,
      });
    }
    
    setState(prev => ({
      ...prev,
      files: [...prev.files, ...newItems],
    }));
  }, [validateFile, generatePreview]);
  
  /**
   * Usunięcie pliku z listy
   */
  const removeFile = useCallback((fileId: string) => {
    setState(prev => ({
      ...prev,
      files: prev.files.filter(f => f.id !== fileId),
    }));
  }, []);
  
  /**
   * Czyszczenie formularza
   */
  const resetForm = useCallback(() => {
    setState({
      storeId: null,
      validFrom: '',
      validTo: '',
      files: [],
      autoProcess: true,
      flyerId: null,
      uploadStatus: 'idle',
      currentStep: '',
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
      setState(prev => ({ 
        ...prev, 
        uploadStatus: 'creating_flyer',
        currentStep: 'Tworzenie gazetki...',
        overallProgress: 10,
      }));
      
      const createPayload: CreateFlyerCommand = {
        store_id: state.storeId!,
        valid_from: state.validFrom,
        valid_to: state.validTo,
      };
      
      const createResponse = await fetch('/api/admin/flyers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createPayload),
      });
      
      if (!createResponse.ok) {
        throw new Error('Nie udało się utworzyć gazetki');
      }
      
      const createData: CreateFlyerResponse = await createResponse.json();
      const flyerId = createData.data.id;
      
      setState(prev => ({ 
        ...prev, 
        flyerId,
        overallProgress: 20,
      }));
      
      // Krok 2: Upload plików
      setState(prev => ({ 
        ...prev, 
        uploadStatus: 'uploading_files',
        currentStep: 'Wysyłanie plików...',
      }));
      
      const formData = new FormData();
      state.files.forEach(item => {
        formData.append('files', item.file);
      });
      
      // Użycie XMLHttpRequest dla tracking progressu
      const uploadedPages = await uploadWithProgress(
        `/api/admin/flyers/${flyerId}/pages`,
        formData,
        (progress) => {
          setState(prev => ({
            ...prev,
            overallProgress: 20 + (progress * 0.6), // 20-80%
          }));
        }
      );
      
      setState(prev => ({ 
        ...prev, 
        overallProgress: 80,
      }));
      
      // Krok 3: Opcjonalne uruchomienie AI
      if (state.autoProcess) {
        setState(prev => ({ 
          ...prev, 
          uploadStatus: 'processing_ai',
          currentStep: 'Uruchamianie przetwarzania AI...',
        }));
        
        // Uruchomienie przetwarzania dla każdej strony (fire and forget - 202 Accepted)
        const processPromises = uploadedPages.map(page => 
          fetch(`/api/admin/flyer-pages/${page.id}/process`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reprocess: false }),
          })
        );
        
        // Nie czekamy na zakończenie (202 = async processing)
        await Promise.allSettled(processPromises);
      }
      
      // Sukces
      setState(prev => ({ 
        ...prev, 
        uploadStatus: 'success',
        currentStep: 'Gazetka została utworzona!',
        overallProgress: 100,
      }));
      
      // Redirect po 2 sekundach
      setTimeout(() => {
        window.location.href = `/admin/gazetki/${flyerId}`;
      }, 2000);
      
    } catch (error) {
      console.error('Upload error:', error);
      setState(prev => ({
        ...prev,
        uploadStatus: 'error',
        uploadError: error instanceof Error ? error.message : 'Wystąpił nieoczekiwany błąd',
        currentStep: 'Błąd',
      }));
    }
  }, [state, canSubmit]);
  
  // beforeunload handler - ostrzeżenie przed zamknięciem
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state.uploadStatus === 'creating_flyer' || 
          state.uploadStatus === 'uploading_files' ||
          state.uploadStatus === 'processing_ai') {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [state.uploadStatus]);
  
  // Cleanup - revoke object URLs on unmount
  useEffect(() => {
    return () => {
      state.files.forEach(item => {
        if (item.preview.startsWith('blob:')) {
          URL.revokeObjectURL(item.preview);
        }
      });
    };
  }, []);
  
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
    
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const progress = (e.loaded / e.total) * 100;
        onProgress(progress);
      }
    });
    
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const response: UploadPagesResponse = JSON.parse(xhr.responseText);
        resolve(response.data.uploaded_pages);
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    });
    
    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });
    
    xhr.open('POST', url);
    xhr.send(formData);
  });
}
```

### 6.2. Przepływ stanu

1. **Początkowy stan (idle):**
   - Wszystkie pola puste/null
   - uploadStatus = 'idle'
   - canSubmit = false (błędy walidacji)

2. **Wypełnianie formularza:**
   - Użytkownik wybiera sklep → setStore(id)
   - Użytkownik ustawia daty → setDateRange(from, to)
   - Użytkownik dodaje pliki → addFiles(files) → walidacja → dodanie do state.files
   - canSubmit zmienia się na true gdy wszystko wypełnione poprawnie

3. **Submit (creating_flyer):**
   - uploadStatus → 'creating_flyer'
   - POST /api/admin/flyers
   - Po sukcesie: state.flyerId ustawiony, overallProgress = 20%

4. **Upload plików (uploading_files):**
   - uploadStatus → 'uploading_files'
   - POST /api/admin/flyers/:id/pages z FormData
   - Progress tracking przez XMLHttpRequest
   - overallProgress 20% → 80%

5. **Przetwarzanie AI (processing_ai, opcjonalnie):**
   - uploadStatus → 'processing_ai'
   - Dla każdej uploaded page: POST /api/admin/flyer-pages/:id/process
   - Nie czekamy na zakończenie (202 Accepted)
   - overallProgress 80% → 100%

6. **Sukces (success):**
   - uploadStatus → 'success'
   - overallProgress = 100%
   - Redirect po 2 sekundach

7. **Błąd (error):**
   - uploadStatus → 'error'
   - uploadError ustawiony
   - Możliwość retry (reset do idle)

## 7. Integracja API

### 7.1. GET /api/admin/stores (lub /api/stores)

**Kiedy:** Podczas inicjalizacji strony (w Astro, server-side)

**Cel:** Pobranie listy sklepów do wyświetlenia w StoreSelector

**Request:**
```typescript
// Brak parametrów
```

**Response:**
```typescript
ApiResponse<StoreDTO[]>

// Przykład:
{
  "data": [
    {
      "id": "uuid-1",
      "name": "Biedronka",
      "slug": "biedronka",
      "logo_url": "https://...",
      "created_at": "2025-01-01T00:00:00Z"
    },
    // ...
  ]
}
```

**Mapowanie do StoreOption:**
```typescript
const stores: StoreOption[] = response.data.map(store => ({
  id: store.id,
  name: store.name,
  slug: store.slug,
  logo_url: store.logo_url,
}));
```

**Obsługa błędów:**
- Brak sklepów: Wyświetlenie komunikatu "Brak dostępnych sklepów. Dodaj sklep przed utworzeniem gazetki."
- Błąd sieciowy: Wyświetlenie błędu i sugestia odświeżenia strony

### 7.2. POST /api/admin/flyers

**Kiedy:** Po kliknięciu "Utwórz gazetkę", jako pierwszy krok procesu

**Cel:** Utworzenie rekordu gazetki w bazie danych

**Request:**
```typescript
CreateFlyerCommand

// Przykład:
{
  "store_id": "uuid-1",
  "valid_from": "2025-01-10",
  "valid_to": "2025-01-16"
}
```

**Response (201 Created):**
```typescript
ApiResponse<{
  id: string;
  store_id: string;
  store_name: string;
  valid_from: string;
  valid_to: string;
  status: FlyerStatus;
  created_at: string;
}>

// Przykład:
{
  "data": {
    "id": "flyer-uuid",
    "store_id": "store-uuid",
    "store_name": "Biedronka",
    "valid_from": "2025-01-10",
    "valid_to": "2025-01-16",
    "status": "draft",
    "created_at": "2025-01-09T10:00:00Z"
  }
}
```

**Obsługa błędów:**
- 400 Bad Request: Błąd walidacji (nieprawidłowy zakres dat) → wyświetlenie details z response
- 404 Not Found: Sklep nie istnieje → "Wybrany sklep nie istnieje"
- 401/403: Problem z autoryzacją → redirect do logowania
- 500: Błąd serwera → "Wystąpił błąd podczas tworzenia gazetki. Spróbuj ponownie."

### 7.3. POST /api/admin/flyers/:flyerId/pages

**Kiedy:** Po sukcesie POST /api/admin/flyers, jako drugi krok procesu

**Cel:** Upload plików graficznych (stron gazetki)

**Request:**
```typescript
FormData // multipart/form-data

// Konstruowanie:
const formData = new FormData();
state.files.forEach(item => {
  formData.append('files', item.file);
});
```

**Response (201 Created):**
```typescript
ApiResponse<UploadFlyerPagesResponse>

// Przykład:
{
  "data": {
    "flyer_id": "flyer-uuid",
    "uploaded_pages": [
      {
        "id": "page-uuid-1",
        "page_number": 1,
        "original_image_url": "https://.../raw_flyers/biedronka/flyer-id/page-1-original.jpg",
        "web_image_url": "https://.../public_flyers/biedronka/flyer-id/page-1.webp",
        "status": "draft",
        "created_at": "2025-01-09T10:30:00Z"
      },
      {
        "id": "page-uuid-2",
        "page_number": 2,
        // ...
      }
    ]
  }
}
```

**Tracking progressu:**
- Użycie XMLHttpRequest z xhr.upload.onprogress
- Update state.overallProgress na podstawie e.loaded / e.total

**Obsługa błędów:**
- 400 Bad Request: Nieprawidłowe pliki → wyświetlenie details
- 404 Not Found: Gazetka nie istnieje (nie powinno się zdarzyć)
- 413 Payload Too Large: Plik za duży → powinno być złapane wcześniej w walidacji
- 500: Błąd podczas uploadu → "Błąd podczas wysyłania plików. Spróbuj ponownie."

### 7.4. POST /api/admin/flyer-pages/:id/process

**Kiedy:** Po sukcesie POST pages, jeśli autoProcess = true, dla każdej strony

**Cel:** Uruchomienie asynchronicznego przetwarzania AI

**Request:**
```typescript
ProcessFlyerPageCommand

// Przykład:
{
  "reprocess": false
}
```

**Response (202 Accepted):**
```typescript
ApiResponse<ProcessPageResponse>

// Przykład:
{
  "data": {
    "id": "page-uuid",
    "status": "processing",
    "message": "AI processing started"
  }
}
```

**Uwagi:**
- Response 202 oznacza że przetwarzanie zostało uruchomione w tle
- Nie czekamy na zakończenie
- Używamy Promise.allSettled (nie Promise.all) aby pojedyncze błędy nie blokowały całości
- Błędy logujemy w konsoli ale nie fail'ujemy całego procesu

**Obsługa błędów:**
- 400: Strona już przetworzona → ignorujemy (nie powinno się zdarzyć)
- 500: Błąd AI service → logujemy, informujemy że strona może wymagać ręcznego przetworzenia
- Inne błędy → logujemy ale kontynuujemy

## 8. Interakcje użytkownika

### 8.1. Wybór sklepu

**Akcja:** Użytkownik klika w select StoreSelector

**Przepływ:**
1. Select otwiera dropdown z listą sklepów
2. Użytkownik wybiera sklep
3. onChange wywołane z id sklepu
4. setStore(id) aktualizuje state
5. Błąd walidacji (jeśli był) znika

**Wizualizacja:**
- Każda opcja pokazuje nazwę sklepu
- Opcjonalnie: mała ikona/logo sklepu obok nazwy

### 8.2. Wybór dat

**Akcja:** Użytkownik wpisuje lub wybiera daty z date pickera

**Przepływ:**
1. Użytkownik wybiera validFrom
2. onChange wywołane dla validFrom
3. Użytkownik wybiera validTo
4. onChange wywołane dla validTo
5. setDateRange(from, to) aktualizuje state
6. Walidacja zakresu dat (to >= from)
7. Błędy walidacji (jeśli są) wyświetlone pod polami

**Walidacja:**
- Oba pola wymagane
- validTo >= validFrom
- Komunikat "Data końcowa musi być późniejsza lub równa dacie początkowej"

### 8.3. Drag & Drop plików

**Akcja:** Użytkownik przeciąga pliki na DropZone

**Przepływ:**
1. onDragEnter → DropZone podświetla się (border color zmienia)
2. onDragOver → preventDefault (umożliwia drop)
3. onDrop → pobiera pliki z e.dataTransfer.files
4. Walidacja każdego pliku (typ, rozmiar)
5. Generowanie podglądów (FileReader API)
6. addFiles(files) dodaje do state.files ze statusem 'pending' lub 'invalid'
7. FileList renderuje nowe FileListItem dla każdego pliku

**Wizualizacja:**
- Podczas drag over: border zmienia kolor, tło lekko podświetlone
- Po drop: animacja dodania plików do listy

### 8.4. Wybór plików przez dialog

**Akcja:** Użytkownik klika "Wybierz pliki" w DropZone

**Przepływ:**
1. onClick na DropZone triggeruje click na hidden input[type="file"]
2. Dialog wyboru plików się otwiera
3. Użytkownik wybiera pliki (multiple selection)
4. onChange na input → pobiera files z e.target.files
5. Dalszy przepływ jak w 8.3 (walidacja, podglądy, dodanie do state)

### 8.5. Usunięcie pliku

**Akcja:** Użytkownik klika X na FileListItem

**Przepływ:**
1. onClick na przycisk X
2. onRemove wywołane z fileId
3. removeFile(fileId) filtruje state.files
4. FileListItem znika z listy (animacja opcjonalna)
5. Object URL podglądu zostaje zwolniony (URL.revokeObjectURL)

**Walidacja:**
- Jeśli ostatni plik usunięty → błąd "Dodaj przynajmniej jeden plik"

### 8.6. Toggle Auto-process

**Akcja:** Użytkownik klika checkbox "Automatycznie uruchom przetwarzanie AI"

**Przepływ:**
1. onClick na checkbox
2. onChange wywołane z nową wartością (boolean)
3. setAutoProcess(value) aktualizuje state
4. Zmiana nie wpływa na walidację (pole opcjonalne)

**Wizualizacja:**
- Tekst pomocniczy wyjaśnia co się stanie jeśli włączone

### 8.7. Submit formularza

**Akcja:** Użytkownik klika "Utwórz gazetkę"

**Przepływ:**
1. onClick na przycisk Submit
2. Sprawdzenie canSubmit (jeśli false, button disabled)
3. submitFlyer() wywołane
4. Sekwencja kroków:
   - uploadStatus → 'creating_flyer'
   - UploadProgress wyświetla się
   - POST /api/admin/flyers
   - uploadStatus → 'uploading_files'
   - POST /api/admin/flyers/:id/pages z progress tracking
   - (opcjonalnie) uploadStatus → 'processing_ai'
   - POST /api/admin/flyer-pages/:id/process dla każdej strony
   - uploadStatus → 'success'
   - Toast/alert sukcesu
   - Redirect po 2 sekundach do widoku gazetki

**Wizualizacja:**
- Przycisk disabled podczas procesu
- UploadProgress pokazuje progress bar i komunikaty
- Spinner podczas operacji
- Alert sukcesu na końcu

### 8.8. Anulowanie / Reset

**Akcja:** Użytkownik klika "Anuluj"

**Przepływ:**
1. onClick na przycisk Anuluj
2. Jeśli uploadStatus !== 'idle' → potwierdzenie "Czy na pewno chcesz anulować?"
3. Jeśli tak → resetForm() lub redirect do listy gazetek
4. Stan wraca do początkowego

### 8.9. Próba zamknięcia karty podczas uploadu

**Akcja:** Użytkownik próbuje zamknąć kartę/okno podczas uploadu

**Przepływ:**
1. beforeunload event triggered
2. Handler sprawdza uploadStatus
3. Jeśli status in ['creating_flyer', 'uploading_files', 'processing_ai']:
   - e.preventDefault()
   - Przeglądarka wyświetla standardowy dialog potwierdzenia
4. Jeśli użytkownik potwierdzi zamknięcie → proces zostaje przerwany
5. Jeśli anuluje → pozostaje na stronie

## 9. Warunki i walidacja

### 9.1. Walidacja pól formularza

**Sklep (StoreSelector):**
- Warunek: storeId !== null
- Sprawdzany: Przed submitem, w useMemo errors
- Wpływ: Button Submit disabled jeśli brak sklepu
- Komunikat: "Wybierz sklep" pod selectem

**Data od (DateRangeInputs.validFrom):**
- Warunek: validFrom !== ''
- Sprawdzany: Przed submitem, w useMemo errors
- Wpływ: Button Submit disabled jeśli puste
- Komunikat: "Podaj datę początku obowiązywania" pod polem

**Data do (DateRangeInputs.validTo):**
- Warunek: validTo !== ''
- Sprawdzany: Przed submitem, w useMemo errors
- Wpływ: Button Submit disabled jeśli puste
- Komunikat: "Podaj datę końca obowiązywania" pod polem

**Zakres dat:**
- Warunek: validTo >= validFrom
- Sprawdzany: Przed submitem, po wypełnieniu obu pól
- Wpływ: Button Submit disabled, oba pola podświetlone czerwonym
- Komunikat: "Data końcowa musi być późniejsza lub równa dacie początkowej" pod polem validTo

**Pliki (FileUploadSection):**
- Warunek: files.length > 0
- Sprawdzany: Przed submitem, w useMemo errors
- Wpływ: Button Submit disabled jeśli brak plików
- Komunikat: "Dodaj przynajmniej jeden plik" w sekcji plików

### 9.2. Walidacja pojedynczych plików

**Typ pliku:**
- Warunek: file.type in ['image/jpeg', 'image/png', 'image/webp']
- Sprawdzany: Przed dodaniem do state (w addFiles)
- Wpływ: Plik otrzymuje status 'invalid', nie może być uploadowany
- Komunikat: "Nieprawidłowy format. Dozwolone: JPG, PNG, WEBP" w FileListItem

**Rozmiar pliku:**
- Warunek: file.size <= 10 * 1024 * 1024 (10MB)
- Sprawdzany: Przed dodaniem do state (w addFiles)
- Wpływ: Plik otrzymuje status 'invalid', nie może być uploadowany
- Komunikat: "Plik jest za duży. Maksymalny rozmiar: 10MB" w FileListItem

**Wszystkie pliki valid:**
- Warunek: files.every(f => f.status === 'pending')
- Sprawdzany: Przed submitem
- Wpływ: Button Submit disabled jeśli jakikolwiek plik 'invalid'
- Komunikat: Lista błędnych plików wyświetlona w errors.fileValidation

### 9.3. Warunki UI

**Button Submit enabled:**
```typescript
canSubmit = 
  uploadStatus === 'idle' &&
  storeId !== null &&
  validFrom !== '' &&
  validTo !== '' &&
  validTo >= validFrom &&
  files.length > 0 &&
  files.every(f => f.status === 'pending')
```

**UploadProgress visible:**
```typescript
showProgress = uploadStatus !== 'idle'
```

**Button Anuluj enabled:**
```typescript
canCancel = uploadStatus === 'idle' || uploadStatus === 'error'
```

**FileListItem usuwalne:**
```typescript
canRemove = uploadStatus === 'idle'
```

**Pola edytowalne:**
```typescript
disabled = uploadStatus !== 'idle'
```

### 9.4. Walidacja API (server-side)

Po stronie serwera (zgodnie z endpoint description):

**POST /api/admin/flyers:**
- store_id: Required, must exist in stores table
- valid_from: Required, ISO 8601 date
- valid_to: Required, ISO 8601 date, must be >= valid_from

**POST /api/admin/flyers/:id/pages:**
- files: Required, at least one file
- File formats: JPG, PNG, WEBP only (MIME type check)
- File size: Max 10MB per file

Błędy z API są wyświetlane w UploadProgress lub jako toast.

## 10. Obsługa błędów

### 10.1. Błędy walidacji (client-side)

**Kiedy:** Przed submitem, podczas wypełniania formularza

**Typ:** Walidacja pól, walidacja plików

**Obsługa:**
- Errors computed w useMemo w hooku
- Przekazywane jako props do komponentów
- Wyświetlane pod polami jako tekstowe komunikaty
- Pola z błędami podświetlone (red border)
- Button Submit disabled

**Przykłady:**
- "Wybierz sklep"
- "Data końcowa musi być późniejsza..."
- "Plik jest za duży..."

### 10.2. Błędy API (POST /api/admin/flyers)

**Kiedy:** Po submicie, podczas tworzenia gazetki

**Możliwe błędy:**
- 400 Bad Request: Błąd walidacji (invalid date range, missing fields)
- 404 Not Found: Sklep nie istnieje
- 401 Unauthorized: Brak sesji
- 403 Forbidden: Brak uprawnień admina
- 500 Internal Server Error: Błąd bazy danych

**Obsługa:**
```typescript
try {
  const response = await fetch('/api/admin/flyers', {...});
  
  if (!response.ok) {
    const errorData: ApiError = await response.json();
    
    if (response.status === 401 || response.status === 403) {
      // Redirect do logowania
      window.location.href = '/admin/login';
      return;
    }
    
    // Wyświetlenie błędu
    throw new Error(errorData.error.message || 'Nie udało się utworzyć gazetki');
  }
  
  // Success path...
  
} catch (error) {
  setState(prev => ({
    ...prev,
    uploadStatus: 'error',
    uploadError: error.message,
  }));
}
```

**Wyświetlanie:**
- UploadProgress w trybie error (red alert)
- Komunikat błędu z uploadError
- Przycisk "Spróbuj ponownie" (wywołuje submitFlyer ponownie)

### 10.3. Błędy uploadu plików

**Kiedy:** Podczas POST /api/admin/flyers/:id/pages

**Możliwe błędy:**
- 400 Bad Request: Nieprawidłowe pliki
- 413 Payload Too Large: Plik za duży (nie powinno się zdarzyć po walidacji)
- 500 Internal Server Error: Błąd storage lub bazy
- Network error: Timeout, brak połączenia

**Obsługa:**
```typescript
try {
  const uploadedPages = await uploadWithProgress(url, formData, onProgress);
  // Success...
} catch (error) {
  setState(prev => ({
    ...prev,
    uploadStatus: 'error',
    uploadError: 'Błąd podczas wysyłania plików. Sprawdź połączenie i spróbuj ponownie.',
  }));
}
```

**Obsługa timeout:**
```typescript
// W funkcji uploadWithProgress
const timeoutId = setTimeout(() => {
  xhr.abort();
  reject(new Error('Upload timeout - przekroczono czas oczekiwania'));
}, 5 * 60 * 1000); // 5 minut

xhr.addEventListener('load', () => {
  clearTimeout(timeoutId);
  // ...
});
```

### 10.4. Błędy przetwarzania AI

**Kiedy:** Podczas POST /api/admin/flyer-pages/:id/process

**Możliwe błędy:**
- 400 Bad Request: Strona już przetworzona
- 500 Internal Server Error: Błąd AI service

**Obsługa:**
```typescript
// Używamy Promise.allSettled (nie all) aby pojedyncze błędy nie fail'owały całości
const processPromises = uploadedPages.map(page => 
  fetch(`/api/admin/flyer-pages/${page.id}/process`, {...})
);

const results = await Promise.allSettled(processPromises);

// Logowanie błędów
results.forEach((result, index) => {
  if (result.status === 'rejected') {
    console.error(`Failed to process page ${index + 1}:`, result.reason);
  }
});

// Nie fail'ujemy całego procesu - kontynuujemy do success
// Komunikat: "Gazetka utworzona. Niektóre strony mogą wymagać ręcznego przetworzenia."
```

### 10.5. Brak sklepów

**Kiedy:** Podczas ładowania strony, jeśli GET /api/admin/stores zwróci pustą listę

**Obsługa:**
```typescript
// W Astro page (server-side)
const storesResponse = await fetch('...');
const stores = await storesResponse.json();

if (stores.data.length === 0) {
  // Wyświetlenie komunikatu zamiast formularza
  return (
    <Layout>
      <Alert variant="warning">
        <AlertTitle>Brak sklepów</AlertTitle>
        <AlertDescription>
          Dodaj przynajmniej jeden sklep przed utworzeniem gazetki.
        </AlertDescription>
      </Alert>
      <Button href="/admin/sklepy/nowy">Dodaj sklep</Button>
    </Layout>
  );
}
```

### 10.6. Błędy generowania podglądu

**Kiedy:** Podczas generowania podglądu pliku (FileReader)

**Obsługa:**
```typescript
const generatePreview = async (file: File): Promise<string> => {
  try {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  } catch (error) {
    console.error('Failed to generate preview:', error);
    // Fallback: zwróć placeholder
    return '/placeholder-image.png';
  }
};
```

### 10.7. Obsługa globalnych błędów

**Network errors:**
- Catch w try/catch głównego submitFlyer
- Komunikat: "Błąd połączenia. Sprawdź internet i spróbuj ponownie."

**Unexpected errors:**
- Catch-all w try/catch
- Logowanie do konsoli dla debugging
- Komunikat: "Wystąpił nieoczekiwany błąd. Odśwież stronę i spróbuj ponownie."

## 11. Kroki implementacji

### Krok 1: Przygotowanie typów

1.1. Dodaj nowe typy ViewModel do `src/types.ts`:
- `StoreOption`
- `FileUploadItem`
- `FileUploadStatus`
- `FileValidationError`
- `FlyerCreatorFormState`
- `UploadStatus`
- `FlyerCreatorFormErrors`
- `UploadProgressInfo`

1.2. Zweryfikuj istniejące typy Command i Response w `src/types.ts`

### Krok 2: Utworzenie custom hooka

2.1. Utwórz plik `src/lib/hooks/useNewFlyerForm.ts`

2.2. Zaimplementuj hook zgodnie ze specyfikacją w sekcji 6.1:
- Stan początkowy
- Funkcje settera (setStore, setDateRange, setAutoProcess)
- Funkcje zarządzania plikami (addFiles, removeFile)
- Walidacja (validateFile, errors computed, canSubmit computed)
- Funkcja submitFlyer (orkiestracja API calls)
- beforeunload handler
- Cleanup (revoke URLs)

2.3. Utwórz helper `uploadWithProgress` dla XMLHttpRequest z progress tracking

### Krok 3: Implementacja leaf components (od dołu)

3.1. **FileListItem.tsx**
- Przyjmuje FileUploadItem i onRemove
- Wyświetla miniaturę, nazwę, rozmiar, status
- Button usunięcia
- Komunikat błędu (jeśli status = 'invalid')
- Progress bar (jeśli status = 'uploading')

3.2. **FileList.tsx**
- Przyjmuje files[] i onRemove
- Mapuje do FileListItem
- Komunikat "Brak plików" jeśli pusta lista

3.3. **DropZone.tsx**
- Drag & Drop functionality
- Hidden input[type="file"]
- Obsługa drag events (enter, leave, over, drop)
- onClick trigger file dialog
- Przekazanie plików do onFilesSelected

3.4. **DateRangeInputs.tsx**
- Dwa input[type="date"]
- Labels z shadcn/ui
- onChange handlers
- Wyświetlanie błędów

3.5. **StoreSelector.tsx**
- Select z shadcn/ui
- Opcje z stores array
- onChange handler
- Wyświetlanie błędu

3.6. **ProcessingOptionsSection.tsx**
- Checkbox z shadcn/ui
- Label i tekst pomocniczy
- onChange handler

3.7. **UploadProgress.tsx**
- Alert z shadcn/ui (warianty: info, success, error)
- Progress bar
- Komunikat o bieżącym kroku
- Spinner (podczas operacji)

3.8. **FormActions.tsx**
- Dwa Button z shadcn/ui
- "Anuluj" (secondary)
- "Utwórz gazetkę" (primary, disabled based on canSubmit)

### Krok 4: Implementacja złożonych komponentów

4.1. **FileUploadSection.tsx**
- Wrapper dla DropZone i FileList
- Header z instrukcjami
- Przekazywanie callbacks

4.2. **MetadataSection.tsx**
- Wrapper dla StoreSelector i DateRangeInputs
- Header sekcji
- Agregacja errors

### Krok 5: Implementacja głównego komponentu

5.1. **FlyerCreatorForm.tsx**
- Import useNewFlyerForm hook
- Inicjalizacja hooka z props.stores
- Destructure wszystkich wartości z hooka
- Render wszystkich sekcji:
  - Card jako główny kontener
  - MetadataSection
  - FileUploadSection
  - ProcessingOptionsSection
  - UploadProgress (warunkowo)
  - FormActions
- Przekazanie odpowiednich props do komponentów potomnych

### Krok 6: Utworzenie strony Astro

6.1. Utwórz `src/pages/admin/gazetki/nowa.astro`

6.2. Server-side logic:
```astro
---
import Layout from '@/layouts/Layout.astro';
import FlyerCreatorForm from '@/components/admin/FlyerCreatorForm';

// Sprawdzenie autoryzacji (przez middleware lub tutaj)
const session = Astro.locals.session;
if (!session) {
  return Astro.redirect('/admin/login');
}

// Pobranie sklepów
const storesResponse = await fetch(`${Astro.url.origin}/api/admin/stores`);
const storesData = await storesResponse.json();
const stores = storesData.data;

// Sprawdzenie czy są sklepy
if (stores.length === 0) {
  // Render komunikatu
}
---

<Layout title="Nowa gazetka">
  <div class="container mx-auto py-8">
    <h1 class="text-3xl font-bold mb-6">Nowa gazetka promocyjna</h1>
    <FlyerCreatorForm client:load stores={stores} />
  </div>
</Layout>
```

### Krok 7: Stylowanie i UI polish

7.1. Dodaj style Tailwind do wszystkich komponentów

7.2. Zapewnij responsywność (grid layouts, breakpoints)

7.3. Dodaj animacje:
- Dodawanie/usuwanie plików z listy
- Drag over effect na DropZone
- Progress bar smooth transition

7.4. Dodaj ikony z lucide-react:
- Upload icon w DropZone
- X icon dla usuwania plików
- CheckCircle dla success
- AlertCircle dla error
- Loader dla loading

### Krok 9: Obsługa edge cases

9.1. Brak sklepów → wyświetlenie komunikatu i link do dodania sklepu

9.2. Bardzo duża liczba plików (np. 50) → rozważenie chunked uploadu lub limitu

9.3. Bardzo długi upload → timeout handling (5 minut)

9.4. Użytkownik wraca przyciskiem wstecz podczas uploadu → ostrzeżenie lub reset stanu

9.5. Duplikaty plików → sprawdzenie nazw i ostrzeżenie
