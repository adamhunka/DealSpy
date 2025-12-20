# Plan implementacji widoku Konfiguracji i Sklepów

## 1. Przegląd

Widok Konfiguracji i Sklepów to panel administracyjny służący do zarządzania globalnymi ustawieniami systemu (np. prompty AI) oraz słownikami (sklepy). Składa się z dwóch oddzielnych widoków:
- **Widok Ustawień** - umożliwia przeglądanie i edycję konfiguracji systemowych przechowywanych jako pary klucz-wartość JSONB
- **Widok Sklepów** - umożliwia zarządzanie (CRUD) listą sklepów wraz z ich logotypami

Oba widoki są dostępne wyłącznie dla użytkowników z rolą administratora i zbudowane w architekturze hybrydowej (Astro SSR + React dla interaktywności).

## 2. Routing widoku

### Widok Ustawień
- **Ścieżka główna:** `/admin/ustawienia`
- **Ścieżka edycji:** `/admin/ustawienia?edit={key}` (query param dla edycji konkretnego klucza)

### Widok Sklepów
- **Ścieżka główna:** `/admin/sklepy`
- **Ścieżka dodawania:** `/admin/sklepy?action=new` (query param dla formularza dodawania)
- **Ścieżka edycji:** `/admin/sklepy?edit={id}` (query param dla edycji konkretnego sklepu)

**Middleware:** Obie ścieżki wymagają sprawdzenia uprawnień admin przez middleware Astro (redirect do logowania jeśli niezalogowany, 403 jeśli nie admin).

## 3. Struktura komponentów

