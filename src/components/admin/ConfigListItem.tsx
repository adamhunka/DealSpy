import type { ConfigDTO } from "@/types";

interface ConfigListItemProps {
  config: ConfigDTO;
  isSelected: boolean;
  onClick: () => void;
}

export function ConfigListItem({ config, isSelected, onClick }: ConfigListItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-4 rounded-lg border transition-colors ${isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-accent"}`}
    >
      <div className="font-medium">{config.key}</div>
      {config.description && <div className="text-sm text-muted-foreground mt-1">{config.description}</div>}
      <div className="text-xs text-muted-foreground mt-1">
        Zaktualizowano: {new Date(config.updated_at).toLocaleDateString("pl-PL")}
      </div>
    </button>
  );
}

export default ConfigListItem;
