import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Upload } from "lucide-react";

type FileUploadFieldProps = {
  accept: string;
  uploadLabel: string;
  loadingLabel: string;
  emptyHint?: string;
  isPending: boolean;
  onUpload: (file: File) => void;
  testId?: string;
};

/** Visible file name box + button that opens the system file picker (no native "No file chosen" text). */
export function FileUploadField({
  accept,
  uploadLabel,
  loadingLabel,
  emptyHint = "No file selected",
  isPending,
  onUpload,
  testId = "button-upload",
}: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const openPicker = () => {
    if (!isPending) inputRef.current?.click();
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setSelectedFile(picked);
    onUpload(picked);
    e.target.value = "";
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div
        className="flex-1 min-h-11 rounded-md border border-[#3a4759] bg-[#1e293b] px-4 flex items-center text-sm truncate"
        aria-label="Selected file"
      >
        {selectedFile && !isPending ? (
          <span className="text-gray-100 truncate">{selectedFile.name}</span>
        ) : isPending ? (
          <span className="text-gray-400 truncate">Uploading…</span>
        ) : (
          <span className="text-gray-500">{emptyHint}</span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={onChange}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
      />

      <Button
        type="button"
        onClick={openPicker}
        disabled={isPending}
        className="bg-emerald-500 hover:bg-emerald-600 text-white w-full sm:w-auto shrink-0"
        data-testid={testId}
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {loadingLabel}
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            {uploadLabel}
          </>
        )}
      </Button>
    </div>
  );
}
