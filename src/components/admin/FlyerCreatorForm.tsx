import type { StoreOption } from "@/types";
import { useNewFlyerForm } from "@/lib/hooks/useNewFlyerForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetadataSection } from "./MetadataSection";
import { FileUploadSection } from "./FileUploadSection";
import { ProcessingOptionsSection } from "./ProcessingOptionsSection";
import { UploadProgress } from "./UploadProgress";
import { FormActions } from "./FormActions";

interface FlyerCreatorFormProps {
  stores: StoreOption[];
  initialAutoProcess?: boolean;
}

/**
 * FlyerCreatorForm - główny komponent formularza tworzenia gazetki
 *
 * Orkiestruje cały proces tworzenia gazetki przez integrację z useNewFlyerForm hook
 */
export function FlyerCreatorForm({ stores, initialAutoProcess = true }: FlyerCreatorFormProps) {
  const { state, errors, canSubmit, setStore, setDateRange, setAutoProcess, addFiles, removeFile, resetForm, submitFlyer } =
    useNewFlyerForm(stores);

  const handleCancel = () => {
    // Jeśli upload w trakcie, pokaż potwierdzenie
    if (state.uploadStatus !== "idle" && state.uploadStatus !== "error" && state.uploadStatus !== "success") {
      if (window.confirm("Czy na pewno chcesz anulować? Upload jest w trakcie.")) {
        resetForm();
      }
    } else if (state.uploadStatus === "error") {
      // W przypadku błędu, resetuj i pozwól spróbować ponownie
      resetForm();
    } else {
      // Redirect do listy gazetek lub reset
      window.location.href = "/admin/gazetki";
    }
  };

  const isLoading = state.uploadStatus !== "idle" && state.uploadStatus !== "error" && state.uploadStatus !== "success";

  return (
    <Card className="mx-auto w-full max-w-4xl">
      <CardHeader>
        <CardTitle>Kreator nowej gazetki</CardTitle>
        <CardDescription>Wgraj nową gazetkę promocyjną do systemu</CardDescription>
      </CardHeader>

      <CardContent className="space-y-8">
        {/* Upload Progress - wyświetlany podczas operacji */}
        {state.uploadStatus !== "idle" && (
          <UploadProgress
            status={state.uploadStatus}
            progress={state.overallProgress}
            currentStep={state.currentStep}
            error={state.uploadError || undefined}
          />
        )}

        {/* Sekcja metadanych */}
        <MetadataSection
          stores={stores}
          selectedStoreId={state.storeId}
          onStoreChange={setStore}
          validFrom={state.validFrom}
          validTo={state.validTo}
          onDateRangeChange={setDateRange}
          errors={{
            store: errors.store,
            validFrom: errors.validFrom,
            validTo: errors.validTo,
            dateRange: errors.dateRange,
          }}
          disabled={isLoading}
        />

        {/* Sekcja uploadu plików */}
        <FileUploadSection
          files={state.files}
          onFilesAdd={addFiles}
          onFileRemove={removeFile}
          disabled={isLoading}
          error={errors.files}
        />

        {/* Opcje przetwarzania */}
        <ProcessingOptionsSection autoProcess={state.autoProcess} onChange={setAutoProcess} disabled={isLoading} />

        {/* Przyciski akcji */}
        <FormActions onSubmit={submitFlyer} onCancel={handleCancel} canSubmit={canSubmit} isLoading={isLoading} />
      </CardContent>
    </Card>
  );
}

