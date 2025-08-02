import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface FileUploaderProps {
  onFileUploaded: (transactions: any[]) => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFileUploaded }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      const text = await file.text();
      const rows = text.split('\n').slice(1).filter(row => row.trim());
      const transactions = rows.map(row => {
        const [date, amount, recipient] = row.split(';');
        return {
          date: new Date(date.split('.').reverse().join('-')),
          amount: parseFloat(amount.replace('.', '').replace(',', '.')),
          recipient: recipient || 'Unknown'
        };
      });
      
      clearInterval(progressInterval);
      setProgress(100);
      
      setTimeout(() => {
        onFileUploaded(transactions);
        setUploading(false);
        setProgress(0);
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploading(false);
      setProgress(0);
    }
  }, [onFileUploaded]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
  });

  return (
    <Card className="p-8">
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer",
          isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        )}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center space-y-4">
          <Upload className="h-12 w-12 text-muted-foreground" />
          
          {isDragActive ? (
            <p className="text-lg font-medium">Drop the CSV file here...</p>
          ) : (
            <>
              <p className="text-lg font-medium">Upload your financial data</p>
              <p className="text-sm text-muted-foreground">
                Drag & drop your CSV file here, or click to select
              </p>
              <Button variant="outline" className="mt-4">
                Select File
              </Button>
            </>
          )}
        </div>
      </div>

      {uploading && (
        <div className="mt-4 space-y-2">
          <Progress value={progress} className="w-full" />
          <p className="text-sm text-center text-muted-foreground">
            Processing your file... {progress}%
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </Card>
  );
};