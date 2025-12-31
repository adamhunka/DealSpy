import { useState, useRef, useCallback } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  accept?: string; // MIME types
}

/**
 * DropZone - interaktywny obszar do przeciągania i upuszczania plików
 *
 * Obsługuje drag & drop oraz kliknięcie do wyboru plików
 */
export function DropZone({
  onFilesSelected,
  disabled = false,
  accept = "image/jpeg,image/png,image/webp",
}: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragOver(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (disabled) return;

      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length > 0) {
        onFilesSelected(droppedFiles);
      }
    },
    [disabled, onFilesSelected]
  );

  const handleClick = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = e.target.files;
      if (selectedFiles && selectedFiles.length > 0) {
        onFilesSelected(Array.from(selectedFiles));
      }
      // Reset input value aby umożliwić wybór tych samych plików ponownie
      e.target.value = "";
    },
    [onFilesSelected]
  );

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`
        relative rounded-lg border-2 border-dashed p-8 text-center transition-colors
        ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}
        ${
          isDragOver && !disabled
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"
        }
      `}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={accept}
        onChange={handleFileInputChange}
        disabled={disabled}
        className="hidden"
      />

      <div className="flex flex-col items-center gap-3">
        <div className={`rounded-full p-3 ${isDragOver ? "bg-blue-100" : "bg-gray-200"}`}>
          <Upload className={`h-8 w-8 ${isDragOver ? "text-blue-600" : "text-gray-500"}`} />
        </div>

        <div className="space-y-1">
          <p className="text-base font-medium text-gray-700">Przeciągnij pliki tutaj</p>
          <p className="text-sm text-gray-500">lub</p>
        </div>

        <Button type="button" variant="outline" onClick={handleClick} disabled={disabled}>
          Wybierz pliki
        </Button>

        <p className="text-xs text-gray-500">Dozwolone formaty: JPG, PNG, WEBP (max 10MB)</p>
      </div>
    </div>
  );
}