```
┌─────────────────────────────────────────────────────────────┐
│ /admin/ustawienia (ConfigurationPage.astro)                │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ AdminLayout.astro                                       │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ ConfigurationPanel (React, client:load)            │ │ │
│ │ │ ┌──────────────┐  ┌────────────────────────────────┐│ │ │
│ │ │ │ ConfigList   │  │ ConfigEditor                   ││ │ │
│ │ │ │ - ConfigItem │  │ - JsonEditor                   ││ │ │
│ │ │ │   (x N)      │  │ - Input (description)          ││ │ │
│ │ │ │              │  │ - Button (Save/Cancel)         ││ │ │
│ │ │ └──────────────┘  └────────────────────────────────┘│ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ /admin/sklepy (StoresPage.astro)                           │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ AdminLayout.astro                                       │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ StoresPanel (React, client:load)                   │ │ │
│ │ │ ┌────────────────┐  ┌──────────────────────────────┐│ │ │
│ │ │ │ StoreList      │  │ StoreFormDialog              ││ │ │
│ │ │ │ - StoreCard    │  │ - StoreForm                  ││ │ │
│ │ │ │   (x N)        │  │   - LogoUpload               ││ │ │
│ │ │ │ - AddButton    │  │   - Input (name, slug)       ││ │ │
│ │ │ │                │  │   - Button (Save/Cancel)     ││ │ │
│ │ │ └────────────────┘  └──────────────────────────────┘│ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 4. Szczegóły komponentów

### 4.1 ConfigurationPage.astro

**Opis:** Główna strona Astro dla widoku konfiguracji. Renderowana po stronie serwera, sprawdza uprawnienia, pobiera początkowe dane i przekazuje je do komponentu React.

**Główne elementy:**
- Import `AdminLayout.astro` jako layout
- Import `ConfigurationPanel` z dyrektywą `client:load`
- Sprawdzenie uprawnień (`checkAdminAccess`)
- Fetch początkowych danych konfiguracji (SSR)
- Przekazanie danych jako props do `ConfigurationPanel`

**Typy:**
- `ConfigDTO[]` - lista konfiguracji z API
- `ApiResponse<ConfigDTO[]>` - response wrapper

**Walidacja:**
- Sprawdzenie czy użytkownik jest zalogowany
- Sprawdzenie czy użytkownik ma rolę admin
- Przekierowanie do `/admin/login` jeśli nie zalogowany
- Zwrócenie 403 jeśli zalogowany ale nie admin

---

### 4.2 ConfigurationPanel.tsx

**Opis:** Główny komponent React zarządzający stanem i logiką widoku konfiguracji. Wyświetla listę konfiguracji i formularz edycji. Używa wzorca master-detail.

**Główne elementy:**
- `<div>` z layoutem grid (2 kolumny na desktop, 1 na mobile)
- `<ConfigList>` - lewa kolumna (lub górna na mobile)
- `<ConfigEditor>` - prawa kolumna (lub dolna na mobile)
- `<Toaster>` - z shadcn/ui dla powiadomień

**Obsługiwane interakcje:**
- Wybór konfiguracji do edycji
- Zapisanie zmian w konfiguracji
- Anulowanie edycji
- Wyświetlanie komunikatów sukcesu/błędu

**Obsługiwana walidacja:**
- Walidacja czy wybrano konfigurację przed edycją
- Walidacja czy formularz jest wypełniony przed zapisem

**Typy:**
- `ConfigDTO[]` - lista konfiguracji
- `ConfigDTO | null` - aktualnie edytowana konfiguracja
- `ConfigEditorState` - stan edytora (idle, editing, saving)

**Propsy:**
```typescript
interface ConfigurationPanelProps {
  initialConfigs: ConfigDTO[];
}
```

**Stan wewnętrzny:**
```typescript
const [configs, setConfigs] = useState<ConfigDTO[]>(initialConfigs);
const [selectedConfig, setSelectedConfig] = useState<ConfigDTO | null>(null);
const [isEditing, setIsEditing] = useState(false);
```

---

### 4.3 ConfigList.tsx

**Opis:** Komponent wyświetlający listę wszystkich konfiguracji systemowych. Każdy element listy jest klikalny i pozwala na wybór konfiguracji do edycji.

**Główne elementy:**
- `<div>` z nagłówkiem "Konfiguracja systemu"
- `<ul>` lub `<div>` z listą elementów
- `<ConfigListItem>` x N - dla każdej konfiguracji
- Pusty stan jeśli brak konfiguracji

**Obsługiwane interakcje:**
- Kliknięcie w element listy - wybór konfiguracji do edycji
- Podświetlenie aktualnie wybranej konfiguracji

**Obsługiwana walidacja:**
- Brak walidacji (read-only list)

**Typy:**
- `ConfigDTO[]` - lista konfiguracji

**Propsy:**
```typescript
interface ConfigListProps {
  configs: ConfigDTO[];
  selectedKey: string | null;
  onSelect: (config: ConfigDTO) => void;
}
```

---

### 4.4 ConfigListItem.tsx

**Opis:** Pojedynczy element listy konfiguracji. Wyświetla klucz konfiguracji i opcjonalnie jej opis.

**Główne elementy:**
- `<div>` lub `<li>` z klasą dla stylowania
- `<span>` dla klucza (pogrubiony)
- `<span>` dla opisu (mniejszy font, przycięty jeśli za długi)
- Wskaźnik "aktywny" jeśli element jest wybrany

**Obsługiwane interakcje:**
- onClick - wywołanie callback onSelect z rodzicem

**Obsługiwana walidacja:**
- Brak walidacji

**Typy:**
- `ConfigDTO` - dane konfiguracji

**Propsy:**
```typescript
interface ConfigListItemProps {
  config: ConfigDTO;
  isSelected: boolean;
  onClick: () => void;
}
```

---

### 4.5 ConfigEditor.tsx

**Opis:** Formularz edycji konfiguracji. Umożliwia edycję wartości JSONB (przez JsonEditor) oraz opisu. Waliduje dane przed zapisem.

**Główne elementy:**
- `<form>` z obsługą onSubmit
- `<div>` nagłówek z kluczem konfiguracji (read-only)
- `<JsonEditor>` - edytor wartości JSON
- `<Input>` (shadcn/ui) - pole opisu (opcjonalne, max 500 znaków)
- `<div>` z przyciskami akcji:
  - `<Button variant="default">` - Zapisz
  - `<Button variant="outline">` - Anuluj
- `<Alert>` (shadcn/ui) - wyświetlanie błędów walidacji

**Obsługiwane interakcje:**
- Edycja wartości JSON
- Edycja opisu
- Zapisanie zmian (PUT /api/admin/config/:key)
- Anulowanie edycji
- Wyświetlanie błędów walidacji

**Obsługiwana walidacja:**
- Wartość JSON musi być poprawnym JSON-em
- Opis: maksymalnie 500 znaków
- Klucz: 1-100 znaków (read-only, ale sprawdzany)
- Wyświetlanie błędów z API (ErrorDetail[])

**Typy:**
- `ConfigDTO` - dane konfiguracji
- `UpdateConfigCommand` - payload do API
- `ApiError` - błędy z API

**Propsy:**
```typescript
interface ConfigEditorProps {
  config: ConfigDTO | null;
  onSave: (key: string, data: UpdateConfigCommand) => Promise<void>;
  onCancel: () => void;
}
```

**Stan wewnętrzny:**
```typescript
const [value, setValue] = useState<Record<string, unknown>>(config?.value ?? {});
const [description, setDescription] = useState(config?.description ?? '');
const [errors, setErrors] = useState<ErrorDetail[]>([]);
const [isSaving, setIsSaving] = useState(false);
```

---

### 4.6 JsonEditor.tsx

**Opis:** Specjalizowany komponent do edycji wartości JSON. Wyświetla textarea z walidacją składni JSON w czasie rzeczywistym. Opcjonalnie może użyć biblioteki do syntax highlighting.

**Główne elementy:**
- `<div>` kontener z etykietą
- `<textarea>` dla edycji JSON (lub biblioteka jak react-json-view w trybie edycji)
- `<span>` z licznikiem znaków
- `<Alert>` dla błędów składni JSON

**Obsługivane interakcje:**
- Wpisywanie JSON-a
- Walidacja składni w czasie rzeczywistym (onBlur lub z debounce)
- Formatowanie JSON (opcjonalny przycisk "Format")

**Obsługiwana walidacja:**
- Sprawdzenie czy wartość jest poprawnym JSON-em (JSON.parse)
- Wyświetlanie błędu składni jeśli niepoprawny
- Opcjonalnie: sprawdzanie czy to obiekt (nie string, number, array jako root)

**Typy:**
- `Record<string, unknown>` - wartość JSON

**Propsy:**
```typescript
interface JsonEditorProps {
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  error?: string;
}
```

**Stan wewnętrzny:**
```typescript
const [rawText, setRawText] = useState(JSON.stringify(value, null, 2));
const [parseError, setParseError] = useState<string | null>(null);
```

---

### 4.7 StoresPage.astro

**Opis:** Główna strona Astro dla widoku sklepów. Renderowana po stronie serwera, sprawdza uprawnienia, pobiera początkowe dane sklepów i przekazuje je do komponentu React.

**Główne elementy:**
- Import `AdminLayout.astro` jako layout
- Import `StoresPanel` z dyrektywą `client:load`
- Sprawdzenie uprawnień (`checkAdminAccess`)
- Fetch początkowych danych sklepów (SSR)
- Przekazanie danych jako props do `StoresPanel`

**Typy:**
- `StoreDTO[]` - lista sklepów z API (zakładam że istnieje)
- `ApiResponse<StoreDTO[]>` - response wrapper

**Walidacja:**
- Sprawdzenie czy użytkownik jest zalogowany
- Sprawdzenie czy użytkownik ma rolę admin
- Przekierowanie do `/admin/login` jeśli nie zalogowany
- Zwrócenie 403 jeśli zalogowany ale nie admin

---

### 4.8 StoresPanel.tsx

**Opis:** Główny komponent React zarządzający stanem i logiką widoku sklepów. Wyświetla listę sklepów w formie siatki kart oraz dialog z formularzem dodawania/edycji.

**Główne elementy:**
- `<div>` kontener główny
- `<div>` nagłówek z tytułem i przyciskiem "Dodaj sklep"
- `<StoreList>` - siatka kart sklepów
- `<StoreFormDialog>` - dialog (shadcn/ui) z formularzem
- `<Toaster>` - powiadomienia

**Obsługiwane interakcje:**
- Otwieranie dialogu dodawania sklepu
- Otwieranie dialogu edycji sklepu
- Usuwanie sklepu (z potwierdzeniem)
- Odświeżanie listy po zapisie/usunięciu
- Wyświetlanie komunikatów sukcesu/błędu

**Obsługiwana walidacja:**
- Walidacja czy formularz jest poprawnie wypełniony przed zapisem
- Potwierdzenie przed usunięciem sklepu

**Typy:**
- `StoreDTO[]` - lista sklepów
- `StoreDTO | null` - aktualnie edytowany sklep
- `StoreFormMode` - tryb formularza (create | edit)

**Propsy:**
```typescript
interface StoresPanelProps {
  initialStores: StoreDTO[];
}
```

**Stan wewnętrzny:**
```typescript
const [stores, setStores] = useState<StoreDTO[]>(initialStores);
const [editingStore, setEditingStore] = useState<StoreDTO | null>(null);
const [isDialogOpen, setIsDialogOpen] = useState(false);
const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
```

---

### 4.9 StoreList.tsx

**Opis:** Komponent wyświetlający siatkę kart sklepów. Responsywny grid (1 kolumna na mobile, 2-3 na tablet, 3-4 na desktop).

**Główne elementy:**
- `<div>` z CSS Grid lub Flexbox
- `<StoreCard>` x N - dla każdego sklepu
- Pusty stan jeśli brak sklepów (z przyciskiem "Dodaj pierwszy sklep")

**Obsługiwane interakcje:**
- Przekazywanie akcji (edit, delete) do kart
- Brak bezpośrednich interakcji

**Obsługiwana walidacja:**
- Brak walidacji (prezentacja danych)

**Typy:**
- `StoreDTO[]` - lista sklepów

**Propsy:**
```typescript
interface StoreListProps {
  stores: StoreDTO[];
  onEdit: (store: StoreDTO) => void;
  onDelete: (storeId: string) => void;
}
```

---

### 4.10 StoreCard.tsx

**Opis:** Karta reprezentująca pojedynczy sklep. Wyświetla logo, nazwę, slug oraz przyciski akcji (edytuj, usuń).

**Główne elementy:**
- `<div>` karta z border i shadow (shadcn/ui Card)
- `<img>` logo sklepu (logo_url)
- `<h3>` nazwa sklepu
- `<p>` slug sklepu (mniejszy font)
- `<div>` przyciski akcji:
  - `<Button size="sm" variant="outline">` Edytuj
  - `<Button size="sm" variant="destructive">` Usuń

**Obsługiwane interakcje:**
- onClick przycisku Edytuj - wywołanie onEdit
- onClick przycisku Usuń - wywołanie onDelete (z potwierdzeniem)

**Obsługiwana walidacja:**
- Brak walidacji (prezentacja danych)

**Typy:**
- `StoreDTO` - dane sklepu

**Propsy:**
```typescript
interface StoreCardProps {
  store: StoreDTO;
  onEdit: () => void;
  onDelete: () => void;
}
```

---

### 4.11 StoreFormDialog.tsx

**Opis:** Dialog (modal) zawierający formularz dodawania/edycji sklepu. Używa komponentu Dialog z shadcn/ui.

**Główne elementy:**
- `<Dialog>` (shadcn/ui) - kontener dialogu
- `<DialogContent>` - zawartość dialogu
- `<DialogHeader>` - nagłówek ("Dodaj sklep" / "Edytuj sklep")
- `<StoreForm>` - właściwy formularz
- `<DialogFooter>` - przyciski akcji

**Obsługiwane interakcje:**
- Otwieranie/zamykanie dialogu
- Przekazywanie danych z formularza do rodzica

**Obsługiwana walidacja:**
- Sprawdzenie czy formularz jest poprawnie wypełniony (delegowane do StoreForm)

**Typy:**
- `StoreDTO | null` - dane sklepu do edycji
- `CreateStoreCommand | UpdateStoreCommand` - payload do API

**Propsy:**
```typescript
interface StoreFormDialogProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  store: StoreDTO | null;
  onClose: () => void;
  onSave: (data: CreateStoreCommand | UpdateStoreCommand) => Promise<void>;
}
```

---

### 4.12 StoreForm.tsx

**Opis:** Formularz do dodawania/edycji sklepu. Zawiera pola: nazwa, slug, upload logo.

**Główne elementy:**
- `<form>` z obsługą onSubmit
- `<div>` grupa pól:
  - `<Label>` + `<Input>` (shadcn/ui) - Nazwa sklepu (required, max 100)
  - `<Label>` + `<Input>` (shadcn/ui) - Slug (required, max 100, pattern URL-safe)
  - `<LogoUpload>` - upload logo
- `<Alert>` (shadcn/ui) - błędy walidacji
- `<div>` przyciski:
  - `<Button type="submit">` Zapisz
  - `<Button type="button" variant="outline">` Anuluj

**Obsługiwane interakcje:**
- Wypełnianie pól formularza
- Upload pliku logo
- Walidacja w czasie rzeczywistym (onBlur)
- Submit formularza (POST lub PUT)
- Anulowanie

**Obsługiwana walidacja:**
- Nazwa: wymagana, 1-100 znaków
- Slug: wymagany, 1-100 znaków, tylko małe litery, cyfry, myślniki
- Logo: opcjonalne, formaty JPG/PNG/WEBP, max 2MB
- Auto-generowanie slug z nazwy (opcjonalne)
- Sprawdzanie unikalności slug (błąd 409 z API)

**Typy:**
- `CreateStoreCommand | UpdateStoreCommand` - dane wyjściowe
- `StoreFormData` - lokalny stan formularza
- `ApiError` - błędy z API

**Propsy:**
```typescript
interface StoreFormProps {
  initialData?: StoreDTO;
  mode: 'create' | 'edit';
  onSubmit: (data: CreateStoreCommand | UpdateStoreCommand) => Promise<void>;
  onCancel: () => void;
}
```

**Stan wewnętrzny:**
```typescript
const [formData, setFormData] = useState<StoreFormData>({
  name: initialData?.name ?? '',
  slug: initialData?.slug ?? '',
  logo_file: null
});
const [errors, setErrors] = useState<Record<string, string>>({});
const [isSubmitting, setIsSubmitting] = useState(false);
```

---

### 4.13 LogoUpload.tsx

**Opis:** Komponent do uploadu pliku logo sklepu. Wyświetla podgląd obrazu, przycisk wyboru pliku oraz przycisk usunięcia.

**Główne elementy:**
- `<div>` kontener
- `<label>` etykieta "Logo sklepu"
- `<input type="file">` (ukryty)
- `<Button>` wywołujący kliknięcie na input
- `<div>` podgląd obrazu (jeśli wybrany)
- `<Button variant="ghost">` usunięcie obrazu

**Obsługiwane interakcje:**
- Wybór pliku z dysku
- Preview wybranego pliku
- Usunięcie wybranego pliku
- Walidacja typu i rozmiaru pliku

**Obsługiwana walidacja:**
- Typ pliku: image/jpeg, image/png, image/webp
- Rozmiar pliku: max 2MB
- Wyświetlanie błędu jeśli walidacja nie przeszła

**Typy:**
- `File | null` - wybrany plik

**Propsy:**
```typescript
interface LogoUploadProps {
  value: File | null;
  currentLogoUrl?: string; // dla trybu edycji
  onChange: (file: File | null) => void;
  error?: string;
}
```

**Stan wewnętrzny:**
```typescript
const [preview, setPreview] = useState<string | null>(null);
```

---

## 5. Typy

### 5.1 Istniejące typy (z types.ts)

```typescript
// DTO z API
export interface ConfigDTO {
  key: string;
  value: Record<string, unknown>;
  description: string | null;
  updated_at: string;
}

