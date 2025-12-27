import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, X } from "lucide-react";
import { formatFileSize, validateLogoFile } from "@/lib/helpers/file-validation.helper";
import { ALLOWED_LOGO_EXTENSIONS, MAX_LOGO_SIZE_MB } from "@/lib/schemas/common.schema";
import { Input } from "../ui/input";
import { cn } from "@/lib/utils";

interface LogoUploadProps {
  value: File | null;
  currentLogoUrl?: string;
  onChange: (file: File | null) => void;
  error?: string;
}

export function LogoUpload({ value, currentLogoUrl, onChange, error }: LogoUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const preventDefault = (e: DragEvent) => {
      e.preventDefault();
    };

    window.addEventListener("dragover", preventDefault);
    window.addEventListener("drop", preventDefault);

    return () => {
      window.removeEventListener("dragover", preventDefault);
      window.removeEventListener("drop", preventDefault);
    };
  }, []);

  const generatePreview = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const processFile = (file: File) => {
    const validation = validateLogoFile(file);
    if (!validation.isValid) {
      onChange(null);
      return;
    }

    generatePreview(file);
    onChange(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    processFile(file);
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemove = () => {
    setPreview(null);
    onChange(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;

    if (files.length === 0) {
      return;
    }

    const file = files[0];

    processFile(file);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="logo-upload">Logo sklepu</Label>
      <Input
        id="logo-upload"
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={ALLOWED_LOGO_EXTENSIONS}
        className="hidden"
      />

      {preview || currentLogoUrl ? (
        <div
          className={cn(
            "relative w-full h-40 border-2 border-dashed rounded-lg",
            "flex items-center justify-center bg-muted/50",
            "transition-colors duration-200",
            isDragging && "border-primary bg-primary/10"
          )}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <img
            src={preview || currentLogoUrl}
            alt="Podgląd logo"
            className="max-h-full max-w-full object-contain p-2"
          />

          {isDragging && (
            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center rounded-lg">
              <p className="text-sm font-medium text-primary">Upuść plik tutaj</p>
            </div>
          )}
          {preview && (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2"
              onClick={handleRemove}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ) : (
        <div
          className={cn(
            "w-full h-40 border-2 border-dashed rounded-lg",
            "flex flex-col items-center justify-center gap-2",
            "bg-muted/50 cursor-pointer transition-colors duration-200",
            "hover:bg-muted hover:border-primary/50",
            isDragging && "border-primary bg-primary/10"
          )}
          role="button"
          tabIndex={0}
          onClick={handleButtonClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleButtonClick();
            }
          }}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload className={cn("h-10 w-10 text-muted-foreground", isDragging && "text-primary")} />
          <div className="text-center">
            <p className="text-sm font-medium">
              {isDragging ? "Upuść plik tutaj" : "Przeciągnij i upuść plik lub kliknij aby wybrać"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {ALLOWED_LOGO_EXTENSIONS} (max {MAX_LOGO_SIZE_MB}MB)
            </p>
          </div>
        </div>
      )}
      {value && (
        <p className="text-xs text-muted-foreground">
          Wybrany plik: <span className="font-medium">{value.name}</span> ({formatFileSize(value.size)})
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
