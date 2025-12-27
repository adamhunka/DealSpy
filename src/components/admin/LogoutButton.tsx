import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Komponent przycisku wylogowania
 *
 * Wylogowuje użytkownika i przekierowuje do strony logowania
 */
export default function LogoutButton() {
  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error("Błąd wylogowania");
      }

      const data = await response.json();

      // Przekieruj do strony logowania
      window.location.href = data.data.redirect_url;
    } catch (error) {
      toast.error("Wystąpił błąd podczas wylogowania");
      // eslint-disable-next-line no-console
      console.error("Logout error:", error);
    }
  };

  return (
    <Button variant="outline" onClick={handleLogout}>
      Wyloguj się
    </Button>
  );
}
