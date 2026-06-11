import { useEffect, useMemo, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { Category } from '@/types';

interface CategoryTwoStepSelectProps {
  categories: Category[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

const NONE_VALUE = '__none__';
const MAIN_ONLY_VALUE = '__main_only__';

function buildCategoryIndex(categories: Category[]) {
  const byId = new Map<string, Category>();
  const childrenByParent = new Map<string, Category[]>();
  const mains: Category[] = [];
  for (const c of categories) byId.set(c.id, c);
  for (const c of categories) {
    if (!c.parent_id) mains.push(c);
    else {
      const arr = childrenByParent.get(c.parent_id) || [];
      arr.push(c);
      childrenByParent.set(c.parent_id, arr);
    }
  }
  mains.sort((a, b) => a.name.localeCompare(b.name));
  for (const arr of childrenByParent.values()) arr.sort((a, b) => a.name.localeCompare(b.name));
  return { byId, childrenByParent, mains };
}

function getRootAncestorId(byId: Map<string, Category>, id: string): string {
  let current = byId.get(id);
  let guard = 0;
  while (current?.parent_id && guard < 20) {
    const parent = byId.get(current.parent_id);
    if (!parent) break;
    current = parent;
    guard += 1;
  }
  return current?.id || id;
}

export function CategoryTwoStepSelect({ categories, value, onChange, disabled, className, placeholder = '—' }: CategoryTwoStepSelectProps) {
  const { byId, childrenByParent, mains } = useMemo(() => buildCategoryIndex(categories), [categories]);
  const [mainId, setMainId] = useState('');
  const [subId, setSubId] = useState('');

  const children = useMemo(() => (mainId ? childrenByParent.get(mainId) || [] : []), [childrenByParent, mainId]);

  useEffect(() => {
    if (!value) return setMainId(''), setSubId('');
    const cat = byId.get(value);
    if (!cat) return setMainId(''), setSubId('');
    if (!cat.parent_id) return setMainId(cat.id), setSubId('');
    const rootId = getRootAncestorId(byId, cat.id);
    setMainId(rootId);
    setSubId(cat.id);
  }, [value, byId]);

  const handleMainChange = (raw: string) => {
    const nextMainId = raw === NONE_VALUE ? '' : raw;
    setMainId(nextMainId);
    setSubId('');
    if (!nextMainId) return onChange('');
    const kids = childrenByParent.get(nextMainId) || [];
    onChange(kids.length === 0 ? nextMainId : nextMainId);
  };

  const handleSubChange = (raw: string) => {
    const nextSubId = raw === MAIN_ONLY_VALUE ? '' : raw;
    setSubId(nextSubId);
    if (!mainId) return onChange('');
    onChange(!nextSubId ? mainId : nextSubId);
  };

  return (
    <div className={`flex flex-col gap-2 ${className || ''}`.trim()}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary">1. Hauptkategorie</Badge>
        <Badge variant="secondary">2. Unterkategorie oder nur Hauptkategorie</Badge>
      </div>
      <div className="flex gap-2">
        <Select value={mainId} onValueChange={handleMainChange} disabled={disabled}>
          <SelectTrigger className="w-44"><SelectValue placeholder={placeholder} /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_VALUE}>Keine Kategorie</SelectItem>
            {mains.map((c) => <SelectItem key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {mainId && children.length > 0 && (
          <Select value={subId} onValueChange={handleSubChange} disabled={disabled}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Unterkategorie" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={MAIN_ONLY_VALUE}>Nur Hauptkategorie</SelectItem>
              {children.map((c) => <SelectItem key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}