# Plan implementacji widoku Logowania Administratora

## 1. Przegląd

Widok logowania administratora stanowi punkt wejścia do panelu administracyjnego aplikacji DealSpy. Jego głównym celem jest zapewnienie bezpiecznego uwierzytelnienia użytkowników z rolą administratora poprzez formularz logowania email/hasło wykorzystujący Supabase Auth. Widok zawiera obsługę przekierowań dla już zalogowanych użytkowników, walidację danych wejściowych oraz przyjazne komunikaty błędów.

## 2. Routing widoku

### Ścieżka podstawowa
- **URL:** `/admin/login`
- **Typ:** Strona SSR (Astro)

### Logika przekierowań
1. **Jeśli użytkownik jest już zalogowany jako admin:**
   - Przekierowanie do `/admin` (dashboard administratora)
2. **Po pomyślnym logowaniu:**
   - Przekierowanie do `/admin` lub do URL zapisanego w parametrze `redirect` (jeśli istnieje)
3. **Próba dostępu do `/admin/*` bez autoryzacji:**
   - Przekierowanie do `/admin/login?redirect=/admin/*` (zachowanie docelowego URL)

## 3. Struktura komponentów

```
LoginPage.astro (strona główna)
├── Layout.astro (layout aplikacji)
└── LoginForm.tsx (React, formularz logowania)
```

### Hierarchia
- `LoginPage.astro` - Strona Astro odpowiedzialna za SSR, sprawdzanie sesji i renderowanie layoutu
- `LoginForm.tsx` - Interaktywny komponent React zawierający formularz i logikę logowania

## 4. Szczegóły komponentów

### LoginPage.astro

**Opis:** Strona Astro działająca jako wrapper dla formularza logowania. Odpowiada za weryfikację sesji po stronie serwera i przekierowanie zalogowanych użytkowników.

**Główne elementy:**
- Import `Layout.astro` jako wrapper strony
- Script po stronie serwera sprawdzający sesję użytkownika
- Sekcja HTML z nagłówkiem i komponentem `LoginForm`
- Stylizacja Tailwind dla centrowania i responsywności

**Obsługiwane zdarzenia:**
- Brak (logika SSR wykonywana przed renderowaniem)

**Warunki walidacji:**
- Sprawdzenie sesji Supabase (`supabase.auth.getSession()`)
- Jeśli sesja istnieje i użytkownik ma rolę admin → redirect do `/admin`

**Typy:**
- `SupabaseClient` - klient Supabase z `context.locals`
- `AdminAccessResult` - wynik sprawdzenia dostępu admina (z `auth.helper.ts`)

**Propsy:**
- Brak (Astro page)

**Kod Astro (server-side):**
```typescript
---
import Layout from '@/layouts/Layout.astro';
import LoginForm from '@/components/admin/LoginForm.tsx';
import { checkAdminAccess } from '@/lib/helpers/auth.helper.ts';

const supabase = Astro.locals.supabase;

// Sprawdź czy użytkownik jest już zalogowany
const { isAdmin } = await checkAdminAccess(supabase);

// Jeśli użytkownik jest już zalogowany jako admin, przekieruj do dashboardu
if (isAdmin) {
  return Astro.redirect('/admin');
}
---

<Layout title="Logowanie - Panel Administratora">
  <main class="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
    <div class="w-full max-w-md space-y-8">
      <div>
        <h1 class="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
          Panel Administratora
        </h1>
        <p class="mt-2 text-center text-sm text-gray-600">
          Zaloguj się aby zarządzać treścią
        </p>
      </div>
      
      <LoginForm client:load />
    </div>
  </main>
</Layout>
```

---

### LoginForm.tsx

**Opis:** Interaktywny komponent React zawierający formularz logowania. Obsługuje wprowadzanie danych, walidację, wysyłanie żądania do Supabase Auth oraz wyświetlanie komunikatów o błędach i sukcesie.

**Główne elementy:**
- Formularz (`<form>`) z dwoma polami input (email, hasło)
- Komponent `Input` z Shadcn/ui dla stylizowanych pól
- Komponent `Label` z Shadcn/ui dla etykiet
- Komponent `Button` z Shadcn/ui dla przycisku submit
- Alert/Toast do wyświetlania błędów (Sonner)
- Stan formularza (email, hasło, loading, błędy)

