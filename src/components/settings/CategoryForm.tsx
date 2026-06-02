"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import type { CategoryAttributes, Rhythmus, Prioritaet, Zahlungsweg } from '../../types';

interface CategoryFormProps {
  name: string;
  color: string;
  icon: string;
  filters: string[];
  parentId: string | null;
  editingCategory: any;
  attributes: CategoryAttributes;
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  onIconChange: (icon: string) => void;
  onAddFilter: (filter: string) => void;
  onRemoveFilter: (filter: string) => void;
  onAttributesChange: (partial: Partial<CategoryAttributes>) => void;
  onSave: () => void;
  onReset: () => void;
}

export function CategoryForm({ 
  name, 
  color, 
  icon, 
  filters, 
  parentId,
  editingCategory,
  attributes,
  onNameChange, 
  onColorChange, 
  onIconChange, 
  onAddFilter,
  onRemoveFilter,
  onAttributesChange,
  onSave,
  onReset
}: CategoryFormProps) {
  const [newFilterInput, setNewFilterInput] = React.useState('');
  const [newTagInput, setNewTagInput] = React.useState('');

  const colorOptions = [
    '#22c55e', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', 
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
  ];

  const iconOptions = ['🛒', '🍽️', '🚗', '🛍️', '🔧', '🎬', '💊', '🏠', '📚', '📋', '💰', '✈️', '📱', '💡', '🥛', '🥖', '🥩', '🏨'];

  const handleAddFilter = () => {
    if (newFilterInput.trim() && !filters.includes(newFilterInput.trim().toLowerCase())) {
      onAddFilter(newFilterInput.trim().toLowerCase());
      setNewFilterInput('');
    }
  };

  const tags = attributes.tags || [];

  const handleAddTag = () => {
    const tag = newTagInput.trim();
    if (tag && !tags.includes(tag)) {
      onAttributesChange({ tags: [...tags, tag] });
      setNewTagInput('');
    }
  };

  const removeTag = (t: string) => {
    onAttributesChange({ tags: tags.filter(x => x !== t) });
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">
          {editingCategory ? 'Kategorie bearbeiten' : parentId ? 'Unterkategorie erstellen' : 'Neue Kategorie'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {parentId && (
          <div className="p-3 bg-blue-50 rounded-lg">
            <Label className="text-sm">Übergeordnete Kategorie:</Label>
            <p className="text-sm font-medium">Unterkategorie</p>
          </div>
        )}

        <div>
          <Label htmlFor="cat-name">Name</Label>
          <Input
            id="cat-name"
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onNameChange(e.target.value)}
            placeholder={parentId ? "z.B. Milchprodukte" : "z.B. Lebensmittel"}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Farbe</Label>
            <div className="grid grid-cols-5 gap-1 mt-1">
              {colorOptions.map(c => (
                <button
                  key={c}
                  onClick={() => onColorChange(c)}
                  className={`w-8 h-8 rounded border-2 ${color === c ? "border-gray-800" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <Label>Icon</Label>
            <div className="grid grid-cols-4 gap-1 mt-1">
              {iconOptions.map((i, index) => (
                <button
                  key={`${i}-${index}`}
                  onClick={() => onIconChange(i)}
                  className={`w-8 h-8 rounded border-2 ${icon === i ? "border-gray-800" : "border-transparent"}`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <Label htmlFor="filter-input">Filter hinzufügen</Label>
          <div className="flex gap-2">
            <Input
              id="filter-input"
              value={newFilterInput}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewFilterInput(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleAddFilter()}
              placeholder={parentId ? "z.B. milch, joghurt, käse" : "z.B. lebensmittel, supermarkt"}
            />
            <Button onClick={handleAddFilter} size="sm">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Filter werden automatisch auf Payee und Beschreibung angewendet
          </p>
        </div>

        {filters.length > 0 && (
          <div>
            <Label>Aktive Filter</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {filters.map((filter, index) => (
                <Badge key={`${filter}-${index}`} variant="secondary" className="gap-1">
                  {filter}
                  <button
                    onClick={() => onRemoveFilter(filter)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Erweiterte Eigenschaften */}
        <div className="space-y-3 p-3 border rounded-lg">
          <p className="text-sm font-medium">Erweiterte Eigenschaften</p>
          
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Checkbox checked={!!attributes.ist_vertrag} onCheckedChange={(v) => onAttributesChange({ ist_vertrag: Boolean(v) })} />
              <Label>Ist Vertrag</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={!!attributes.fixkosten} onCheckedChange={(v) => onAttributesChange({ fixkosten: Boolean(v) })} />
              <Label>Fixkosten</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={!!attributes.essenziell} onCheckedChange={(v) => onAttributesChange({ essenziell: Boolean(v) })} />
              <Label>Essenziell</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={!!attributes.steuerrelevant} onCheckedChange={(v) => onAttributesChange({ steuerrelevant: Boolean(v) })} />
              <Label>Steuerrelevant</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={attributes.sichtbar !== false} onCheckedChange={(v) => onAttributesChange({ sichtbar: Boolean(v) })} />
              <Label>Sichtbar</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={!!attributes.archiviert} onCheckedChange={(v) => onAttributesChange({ archiviert: Boolean(v) })} />
              <Label>Archiviert</Label>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Rhythmus</Label>
              <Select value={attributes.rhythmus || ''} onValueChange={(val: Rhythmus) => onAttributesChange({ rhythmus: val })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="–" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Wöchentlich</SelectItem>
                  <SelectItem value="monthly">Monatlich</SelectItem>
                  <SelectItem value="quarterly">Vierteljährlich</SelectItem>
                  <SelectItem value="yearly">Jährlich</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priorität</Label>
              <Select value={attributes.prioritaet || ''} onValueChange={(val: Prioritaet) => onAttributesChange({ prioritaet: val })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="–" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="essential">Essenziell</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="nice">Nice-to-have</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Zahlungsweg</Label>
              <Select value={attributes.zahlungsweg || ''} onValueChange={(val: Zahlungsweg) => onAttributesChange({ zahlungsweg: val })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="–" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="giro">Giro</SelectItem>
                  <SelectItem value="credit">Kreditkarte</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="cash">Bar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Händler-Alias</Label>
              <Input
                value={attributes.merchant_alias || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onAttributesChange({ merchant_alias: e.target.value || null })}
                placeholder="z.B. Telekom"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Fälligkeitstag (1–31)</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={attributes.faelligkeitstag ?? ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onAttributesChange({ faelligkeitstag: e.target.value ? Number(e.target.value) : null })}
                placeholder="z.B. 15"
              />
            </div>
            <div>
              <Label>Nächstes Fälligkeitsdatum</Label>
              <Input
                type="date"
                value={attributes.next_due_date ?? ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onAttributesChange({ next_due_date: e.target.value || null })}
              />
            </div>
            <div>
              <Label>Kündigungsfrist (Tage)</Label>
              <Input
                type="number"
                min={0}
                value={attributes.kuendigungsfrist_tage ?? ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onAttributesChange({ kuendigungsfrist_tage: e.target.value ? Number(e.target.value) : null })}
                placeholder="z.B. 90"
              />
            </div>
            <div>
              <Label>Vertragsende</Label>
              <Input
                type="date"
                value={attributes.vertragsende ?? ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onAttributesChange({ vertragsende: e.target.value || null })}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Monatsbudget (€)</Label>
              <Input
                type="number"
                min={0}
                value={attributes.budget_monat ?? ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onAttributesChange({ budget_monat: e.target.value ? Number(e.target.value) : null })}
                placeholder="z.B. 100"
              />
            </div>
            <div>
              <Label>Warnschwelle (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={attributes.warnschwelle_prozent ?? ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onAttributesChange({ warnschwelle_prozent: e.target.value ? Number(e.target.value) : null })}
                placeholder="z.B. 80"
              />
            </div>
            <div>
              <Label>Sortierreihenfolge</Label>
              <Input
                type="number"
                value={attributes.sort_index ?? ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onAttributesChange({ sort_index: e.target.value ? Number(e.target.value) : null })}
                placeholder="z.B. 1"
              />
            </div>
          </div>

          <div>
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input
                value={newTagInput}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTagInput(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleAddTag()}
                placeholder="Tag hinzufügen"
              />
              <Button onClick={handleAddTag} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((t, i) => (
                  <Badge key={`${t}-${i}`} variant="secondary" className="gap-1">
                    {t}
                    <button onClick={() => removeTag(t)} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={onSave} className="flex-1">
            {editingCategory ? 'Aktualisieren' : 'Erstellen'}
          </Button>
          {(editingCategory || parentId) && (
            <Button onClick={onReset} variant="outline">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}