export interface StoreDTO {
  id: string;
  name: string;
  slug: string;
  logo_url: string;
  created_at: string;
}

export interface ProfileDTO {
  id: string;
  email: string;
  role: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
}

// Command Models
export interface UpdateConfigCommand {
  value: Record<string, unknown>;
  description?: string;
}

export interface CreateStoreCommand {
  name: string;
  slug: string;
  logo_file?: string;
}

export interface UpdateStoreCommand {
  name?: string;
  slug?: string;
  logo_file?: string;
}

export interface UpdateProfileCommand {
  full_name?: string;
}

// Response wrappers
export interface ApiResponse<T> {
  data: T;
  pagination?: PaginationMeta;
}

export interface ApiError {
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
  };
}

export interface ErrorDetail {
  field: string;
  message: string;
}
```

### 5.2 Nowe typy do dodania (ViewModels i pomocnicze)

```typescript
// ============================================================================
// Config View Models
// ============================================================================

/**
 * ConfigEditorState - stan edytora konfiguracji
 */
export type ConfigEditorState = 'idle' | 'editing' | 'saving';

/**
 * ConfigFormData - lokalny stan formularza edycji config
 */
export interface ConfigFormData {
  value: Record<string, unknown>;
  description: string;
}

// ============================================================================
// Store View Models
// ============================================================================

/**
 * StoreFormMode - tryb formularza sklepu
 */
export type StoreFormMode = 'create' | 'edit';

/**
 * StoreFormData - lokalny stan formularza sklepu
 */
export interface StoreFormData {
  name: string;
  slug: string;
  logo_file: File | null;
}

/**
 * StoreFormErrors - błędy walidacji formularza sklepu
 */
export interface StoreFormErrors {
  name?: string;
  slug?: string;
  logo_file?: string;
}

// ============================================================================
// Pomocnicze typy dla API Stores (jeśli nie istnieją)
// ============================================================================
// Uwaga: Te typy zakładają że endpointy stores istnieją
// Jeśli nie - należy je najpierw stworzyć

/**
 * CreateStoreResponse - odpowiedź po utworzeniu sklepu
 */
export interface CreateStoreResponse {
  data: StoreDTO;
}

/**
 * UpdateStoreResponse - odpowiedź po aktualizacji sklepu
 */
export interface UpdateStoreResponse {
  data: StoreDTO;
}

/**
 * DeleteStoreResponse - odpowiedź po usunięciu sklepu
 */
export interface DeleteStoreResponse {
  data: {
    id: string;
    deleted: boolean;
  };
}
```

### 5.3 Typy walidacji (Zod schemas)

Należy utworzyć pliki z schematami Zod dla walidacji:

**`src/lib/schemas/store.schema.ts`**
```typescript
import { z } from 'zod';

// Walidacja slug: tylko małe litery, cyfry, myślniki
const slugRegex = /^[a-z0-9-]+$/;

export const createStoreSchema = z.object({
  name: z.string().min(1, 'Nazwa jest wymagana').max(100, 'Nazwa może mieć maksymalnie 100 znaków'),
  slug: z
    .string()
    .min(1, 'Slug jest wymagany')
    .max(100, 'Slug może mieć maksymalnie 100 znaków')
    .regex(slugRegex, 'Slug może zawierać tylko małe litery, cyfry i myślniki'),
  logo_file: z.string().optional()
});