**Obsługiwane interakcje:**
1. **onChange dla pól input** - Aktualizacja stanu formularza
2. **onSubmit formularza** - Walidacja i wysłanie żądania logowania
3. **onClick na przycisku** - Trigger submit formularza

**Obsługiwana walidacja:**
1. **Email:**
   - Wymagane pole
   - Format email (regex lub HTML5 validation)
   - Min. 3 znaki
2. **Hasło:**
   - Wymagane pole
   - Min. 6 znaków
3. **Walidacja przed submit:**
   - Sprawdzenie czy wszystkie pola są wypełnione
   - Sprawdzenie czy email ma poprawny format

**Typy:**
- `LoginFormState` - stan formularza
- `LoginFormErrors` - błędy walidacji
- `SupabaseAuthError` - typ błędu z Supabase Auth

**Propsy:**
- Brak (standalone component)

**Interfejs komponentu:**
```typescript
interface LoginFormProps {}

interface LoginFormState {
  email: string;
  password: string;
  isLoading: boolean;
}

interface LoginFormErrors {
  email?: string;
  password?: string;
  general?: string;
}
```

**Struktura komponentu:**
```tsx
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function LoginForm() {
  const [formState, setFormState] = useState<LoginFormState>({
    email: '',
    password: '',
    isLoading: false,
  });
  
  const [errors, setErrors] = useState<LoginFormErrors>({});

  const validateForm = (): boolean => {
    // Walidacja pól
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Walidacja
    if (!validateForm()) {
      return;
    }
    
    setFormState(prev => ({ ...prev, isLoading: true }));
    
    try {
      // Wywołanie Supabase Auth
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formState.email,
          password: formState.password,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      
      // Sukces - przekierowanie
      const urlParams = new URLSearchParams(window.location.search);
      const redirectUrl = urlParams.get('redirect') || '/admin';
      window.location.href = redirectUrl;
      
    } catch (error) {
      // Obsługa błędów
      toast.error(error.message || 'Wystąpił błąd podczas logowania');
      setErrors({ general: error.message });
    } finally {
      setFormState(prev => ({ ...prev, isLoading: false }));
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
          onChange={(e) => setFormState(prev => ({ ...prev, email: e.target.value }))}
          className="mt-1"
          disabled={formState.isLoading}
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-600">{errors.email}</p>
        )}
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
          onChange={(e) => setFormState(prev => ({ ...prev, password: e.target.value }))}
          className="mt-1"
          disabled={formState.isLoading}
        />
        {errors.password && (
          <p className="mt-1 text-sm text-red-600">{errors.password}</p>
        )}
      </div>

      {/* General error */}
      {errors.general && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{errors.general}</p>
        </div>
      )}

      {/* Submit button */}
      <Button
        type="submit"
        className="w-full"
        disabled={formState.isLoading}
      >
        {formState.isLoading ? 'Logowanie...' : 'Zaloguj się'}
      </Button>
    </form>
  );
}
```

## 5. Typy

### Typy interfejsu użytkownika

```typescript
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
 * Command do logowania - dane wysyłane do API
 */
interface LoginCommand {
  email: string;
  password: string;
}

/**
 * Response z API logowania
 */
interface LoginResponse {
  success: boolean;
  redirect_url?: string;
  error?: {
    code: string;
    message: string;
  };
}
```

### Typy z auth.helper.ts (istniejące)

```typescript
interface AdminAccessResult {
  isAdmin: boolean;
  userId: string | null;
  error?: "UNAUTHORIZED" | "FORBIDDEN";
}
```

### Typy Supabase Auth (z biblioteki)

```typescript
// Z @supabase/supabase-js
import type { AuthError, Session, User } from '@supabase/supabase-js';
```

## 6. Zarządzanie stanem

### Stan lokalny w LoginForm

Zarządzanie stanem odbywa się za pomocą React hooks (`useState`) bezpośrednio w komponencie `LoginForm.tsx`:

