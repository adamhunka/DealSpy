import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

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

/**
 * DateRangeInputs - para pól input type="date" dla zakresu ważności gazetki
 *
 * Obsługuje wybór dat i walidację zakresu
 */
export function DateRangeInputs({ validFrom, validTo, onChange, errors, disabled = false }: DateRangeInputsProps) {
  const handleValidFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value, validTo);
  };

  const handleValidToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(validFrom, e.target.value);
  };

  const hasError = errors?.validFrom || errors?.validTo || errors?.dateRange;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Data od */}
        <div className="space-y-2">
          <Label htmlFor="validFrom">
            Data od <span className="text-red-500">*</span>
          </Label>
          <Input
            id="validFrom"
            type="date"
            value={validFrom}
            onChange={handleValidFromChange}
            disabled={disabled}
            className={errors?.validFrom ? "border-red-500" : ""}
            aria-invalid={!!errors?.validFrom}
            aria-describedby={errors?.validFrom ? "validFrom-error" : undefined}
          />
          {errors?.validFrom && (
            <p id="validFrom-error" className="text-sm text-red-600">
              {errors.validFrom}
            </p>
          )}
        </div>

        {/* Data do */}
        <div className="space-y-2">
          <Label htmlFor="validTo">
            Data do <span className="text-red-500">*</span>
          </Label>
          <Input
            id="validTo"
            type="date"
            value={validTo}
            onChange={handleValidToChange}
            disabled={disabled}
            className={errors?.validTo || errors?.dateRange ? "border-red-500" : ""}
            aria-invalid={!!(errors?.validTo || errors?.dateRange)}
            aria-describedby={errors?.validTo || errors?.dateRange ? "validTo-error" : undefined}
          />
          {errors?.validTo && (
            <p id="validTo-error" className="text-sm text-red-600">
              {errors.validTo}
            </p>
          )}
        </div>
      </div>

      {/* Błąd zakresu dat (wyświetlany pod oboma polami) */}
      {errors?.dateRange && !errors?.validFrom && !errors?.validTo && (
        <p className="text-sm text-red-600">{errors.dateRange}</p>
      )}
    </div>
  );
}
