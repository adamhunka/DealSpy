import type { StoreDTO } from "@/types";
import { StoreCard } from "./StoreCard";
import { Button } from "../ui/button";
import { Store } from "lucide-react";

interface StoreListProps {
  stores: StoreDTO[];
  onEdit: (store: StoreDTO) => void;
  onDelete: (store: StoreDTO) => void;
  onAddNew: () => void;
}

export function StoreList({ stores, onEdit, onDelete, onAddNew }: StoreListProps) {
  if (stores.length === 0) {
    return (
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
        <div className="flex flex-col items-center gap-4">
          <Store className="h-12 w-12 text-gray-400" />
          <div>
            <h3 className="font-semibold text-lg">Brak sklepów</h3>
            <p className="text-sm text-muted-foreground mt-1">Dodaj pierwszy sklep aby rozpocząć</p>
          </div>
          <Button onClick={onAddNew}>Dodaj pierwszy sklep</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {stores.map((store) => (
        <StoreCard
          key={store.id} // WAŻNE: key musi być unikalny!
          store={store}
          onEdit={() => onEdit(store)} // Przekazujemy konkretny sklep
          onDelete={() => onDelete(store)} // Przekazujemy konkretny sklep
        />
      ))}
    </div>
  );
}