1. **formState** - stan formularza:
   - `email: string` - wartość pola email
   - `password: string` - wartość pola hasło
   - `isLoading: boolean` - czy trwa proces logowania

2. **errors** - błędy walidacji i autoryzacji:
   - `email?: string` - błąd pola email
   - `password?: string` - błąd pola hasło
   - `general?: string` - ogólny błąd logowania

### Nie jest wymagany custom hook

Ze względu na prostotę widoku logowania (jeden formularz, brak współdzielenia stanu), nie ma potrzeby tworzenia dedykowanego hooka. Cała logika jest zawarta w komponencie `LoginForm.tsx`.

### Przepływ stanu

1. Użytkownik wpisuje dane → aktualizacja `formState`
2. Submit formularza → walidacja → `isLoading = true`
3. Wywołanie API → oczekiwanie na response
4. Sukces → przekierowanie (stan nie jest resetowany)
5. Błąd → `errors.general` = komunikat, `isLoading = false`

## 7. Integracja API

### Endpoint logowania

**Metoda:** POST  
**Ścieżka:** `/api/auth/login`  
**Content-Type:** `application/json`

### Request

**Typ:** `LoginCommand`

```typescript
interface LoginCommand {
  email: string;
  password: string;
}
```

**Przykład:**
```json
{
  "email": "admin@dealspy.com",
  "password": "SecurePassword123"
}
```

### Response

#### Sukces (200 OK)

**Typ:** `LoginResponse`

```typescript
interface LoginResponse {
  success: true;
  redirect_url: string;
}
```

**Przykład:**
```json
{
  "success": true,
  "redirect_url": "/admin"
}
```

#### Błąd (401 Unauthorized)

**Typ:** `ApiError`

```typescript
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Nieprawidłowy email lub hasło"
  }
}
```

#### Błąd (400 Bad Request - walidacja)

```typescript
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Nieprawidłowe dane wejściowe",
    "details": [
      {
        "field": "email",
        "message": "Nieprawidłowy format email"
      }
    ]
  }
}
```

### Implementacja endpointu API

**Plik:** `src/pages/api/auth/login.ts`

```typescript
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { createErrorResponse, createSuccessResponse } from '@/lib/helpers/api-response.helper';

const loginSchema = z.object({
  email: z.string().email('Nieprawidłowy format email'),
  password: z.string().min(6, 'Hasło musi mieć minimum 6 znaków'),
});

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  try {
    const body = await request.json();
    
    // Walidacja
    const result = loginSchema.safeParse(body);
    if (!result.success) {
      return createErrorResponse(
        'VALIDATION_ERROR',
        'Nieprawidłowe dane wejściowe',
        400,
        result.error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
        }))
      );
    }
    
    const { email, password } = result.data;
    const supabase = locals.supabase;
    
    // Logowanie przez Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      return createErrorResponse(
        'UNAUTHORIZED',
        'Nieprawidłowy email lub hasło',
        401
      );
    }
    
    // Sprawdź rolę użytkownika
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();
    
    if (profile?.role !== 'admin') {
      // Wyloguj użytkownika jeśli nie jest adminem
      await supabase.auth.signOut();
      return createErrorResponse(
        'FORBIDDEN',
        'Brak uprawnień administratora',
        403
      );
    }
    
    // Sukces
    return createSuccessResponse({
      success: true,
      redirect_url: '/admin',
    });
    
  } catch (error) {
    return createErrorResponse(
      'INTERNAL_SERVER_ERROR',
      'Wystąpił błąd serwera',
      500
    );
  }
};
```

### Wykorzystanie w komponencie

```typescript
// W LoginForm.tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  setFormState(prev => ({ ...prev, isLoading: true }));
  setErrors({});
  
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: formState.email,
        password: formState.password,
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'Błąd logowania');
    }
    
    // Sukces - przekierowanie
    window.location.href = data.data.redirect_url;
    
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Wystąpił błąd');
    setErrors({ general: error instanceof Error ? error.message : 'Wystąpił błąd' });
  } finally {
    setFormState(prev => ({ ...prev, isLoading: false }));
  }
};
```

## 8. Interakcje użytkownika

### Scenariusz 1: Pomyślne logowanie