export const updateStoreSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).regex(slugRegex).optional(),
  logo_file: z.string().optional()
});

export const storeIdSchema = z.string().uuid('Nieprawidłowe ID sklepu');
```

**Walidacja pola logo_file po stronie klienta:**
```typescript
export const validateLogoFile = (file: File): string | null => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const maxSize = 2 * 1024 * 1024; // 2MB

  if (!allowedTypes.includes(file.type)) {
    return 'Dozwolone formaty: JPG, PNG, WEBP';
  }

  if (file.size > maxSize) {
    return 'Maksymalny rozmiar pliku to 2MB';
  }

  return null;
};
```

## 6. Zarządzanie stanem

### 6.1 Stan na poziomie strony (Astro SSR)

Dane początkowe pobierane są po stronie serwera (SSR) w plikach `.astro`:
- Lista konfiguracji: `GET /api/admin/config`
- Lista sklepów: `GET /api/admin/stores`

Dane te są przekazywane jako props do głównych komponentów React.

### 6.2 Stan na poziomie komponentów React

#### ConfigurationPanel
```typescript
const [configs, setConfigs] = useState<ConfigDTO[]>(initialConfigs);
const [selectedConfig, setSelectedConfig] = useState<ConfigDTO | null>(null);
const [isEditing, setIsEditing] = useState(false);
```

#### StoresPanel
```typescript
const [stores, setStores] = useState<StoreDTO[]>(initialStores);
const [editingStore, setEditingStore] = useState<StoreDTO | null>(null);
const [isDialogOpen, setIsDialogOpen] = useState(false);
const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
```

#### ConfigEditor
```typescript
const [formData, setFormData] = useState<ConfigFormData>({
  value: config?.value ?? {},
  description: config?.description ?? ''
});
const [errors, setErrors] = useState<ErrorDetail[]>([]);
const [isSaving, setIsSaving] = useState(false);
```

#### StoreForm
```typescript
const [formData, setFormData] = useState<StoreFormData>({
  name: initialData?.name ?? '',
  slug: initialData?.slug ?? '',
  logo_file: null
});
const [errors, setErrors] = useState<StoreFormErrors>({});
const [isSubmitting, setIsSubmitting] = useState(false);
```

### 6.3 Custom Hooks (opcjonalne, ale zalecane)

#### useConfigEditor
```typescript
interface UseConfigEditorReturn {
  formData: ConfigFormData;
  errors: ErrorDetail[];
  isSaving: boolean;
  updateField: (field: keyof ConfigFormData, value: any) => void;
  validateForm: () => boolean;
  saveConfig: (key: string) => Promise<void>;
  reset: () => void;
}

function useConfigEditor(
  initialConfig: ConfigDTO | null,
  onSaveSuccess: (config: ConfigDTO) => void
): UseConfigEditorReturn;
```

#### useStoreForm
```typescript
interface UseStoreFormReturn {
  formData: StoreFormData;
  errors: StoreFormErrors;
  isSubmitting: boolean;
  updateField: (field: keyof StoreFormData, value: any) => void;
  validateForm: () => boolean;
  submitForm: (mode: StoreFormMode, storeId?: string) => Promise<void>;
  reset: () => void;
}

function useStoreForm(
  initialData: StoreDTO | null,
  onSubmitSuccess: (store: StoreDTO) => void
): UseStoreFormReturn;
```

#### useToast
```typescript
// Wrapper dla shadcn/ui toast
interface UseToastReturn {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showInfo: (message: string) => void;
}

