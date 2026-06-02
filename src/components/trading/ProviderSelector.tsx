"use client";

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, ChevronDown, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { setPreferredMarketProvider } from '@/services/user-settings-service';

interface ProviderSelectorProps {
  currentProvider: 'yahoo' | 'stooq';
  onProviderChange: (provider: 'yahoo' | 'stooq') => void;
}

export default function ProviderSelector({
  currentProvider,
  onProviderChange,
}: ProviderSelectorProps) {
  const [favoriteProvider, setFavoriteProvider] = useState<'yahoo' | 'stooq'>('yahoo');

  const saveFavoriteMutation = useMutation({
    mutationFn: async (provider: 'yahoo' | 'stooq') => {
      await setPreferredMarketProvider(provider as any);
      return provider;
    },
    onSuccess: (provider) => {
      toast.success(`${provider.toUpperCase()} als Favorit gespeichert`);
    },
    onError: (error: Error) => {
      toast.error(`Fehler beim Speichern des Favoriten: ${error.message}`);
    },
  });

  const handleSetFavorite = (provider: 'yahoo' | 'stooq') => {
    setFavoriteProvider(provider);
    saveFavoriteMutation.mutate(provider);
  };

  const providers = [
    {
      id: 'yahoo' as const,
      name: 'Yahoo Finance',
      description: 'Server-seitig (CORS-sicher)',
      isFavorite: favoriteProvider === 'yahoo',
    },
    {
      id: 'stooq' as const,
      name: 'Stooq',
      description: 'Kostenloser CSV-Feed (Fallback)',
      isFavorite: favoriteProvider === 'stooq',
    },
  ];

  const currentProviderInfo = providers.find((p) => p.id === currentProvider);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <span className="mr-2">Kurs-Provider:</span>
          <span className="mr-1">{currentProviderInfo?.name || 'Yahoo Finance'}</span>
          {currentProviderInfo?.isFavorite && (
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          )}
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Provider auswählen</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {providers.map((provider) => (
          <DropdownMenuItem
            key={provider.id}
            onClick={() => onProviderChange(provider.id)}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              {provider.isFavorite && (
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              )}
              <div>
                <div className="font-medium">{provider.name}</div>
                <div className="text-xs text-muted-foreground">{provider.description}</div>
              </div>
            </div>
            {currentProvider === provider.id && (
              <Badge variant="secondary" className="ml-2">
                Aktiv
              </Badge>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Favorit setzen</DropdownMenuLabel>
        {providers.map((provider) => (
          <DropdownMenuItem
            key={`fav-${provider.id}`}
            onClick={() => handleSetFavorite(provider.id)}
            disabled={provider.isFavorite || saveFavoriteMutation.isPending}
          >
            {provider.isFavorite ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                {provider.name} (Favorit)
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                {provider.name} als Favorit
              </span>
            )}
            {saveFavoriteMutation.isPending && !provider.isFavorite && (
              <Loader2 className="h-4 w-4 ml-auto animate-spin" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}