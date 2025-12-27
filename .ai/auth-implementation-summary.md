# System Autoryzacji - Dokumentacja Implementacji

## Przegląd

System autoryzacji dla panelu administratora DealSpy został w pełni zaimplementowany zgodnie z planem. Obejmuje logowanie, wylogowanie, ochronę tras oraz walidację danych.

## Zrealizowane Komponenty

### 1. Walidacja (Schemas)

**Plik:** `src/lib/schemas/auth.schema.ts`

- `emailSchema` - walidacja adresu email (wymagany, format email, 3-255 znaków)
- `passwordSchema` - walidacja hasła (wymagane, 6-255 znaków)
- `loginSchema` - kompletny schemat dla logowania
- `LoginCommandSchema` - type wyekstrahowany ze schematu

**Wykorzystanie:**
- Backend: `src/pages/api/auth/login.ts`
- Frontend: `src/components/admin/LoginForm.tsx`

### 2. API Endpoints

#### POST /api/auth/login
**Plik:** `src/pages/api/auth/login.ts`

**Request:**
```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Response (200 OK):**
```json
{
  "data": {
    "success": true,
    "redirect_url": "/admin"
  }
}
```

**Błędy:**
- 400 - Validation Error (nieprawidłowe dane wejściowe)
- 401 - Unauthorized (nieprawidłowy email/hasło)
- 403 - Forbidden (brak uprawnień administratora)
- 500 - Internal Server Error

**Logika:**
1. Walidacja danych przez Zod schema
2. Logowanie przez Supabase Auth (`signInWithPassword`)
3. Sprawdzenie roli użytkownika w tabeli `profiles`
4. Wylogowanie jeśli użytkownik nie ma roli `admin`
5. Zwrócenie URL przekierowania

#### POST /api/auth/logout
**Plik:** `src/pages/api/auth/logout.ts`

**Request:** Puste body

**Response (200 OK):**
```json
{
  "data": {
    "success": true,
    "redirect_url": "/admin/login"
  }
}
```

**Logika:**
1. Wywołanie `supabase.auth.signOut()`
2. Zwrócenie URL przekierowania do strony logowania

### 3. Komponenty UI

#### LoginForm.tsx
**Plik:** `src/components/admin/LoginForm.tsx`

**Funkcjonalności:**
- Zarządzanie stanem formularza (email, password, isLoading)
- Walidacja po stronie klienta używając tych samych Zod schemas co backend
- Obsługa błędów walidacji, autoryzacji i sieciowych
- Toast notifications (Sonner)
- Przekierowanie po pomyślnym logowaniu z obsługą parametru `?redirect=`

**Stan:**
```typescript
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

#### LogoutButton.tsx
**Plik:** `src/components/admin/LogoutButton.tsx`

**Funkcjonalności:**
- Przycisk wylogowania
- Wywołanie API `/api/auth/logout`
- Przekierowanie do strony logowania
- Obsługa błędów

### 4. Strony

#### /admin/login
**Plik:** `src/pages/admin/login.astro`

**Logika SSR:**
- Sprawdzenie czy użytkownik jest już zalogowany (`checkAdminAccess`)
- Przekierowanie do `/admin` jeśli jest zalogowany
- Renderowanie formularza dla niezalogowanych

**UI:**
- Nagłówek "Panel Administratora"
- Opis "Zaloguj się aby zarządzać treścią"
- Komponent `LoginForm` z dyrektywą `client:load`
- Centrowanie i responsywność (Tailwind)

#### /admin (dashboard)
**Plik:** `src/pages/admin/index.astro`

**Logika SSR:**
- Sprawdzenie uprawnień admina
- Pobranie danych profilu użytkownika
- Wyświetlenie powitania z imieniem/emailem

**UI:**
- Przycisk wylogowania (LogoutButton)
- Kafelki z linkami do sekcji panelu:
  - Sklepy (`/admin/stores`)
  - Konfiguracja (`/admin/configuration`)
  - Gazetki (placeholder - wkrótce)

### 5. Middleware

**Plik:** `src/middleware/index.ts`

**Funkcjonalności:**
- Ochrona wszystkich tras `/admin/*` (oprócz `/admin/login`)
- Sprawdzenie sesji użytkownika przez `checkAdminAccess`
- Przekierowanie do `/admin/login?redirect={current_url}` jeśli brak autoryzacji
- Zachowanie URL docelowego dla przekierowania po logowaniu

**Logika:**
```typescript
if (isAdminRoute && !isLoginPage) {
  const { isAdmin } = await checkAdminAccess(supabase);
  if (!isAdmin) {
    return redirect to login with current path
  }
}
```

