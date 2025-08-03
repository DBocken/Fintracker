import React, { useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Transaction {
  id?: number;
  date: Date;
  amount: number;
  recipient?: string;
  category?: string;
  raw?: Record<string, string>;
}

interface Rule {
  id?: number;
  name: string;
  category: string;
  conditions: any;
  matches: (tx: Transaction) => boolean;
}

interface Condition {
  id: string;
  field: 'recipient' | 'amount' | 'description';
  operator: 'contains' | 'equals' | 'greater_than' | 'less_than' | 'starts_with';
  value: string;
}

interface RuleForm {
  name: string;
  category: string;
  conditions: Condition[];
  matchType: 'all' | 'any';
}

interface RuleBuilderProps {
  onRulesUpdated: () => void;
}

// Simple in-memory storage for client-side
let rules: Rule[] = [];
let transactions: Transaction[] = [];

export const RuleBuilder: React.FC<RuleBuilderProps> = ({ onRulesUpdated }) => {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<RuleForm>({
    name: '',
    category: '',
    conditions: [{ id: '1', field: 'recipient', operator: 'contains', value: '' }],
    matchType: 'any'
  });

  React.useEffect(() => {
    loadRules();
  }, []);

  const loadRules = () => {
    // Load from localStorage for persistence
    const savedRules = localStorage.getItem('fintrack-rules');
    if (savedRules) {
      rules = JSON.parse(savedRules);
    }
  };

  const addCondition = () => {
    setFormData(prev => ({
      ...prev,
      conditions: [...prev.conditions, { 
        id: Date.now().toString(), 
        field: 'recipient', 
        operator: 'contains', 
        value: '' 
      }]
    }));
  };

  const removeCondition = (id: string) => {
    setFormData(prev => ({
      ...prev,
      conditions: prev.conditions.filter(c => c.id !== id)
    }));
  };

  const updateCondition = (id: string, updates: Partial<Condition>) => {
    setFormData(prev => ({
      ...prev,
      conditions: prev.conditions.map(c => 
        c.id === id ? { ...c, ...updates } : c
      )
    }));
  };

  const saveRule = () => {
    if (!formData.name || !formData.category || formData.conditions.some(c => !c.value)) {
      alert('Please fill all required fields');
      return;
    }

    const rule: Rule = {
      name: formData.name,
      category: formData.category,
      conditions: {
        matchType: formData.matchType,
        conditions: formData.conditions
      },
      matches: (tx: Transaction) => {
        const results = formData.conditions.map(condition => {
          const value = tx[condition.field as keyof Transaction] as string;
          
          switch (condition.operator) {
            case 'contains':
              return value?.toLowerCase().includes(condition.value.toLowerCase()) || false;
            case 'equals':
              return value?.toLowerCase() === condition.value.toLowerCase();
            case 'starts_with':
              return value?.toLowerCase().startsWith(condition.value.toLowerCase());
            case 'greater_than':
              return parseFloat(value) > parseFloat(condition.value);
            case 'less_than':
              return parseFloat(value) < parseFloat(condition.value);
            default:
              return false;
          }
        });

        return formData.matchType === 'all' 
          ? results.every(r => r)
          : results.some(r => r);
      }
    };

    rules.push(rule);
    localStorage.setItem('fintrack-rules', JSON.stringify(rules));
    setShowForm(false);
    setFormData({
      name: '',
      category: '',
      conditions: [{ id: '1', field: 'recipient', operator: 'contains', value: '' }],
      matchType: 'any'
    });
    onRulesUpdated();
  };

  const deleteRule = (index: number) => {
    rules.splice(index, 1);
    localStorage.setItem('fintrack-rules', JSON.stringify(rules));
    onRulesUpdated();
  };

  const applyRules = () => {
    // Apply rules to transactions (would be called from parent component)
    onRulesUpdated();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Categorization Rules</h2>
          <p className="text-muted-foreground">
            Create rules to automatically categorize transactions
          </p>
        </div>
        <div className="space-x-2">
          <Button onClick={applyRules} variant="outline">
            Apply Rules
          </Button>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Rule
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Rule Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Supermarket Expenses"
                />
              </div>
              <div>
                <Label>Category</Label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="e.g., Groceries"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Label>Match Type:</Label>
              <Select
                value={formData.matchType}
                onValueChange={(value: 'all' | 'any') => 
                  setFormData(prev => ({ ...prev, matchType: value }))
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any condition</SelectItem>
                  <SelectItem value="all">All conditions</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Conditions</Label>
              {formData.conditions.map((condition) => (
                <div key={condition.id} className="flex items-center space-x-2">
                  <Select
                    value={condition.field}
                    onValueChange={(value) => updateCondition(condition.id, { field: value as any })}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recipient">Recipient</SelectItem>
                      <SelectItem value="amount">Amount</SelectItem>
                      <SelectItem value="description">Description</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={condition.operator}
                    onValueChange={(value) => updateCondition(condition.id, { operator: value as any })}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contains">Contains</SelectItem>
                      <SelectItem value="equals">Equals</SelectItem>
                      <SelectItem value="starts_with">Starts with</SelectItem>
                      <SelectItem value="greater_than">Greater than</SelectItem>
                      <SelectItem value="less_than">Less than</SelectItem>
                    </SelectContent>
                  </Select>

                  <Input
                    value={condition.value}
                    onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                    placeholder="Value"
                    className="flex-1 min-w-[12rem]"
                  />

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCondition(condition.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              
              <Button
                variant="outline"
                size="sm"
                onClick={addCondition}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Condition
              </Button>
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
              <Button onClick={saveRule}>
                <Save className="h-4 w-4 mr-2" />
                Save Rule
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-4">
        {rules.map((rule, index) => (
          <Card key={index} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{rule.name}</h3>
                <p className="text-sm text-muted-foreground">
                  Category: {rule.category}
                </p>
                <p className="text-xs text-muted-foreground">
                  {rule.conditions.conditions.length} conditions • 
                  {rule.conditions.matchType === 'all' ? 'All must match' : 'Any can match'}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteRule(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {rules.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            No rules created yet. Create your first rule to automatically categorize transactions.
          </p>
        </Card>
      )}
    </div>
  );
};