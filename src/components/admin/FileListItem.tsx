import type { FileUploadItem } from "@/types";
import { X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileListItemProps {
  file: FileUploadItem;
  onRemove: (fileId: string) => void;
  disabled?: boolean;
}

/**
 * FileListItem - pojedynczy element listy reprezentujący plik
 *
 * Wyświetla miniaturę, nazwę, rozmiar, status i kontrolki usunięcia
 */
export function FileListItem({ file, onRemove, disabled = false }: FileListItemProps) {
  // Formatowanie rozmiaru pliku
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Określenie ikony statusu
  const renderStatusIcon = () => {
    switch (file.status) {
      case "pending":
        return null;
      case "validating":
      case "uploading":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "invalid":
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  // Określenie koloru obramowania
  const getBorderColor = () => {
    switch (file.status) {
      case "invalid":
      case "error":
        return "border-red-300";
      case "success":
        return "border-green-300";
      case "uploading":
        return "border-blue-300";
      default:
        return "border-gray-200";
    }
  };

  return (
    <div
      className={`relative flex items-center gap-3 rounded-lg border-2 bg-white p-3 transition-colors ${getBorderColor()}`}
    >
      {/* Miniatura */}
      <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded">
        <img src={file.preview} alt={file.file.name} className="h-full w-full object-cover" />
      </div>

      {/* Informacje o pliku */}
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-gray-900">{file.file.name}</p>
        <p className="text-xs text-gray-500">{formatFileSize(file.file.size)}</p>

        {/* Komunikat błędu */}
        {(file.status === "invalid" || file.status === "error") && file.error && (
          <p className="mt-1 text-xs text-red-600">{file.error}</p>
        )}

        {/* Progress bar dla uploading */}
        {file.status === "uploading" && file.progress !== undefined && (
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-gray-200">
            <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${file.progress}%` }} />
          </div>
        )}
      </div>

      {/* Status icon */}
      <div className="flex-shrink-0">{renderStatusIcon()}</div>

      {/* Przycisk usunięcia */}
      <Button
        variant="ghost"
        size="icon"
        className="flex-shrink-0 h-8 w-8"
        onClick={() => onRemove(file.id)}
        disabled={disabled}
        aria-label="Usuń plik"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
