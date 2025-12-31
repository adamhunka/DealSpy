import type { FileUploadItem } from "@/types";
import { FileListItem } from "./FileListItem";

interface FileListProps {
  files: FileUploadItem[];
  onRemove: (fileId: string) => void;
  disabled?: boolean;
}

/**
 * FileList - lista wybranych plików z podglądami
 *
 * Wyświetla wszystkie wybrane pliki lub komunikat "Brak plików"
 */
export function FileList({ files, onRemove, disabled = false }: FileListProps) {
  if (files.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <p className="text-sm text-gray-500">Brak wybranych plików. Przeciągnij pliki lub kliknij przycisk powyżej.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {files.map((file) => (
        <FileListItem key={file.id} file={file} onRemove={onRemove} disabled={disabled} />
      ))}
    </div>
  );
}