1. Użytkownik otwiera `/admin/login`
2. Widzi formularz z polami email i hasło
3. Wpisuje poprawne dane logowania
4. Klika przycisk "Zaloguj się"
5. Przycisk zmienia tekst na "Logowanie..." i jest disabled
6. System wysyła żądanie do API
7. Po otrzymaniu odpowiedzi użytkownik jest przekierowywany do `/admin`
8. Sesja jest zachowana w cookies/localStorage

### Scenariusz 2: Błędne dane logowania

1. Użytkownik wpisuje niepoprawny email lub hasło
2. Klika przycisk "Zaloguj się"
3. System wysyła żądanie do API
4. API zwraca błąd 401
5. Wyświetla się komunikat błędu: "Nieprawidłowy email lub hasło"
6. Pola formularza pozostają wypełnione
7. Przycisk wraca do stanu aktywnego
8. Użytkownik może poprawić dane i spróbować ponownie

### Scenariusz 3: Walidacja po stronie klienta

1. Użytkownik próbuje submit formularza bez wypełnienia pól
2. HTML5 validation wyświetla natywny komunikat "To pole jest wymagane"
3. Użytkownik wpisuje niepoprawny format email (np. "test")
4. HTML5 validation wyświetla "Wprowadź poprawny adres email"
5. Żądanie do API nie jest wysyłane

### Scenariusz 4: Próba dostępu będąc już zalogowanym

1. Zalogowany administrator próbuje otworzyć `/admin/login`
2. Middleware SSR sprawdza sesję
3. Użytkownik jest automatycznie przekierowywany do `/admin`
4. Formularz logowania nie jest renderowany

### Scenariusz 5: Przekierowanie po logowaniu

1. Niezalogowany użytkownik próbuje wejść na `/admin/stores`
2. Middleware przekierowuje do `/admin/login?redirect=/admin/stores`
3. Użytkownik loguje się pomyślnie
4. Jest przekierowywany do `/admin/stores` (zapisany URL)

### Scenariusz 6: Błąd serwera

1. Użytkownik wypełnia formularz i klika "Zaloguj się"
2. Następuje błąd połączenia lub błąd serwera (500)
3. Wyświetla się toast z komunikatem: "Wystąpił błąd serwera. Spróbuj ponownie później"
4. Formularz wraca do stanu aktywnego

## 9. Warunki i walidacja

### Walidacja po stronie klienta (LoginForm.tsx)

#### Email
- **Pole wymagane:** `required` attribute w HTML
- **Format email:** `type="email"` zapewnia podstawową walidację przeglądarki
- **Długość:** Min. 3 znaki (dodatkowa walidacja JS)
- **Sprawdzenie przed submit:** Regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- **Komunikat błędu:** "Wprowadź poprawny adres email"

#### Hasło
- **Pole wymagane:** `required` attribute w HTML
- **Długość:** Min. 6 znaków
- **Sprawdzenie przed submit:** `password.length >= 6`
- **Komunikat błędu:** "Hasło musi mieć minimum 6 znaków"

#### Funkcja walidacji

```typescript
const validateForm = (): boolean => {
  const newErrors: LoginFormErrors = {};
  
  // Walidacja email
  if (!formState.email) {
    newErrors.email = 'Email jest wymagany';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.email)) {
    newErrors.email = 'Nieprawidłowy format email';
  }
  
  // Walidacja hasła
  if (!formState.password) {
    newErrors.password = 'Hasło jest wymagane';
  } else if (formState.password.length < 6) {
    newErrors.password = 'Hasło musi mieć minimum 6 znaków';
  }
  
  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};
```

### Walidacja po stronie serwera (API endpoint)

#### Zod Schema

```typescript
const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email jest wymagany' })
    .email('Nieprawidłowy format email')
    .min(3, 'Email musi mieć minimum 3 znaki')
    .max(255, 'Email jest zbyt długi'),
  password: z
    .string({ required_error: 'Hasło jest wymagane' })
    .min(6, 'Hasło musi mieć minimum 6 znaków')
    .max(255, 'Hasło jest zbyt długie'),
});
```

