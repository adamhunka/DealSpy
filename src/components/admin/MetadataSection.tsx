import type { StoreOption } from "@/types";
import { StoreSelector } from "./StoreSelector";
import { DateRangeInputs } from "./DateRangeInputs";

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
  disabled?: boolean;
}

/**
 * MetadataSection - sekcja z metadanymi gazetki
 *
 * Zawiera wybór sklepu i zakres dat ważności
 */
export function MetadataSection({
  stores,
  selectedStoreId,
  onStoreChange,
  validFrom,
  validTo,
  onDateRangeChange,
  errors,
  disabled = false,
}: MetadataSectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Informacje podstawowe</h3>
        <p className="mt-1 text-sm text-gray-500">Określ sklep i okres ważności promocji.</p>
      </div>

      {/* Wybór sklepu */}
      <StoreSelector
        stores={stores}
        selectedStoreId={selectedStoreId}
        onChange={onStoreChange}
        error={errors?.store}
        disabled={disabled}
      />

      {/* Zakres dat */}
      <DateRangeInputs
        validFrom={validFrom}
        validTo={validTo}
        onChange={onDateRangeChange}
        errors={{
          validFrom: errors?.validFrom,
          validTo: errors?.validTo,
          dateRange: errors?.dateRange,
        }}
        disabled={disabled}
      />
    </div>
  );
}

