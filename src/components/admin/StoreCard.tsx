import type { StoreDTO } from "@/types";
import { Button } from "../ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "../ui/card";
import { Pencil, Trash2 } from "lucide-react";

interface StoreCardProps {
  store: StoreDTO;
  onEdit: () => void;
  onDelete: () => void;
}

export function StoreCard({ store, onEdit, onDelete }: StoreCardProps) {
  return (
    <Card className="overflow-hidden">
      {/* Logo */}
      <CardHeader className="p-4 bg-muted/50">
        <div className="flex items-center justify-center h-20">
          <img
            src={store.logo_url}
            alt={`Logo ${store.name}`}
            className="max-h-full max-w-full object-contain"
            onError={(e) => {
              e.currentTarget.src = "/images/default-logo.png";
            }}
          />
        </div>
      </CardHeader>
      {/* Zawartość nazwa i slug */}
      <CardContent className="p-4">
        <h3 className="font-semibold text-lg">{store.name}</h3>
        <p className="text-sm text-muted-foreground mt-1">/{store.slug}</p>
        <p className="text-xs text-muted-foreground mt-2">
          Dodano: {new Date(store.created_at).toLocaleDateString("pl-PL")}
        </p>
      </CardContent>
      {/* Stopka z przyciskami */}
      <CardFooter className="p-4 pt-0 gap-2">
        <Button variant={"outline"} size="sm" className="flex-1" onClick={onEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          Edytuj
        </Button>
        <Button variant="destructive" size="sm" onClick={onDelete}>
          <Trash2 className="mr-2 h-4 w-4" />
          Usuń
        </Button>
      </CardFooter>
    </Card>
  );
}
