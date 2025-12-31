import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface ProcessingOptionsSectionProps {
  autoProcess: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

/**
 * ProcessingOptionsSection - sekcja z opcjami automatycznego przetwarzania AI
 *
 * Umożliwia włączenie/wyłączenie auto-process
 */
export function ProcessingOptionsSection({ autoProcess, onChange, disabled = false }: ProcessingOptionsSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Przetwarzanie</h3>

      <div className="flex items-start gap-3">
        <Checkbox
          id="autoProcess"
          checked={autoProcess}
          onCheckedChange={(checked) => onChange(checked === true)}
          disabled={disabled}
        />
        <div className="space-y-1">
          <Label
            htmlFor="autoProcess"
            className="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Automatycznie uruchom przetwarzanie AI
          </Label>
          <p className="text-sm text-gray-500">
            Po wgraniu plików system automatycznie rozpocznie rozpoznawanie produktów. Możesz to zrobić również później
            z poziomu szczegółów gazetki.
          </p>
        </div>
      </div>
    </div>
  );
}
