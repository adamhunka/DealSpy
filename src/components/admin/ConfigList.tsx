import type { ConfigDTO } from "@/types";
import ConfigListItem from "./ConfigListItem.tsx";

interface ConfigListProps {
  configs: ConfigDTO[];
  selectedKey: string | null;
  onSelect: (config: ConfigDTO) => void;
}

export function ConfigList({ configs, selectedKey, onSelect }: ConfigListProps) {
  if (configs.length === 0) {
    return <div className="text-muted-foreground text-center py-8">Brak konfiguracji</div>;
  }

  return (
    <div className="space-y-2">
      {configs.map((config) => (
        <ConfigListItem
          key={config.key}
          config={config}
          isSelected={selectedKey === config.key}
          onClick={() => onSelect(config)}
        />
      ))}
    </div>
  );
}

export default ConfigList;