function useToast(): UseToastReturn;
```

### 6.4 Optymalizacja stanu

- **Optimistic Updates:** Po zapisie/usunięciu zaktualizuj stan lokalny od razu, przed potwierdzeniem z serwera
- **Error Rollback:** W przypadku błędu przywróć poprzedni stan
- **Loading States:** Wyraźnie oznaczaj stan ładowania (disabled buttons, spinners)

## 7. Integracja API

### 7.1 Endpointy Config

#### Pobieranie wszystkich konfiguracji
```typescript
async function fetchAllConfigs(): Promise<ConfigDTO[]> {
  const response = await fetch('/api/admin/config');
  
  if (!response.ok) {
    if (response.status === 401) {
      window.location.href = '/admin/login';
      throw new Error('Unauthorized');
    }
    throw new Error('Failed to fetch configs');
  }
  
  const data: ApiResponse<ConfigDTO[]> = await response.json();
  return data.data;
}
```

#### Pobieranie pojedynczej konfiguracji
```typescript
async function fetchConfigByKey(key: string): Promise<ConfigDTO> {
  const response = await fetch(`/api/admin/config/${key}`);
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Configuration not found');
    }
    throw new Error('Failed to fetch config');
  }
  
  const data: ApiResponse<ConfigDTO> = await response.json();
  return data.data;
}
```

#### Aktualizacja konfiguracji
```typescript
async function updateConfig(
  key: string, 
  command: UpdateConfigCommand
): Promise<ConfigDTO> {
  const response = await fetch(`/api/admin/config/${key}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command)
  });
  
  if (!response.ok) {
    const error: ApiError = await response.json();
    throw error;
  }
  
  const data: ApiResponse<ConfigDTO> = await response.json();
  return data.data;
}
```

### 7.2 Endpointy Store (zakładając że istnieją)

#### Pobieranie wszystkich sklepów
```typescript
async function fetchAllStores(): Promise<StoreDTO[]> {
  const response = await fetch('/api/admin/stores');
  
  if (!response.ok) {
    throw new Error('Failed to fetch stores');
  }
  
  const data: ApiResponse<StoreDTO[]> = await response.json();
  return data.data;
}
```

#### Tworzenie sklepu
```typescript
async function createStore(command: CreateStoreCommand): Promise<StoreDTO> {
  // Jeśli logo_file to File, konwertujemy na FormData
  const formData = new FormData();
  formData.append('name', command.name);
  formData.append('slug', command.slug);
  if (command.logo_file) {
    formData.append('logo', command.logo_file);
  }
  
  const response = await fetch('/api/admin/stores', {
    method: 'POST',
    body: formData
  });
  
  if (!response.ok) {
    const error: ApiError = await response.json();
    throw error;
  }
  
  const data: ApiResponse<StoreDTO> = await response.json();
  return data.data;
}
```

#### Aktualizacja sklepu
```typescript
async function updateStore(
  storeId: string, 
  command: UpdateStoreCommand
): Promise<StoreDTO> {
  const formData = new FormData();
  if (command.name) formData.append('name', command.name);
  if (command.slug) formData.append('slug', command.slug);
  if (command.logo_file) formData.append('logo', command.logo_file);
  
  const response = await fetch(`/api/admin/stores/${storeId}`, {
    method: 'PUT',
    body: formData
  });
  
  if (!response.ok) {
    const error: ApiError = await response.json();
    throw error;
  }
  
  const data: ApiResponse<StoreDTO> = await response.json();
  return data.data;
}
```

#### Usuwanie sklepu
```typescript
async function deleteStore(storeId: string): Promise<void> {
  const response = await fetch(`/api/admin/stores/${storeId}`, {
    method: 'DELETE'
  });
  
  if (!response.ok) {
    const error: ApiError = await response.json();
    throw error;
  }
}
```

### 7.3 Obsługa błędów API

```typescript
function handleApiError(error: unknown, showToast: (msg: string) => void): void {
  if (error && typeof error === 'object' && 'error' in error) {
    const apiError = error as ApiError;
    
    switch (apiError.error.code) {
      case 'VALIDATION_ERROR':
        showToast(`Błąd walidacji: ${apiError.error.message}`);
        break;
      case 'UNAUTHORIZED':
        window.location.href = '/admin/login';
        break;
      case 'FORBIDDEN':
        showToast('Brak uprawnień do wykonania tej operacji');
        break;
      case 'NOT_FOUND':
        showToast('Nie znaleziono zasobu');
        break;
      case 'CONFLICT':
        showToast('Konflikt: zasób już istnieje');
        break;
      default:
        showToast('Wystąpił nieoczekiwany błąd');
    }
  } else {
    showToast('Wystąpił błąd sieci');
  }
}
```

## 8. Interakcje użytkownika

### 8.1 Widok Konfiguracji

#### Wybór konfiguracji do edycji
1. Użytkownik klika na element listy konfiguracji
2. Element zostaje podświetlony
3. Formularz edycji po prawej stronie zostaje wypełniony danymi
4. Focus przenosi się do pierwszego pola edycji

#### Edycja wartości JSON
1. Użytkownik wpisuje/edytuje JSON w JsonEditor
2. Walidacja składni następuje po opuszczeniu pola (onBlur)
3. W przypadku błędu składni wyświetlany jest komunikat pod polem
4. Przycisk "Zapisz" jest disabled jeśli JSON jest niepoprawny

#### Edycja opisu
1. Użytkownik wpisuje opis w polu tekstowym
2. Licznik znaków pokazuje 0/500
3. Po przekroczeniu limitu pole jest podświetlone na czerwono
4. Przycisk "Zapisz" jest disabled jeśli limit przekroczony

#### Zapis konfiguracji
1. Użytkownik klika "Zapisz"
2. Przycisk zmienia stan na loading (spinner)
3. Wysłanie PUT request do API
4. W przypadku sukcesu:
   - Toast z komunikatem "Konfiguracja zapisana"
   - Lista konfiguracji zostaje zaktualizowana (updated_at)
   - Formularz pozostaje otwarty
5. W przypadku błędu:
   - Toast z komunikatem błędu
   - Błędy walidacji wyświetlane pod odpowiednimi polami
   - Przycisk wraca do stanu normalnego

#### Anulowanie edycji
1. Użytkownik klika "Anuluj"
2. Formularz zostaje zresetowany do pierwotnych wartości
3. Wszystkie błędy walidacji są czyszczone

### 8.2 Widok Sklepów

#### Dodawanie nowego sklepu
1. Użytkownik klika przycisk "Dodaj sklep"
2. Otwiera się dialog z pustym formularzem
3. Użytkownik wypełnia pola:
   - Nazwa (required) - podczas wpisywania slug jest auto-generowany
   - Slug (required) - można edytować ręcznie
   - Logo (optional) - kliknięcie otwiera file picker
4. Po wybraniu logo wyświetlany jest preview
5. Walidacja pól następuje po opuszczeniu (onBlur)
6. Użytkownik klika "Zapisz"
7. POST request do API
8. W przypadku sukcesu:
   - Dialog się zamyka
   - Toast "Sklep został dodany"
   - Lista sklepów zostaje zaktualizowana
   - Nowy sklep pojawia się na liście
9. W przypadku błędu:
   - Toast z komunikatem błędu
   - Błędy walidacji pod polami
   - Dialog pozostaje otwarty

#### Edycja sklepu
1. Użytkownik klika "Edytuj" na karcie sklepu
2. Otwiera się dialog z formularzem wypełnionym danymi
3. Wyświetlany jest obecny logo (jeśli istnieje)
4. Użytkownik może zmienić dowolne pole
5. Jeśli wybierze nowy plik logo, zastąpi obecny
6. Walidacja i zapis analogiczne jak przy dodawaniu
7. PUT request do API

#### Usuwanie sklepu
1. Użytkownik klika "Usuń" na karcie sklepu
2. Pojawia się dialog potwierdzenia:
   - "Czy na pewno chcesz usunąć sklep {nazwa}?"
   - "Ta operacja jest nieodwracalna"
   - Przyciski: "Anuluj" / "Usuń" (czerwony)
3. Po kliknięciu "Usuń":
   - DELETE request do API
   - W przypadku sukcesu:
     - Toast "Sklep został usunięty"
     - Karta znika z listy (animacja fade-out)
   - W przypadku błędu:
     - Toast z komunikatem błędu
     - Karta pozostaje na liście

#### Upload logo
1. Użytkownik klika przycisk "Wybierz plik" lub obszar upload
2. Otwiera się systemowy file picker
3. Użytkownik wybiera plik obrazu
4. Walidacja:
   - Typ pliku (JPG/PNG/WEBP)
   - Rozmiar (max 2MB)
5. Jeśli walidacja OK:
   - Generowany jest preview (FileReader)
   - Przycisk "Usuń" staje się widoczny
6. Jeśli walidacja błąd:
   - Toast z komunikatem błędu
   - Plik nie jest akceptowany
7. Użytkownik może kliknąć "Usuń" aby wyczyścić wybór

## 9. Warunki i walidacja

### 9.1 Walidacja na poziomie klienta (ConfigEditor)

#### Pole: value (JSON)
- **Komponent:** JsonEditor w ConfigEditor
- **Warunki:**
  - Wartość musi być poprawnym JSON-em (sprawdzane przez JSON.parse)
  - Nie może być puste
- **Walidacja:**
  - Trigger: onBlur w textarea lub onChange z debounce (500ms)
  - Metoda: try-catch z JSON.parse
- **Stan UI:**
  - Błąd: czerwony border, komunikat pod polem
  - Sukces: zielony border (opcjonalnie)
  - Przycisk "Zapisz" disabled gdy błąd
- **Komunikaty:**
  - "Nieprawidłowy format JSON"
  - "To pole jest wymagane"

#### Pole: description
- **Komponent:** Input w ConfigEditor
- **Warunki:**
  - Maksymalnie 500 znaków
  - Pole opcjonalne
- **Walidacja:**
  - Trigger: onChange
  - Metoda: sprawdzenie length
- **Stan UI:**
  - Licznik: "245/500" (szary), "500/500" (czerwony)
  - Czerwony border gdy przekroczony limit
  - Przycisk "Zapisz" disabled gdy limit przekroczony
- **Komunikaty:**
  - "Opis może mieć maksymalnie 500 znaków"

### 9.2 Walidacja na poziomie klienta (StoreForm)

#### Pole: name
- **Komponent:** Input w StoreForm
- **Warunki:**
  - Wymagane (min 1 znak)
  - Maksymalnie 100 znaków
- **Walidacja:**
  - Trigger: onBlur
  - Metoda: Zod schema (createStoreSchema.shape.name)
- **Stan UI:**
  - Czerwony border i komunikat pod polem przy błędzie
  - Przycisk "Zapisz" disabled gdy błąd
- **Komunikaty:**
  - "Nazwa jest wymagana"
  - "Nazwa może mieć maksymalnie 100 znaków"

#### Pole: slug
- **Komponent:** Input w StoreForm
- **Warunki:**
  - Wymagane (min 1 znak)
  - Maksymalnie 100 znaków
  - Tylko małe litery, cyfry, myślniki (regex: ^[a-z0-9-]+$)
- **Walidacja:**
  - Trigger: onBlur lub onChange (dla regex)
  - Metoda: Zod schema (createStoreSchema.shape.slug)
- **Stan UI:**
  - Auto-generowanie z name (zamiana spacji na myślniki, małe litery, usunięcie znaków specjalnych)
  - Użytkownik może nadpisać ręcznie
  - Czerwony border przy błędzie
- **Komunikaty:**
  - "Slug jest wymagany"
  - "Slug może mieć maksymalnie 100 znaków"
  - "Slug może zawierać tylko małe litery, cyfry i myślniki"

#### Pole: logo_file
- **Komponent:** LogoUpload
- **Warunki:**
  - Opcjonalne
  - Typ: image/jpeg, image/png, image/webp
  - Maksymalny rozmiar: 2MB
- **Walidacja:**
  - Trigger: onChange (zaraz po wyborze pliku)
  - Metoda: funkcja validateLogoFile
- **Stan UI:**
  - Preview obrazu po wyborze
  - Przycisk "Usuń" gdy plik wybrany
  - Czerwony border obszaru upload przy błędzie
- **Komunikaty:**
  - "Dozwolone formaty: JPG, PNG, WEBP"
  - "Maksymalny rozmiar pliku to 2MB"

### 9.3 Walidacja na poziomie API

#### Config - PUT /api/admin/config/:key
- **Warunki sprawdzane przez API:**
  - key: 1-100 znaków (sprawdzane przez configKeySchema)
  - value: musi być obiektem JSON (Record<string, unknown>)
  - description: max 500 znaków, opcjonalne
- **Błędy zwracane przez API:**
  - 400 VALIDATION_ERROR - błędy walidacji Zod
    - ErrorDetail[] w response.error.details
  - 401 UNAUTHORIZED - brak sesji
  - 403 FORBIDDEN - nie admin
- **Obsługa na kliencie:**
  - Parse ErrorDetail[] i przypisanie do odpowiednich pól
  - Wyświetlenie komunikatów pod polami
  - Toast z głównym komunikatem błędu

#### Store - POST /api/admin/stores
- **Warunki sprawdzane przez API:**
  - name: 1-100 znaków
  - slug: 1-100 znaków, regex ^[a-z0-9-]+$, unikalny
  - logo: multipart file, walidacja typu i rozmiaru
- **Błędy zwracane przez API:**
  - 400 VALIDATION_ERROR - błędy walidacji
  - 409 CONFLICT - slug już istnieje
  - 413 PAYLOAD_TOO_LARGE - plik za duży
  - 401 UNAUTHORIZED - brak sesji
  - 403 FORBIDDEN - nie admin
- **Obsługa na kliencie:**
  - Specjalna obsługa 409 CONFLICT dla slug
  - Wyświetlenie błędu pod polem slug: "Ten slug jest już używany"
  - Pozostałe błędy standardowo

### 9.4 Walidacja formularza przed submitem

#### ConfigEditor - przed zapisem
```typescript
function validateBeforeSubmit(): boolean {
  const errors: ErrorDetail[] = [];
  
  // Sprawdź czy JSON jest poprawny
  try {
    JSON.stringify(formData.value);
  } catch {
    errors.push({ field: 'value', message: 'Nieprawidłowy format JSON' });
  }
  
  // Sprawdź długość opisu
  if (formData.description.length > 500) {
    errors.push({ field: 'description', message: 'Opis może mieć maksymalnie 500 znaków' });
  }
  
  setErrors(errors);
  return errors.length === 0;
}
```

#### StoreForm - przed submitem
```typescript
function validateBeforeSubmit(): boolean {
  const errors: StoreFormErrors = {};
  
  // Walidacja przez Zod schema
  const schema = mode === 'create' ? createStoreSchema : updateStoreSchema;
  const result = schema.safeParse({
    name: formData.name,
    slug: formData.slug
  });
  
  if (!result.success) {
    result.error.issues.forEach(issue => {
      errors[issue.path[0] as keyof StoreFormErrors] = issue.message;
    });
  }
  
  // Walidacja pliku logo (jeśli wybrany)
  if (formData.logo_file) {
    const logoError = validateLogoFile(formData.logo_file);
    if (logoError) {
      errors.logo_file = logoError;
    }
  }
  
  setErrors(errors);
  return Object.keys(errors).length === 0;
}
```

### 9.5 Warunki UI (disabled states)

#### Przycisk "Zapisz" disabled gdy:
- ConfigEditor:
  - JSON jest niepoprawny (parseError !== null)
  - Opis przekracza 500 znaków
  - Trwa zapisywanie (isSaving === true)
  - Brak zmian względem oryginału (opcjonalnie)
- StoreForm:
  - Walidacja nie przeszła (errors nie puste)
  - Trwa wysyłanie (isSubmitting === true)
  - Wymagane pola puste (name, slug)

#### Pola input disabled gdy:
- Trwa zapisywanie/wysyłanie
- (Opcjonalnie) Po stronie edycji: slug może być read-only jeśli istnieją powiązane rekordy

#### Dialog zamknięcie zablokowane gdy:
- Trwa wysyłanie formularza (isSubmitting === true)
- Użytkownik wprowadził zmiany - pokazać prompt "Czy na pewno chcesz zamknąć? Niezapisane zmiany zostaną utracone"

## 10. Obsługa błędów

### 10.1 Błędy sieciowe

**Scenariusz:** Brak połączenia z serwerem lub timeout
- **Wykrywanie:** `fetch()` rzuca błąd network error
- **Obsługa:**
  - Toast: "Brak połączenia z serwerem. Sprawdź połączenie internetowe."
  - Przycisk "Ponów" w toast
  - Przywrócenie stanu formularza (rollback)
  - Logowanie błędu do console

### 10.2 Błędy uwierzytelniania

**Scenariusz:** Status 401 Unauthorized
- **Przyczyna:** Sesja wygasła lub użytkownik nie jest zalogowany
- **Obsługa:**
  - Automatyczne przekierowanie do `/admin/login`
  - Query param `?redirect=/admin/ustawienia` dla powrotu po logowaniu
  - Toast: "Sesja wygasła. Zaloguj się ponownie."

**Scenariusz:** Status 403 Forbidden
- **Przyczyna:** Użytkownik zalogowany ale nie ma roli admin
- **Obsługa:**
  - Toast: "Brak uprawnień do wykonania tej operacji"
  - Pozostanie na stronie (nie redirect)
  - Opcjonalnie: disabled wszystkich przycisków akcji

### 10.3 Błędy walidacji (400 Bad Request)

**Scenariusz:** API zwraca VALIDATION_ERROR z ErrorDetail[]
- **Obsługa:**
  - Parse `response.error.details[]`
  - Przypisanie każdego błędu do odpowiedniego pola formularza
  - Wyświetlenie komunikatu pod polem (czerwony tekst)
  - Czerwony border pola z błędem
  - Toast z głównym komunikatem: "Popraw błędy w formularzu"
  - Focus na pierwszym polu z błędem

**Przykład:**
```typescript
// Response z API
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": [
      { "field": "slug", "message": "Slug może zawierać tylko małe litery, cyfry i myślniki" }
    ]
  }
}

// Mapping do stanu formularza
const fieldErrors: StoreFormErrors = {};
apiError.error.details?.forEach(detail => {
  fieldErrors[detail.field as keyof StoreFormErrors] = detail.message;
});
setErrors(fieldErrors);
```

### 10.4 Błędy konfliktów (409 Conflict)

**Scenariusz:** Slug sklepu już istnieje w bazie
- **Obsługa:**
  - Toast: "Sklep o tym slug już istnieje"
  - Błąd pod polem slug: "Ten slug jest już używany"
  - Sugestia: automatyczne dodanie liczby do slug (np. "biedronka-2")
  - Focus na pole slug

### 10.5 Błędy Not Found (404)

**Scenariusz:** GET /api/admin/config/:key zwraca 404
- **Obsługa:**
  - Toast: "Nie znaleziono konfiguracji o kluczu {key}"
  - Usunięcie elementu z listy (jeśli był)
  - Czyszczenie formularza edycji

**Scenariusz:** PUT /api/admin/stores/:id zwraca 404
- **Obsługa:**
  - Toast: "Sklep został usunięty przez innego użytkownika"
  - Zamknięcie dialogu
  - Odświeżenie listy sklepów

### 10.6 Błędy serwera (500 Internal Server Error)

**Scenariusz:** Błąd po stronie serwera
- **Obsługa:**
  - Toast: "Wystąpił błąd serwera. Spróbuj ponownie za chwilę."
  - Przycisk "Ponów" w toast
  - Logowanie szczegółów błędu do console
  - Opcjonalnie: wysłanie błędu do systemu monitoringu (Sentry, etc.)

### 10.7 Błędy uploadu plików

**Scenariusz:** Plik logo za duży (413 Payload Too Large)
- **Obsługa:**
  - Toast: "Plik jest za duży. Maksymalny rozmiar to 2MB."
  - Błąd pod komponentem upload
  - Czyszczenie wybranego pliku

**Scenariusz:** Nieprawidłowy typ pliku
- **Obsługa:** (walidacja po stronie klienta przed wysłaniem)
  - Toast: "Nieprawidłowy format pliku. Dozwolone: JPG, PNG, WEBP."
  - Nie wysyłanie requestu do API

**Scenariusz:** Błąd podczas generowania preview
- **Obsługa:**
  - Toast: "Nie można wygenerować podglądu obrazu"
  - Plik nadal wybrany (można zapisać bez preview)
  - Fallback: ikona obrazu zamiast preview

### 10.8 Błędy parsowania JSON (ConfigEditor)

**Scenariusz:** Użytkownik wpisuje niepoprawny JSON
- **Obsługa:**
  - Walidacja w czasie rzeczywistym (onBlur lub debounced onChange)
  - Komunikat pod edytorem: "Nieprawidłowy format JSON: {error message}"
  - Przycisk "Zapisz" disabled
  - Opcjonalnie: podświetlenie linii z błędem (jeśli używamy biblioteki)

**Scenariusz:** API zwraca błąd parsowania
- **Obsługa:**
  - Toast: "Nie można zapisać konfiguracji: nieprawidłowy format JSON"
  - Formularz pozostaje otwarty
  - Focus na edytor JSON

### 10.9 Race conditions i stale data

**Scenariusz:** Dwie karty przeglądarki, edycja tego samego rekordu
- **Obsługa:**
  - Sprawdzanie `updated_at` przed zapisem (optimistic locking)
  - Jeśli zmienione: pokazać dialog "Rekord został zmieniony przez innego użytkownika. Odświeżyć?"
  - Przyciski: "Odśwież i straćzmiany" / "Zapisz mimo wszystko" (nadpisz)

**Scenariusz:** Lista sklepów nieaktualna po usunięciu w innej karcie
- **Obsługa:**
  - Obsługa 404 przy próbie edycji usuniętego sklepu
  - Automatyczne odświeżenie listy po otrzymaniu 404

### 10.10 Boundary dla React Error

**Komponent:** ErrorBoundary (React)
- **Cel:** Złapanie nieobsłużonych błędów React
- **Obsługa:**
  - Wyświetlenie fallback UI: "Coś poszło nie tak. Odśwież stronę."
  - Przycisk "Odśwież stronę"
  - Logowanie błędu do console
  - Opcjonalnie: wysłanie do Sentry

```tsx
<ErrorBoundary fallback={<ErrorFallback />}>
  <ConfigurationPanel initialConfigs={configs} />
</ErrorBoundary>
```

## 11. Kroki implementacji

### Faza 1: Setup i struktura bazowa

#### Krok 1.1: Utworzenie layoutu admin
- [ ] Utworzyć `src/layouts/AdminLayout.astro`
- [ ] Dodać nawigację z linkami do `/admin/ustawienia` i `/admin/sklepy`
- [ ] Dodać przycisk wylogowania
- [ ] Zaimplementować sprawdzenie uprawnień w middleware

#### Krok 1.2: Utworzenie stron Astro
- [ ] Utworzyć `src/pages/admin/ustawienia.astro`
- [ ] Utworzyć `src/pages/admin/sklepy.astro`
- [ ] Dodać sprawdzenie uprawnień (checkAdminAccess)
- [ ] Zaimplementować pobieranie danych SSR

#### Krok 1.3: Przygotowanie typów
- [ ] Dodać ViewModels do `src/types.ts` (ConfigFormData, StoreFormData, etc.)
- [ ] Utworzyć `src/lib/schemas/store.schema.ts` z walidacją Zod
- [ ] Utworzyć pomocniczą funkcję `validateLogoFile`

### Faza 2: Implementacja widoku Konfiguracji

#### Krok 2.1: ConfigurationPanel (główny kontener)
- [ ] Utworzyć `src/components/admin/ConfigurationPanel.tsx`
- [ ] Zaimplementować stan (configs, selectedConfig, isEditing)
- [ ] Zaimplementować layout (grid 2 kolumny)
- [ ] Dodać obsługę wyboru konfiguracji
- [ ] Dodać obsługę zapisu konfiguracji

#### Krok 2.2: ConfigList i ConfigListItem
- [ ] Utworzyć `src/components/admin/ConfigList.tsx`
- [ ] Utworzyć `src/components/admin/ConfigListItem.tsx`
- [ ] Zaimplementować wyświetlanie listy
- [ ] Dodać obsługę kliknięcia (onSelect)
- [ ] Dodać podświetlenie wybranego elementu

#### Krok 2.3: JsonEditor
- [ ] Utworzyć `src/components/admin/JsonEditor.tsx`
- [ ] Zaimplementować textarea dla JSON
- [ ] Dodać walidację JSON w czasie rzeczywistym
- [ ] Dodać licznik znaków
- [ ] Opcjonalnie: dodać przycisk "Formatuj JSON"
- [ ] Dodać wyświetlanie błędów składni

#### Krok 2.4: ConfigEditor
- [ ] Utworzyć `src/components/admin/ConfigEditor.tsx`
- [ ] Zaimplementować formularz z JsonEditor i Input (description)
- [ ] Dodać walidację przed submitem
- [ ] Zaimplementować obsługę zapisu (PUT /api/admin/config/:key)
- [ ] Dodać obsługę anulowania
- [ ] Dodać wyświetlanie błędów walidacji z API
- [ ] Dodać loading state dla przycisku Zapisz

#### Krok 2.5: Integracja i testy
- [ ] Zintegrować wszystkie komponenty w ConfigurationPanel
- [ ] Przetestować flow: wybór -> edycja -> zapis
- [ ] Przetestować obsługę błędów (400, 401, 500)
- [ ] Przetestować walidację JSON
- [ ] Przetestować responsywność (mobile/desktop)

### Faza 3: Implementacja widoku Sklepów

#### Krok 3.1: StoresPanel (główny kontener)
- [ ] Utworzyć `src/components/admin/StoresPanel.tsx`
- [ ] Zaimplementować stan (stores, editingStore, isDialogOpen, formMode)
- [ ] Dodać przycisk "Dodaj sklep"
- [ ] Zaimplementować obsługę otwierania/zamykania dialogu
- [ ] Dodać obsługę zapisu (create/update)
- [ ] Dodać obsługę usuwania z potwierdzeniem

#### Krok 3.2: StoreList i StoreCard
- [ ] Utworzyć `src/components/admin/StoreList.tsx`
- [ ] Utworzyć `src/components/admin/StoreCard.tsx`
- [ ] Zaimplementować grid layout (responsywny)
- [ ] Dodać wyświetlanie logo, nazwy, slug
- [ ] Dodać przyciski akcji (Edytuj, Usuń)
- [ ] Dodać pusty stan ("Brak sklepów")

#### Krok 3.3: LogoUpload
- [ ] Utworzyć `src/components/admin/LogoUpload.tsx`
- [ ] Zaimplementować file input (ukryty)
- [ ] Dodać przycisk wyboru pliku
- [ ] Zaimplementować preview obrazu (FileReader)
- [ ] Dodać walidację typu i rozmiaru pliku
- [ ] Dodać przycisk usunięcia wybranego pliku
- [ ] Dodać wyświetlanie obecnego logo (tryb edycji)

#### Krok 3.4: StoreForm
- [ ] Utworzyć `src/components/admin/StoreForm.tsx`
- [ ] Zaimplementować pola: name, slug, logo
- [ ] Dodać auto-generowanie slug z name
- [ ] Zaimplementować walidację Zod
- [ ] Dodać walidację w czasie rzeczywistym (onBlur)
- [ ] Zaimplementować submit (POST/PUT)
- [ ] Dodać obsługę błędów walidacji z API
- [ ] Dodać loading state

#### Krok 3.5: StoreFormDialog
- [ ] Utworzyć `src/components/admin/StoreFormDialog.tsx`
- [ ] Zintegrować Dialog z shadcn/ui
- [ ] Dodać StoreForm wewnątrz dialogu
- [ ] Zaimplementować obsługę zamykania
- [ ] Dodać prompt przy niezapisanych zmianach
- [ ] Dostosować nagłówek w zależności od mode (create/edit)

#### Krok 3.6: API endpoints dla sklepów (jeśli nie istnieją)
- [ ] Utworzyć `src/pages/api/admin/stores/index.ts` (GET, POST)
- [ ] Utworzyć `src/pages/api/admin/stores/[id].ts` (GET, PUT, DELETE)
- [ ] Utworzyć `src/lib/services/store.service.ts`
- [ ] Zaimplementować upload logo do Supabase Storage
- [ ] Dodać walidację Zod
- [ ] Dodać testy endpoints

#### Krok 3.7: Integracja i testy
- [ ] Zintegrować wszystkie komponenty w StoresPanel
- [ ] Przetestować flow: dodawanie -> lista -> edycja -> usuwanie
- [ ] Przetestować upload logo (różne formaty, rozmiary)
- [ ] Przetestować walidację slug (unikalność, format)
- [ ] Przetestować obsługę błędów (400, 409, 500)
- [ ] Przetestować responsywność
- [ ] Przetestować dialog (otwieranie, zamykanie, prompt)

### Faza 4: Custom Hooks i optymalizacje

#### Krok 4.1: useConfigEditor hook
- [ ] Utworzyć `src/lib/hooks/useConfigEditor.ts`
- [ ] Przenieść logikę zarządzania stanem z ConfigEditor
- [ ] Zaimplementować walidację
- [ ] Zaimplementować saveConfig z obsługą błędów

#### Krok 4.2: useStoreForm hook
- [ ] Utworzyć `src/lib/hooks/useStoreForm.ts`
- [ ] Przenieść logikę zarządzania stanem z StoreForm
- [ ] Zaimplementować walidację
- [ ] Zaimplementować submitForm z obsługą błędów

#### Krok 4.3: useToast hook
- [ ] Utworzyć `src/lib/hooks/useToast.ts`
- [ ] Wrapper dla shadcn/ui toast
- [ ] Zaimplementować showSuccess, showError, showInfo

#### Krok 4.4: Optimistic updates
- [ ] Dodać optimistic update w ConfigurationPanel
- [ ] Dodać optimistic update w StoresPanel (create, update, delete)
- [ ] Zaimplementować rollback w przypadku błędu

### Faza 5: Error handling i edge cases

#### Krok 5.1: ErrorBoundary
- [ ] Utworzyć `src/components/ErrorBoundary.tsx`
- [ ] Zaimplementować fallback UI
- [ ] Dodać logowanie błędów
- [ ] Owinąć główne komponenty w ErrorBoundary

#### Krok 5.2: Network error handling
- [ ] Dodać obsługę błędów sieciowych we wszystkich fetch calls
- [ ] Zaimplementować retry logic (opcjonalnie)
- [ ] Dodać informacyjne toasty

#### Krok 5.3: Race conditions
- [ ] Dodać sprawdzanie updated_at przy zapisie
- [ ] Zaimplementować dialog "Rekord zmieniony"
- [ ] Dodać automatyczne odświeżanie po 404

### Faza 6: Styling i responsywność

#### Krok 6.1: Tailwind styling
- [ ] Dodać style dla ConfigurationPanel (grid layout)
- [ ] Dodać style dla ConfigList (lista z hover effects)
- [ ] Dodać style dla ConfigEditor (formularz, spacing)
- [ ] Dodać style dla StoresPanel
- [ ] Dodać style dla StoreCard (card, shadow, buttons)
- [ ] Dodać style dla dialogów

#### Krok 6.2: Responsywność
- [ ] Przetestować ConfigurationPanel na mobile (1 kolumna zamiast 2)
- [ ] Przetestować StoresPanel na mobile (grid 1 kolumna)
- [ ] Dostosować rozmiary czcionek
- [ ] Dostosować spacing i padding
- [ ] Przetestować dialogi na mobile (full screen)

#### Krok 6.3: Accessibility
- [ ] Dodać aria-labels do przycisków
- [ ] Dodać aria-live dla komunikatów błędów
- [ ] Sprawdzić focus management (Tab navigation)
- [ ] Sprawdzić kontrast kolorów (WCAG AA)
- [ ] Dodać focus visible styles

### Faza 7: Testy i dokumentacja

#### Krok 7.1: Testy manualne
- [ ] Przetestować pełny flow widoku Konfiguracji
- [ ] Przetestować pełny flow widoku Sklepów
- [ ] Przetestować wszystkie scenariusze błędów
- [ ] Przetestować na różnych urządzeniach (desktop, tablet, mobile)
- [ ] Przetestować na różnych przeglądarkach (Chrome, Firefox, Safari)

#### Krok 7.2: Code review
- [ ] Sprawdzić zgodność z PRD i User Stories
- [ ] Sprawdzić jakość kodu (naming, struktura, comments)
- [ ] Sprawdzić obsługę błędów
- [ ] Sprawdzić performance (re-renders, bundle size)

#### Krok 7.3: Dokumentacja
- [ ] Dodać JSDoc comments do komponentów
- [ ] Dodać README z opisem architektury widoków
- [ ] Zaktualizować .ai/ui-plan.md jeśli potrzeba
- [ ] Dodać przykłady użycia custom hooks

### Faza 8: Deploy i monitoring

#### Krok 8.1: Pre-deploy checklist
- [ ] Sprawdzić czy wszystkie environment variables są ustawione
- [ ] Sprawdzić czy migracje bazy danych są wykonane
- [ ] Sprawdzić czy storage buckets są skonfigurowane
- [ ] Sprawdzić logi błędów w console

#### Krok 8.2: Deploy
- [ ] Build produkcyjny (`npm run build`)
- [ ] Deploy na staging
- [ ] Smoke tests na staging
- [ ] Deploy na production

#### Krok 8.3: Post-deploy monitoring
- [ ] Monitorować logi błędów (Sentry, etc.)
- [ ] Monitorować performance (FCP, LCP)
- [ ] Zbierać feedback od użytkowników
- [ ] Naprawić ewentualne błędy

---

## Podsumowanie

Ten plan implementacji szczegółowo opisuje wszystkie aspekty tworzenia widoków Konfiguracji i Sklepów w panelu administracyjnym DealSpy. Plan obejmuje:

1. **11 komponentów React** - od prostych (ConfigListItem) po złożone (StoresPanel)
2. **2 strony Astro** - z SSR i sprawdzaniem uprawnień
3. **3 custom hooks** - dla reużywalnej logiki biznesowej
4. **Pełną obsługę błędów** - od walidacji po network errors
5. **Responsywny design** - mobile-first approach
6. **Accessibility** - zgodność z WCAG AA
7. **68 kroków implementacji** - podzielonych na 8 faz

Implementacja powinna być wykonywana iteracyjnie, faza po fazie, z testami po każdej fazie. Szacowany czas implementacji: **3-5 dni** dla doświadczonego frontend developera.

