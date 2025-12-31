import type { StoreOption } from "@/types";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface StoreSelectorProps {
  stores: StoreOption[];
  selectedStoreId: string | null;
  onChange: (storeId: string) => void;
  error?: string;
  disabled?: boolean;
}

/**
 * StoreSelector - dropdown do wyboru sklepu
 *
 * Wyświetla listę dostępnych sklepów
 */
export function StoreSelector({ stores, selectedStoreId, onChange, error, disabled = false }: StoreSelectorProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="store">
        Sklep <span className="text-red-500">*</span>
      </Label>
      <Select value={selectedStoreId || undefined} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger
          id="store"
          className={error ? "border-red-500" : ""}
          aria-invalid={!!error}
          aria-describedby={error ? "store-error" : undefined}
        >
          <SelectValue placeholder="Wybierz sklep" />
        </SelectTrigger>
        <SelectContent>
          {stores.map((store) => (
            <SelectItem key={store.id} value={store.id}>
              <div className="flex items-center gap-2">
                {store.logo_url && <img src={store.logo_url} alt={store.name} className="h-5 w-5 object-contain" />}
                <span>{store.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <p id="store-error" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
