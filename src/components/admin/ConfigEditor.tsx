import type { ConfigDTO, ErrorDetail } from "@/types";
import type { UpdateConfigCommand } from "@/types";
import { useState } from "react";

interface ConfigEditorProps {
  config: ConfigDTO;
  onSave: (key: string, data: UpdateConfigCommand) => Promise<void>;
  onCancel: () => void;
}

export function ConfigEditor({ config, onSave, onCancel }: ConfigEditorProps) {
  const [value, setValue] = useState(JSON.stringify(config.value, null, 2));
  const [description, setDescription] = useState(config.description ?? "");
  const [errors, setErrors] = useState<ErrorDetail[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const validateJson = (text: string): boolean => {
    try {
      JSON.parse(text);
      setJsonError(null);
      return true;
    } catch (e) {
      setJsonError((e as Error).message);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateJson(value)) {
      return;
    }

    setIsSaving(true);

    try {
      const dataToSave: UpdateConfigCommand = {
        value: JSON.parse(value),
        description: description || undefined,
      };

      await onSave(config.key, dataToSave);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error saving config:", error);
      setErrors([{ field: "general", message: "Błąd podczas zapisywania konfiguracji" }]);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg">
      <h3 className="text-lg font-semiblod"> Edycja: {config.key}</h3>

      <div className="space-y-2">
        <label htmlFor="config-value" className="text-sm font-medium">
          Wartość (JSON)
        </label>
        <textarea
          id="config-value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => validateJson(value)}
          rows={10}
          disabled={isSaving}
          className="w-full p-3 border rounded-lg font-mono text-sm"
        />
        {jsonError && <p className="text-sm text-destructive mt-1">{jsonError}</p>}
        {errors.length > 0 && (
          <div className="text-sm text-destructive">
            {errors.map((err, i) => (
              <p key={i}>{err.message}</p>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="config-description" className="text-sm font-medium">
          Opis
        </label>
        <input
          id="config-description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          disabled={isSaving}
          className="w-full p-2 border rounded-lg"
        />
        <p className="txt-sm text-muted-foreground text-right">{description.length}/500</p>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="px-4 py-2 border rounded-lg hover:bg-accent"
        >
          Anuluj
        </button>
        <button
          type="submit"
          disabled={isSaving || !!jsonError}
          className="px-4 py-2 bg-primary tex-primary-foreground rounded-lg disabled:opacity-50"
        >
          {isSaving ? "Zapisywanie..." : "Zapisz"}
        </button>
      </div>
    </form>
  );
}

export default ConfigEditor;
