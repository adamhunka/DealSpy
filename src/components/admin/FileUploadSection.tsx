import type { FileUploadItem } from "@/types";
import { DropZone } from "./DropZone";
import { FileList } from "./FileList";

interface FileUploadSectionProps {
  files: FileUploadItem[];
  onFilesAdd: (files: File[]) => void;
  onFileRemove: (fileId: string) => void;
  disabled?: boolean;
  error?: string;
}

/**
 * FileUploadSection - sekcja odpowiedzialna za wybór i zarządzanie plikami
 *
 * Wrapper dla DropZone i FileList z nagłówkiem i instrukcjami
 */
export function FileUploadSection({
  files,
  onFilesAdd,
  onFileRemove,
  disabled = false,
  error,
}: FileUploadSectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">
          Strony gazetki <span className="text-red-500">*</span>
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Wgraj wszystkie strony gazetki promocyjnej. Pliki będą automatycznie uporządkowane według nazw.
        </p>
      </div>

      {/* Błąd ogólny (jeśli brak plików) */}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* DropZone */}
      <DropZone onFilesSelected={onFilesAdd} disabled={disabled} />

      {/* Lista plików */}
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Wybrane pliki ({files.length})</p>
          <FileList files={files} onRemove={onFileRemove} disabled={disabled} />
        </div>
      )}
    </div>
  );
}
