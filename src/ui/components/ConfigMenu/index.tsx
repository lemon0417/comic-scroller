import type { ChangeEventHandler, ReactNode } from "react";
import { useEffect, useRef } from "react";
import DropdownMenu from "@components/DropdownMenu";

type ConfigMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: ReactNode;
  exportUrl: string;
  exportFilename?: string;
  onRequestExport: () => void;
  onClearExport: () => void;
  onRequestImport: (data: any) => void;
  onRequestReset: () => void;
  onBackgroundCheck?: () => void;
  showBackgroundCheck?: boolean;
  onImportError?: (message: string) => void;
};

const DEFAULT_EXPORT_FILENAME = "comic-scroller-config.json";

export default function ConfigMenu({
  open,
  onOpenChange,
  trigger,
  exportUrl,
  exportFilename,
  onRequestExport,
  onClearExport,
  onRequestImport,
  onRequestReset,
  onBackgroundCheck,
  showBackgroundCheck,
  onImportError,
}: ConfigMenuProps) {
  const downloadRef = useRef<HTMLAnchorElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!exportUrl) return;
    const link = downloadRef.current;
    if (!link) return;
    link.href = exportUrl;
    link.download = exportFilename || DEFAULT_EXPORT_FILENAME;
    link.click();
    window.URL.revokeObjectURL(exportUrl);
    onClearExport();
  }, [exportUrl, exportFilename, onClearExport]);

  const handleDownload = () => {
    onRequestExport();
    onOpenChange(false);
  };

  const handleUpload = () => {
    fileInputRef.current?.click();
    onOpenChange(false);
  };

  const handleReset = () => {
    onRequestReset();
    onOpenChange(false);
  };

  const handleBackgroundCheck = () => {
    onBackgroundCheck?.();
    onOpenChange(false);
  };

  const handleFileChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.currentTarget.files?.item(0);
    if (!file) return;
    const fr = new FileReader();
    fr.onload = (event) => {
      const raw = event.target && (event.target as FileReader).result;
      let result: any = {};
      try {
        result = JSON.parse(String(raw || "{}"));
      } catch {
        onImportError?.("Invalid config file.");
        return;
      } finally {
        e.currentTarget.value = "";
      }
      onRequestImport(result);
    };
    fr.readAsText(file);
  };

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenu.Trigger className="ds-menu-btn">
        {trigger ?? "⋮"}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item onClick={handleDownload}>
          Download Config
        </DropdownMenu.Item>
        <DropdownMenu.Item onClick={handleUpload}>
          Upload Config
        </DropdownMenu.Item>
        <DropdownMenu.Item onClick={handleReset}>
          Reset Config
        </DropdownMenu.Item>
        {showBackgroundCheck ? (
          <DropdownMenu.Item onClick={handleBackgroundCheck}>
            Background Check
          </DropdownMenu.Item>
        ) : null}
        <a className="hidden" ref={downloadRef}>
          Download Config
        </a>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
