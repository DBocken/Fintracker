import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import type { Category, CategoryAttributes, Rhythmus, Prioritaet, Zahlungsweg } from '../../types';

interface CategoryFormProps {
  name: string;
  color: string;
  icon: string;
  filters: string[];
  parentId: string | null;
  editingCategory: Category | null;
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

const colorOptions = [
  { value: '#22c55e', label: 'Grün' },
  { value: '#ef4444', label: 'Rot' },
  { value: '#3b82f6', label: 'Blau' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#8b5cf6', label: 'Violett' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#84cc16', label: 'Limette' },
  { value: '#f97316', label: 'Orange' },
  { value: '#6366f1', label: 'Indigo' },
];

const iconOptions = ['🛒', '🍽️', '🚗', '🛍️', '🔧', '🎬', '💊', '🏠', '📚', '📋', '💰', '✈️', '📱', '💡', '🥛', '🥖', '🥩', '🏨'];

const checkboxFields: Array<{ key: keyof CategoryAttributes; label: string }> = [
  { key: 'ist_vertrag', label: 'Ist Vertrag' },
  { key: 'fixkosten', label: 'Fixkosten' },
  { key: 'essenziell', label: 'Essenziell' },
  { key: 'steuerrelevant', label: 'Steuerrelevant' },
  { key: 'sichtbar', label: 'Sichtbar' },
  { key: 'archiviert', label: 'Archiviert' },
];

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
  onReset,
}: CategoryFormProps) {
  const [newFilterInput, setNewFilterInput] = React.useState('');
  const [newTagInput, setNewTagInput] = React.useState('');

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

  const removeTag = (tag: string) => {
    onAttributesChange({ tags: tags.filter((currentTag) => currentTag !== tag) });
  };

  const isCheckboxChecked = (key: keyof CategoryAttributes) => {
    if (key === 'sichtbar') return attributes.sichtbar !== false;
    return Boolean(attributes[key]);
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
            onChange={(event) => onNameChange(event.target.value)}
            placeholder={parentId ? 'z.B. Milchprodukte' : 'z.B. Lebensmittel'}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <fieldset>
            <legend className="text-sm font-medium">Farbe</legend>
            <div className="grid grid-cols-5 gap-1 mt-1">
              {colorOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onColorChange(option.value)}
                  className={`w-8 h-8 rounded border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${color === option.value ? 'border-gray-800' : 'border-transparent'}`}
                  style={{ backgroundColor: option.value }}
                  aria-label={`Farbe ${option.label} auswählen`}
                  aria-pressed={color === option.value}
                >
                  <span className="sr-only">{option.label}{color === option.value ? ', ausgewählt' : ''}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium">Icon</legend>
            <div className="grid grid-cols-4 gap-1 mt-1">
              {iconOptions.map((option, index) => (
                <button
                  key={`${option}-${index}`}
                  type="button"
                  onClick={() => onIconChange(option)}
                  className={`w-8 h-8 rounded border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${icon === option ? 'border-gray-800' : 'border-transparent'}`}
                  aria-label={`Icon ${index + 1} auswählen: ${option}`}
                  aria-pressed={icon === option}
                >
                  <span aria-hidden="true">{option}</span>
                  <span className="sr-only">{icon === option ? ' ausgewählt' : ''}</span>
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div>
          <Label htmlFor="filter-input">Filter hinzufügen</Label>
          <div className="flex gap-2">
            <Input
              id="filter-input"
              value={newFilterInput}
              onChange={(event) => setNewFilterInput(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && handleAddFilter()}
              placeholder={parentId ? 'z.B. milch, joghurt, käse' : 'z.B. lebensmittel, supermarkt'}
            />
            <Button type="button" onClick={handleAddFilter} size="sm" aria-label="Filter hinzufügen">
              <Plus className="h-4 w-4" aria-hidden="true" />
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
                    type="button"
                    onClick={() => onRemoveFilter(filter)}
                    className="ml-1 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                    aria-label={`Filter ${filter} entfernen`}
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3 p-3 border rounded-lg">
          <p className="text-sm font-medium">Erweiterte Eigenschaften</p>

          <div className="grid sm:grid-cols-2 gap-3">
            {checkboxFields.map((field) => {
              const id = `category-${String(field.key)}`;
              return (
                <div key={field.key} className="flex items-center gap-2">
                  <Checkbox
                    id={id}
                    checked={isCheckboxChecked(field.key)}
                    onCheckedChange={(value) => onAttributesChange({ [field.key]: Boolean(value) })}
                  />
                  <Label htmlFor={id}>{field.label}</Label>
                </div>
              );
            })}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="category-rhythmus">Rhythmus</Label>
              <Select value={attributes.rhythmus || ''} onValueChange={(value: Rhythmus) => onAttributesChange({ rhythmus: value })}>
                <SelectTrigger id="category-rhythmus" className="w-full">
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
              <Label htmlFor="category-prioritaet">Priorität</Label>
              <Select value={attributes.prioritaet || ''} onValueChange={(value: Prioritaet) => onAttributesChange({ prioritaet: value })}>
                <SelectTrigger id="category-prioritaet" className="w-full">
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
              <Label htmlFor="category-zahlungsweg">Zahlungsweg</Label>
              <Select value={attributes.zahlungsweg || ''} onValueChange={(value: Zahlungsweg) => onAttributesChange({ zahlungsweg: value })}>
                <SelectTrigger id="category-zahlungsweg" className="w-full">
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
              <Label htmlFor="category-merchant-alias">Händler-Alias</Label>
              <Input
                id="category-merchant-alias"
                value={attributes.merchant_alias || ''}
                onChange={(event) => onAttributesChange({ merchant_alias: event.target.value || null })}
                placeholder="z.B. Telekom"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="category-faelligkeitstag">Fälligkeitstag (1–31)</Label>
              <Input
                id="category-faelligkeitstag"
                type="number"
                min={1}
                max={31}
                value={attributes.faelligkeitstag ?? ''}
                onChange={(event) => onAttributesChange({ faelligkeitstag: event.target.value ? Number(event.target.value) : null })}
                placeholder="z.B. 15"
              />
            </div>
            <div>
              <Label htmlFor="category-next-due-date">Nächstes Fälligkeitsdatum</Label>
              <Input
                id="category-next-due-date"
                type="date"
                value={attributes.next_due_date ?? ''}
                onChange={(event) => onAttributesChange({ next_due_date: event.target.value || null })}
              />
            </div>
            <div>
              <Label htmlFor="category-kuendigungsfrist">Kündigungsfrist (Tage)</Label>
              <Input
                id="category-kuendigungsfrist"
                type="number"
                min={0}
                value={attributes.kuendigungsfrist_tage ?? ''}
                onChange={(event) => onAttributesChange({ kuendigungsfrist_tage: event.target.value ? Number(event.target.value) : null })}
                placeholder="z.B. 90"
              />
            </div>
            <div>
              <Label htmlFor="category-vertragsende">Vertragsende</Label>
              <Input
                id="category-vertragsende"
                type="date"
                value={attributes.vertragsende ?? ''}
                onChange={(event) => onAttributesChange({ vertragsende: event.target.value || null })}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="category-budget-monat">Monatsbudget (€)</Label>
              <Input
                id="category-budget-monat"
                type="number"
                min={0}
                value={attributes.budget_monat ?? ''}
                onChange={(event) => onAttributesChange({ budget_monat: event.target.value ? Number(event.target.value) : null })}
                placeholder="z.B. 100"
              />
            </div>
            <div>
              <Label htmlFor="category-warnschwelle">Warnschwelle (%)</Label>
              <Input
                id="category-warnschwelle"
                type="number"
                min={0}
                max={100}
                value={attributes.warnschwelle_prozent ?? ''}
                onChange={(event) => onAttributesChange({ warnschwelle_prozent: event.target.value ? Number(event.target.value) : null })}
                placeholder="z.B. 80"
              />
            </div>
            <div>
              <Label htmlFor="category-sort-index">Sortierreihenfolge</Label>
              <Input
                id="category-sort-index"
                type="number"
                value={attributes.sort_index ?? ''}
                onChange={(event) => onAttributesChange({ sort_index: event.target.value ? Number(event.target.value) : null })}
                placeholder="z.B. 1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="category-tag-input">Tags</Label>
            <div className="flex gap-2">
              <Input
                id="category-tag-input"
                value={newTagInput}
                onChange={(event) => setNewTagInput(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && handleAddTag()}
                placeholder="Tag hinzufügen"
              />
              <Button type="button" onClick={handleAddTag} size="sm" aria-label="Tag hinzufügen">
                <Plus className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag, index) => (
                  <Badge key={`${tag}-${index}`} variant="secondary" className="gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-1 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                      aria-label={`Tag ${tag} entfernen`}
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button type="button" onClick={onSave} className="flex-1">
            {editingCategory ? 'Aktualisieren' : 'Erstellen'}
          </Button>
          {(editingCategory || parentId) && (
            <Button type="button" onClick={onReset} variant="outline" aria-label="Formular zurücksetzen">
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
