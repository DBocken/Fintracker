"use client";

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Shield } from 'lucide-react';

interface AutoCategorizationSettingsProps {
  autoConfirm: boolean;
  onAutoConfirmChange: (enabled: boolean) => void;
}

export function AutoCategorizationSettings({ 
  autoConfirm, 
  onAutoConfirmChange 
}: AutoCategorizationSettingsProps) {
  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Auto-Kategorisierung
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <Label htmlFor="auto-confirm">Automatisch bestätigen</Label>
          <Switch
            id="auto-confirm"
            checked={autoConfirm}
            onCheckedChange={onAutoConfirmChange}
          />
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Transaktionen werden automatisch basierend auf hierarchischen Filtern kategorisiert
        </p>
      </CardContent>
    </Card>
  );
}