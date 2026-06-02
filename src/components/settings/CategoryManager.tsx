"use client";

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Folder, Tag, Sparkles } from 'lucide-react';
import { CategoryForm } from './CategoryForm';
import { CategoryTree } from './CategoryTree';
import type { HierarchicalCategory, CategoryAttributes } from '../../types';
import { getTopCategorySuggestion, type CategorySuggestion } from '../../services/transaction-service';

interface CategoryManagerProps {
  categories: HierarchicalCategory[];
  onCategoryDelete: (category: HierarchicalCategory) => void;
  onCategoryEdit: (category: HierarchicalCategory) => void;
  onCategorySave: (categoryData: any) => void;
  onApplySuggestion: () => void;
}

export function CategoryManager({ categories, onCategoryDelete, onCategoryEdit, onCategorySave, onApplySuggestion }: CategoryManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('manage');
  const [selectedCategory, setSelectedCategory] = useState<HierarchicalCategory | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [newCategoryParentId, setNewCategoryParentId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState('#22c55e');
  const [formIcon, setFormIcon] = useState('🛒');
  const [formFilters, setFormFilters] = useState<string[]>([]);
  const [formAttributes, setFormAttributes] = useState<CategoryAttributes>({});

  const filteredCategories = categories.filter((cat) => cat.name.toLowerCase().includes(searchQuery.toLowerCase()) || cat.filters.some((f) => f.toLowerCase().includes(searchQuery.toLowerCase())));

  useEffect(() => {
    setFormName(selectedCategory?.name || '');
    setFormColor(selectedCategory?.color || '#22c55e');
    setFormIcon(selectedCategory?.icon || '🛒');
    setFormFilters(selectedCategory?.filters || []);
    setFormAttributes(selectedCategory?.attributes || {});
    setNewCategoryParentId(null);
  }, [selectedCategory]);

  const handleCategoryFormSave = () => onCategorySave({ id: selectedCategory?.id, name: formName, color: formColor, icon: formIcon, filters: formFilters, parent_id: selectedCategory ? selectedCategory.parent_id : newCategoryParentId, attributes: formAttributes });
  const handleCategoryFormReset = () => { setSelectedCategory(null); setFormName(''); setFormColor('#22c55e'); setFormIcon('🛒'); setFormFilters([]); setFormAttributes({}); setNewCategoryParentId(null); };
  const handleEditCategoryClick = (category: HierarchicalCategory) => { setSelectedCategory(category); setNewCategoryParentId(category.parent_id ?? null); setActiveTab('create'); onCategoryEdit(category); };
  const { data: suggestion } = useQuery<CategorySuggestion | null>({ queryKey: ['category-suggestion'], queryFn: getTopCategorySuggestion });

  return (
    <div className="space-y-6">
      <Card className="border border-border bg-card shadow-sm">
        <CardHeader><CardTitle className="flex items-center gap-2 text-2xl"><Folder className="h-6 w-6 text-primary" />Kategorieverwaltung</CardTitle></CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manage">Verwalten</TabsTrigger>
              <TabsTrigger value="create">Erstellen</TabsTrigger>
            </TabsList>
            <TabsContent value="manage" className="space-y-4">
              <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input placeholder="Kategorien oder Filter suchen..." value={searchQuery} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)} className="pl-10" /></div>
              <CategoryTree categories={filteredCategories} expandedCategories={expandedCategories} onToggleExpand={(id) => setExpandedCategories((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; })} onEdit={handleEditCategoryClick} onDelete={onCategoryDelete} onAddSubcategory={(parentId) => { setSelectedCategory(null); setFormName(''); setFormColor('#22c55e'); setFormIcon('🛒'); setFormFilters([]); setFormAttributes({}); setNewCategoryParentId(parentId); setActiveTab('create'); }} />
            </TabsContent>
            <TabsContent value="create" className="space-y-4">
              <CategoryForm name={formName} color={formColor} icon={formIcon} filters={formFilters} parentId={selectedCategory ? (selectedCategory.parent_id ?? null) : newCategoryParentId} editingCategory={selectedCategory} attributes={formAttributes} onNameChange={setFormName} onColorChange={setFormColor} onIconChange={setFormIcon} onAddFilter={(filter) => setFormFilters((prev) => [...prev, filter])} onRemoveFilter={(filterToRemove) => setFormFilters((prev) => prev.filter((f) => f !== filterToRemove))} onAttributesChange={(partial) => setFormAttributes((prev) => ({ ...prev, ...partial }))} onSave={handleCategoryFormSave} onReset={handleCategoryFormReset} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <Card className="border border-border bg-card shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Sparkles className="h-5 w-5" />Intelligente Vorschläge</CardTitle></CardHeader><CardContent><div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3"><div className="flex items-center gap-2 mb-2"><Tag className="h-4 w-4 text-primary" /><span className="text-sm font-medium">{suggestion ? 'Neue Regel gefunden' : 'Noch keine Vorschläge'}</span></div>{suggestion ? <><p className="text-sm text-muted-foreground">{suggestion.affectedCount} Transaktionen könnten zur Kategorie "{suggestion.category.name}" passen.</p><Button size="sm" className="mt-2" onClick={onApplySuggestion} disabled={suggestion.affectedCount === 0}>Regel anwenden</Button></> : <p className="text-sm text-muted-foreground">Lade neue Transaktionen oder füge Filter hinzu, um Vorschläge zu erhalten.</p>}</div></CardContent></Card>
    </div>
  );
}