### 6. Typy

**Plik:** `src/types.ts`

Dodano w sekcji "Auth Commands":
- `LoginCommand` - dane wejściowe dla logowania
- `LoginResponse` - odpowiedź z API login
- `LogoutResponse` - odpowiedź z API logout

## Przepływ Użytkownika

### Scenariusz 1: Pomyślne logowanie
1. Użytkownik otwiera `/admin/login`
2. Wpisuje email i hasło
3. Kliknięcie "Zaloguj się" → walidacja client-side
4. Wywołanie API `/api/auth/login`
5. Backend: walidacja → logowanie Supabase → sprawdzenie roli
6. Sukces: toast "Logowanie pomyślne!" → przekierowanie do `/admin`

### Scenariusz 2: Próba dostępu bez logowania
1. Użytkownik próbuje otworzyć `/admin/stores`
2. Middleware sprawdza sesję → brak autoryzacji
3. Przekierowanie do `/admin/login?redirect=/admin/stores`
4. Po zalogowaniu → przekierowanie do `/admin/stores`

### Scenariusz 3: Wylogowanie
1. Użytkownik klika "Wyloguj się" w `/admin`
2. Wywołanie API `/api/auth/logout`
3. Backend: `supabase.auth.signOut()`
4. Przekierowanie do `/admin/login`

### Scenariusz 4: Błędne dane logowania
1. Użytkownik wpisuje nieprawidłowy email/hasło
2. API zwraca 401 Unauthorized
3. Toast error: "Nieprawidłowy email lub hasło"
4. Formularz pozostaje aktywny do ponownej próby

### Scenariusz 5: Brak uprawnień admin
1. Użytkownik loguje się kontem bez roli admin
2. Backend sprawdza rolę → nie jest adminem
3. Backend wylogowuje użytkownika
4. API zwraca 403 Forbidden
5. Toast error: "Brak uprawnień administratora"

## Obsługa Błędów

### Client-side
- Walidacja przed wysłaniem (Zod schemas)
- Błędy wyświetlane pod polami formularza
- Toast notifications dla błędów ogólnych
- Logowanie błędów do konsoli (development)

### Server-side
- Walidacja wszystkich danych wejściowych (Zod)
- Standardowe kody błędów HTTP
- Ustandaryzowane odpowiedzi przez `createErrorResponse`
- Logowanie błędów krytycznych do konsoli

### Typy błędów
- **VALIDATION_ERROR (400)** - nieprawidłowe dane wejściowe
- **UNAUTHORIZED (401)** - nieprawidłowe dane logowania
- **FORBIDDEN (403)** - brak uprawnień administratora
- **INTERNAL_SERVER_ERROR (500)** - błąd serwera/bazy danych

## Bezpieczeństwo

### Implementowane praktyki:
1. ✅ Server-side session validation w middleware
2. ✅ Sprawdzanie roli użytkownika w bazie danych
3. ✅ Automatyczne wylogowanie przy braku uprawnień
4. ✅ Walidacja danych po stronie serwera (Zod)
5. ✅ Bezpieczne przekierowywania (nie ujawniają informacji)
6. ✅ Odpowiednie kody HTTP dla różnych błędów
7. ✅ Logowanie błędów bez ujawniania szczegółów użytkownikowi

## Testowanie

### Build Status
✅ Projekt kompiluje się bez błędów  
✅ Wszystkie komponenty zostały zbudowane  
✅ Brak błędów ESLint

### Pliki do przetestowania manualnie:
1. `/admin/login` - formularz logowania
2. `/admin` - dashboard (wymaga logowania)
3. `/admin/stores` - test przekierowania
4. `/admin/configuration` - test przekierowania
5. Próba dostępu bez logowania
6. Wylogowanie z dashboardu

## Zgodność z Planem Implementacji

| Krok | Status | Opis |
|------|--------|------|
| 1. API endpoint login | ✅ | Walidacja, auth, role check |
| 2. Komponent LoginForm | ✅ | Stan, walidacja, API call, errors |
| 3. Strona LoginPage | ✅ | SSR check, redirect, layout |
| 4. Middleware | ✅ | Ochrona tras `/admin/*` |
| 5. Logout endpoint | ✅ | API + komponent przycisku |
| 6. Testowanie | ✅ | Build OK, ready for manual tests |

## Dodatkowe Usprawnienia

Poza planem zostały zaimplementowane:
- **Centralizacja walidacji** - schemas w osobnym pliku
- **LogoutButton** - komponent do wylogowania
- **Dashboard** - strona główna `/admin` z nawigacją
- **Wspólne schemas** - client i server używają tych samych reguł walidacji

