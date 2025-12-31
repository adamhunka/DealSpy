import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface FormActionsProps {
  onSubmit: () => void;
  onCancel: () => void;
  canSubmit: boolean;
  isLoading: boolean;
}

/**
 * FormActions - sekcja z przyciskami akcji (Submit, Anuluj)
 *
 * Obsługuje submit i anulowanie formularza
 */
export function FormActions({ onSubmit, onCancel, canSubmit, isLoading }: FormActionsProps) {
  return (
    <div className="flex items-center justify-end gap-3 border-t pt-6">
      <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
        Anuluj
      </Button>
      <Button type="button" onClick={onSubmit} disabled={!canSubmit || isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Tworzenie...
          </>
        ) : (
          "Utwórz gazetkę"
        )}
      </Button>
    </div>
  );
}
