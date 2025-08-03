import React, { useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { Target, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Transaction } from '@/types';

interface BudgetGoal {
  id: string;
  category: string;
  target: number;
  current: number;
  period: 'monthly' | 'yearly';
}

interface BudgetGoalsProps {
  transactions: Transaction[];
}

export const BudgetGoals: React.FC<BudgetGoalsProps> = ({ transactions }) => {
  const [goals, setGoals] = useState<BudgetGoal[]>([
    { id: '1', category: 'Groceries', target: 500, current: 350, period: 'monthly' },
    { id: '2', category: 'Entertainment', target: 200, current: 150, period: 'monthly' },
    { id: '3', category: 'Transport', target: 150, current: 100, period: 'monthly' },
  ]);

  const [newGoal, setNewGoal] = useState({ category: '', target: 0, period: 'monthly' as const });
  const [editingGoal, setEditingGoal] = useState<BudgetGoal | null>(null);
  const [editValues, setEditValues] = useState({ category: '', target: 0, period: 'monthly' as const });

  const calculateCurrent = (category: string) => {
    return Math.abs(
      transactions
        .filter(t => t.amount < 0 && t.category === category)
        .reduce((sum, t) => sum + t.amount, 0)
    );
  };

  const getProgress = (goal: BudgetGoal) => {
    const current = calculateCurrent(goal.category);
    return Math.min((current / goal.target) * 100, 100);
  };

  const getStatusColor = (progress: number) => {
    if (progress >= 100) return 'text-red-600';
    if (progress >= 80) return 'text-yellow-600';
    return 'text-green-600';
  };

  const addGoal = () => {
    if (newGoal.category && newGoal.target > 0) {
      setGoals([...goals, { ...newGoal, id: Date.now().toString(), current: 0 }]);
      setNewGoal({ category: '', target: 0, period: 'monthly' });
    }
  };

  const saveGoal = () => {
    if (editingGoal) {
      setGoals(
        goals.map((g) =>
          g.id === editingGoal.id ? { ...g, ...editValues } : g
        )
      );
      setEditingGoal(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Budgeting & Goals</h2>
          <p className="text-muted-foreground">
            Set and track your spending limits
          </p>
        </div>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Goal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Budget Goal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Category</Label>
                <Input
                  value={newGoal.category}
                  onChange={(e) => setNewGoal({ ...newGoal, category: e.target.value })}
                  placeholder="e.g., Dining, Shopping"
                />
              </div>
              <div>
                <Label>Monthly Target</Label>
                <Input
                  type="number"
                  value={newGoal.target}
                  onChange={(e) => setNewGoal({ ...newGoal, target: parseFloat(e.target.value) || 0 })}
                  placeholder="500"
                />
              </div>
              <Button onClick={addGoal}>Add Goal</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {goals.map((goal) => {
          const progress = getProgress(goal);
          const current = calculateCurrent(goal.category);

          return (
            <Card key={goal.id} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-semibold">{goal.category}</h3>
                  <p className="text-sm text-muted-foreground">{goal.period}</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(current)} / {formatCurrency(goal.target)}</p>
                    <p className={`text-sm ${getStatusColor(progress)}`}>
                      {progress.toFixed(0)}% used
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingGoal(goal);
                      setEditValues({
                        category: goal.category,
                        target: goal.target,
                        period: goal.period,
                      });
                    }}
                  >
                    Edit
                  </Button>
                </div>
              </div>
              <Progress value={progress} className="w-full" />
            </Card>
          );
        })}
      </div>

      <Dialog open={!!editingGoal} onOpenChange={(open) => !open && setEditingGoal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Budget Goal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Category</Label>
              <Input
                value={editValues.category}
                onChange={(e) =>
                  setEditValues({ ...editValues, category: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Monthly Target</Label>
              <Input
                type="number"
                value={editValues.target}
                onChange={(e) =>
                  setEditValues({
                    ...editValues,
                    target: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            <Button onClick={saveGoal}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {goals.length === 0 && (
        <Card className="p-8 text-center">
          <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            No budget goals set yet. Add your first goal to start tracking spending.
          </p>
        </Card>
      )}
    </div>
  );
};