### Warunki dostępu (LoginPage.astro - SSR)

#### Sprawdzenie sesji przy załadowaniu strony
```typescript
const { isAdmin } = await checkAdminAccess(supabase);

if (isAdmin) {
  return Astro.redirect('/admin');
}
```

**Wpływ na UI:**
- Jeśli użytkownik jest zalogowany → strona nie jest renderowana, następuje redirect
- Jeśli użytkownik nie jest zalogowany → renderuje się formularz

### Warunki UI (LoginForm.tsx)

#### Disabled state
- **Pola input:** Disabled gdy `isLoading === true`
- **Przycisk submit:** Disabled gdy `isLoading === true`

#### Loading state
- **Tekst przycisku:** Zmienia się z "Zaloguj się" na "Logowanie..."
- **Trigger:** `isLoading === true`

#### Error state
- **Display błędów:** Wyświetlane gdy `errors.email` lub `errors.password` lub `errors.general` są ustawione
- **Style:** Czerwony tekst pod polami, czerwone tło dla błędu ogólnego

## 10. Obsługa błędów

### Błędy walidacji (client-side)

**Typ błędu:** Brak wypełnienia wymaganych pól  
**Obsługa:** HTML5 validation + custom validation function  
**Komunikat:** Pod polem z błędem  
**Akcja:** Użytkownik poprawia dane i próbuje ponownie

**Typ błędu:** Nieprawidłowy format email  
**Obsługa:** HTML5 validation + regex check  
**Komunikat:** "Nieprawidłowy format email"  
**Akcja:** Użytkownik poprawia email

**Typ błędu:** Za krótkie hasło  
**Obsługa:** Custom validation function  
**Komunikat:** "Hasło musi mieć minimum 6 znaków"  
**Akcja:** Użytkownik wprowadza dłuższe hasło

### Błędy autoryzacji (API)

**Typ błędu:** 401 Unauthorized - Nieprawidłowe dane logowania  
**Obsługa:** Try-catch w handleSubmit  
**Komunikat:** "Nieprawidłowy email lub hasło" (toast + general error)  
**Akcja:** Użytkownik sprawdza dane i próbuje ponownie

**Typ błędu:** 403 Forbidden - Brak uprawnień administratora  
**Obsługa:** Try-catch w handleSubmit  
**Komunikat:** "Brak uprawnień administratora"  
**Akcja:** Użytkownik nie może się zalogować, potrzebuje nadania roli admin

### Błędy walidacji (API)

**Typ błędu:** 400 Bad Request - Validation error  
**Obsługa:** Try-catch w handleSubmit, parsowanie details  
**Komunikat:** Szczegółowe komunikaty pod odpowiednimi polami  
**Akcja:** Użytkownik poprawia dane zgodnie z komunikatami

### Błędy sieciowe i serwerowe

**Typ błędu:** Network error (brak internetu, timeout)  
**Obsługa:** Catch error w fetch  
**Komunikat:** "Sprawdź połączenie z internetem i spróbuj ponownie"  
**Akcja:** Użytkownik sprawdza internet i retry

**Typ błędu:** 500 Internal Server Error  
**Obsługa:** Try-catch w handleSubmit  
**Komunikat:** "Wystąpił błąd serwera. Spróbuj ponownie później"  
**Akcja:** Użytkownik czeka i próbuje później, admin sprawdza logi

**Typ błędu:** Supabase Auth service unavailable (503)  
**Obsługa:** Try-catch w handleSubmit  
**Komunikat:** "Usługa tymczasowo niedostępna. Spróbuj ponownie za chwilę"  
**Akcja:** Użytkownik czeka i retry

