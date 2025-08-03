import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { parseGermanDate, parseGermanNumber } from '@/lib/dateUtils';

interface Transaction {
  date: Date;
  amount: number;
  recipient?: string;
}

interface FileUploaderProps {
  onFileUploaded: (transactions: Transaction[]) => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFileUploaded }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<{
    date?: string;
    amount?: string;
    recipient?: string;
  }>({});

  const resetState = () => {
    setHeaders([]);
    setRows([]);
    setMapping({});
    setError(null);
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    resetState();

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        setError('CSV appears to be empty');
        return;
      }

      const delimiter = lines[0].includes(';') ? ';' : ',';
      const headerRow = lines[0].split(delimiter).map(h => h.trim());
      const dataRows = lines
        .slice(1)
        .map(line => line.split(delimiter).map(cell => cell.trim()));

      setHeaders(headerRow);
      setRows(dataRows);

      const lower = headerRow.map(h => h.toLowerCase());
      const dateHeader = headerRow[
        lower.findIndex(h => h.includes('date') || h.includes('datum'))
      ];
      const amountHeader = headerRow[
        lower.findIndex(h => h.includes('amount') || h.includes('betrag'))
      ];
      const recipientHeader = headerRow[
        lower.findIndex(
          h =>
            h.includes('recipient') ||
            h.includes('empf') ||
            h.includes('description') ||
            h.includes('payee')
        )
      ];

      setMapping({
        date: dateHeader,
        amount: amountHeader,
        recipient: recipientHeader,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  }, []);

  const processData = async () => {
    if (!mapping.date || !mapping.amount || !mapping.recipient) {
      setError('Please map all columns.');
      return;
    }

    setUploading(true);
    setError(null);
    setProgress(0);

    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 10, 90));
    }, 100);

    try {
      const dateIdx = headers.indexOf(mapping.date);
      const amountIdx = headers.indexOf(mapping.amount);
      const recipientIdx = headers.indexOf(mapping.recipient);

 csztvl-codex/fix-date-and-amount-recognition
      const transactions = rows
        .map(row => {
          const date = parseGermanDate(row[dateIdx]);
          const amount = parseGermanNumber(row[amountIdx]);
          if (!date || isNaN(amount)) return null;
          return {
            date,
            amount,
            recipient: row[recipientIdx] || 'Unknown'
          };
        })
        .filter(
          (
            t
          ): t is {
            date: Date;
            amount: number;
            recipient: string;
          } => t !== null
        );

      const transactions = rows.map(row => ({
        date: new Date(row[dateIdx].split('.').reverse().join('-')),
        amount: parseFloat(
          row[amountIdx].replace(/\./g, '').replace(',', '.')
        ),
        recipient: row[recipientIdx] || 'Unknown',
      }));
 main

      clearInterval(progressInterval);
      setProgress(100);

      setTimeout(() => {
        onFileUploaded(transactions);
        setUploading(false);
        setProgress(0);
        resetState();
      }, 500);
    } catch (err) {
      clearInterval(progressInterval);
      setError(err instanceof Error ? err.message : 'Processing failed');
      setUploading(false);
      setProgress(0);
    }
  };

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

      {headers.length > 0 && (
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="dateColumn">Date</Label>
              <Select
                value={mapping.date}
                onValueChange={value =>
                  setMapping(prev => ({ ...prev, date: value }))
                }
              >
                <SelectTrigger id="dateColumn">
                  <SelectValue placeholder="Select column" />
                </SelectTrigger>
                <SelectContent>
                  {headers.map(h => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="amountColumn">Amount</Label>
              <Select
                value={mapping.amount}
                onValueChange={value =>
                  setMapping(prev => ({ ...prev, amount: value }))
                }
              >
                <SelectTrigger id="amountColumn">
                  <SelectValue placeholder="Select column" />
                </SelectTrigger>
                <SelectContent>
                  {headers.map(h => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="recipientColumn">Recipient</Label>
              <Select
                value={mapping.recipient}
                onValueChange={value =>
                  setMapping(prev => ({ ...prev, recipient: value }))
                }
              >
                <SelectTrigger id="recipientColumn">
                  <SelectValue placeholder="Select column" />
                </SelectTrigger>
                <SelectContent>
                  {headers.map(h => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={processData} disabled={uploading}>
            Process File
          </Button>
        </div>
      )}

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