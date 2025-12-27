import { useState } from "react";
import type { ApiResponse, ConfigDTO, UpdateConfigCommand } from "@/types";
import { ConfigList } from "./ConfigList";
import { toast } from "sonner";
import { ConfigEditor } from "./ConfigEditor";

interface ConfigurationPanelProps {
  initialConfigs: ConfigDTO[];
}

async function updateConfig(key: string, data: UpdateConfigCommand): Promise<ConfigDTO> {
  const response = await fetch(`/api/admin/config/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const json: ApiResponse<ConfigDTO> = await response.json();
  return json.data;
}

export function ConfigurationPanel({ initialConfigs }: ConfigurationPanelProps) {
  const [configs, setConfigs] = useState<ConfigDTO[]>(initialConfigs);
  const [selectedConfig, setSelectedConfig] = useState<ConfigDTO | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const handleSelectConfig = (config: ConfigDTO) => {
    setSelectedConfig(config);
    setIsEditing(true);
  };

  const handleSaveConfig = async (key: string, data: UpdateConfigCommand) => {
    try {
      const updated = await updateConfig(key, data);
      setConfigs((prev) => prev.map((config) => (config.key === key ? updated : config)));
      setSelectedConfig(updated);

      toast.success("Konfiguracja zaktualizowana pomyślnie");
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error saving config:", error);
      toast.error("Błąd podczas aktualizacji konfiguracji");
      throw error;
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setSelectedConfig(null);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <ConfigList configs={configs} selectedKey={selectedConfig?.key ?? null} onSelect={handleSelectConfig} />

      {isEditing && selectedConfig && (
        <ConfigEditor config={selectedConfig} onSave={handleSaveConfig} onCancel={handleCancelEdit} />
      )}
    </div>
  );
}

export default ConfigurationPanel;
