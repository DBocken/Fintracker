"use client";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId?: string | null;
  selectedCount: number;
  onConfirm: () => void;
}

export function DeleteConfirmationDialog({ 
  isOpen, 
  onOpenChange, 
  transactionId, 
  selectedCount, 
  onConfirm 
}: DeleteConfirmationDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="card-premium">
        <AlertDialogHeader>
          <AlertDialogTitle>Löschen bestätigen</AlertDialogTitle>
          <AlertDialogDescription>
            {transactionId 
              ? `Möchtest du diese Transaktion wirklich löschen? (ID: ${transactionId})`
              : `Möchtest du ${selectedCount} Transaktionen wirklich löschen?`}
            Diese Aktion kann nicht rückgängig gemacht werden.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-red-600 hover:bg-red-700">
            Löschen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}