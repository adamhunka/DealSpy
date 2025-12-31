import { useState } from "react";
import type { StoreDTO, CreateStoreCommand, UpdateStoreCommand, ApiError } from "@/types";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Plus } from "lucide-react";
import { StoreList } from "./StoreList";
import { StoreFormDialog } from "./StoreFormDialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
} from "../ui/alert-dialog";

interface StoresPanelProps {
  initialStores: StoreDTO[];
}

export function StoresPanel({ initialStores }: StoresPanelProps) {
  const [stores, setStores] = useState<StoreDTO[]>(initialStores);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreDTO | null>(null);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [deletingStore, setDeletingStore] = useState<StoreDTO | null>(null);

  const handleAddNew = () => {
    setEditingStore(null);
    setFormMode("create");
    setIsDialogOpen(true);
  };

  const handleEdit = (store: StoreDTO) => {
    setEditingStore(store);
    setFormMode("edit");
    setIsDialogOpen(true);
  };

  const handleDelete = (store: StoreDTO) => {
    setDeletingStore(store);
  };

  const handleSave = async (data: CreateStoreCommand | UpdateStoreCommand): Promise<void> => {
    try {
      if (formMode === "create") {
        const response = await fetch("/api/admin/stores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const error: ApiError = await response.json();
          throw new Error(error.error.message || "Nie udało się dodać sklepu");
        }

        const result = await response.json();
        const newStore: StoreDTO = result.data;

        setStores([...stores, newStore]);
        toast.success("Sklep został dodany");
        handleCloseDialog();
      } else {
        if (!editingStore) {
          throw new Error("Brak sklepu do edycji");
        }

        const response = await fetch(`/api/admin/stores/${editingStore.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const error: ApiError = await response.json();
          throw new Error(error.error.message || "Nie udało się edytować sklepu");
        }

        const result = await response.json();
        const updatedStore: StoreDTO = result.data;

        setStores((prev) => prev.map((store) => (store.id === updatedStore.id ? updatedStore : store)));

        toast.success("Sklep został zaktualizowany");
        handleCloseDialog();
      }
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Wystąpił nieoczekiwany błąd");
      }
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingStore(null);
  };
  const confirmDelete = async () => {
    if (!deletingStore) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/stores/${deletingStore.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error.message || "Nie udało się usunąć sklepu");
      }

      setStores((prev) => prev.filter((s) => s.id !== deletingStore.id));
      toast.success(`Sklep "${deletingStore.name}" został usunięty`);
      setDeletingStore(null);
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Wystąpił nieoczekiwany błąd");
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Nagłówek */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Zarządzaj sklepami, ich nazwami i logotypami</p>
        </div>

        <Button onClick={handleAddNew}>
          <Plus className="mr-2 h-4 w-4" />
          Dodaj sklep
        </Button>
      </div>

      <StoreList stores={stores} onEdit={handleEdit} onDelete={handleDelete} onAddNew={handleAddNew} />
      <StoreFormDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        mode={formMode}
        store={editingStore}
        onSave={handleSave}
      />

      {/* Dialog potwierdzenia usunięcia */}
      <AlertDialog open={!!deletingStore} onOpenChange={(open) => !open && setDeletingStore(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Czy na pewno chcesz usunąć ten sklep?</AlertDialogTitle>
            <AlertDialogDescription>
              Sklep <strong>{deletingStore?.name}</strong> zostanie trwale usunięty. Tej operacji nie można cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Usuń sklep
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
