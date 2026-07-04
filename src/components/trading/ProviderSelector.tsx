import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useI18n } from '@/i18n/useI18n';
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
  const { t } = useI18n();
  const [favoriteProvider, setFavoriteProvider] = useState<'yahoo' | 'stooq'>('yahoo');

  const saveFavoriteMutation = useMutation({
    mutationFn: async (provider: 'yahoo' | 'stooq') => {
      await setPreferredMarketProvider(provider);
      return provider;
    },
    onSuccess: (provider) => {
      toast.success(t('trading.providerSelector.messages.saveFavoriteSuccess').replace('{provider}', provider.toUpperCase()));
    },
    onError: (error: Error) => {
      toast.error(t('trading.providerSelector.messages.saveFavoriteError').replace('{error}', error.message));
    },
  });

  const handleSetFavorite = (provider: 'yahoo' | 'stooq') => {
    setFavoriteProvider(provider);
    saveFavoriteMutation.mutate(provider);
  };

  const providers = [
    {
      id: 'yahoo' as const,
      name: t('trading.providerSelector.yahooName'),
      description: t('trading.providerSelector.yahooDesc'),
      isFavorite: favoriteProvider === 'yahoo',
    },
    {
      id: 'stooq' as const,
      name: t('trading.providerSelector.stooqName'),
      description: t('trading.providerSelector.stooqDesc'),
      isFavorite: favoriteProvider === 'stooq',
    },
  ];

  const currentProviderInfo = providers.find((p) => p.id === currentProvider);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <span className="mr-2">{t('trading.providerSelector.label')}</span>
          <span className="mr-1">{currentProviderInfo?.name || t('trading.providerSelector.yahooName')}</span>
          {currentProviderInfo?.isFavorite && (
            <Star className="h-4 w-4 fill-warning text-warning" />
          )}
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>{t('trading.providerSelector.selectLabel')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {providers.map((provider) => (
          <DropdownMenuItem
            key={provider.id}
            onClick={() => onProviderChange(provider.id)}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              {provider.isFavorite && (
                <Star className="h-4 w-4 fill-warning text-warning" />
              )}
              <div>
                <div className="font-medium">{provider.name}</div>
                <div className="text-xs text-muted-foreground">{provider.description}</div>
              </div>
            </div>
            {currentProvider === provider.id && (
              <Badge variant="secondary" className="ml-2">
                {t('trading.providerSelector.activeBadge')}
              </Badge>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t('trading.providerSelector.setFavoriteLabel')}</DropdownMenuLabel>
        {providers.map((provider) => (
          <DropdownMenuItem
            key={`fav-${provider.id}`}
            onClick={() => handleSetFavorite(provider.id)}
            disabled={provider.isFavorite || saveFavoriteMutation.isPending}
          >
            {provider.isFavorite ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Star className="h-4 w-4 fill-warning text-warning" />
                {t('trading.providerSelector.favoriteLabel').replace('{name}', provider.name)}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                {t('trading.providerSelector.setFavoriteButton').replace('{name}', provider.name)}
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