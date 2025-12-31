import type { UploadStatus } from "@/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface UploadProgressProps {
  status: UploadStatus;
  progress: number; // 0-100
  currentStep?: string;
  error?: string;
}

/**
 * UploadProgress - komponent wyświetlający postęp uploadu
 *
 * Pokazuje progress bar, komunikaty i statusy operacji
 */
export function UploadProgress({ status, progress, currentStep, error }: UploadProgressProps) {
  if (status === "idle") {
    return null;
  }

  // Określenie wariantu alertu i ikony
  const getAlertVariant = () => {
    if (status === "error") return "destructive";
    if (status === "success") return "default";
    return "default";
  };

  const getIcon = () => {
    if (status === "error") {
      return <AlertCircle className="h-5 w-5 text-red-600" />;
    }
    if (status === "success") {
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    }
    return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />;
  };

  const getTitle = () => {
    switch (status) {
      case "creating_flyer":
        return "Tworzenie gazetki...";
      case "uploading_files":
        return "Wysyłanie plików...";
      case "processing_ai":
        return "Uruchamianie przetwarzania AI...";
      case "success":
        return "Sukces!";
      case "error":
        return "Błąd";
      default:
        return "Przetwarzanie...";
    }
  };

  return (
    <Alert variant={getAlertVariant()} className="mb-6">
      <div className="flex items-start gap-3">
        {getIcon()}
        <div className="flex-1 space-y-3">
          <div>
            <AlertTitle>{getTitle()}</AlertTitle>
            <AlertDescription>{error || currentStep || "Przetwarzanie w toku..."}</AlertDescription>
          </div>

          {/* Progress bar - tylko dla stanów w trakcie */}
          {status !== "error" && status !== "success" && (
            <div className="space-y-1">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-gray-600">{Math.round(progress)}%</p>
            </div>
          )}

          {/* Informacja o sukcesie */}
          {status === "success" && (
            <p className="text-sm text-gray-600">Za chwilę zostaniesz przekierowany do szczegółów gazetki...</p>
          )}
        </div>
      </div>
    </Alert>
  );
}