### Struktura obsługi błędów

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  // Walidacja client-side
  if (!validateForm()) {
    return;
  }
  
  setFormState(prev => ({ ...prev, isLoading: true }));
  setErrors({});
  
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: formState.email,
        password: formState.password,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      
      // Obsługa błędów walidacji
      if (errorData.error?.code === 'VALIDATION_ERROR' && errorData.error?.details) {
        const newErrors: LoginFormErrors = {};
        errorData.error.details.forEach((detail: ErrorDetail) => {
          if (detail.field === 'email') newErrors.email = detail.message;
          if (detail.field === 'password') newErrors.password = detail.message;
        });
        setErrors(newErrors);
        return;
      }
      
      // Obsługa innych błędów
      throw new Error(errorData.error?.message || 'Wystąpił błąd podczas logowania');
    }
    
    const data = await response.json();
    
    // Sukces - przekierowanie
    toast.success('Logowanie pomyślne!');
    
    setTimeout(() => {
      window.location.href = data.data.redirect_url;
    }, 500);
    
  } catch (error) {
    // Obsługa błędów sieciowych i nieoczekiwanych
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Wystąpił nieoczekiwany błąd';
    
    toast.error(errorMessage);
    setErrors({ general: errorMessage });
    
    // Logowanie błędu dla debugowania
    console.error('Login error:', error);
    
  } finally {
    setFormState(prev => ({ ...prev, isLoading: false }));
  }
};
```

### Logowanie błędów

W przypadku błędów krytycznych (500, service unavailable):
1. Błąd jest logowany do konsoli po stronie klienta
2. Błąd jest logowany przez API endpoint po stronie serwera
3. Admin może sprawdzić logi serwera w przypadku problemów

## 11. Kroki implementacji

### Krok 1: Utworzenie API endpoint logowania
1. Utwórz plik `src/pages/api/auth/login.ts`
2. Zaimplementuj schema walidacji Zod dla email i hasła
3. Dodaj logikę logowania przez Supabase Auth (`signInWithPassword`)
4. Dodaj sprawdzenie roli użytkownika w tabeli `profiles`
5. Zwróć odpowiedź sukcesu lub błędu zgodnie z formatem API

### Krok 2: Utworzenie komponentu LoginForm
1. Utwórz plik `src/components/admin/LoginForm.tsx`
2. Zaimportuj komponenty UI z Shadcn (Input, Label, Button)
3. Zdefiniuj interfejsy `LoginFormState` i `LoginFormErrors`
4. Dodaj state management używając `useState`
5. Zaimplementuj funkcję `validateForm()`
6. Zaimplementuj funkcję `handleSubmit()` z wywołaniem API
7. Zbuduj JSX z formularzem i obsługą błędów
8. Dodaj style Tailwind dla layoutu i responsywności

### Krok 3: Utworzenie strony LoginPage
1. Utwórz plik `src/pages/admin/login.astro`
2. Dodaj import `Layout.astro` i `LoginForm.tsx`
3. W sekcji frontmatter (---) dodaj logikę SSR:
   - Pobierz `supabase` z `Astro.locals`
   - Wywołaj `checkAdminAccess()`
   - Jeśli użytkownik jest adminem, dodaj `return Astro.redirect('/admin')`
4. Zbuduj HTML z nagłówkiem i wrapperem dla formularza
5. Dodaj `LoginForm` z dyrektywą `client:load`
6. Stylizuj stronę używając Tailwind (centrowanie, spacing)

### Krok 4: Aktualizacja middleware (opcjonalne)
1. Otwórz `src/middleware/index.ts`
2. Dodaj logikę sprawdzania dostępu do `/admin/*` routes:
   - Jeśli ścieżka zaczyna się od `/admin/` (z wyłączeniem `/admin/login`)
   - Sprawdź sesję użytkownika
   - Jeśli brak sesji → redirect do `/admin/login?redirect={current_url}`
3. Zapisz zmiany

### Krok 5: Dodanie typów do types.ts
1. Otwórz `src/types.ts`
2. Dodaj interfejsy w sekcji Command Models lub nowej sekcji Auth:
   - `LoginCommand`
   - `LoginResponse`
   - `LoginFormState` (opcjonalnie, może być lokalny w komponencie)
   - `LoginFormErrors` (opcjonalnie, może być lokalny w komponencie)
3. Zapisz plik

### Krok 6: Konfiguracja Sonner toast
1. Upewnij się, że `Toaster` z Sonner jest dodany do `Layout.astro`
2. Jeśli nie istnieje, dodaj:
   ```tsx
   import { Toaster } from '@/components/ui/sonner';
   
   // W body:
   <Toaster position="top-right" />
   ```
