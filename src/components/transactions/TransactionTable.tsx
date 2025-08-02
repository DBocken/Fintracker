import React, { useState } from 'react';
import { formatDate, formatCurrency } from '@/lib/utils';
import { Search, Filter, Tag, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Transaction {
  id: number;
  date: Date;
  amount: number;
  recipient?: string;
  category?: string;
  description?: string;
}

interface TransactionTableProps {
  transactions: Transaction[];
  onCategoryChange: (id: number, category: string) => void;
}

export const TransactionTable: React.FC<TransactionTableProps> = ({ 
  transactions, 
  onCategoryChange 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const categories = Array.from(new Set(transactions.map(t => t.category).filter(Boolean)));

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = !searchTerm || 
      transaction.recipient?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || transaction.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  const sortedTransactions = [...filteredTransactions].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full mt-1 p-2 border rounded-md"
                >
                  <option value="all">All categories</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 px-4 font-medium">Date</th>
              <th className="text-left py-3 px-4 font-medium">Description</th>
              <th className="text-left py-3 px-4 font-medium">Category</th>
              <th className="text-right py-3 px-4 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {sortedTransactions.map((transaction) => (
              <tr key={transaction.id} className="border-b hover:bg-muted/50">
                <td className="py-3 px-4">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{formatDate(transaction.date)}</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div>
                    <p className="font-medium">{transaction.recipient || 'Unknown'}</p>
                    <p className="text-sm text-muted-foreground">{transaction.description}</p>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <Badge 
                    variant={transaction.category ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      const newCategory = prompt('Enter category:', transaction.category || '');
                      if (newCategory !== null) {
                        onCategoryChange(transaction.id, newCategory);
                      }
                    }}
                  >
                    <Tag className="h-3 w-3 mr-1" />
                    {transaction.category || 'Uncategorized'}
                  </Badge>
                </td>
                <td className="py-3 px-4 text-right">
                  <span className={transaction.amount > 0 ? 'text-green-600' : 'text-red-600'}>
                    {formatCurrency(transaction.amount)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};