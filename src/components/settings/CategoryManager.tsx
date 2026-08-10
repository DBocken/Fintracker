import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Folder, Tag, Sparkles } from 'lucide-react';
import { useI18n } from '@/i18n/useI18n';
import { CategoryForm } from './CategoryForm';
import { CategoryTree } from './CategoryTree';
import type { HierarchicalCategory, CategoryAttributes, Category, CategorySuggestion } from '../../types';

interface CategoryManagerProps {
  categories: HierarchicalCategory[];
  /**
   * Kategorie-Vorschlag aus dem ViewModel (`useSettingsOverview`). Bis WP 6.5b
   * fragte diese Komponente ihn selbst ab — eine Fläche mit eigener
   * Datenschicht (AGENTS.md §3/§4, `pnpm check:view-data`).
   */
  suggestion: CategorySuggestion | null;
  onCategoryDelete: (category: HierarchicalCategory) => void;
  onCategoryEdit: (category: HierarchicalCategory) => void;
  onCategorySave: (categoryData: Partial<Category> & { name: string }) => void;
  onApplySuggestion: () => void;
}

export function CategoryManager({ categories, suggestion, onCategoryDelete, onCategoryEdit, onCategorySave, onApplySuggestion }: CategoryManagerProps) {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('manage');
  const [selectedCategory, setSelectedCategory] = useState<HierarchicalCategory | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [newCategoryParentId, setNewCategoryParentId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState('#2e7d72');
  const [formIcon, setFormIcon] = useState('🛒');
  const [formFilters, setFormFilters] = useState<string[]>([]);
  const [formAttributes, setFormAttributes] = useState<CategoryAttributes>({});

  const filteredCategories = categories.filter((cat) => cat.name.toLowerCase().includes(searchQuery.toLowerCase()) || cat.filters.some((f) => f.toLowerCase().includes(searchQuery.toLowerCase())));

  useEffect(() => {
    setFormName(selectedCategory?.name || '');
    setFormColor(selectedCategory?.color || '#2e7d72');
    setFormIcon(selectedCategory?.icon || '🛒');
    setFormFilters(selectedCategory?.filters || []);
    setFormAttributes(selectedCategory?.attributes || {});
    setNewCategoryParentId(null);
  }, [selectedCategory]);

  const handleCategoryFormSave = () => onCategorySave({ id: selectedCategory?.id, name: formName, color: formColor, icon: formIcon, filters: formFilters, parent_id: selectedCategory ? selectedCategory.parent_id : newCategoryParentId, attributes: formAttributes });
  const handleCategoryFormReset = () => { setSelectedCategory(null); setFormName(''); setFormColor('#2e7d72'); setFormIcon('🛒'); setFormFilters([]); setFormAttributes({}); setNewCategoryParentId(null); };
  const handleEditCategoryClick = (category: HierarchicalCategory) => { setSelectedCategory(category); setNewCategoryParentId(category.parent_id ?? null); setActiveTab('create'); onCategoryEdit(category); };

  return (
    <div className="space-y-6">
      <Card className="border border-border bg-card shadow-sm">
        <CardHeader><CardTitle className="flex items-center gap-2 text-2xl"><Folder className="h-6 w-6 text-primary" />{t('categoryManager.title')}</CardTitle></CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manage">{t('categoryManager.manageTab')}</TabsTrigger>
              <TabsTrigger value="create">{t('categoryManager.createTab')}</TabsTrigger>
            </TabsList>
            <TabsContent value="manage" className="space-y-4">
              <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input placeholder={t('categoryManager.searchPlaceholder')} value={searchQuery} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)} className="pl-10" /></div>
              <CategoryTree categories={filteredCategories} expandedCategories={expandedCategories} onToggleExpand={(id) => setExpandedCategories((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; })} onEdit={handleEditCategoryClick} onDelete={onCategoryDelete} onAddSubcategory={(parentId) => { setSelectedCategory(null); setFormName(''); setFormColor('#2e7d72'); setFormIcon('🛒'); setFormFilters([]); setFormAttributes({}); setNewCategoryParentId(parentId); setActiveTab('create'); }} />
            </TabsContent>
            <TabsContent value="create" className="space-y-4">
              <CategoryForm name={formName} color={formColor} icon={formIcon} filters={formFilters} parentId={selectedCategory ? (selectedCategory.parent_id ?? null) : newCategoryParentId} editingCategory={selectedCategory} attributes={formAttributes} onNameChange={setFormName} onColorChange={setFormColor} onIconChange={setFormIcon} onAddFilter={(filter) => setFormFilters((prev) => [...prev, filter])} onRemoveFilter={(filterToRemove) => setFormFilters((prev) => prev.filter((f) => f !== filterToRemove))} onAttributesChange={(partial) => setFormAttributes((prev) => ({ ...prev, ...partial }))} onSave={handleCategoryFormSave} onReset={handleCategoryFormReset} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <Card className="border border-border bg-card shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Sparkles className="h-5 w-5" />{t('categoryManager.suggestionsTitle')}</CardTitle></CardHeader><CardContent><div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3"><div className="flex items-center gap-2 mb-2"><Tag className="h-4 w-4 text-primary" /><span className="text-sm font-medium">{suggestion ? t('categoryManager.ruleFoundTitle') : t('categoryManager.noSuggestionsTitle')}</span></div>{suggestion ? <><p className="text-sm text-muted-foreground">{t('categoryManager.suggestionsDescription').replace('{count}', String(suggestion.affectedCount)).replace('{category}', suggestion.category.name)}</p><Button size="sm" className="mt-2" onClick={onApplySuggestion} disabled={suggestion.affectedCount === 0}>{t('categoryManager.applySuggestionButton')}</Button></> : <p className="text-sm text-muted-foreground">{t('categoryManager.suggestionsEmptyHint')}</p>}</div></CardContent></Card>
    </div>
  );
}