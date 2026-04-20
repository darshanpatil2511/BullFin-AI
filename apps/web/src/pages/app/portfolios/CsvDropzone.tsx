import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useUploadHoldings } from '@/hooks/useHoldings';
import { cn } from '@/lib/utils';

interface CsvDropzoneProps {
  portfolioId: string;
  onUploaded?: (count: number) => void;
}

export function CsvDropzone({ portfolioId, onUploaded }: CsvDropzoneProps) {
  const upload = useUploadHoldings(portfolioId);
  const [pickedFile, setPickedFile] = useState<File | null>(null);

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) setPickedFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false,
    maxSize: 5 * 1024 * 1024,
  });

  async function handleUpload() {
    if (!pickedFile) return;
    try {
      const inserted = await upload.mutateAsync(pickedFile);
      toast.success(`Imported ${inserted.length} holdings`);
      setPickedFile(null);
      onUploaded?.(inserted.length);
    } catch (err) {
      toast.error('Upload failed', {
        description: err instanceof Error ? err.message : 'Check your CSV formatting and try again.',
      });
    }
  }

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg-muted)]/50 px-6 py-10 text-center transition-colors',
          isDragActive && 'border-[var(--color-brand-500)] bg-[var(--color-brand-500)]/5',
        )}
      >
        <input {...getInputProps()} />
        <UploadCloud className="size-8 text-[var(--color-fg-muted)]" />
        <p className="mt-3 text-sm font-medium">
          {isDragActive ? 'Drop your CSV here' : 'Drop a CSV or click to browse'}
        </p>
        <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
          Columns we recognize: <code>symbol</code>, <code>shares</code>,{' '}
          <code>purchasePrice</code>, <code>purchaseDate</code>, <code>sector</code> (optional)
        </p>
      </div>
      {pickedFile ? (
        <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm">
          <div className="flex min-w-0 items-center gap-2">
            <FileSpreadsheet className="size-4 text-[var(--color-brand-400)]" />
            <span className="truncate">{pickedFile.name}</span>
            <span className="text-xs text-[var(--color-fg-subtle)]">
              ({(pickedFile.size / 1024).toFixed(1)} KB)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPickedFile(null)}>
              Clear
            </Button>
            <Button size="sm" loading={upload.isPending} onClick={handleUpload}>
              Import
            </Button>
          </div>
        </div>
      ) : null}
      {upload.isSuccess ? (
        <p className="flex items-center gap-2 text-xs text-[var(--color-brand-400)]">
          <CheckCircle2 className="size-4" /> Last import succeeded.
        </p>
      ) : upload.isError ? (
        <p className="flex items-center gap-2 text-xs text-[var(--color-danger)]">
          <AlertCircle className="size-4" /> Last import failed. See toast for details.
        </p>
      ) : null}
    </div>
  );
}
