// components/planner/ScheduleExpenseLinker.tsx
'use client';

import { useState, useEffect } from 'react';
import { Search, X, Receipt, Tag } from 'lucide-react';
import type { ScheduleExpense } from '@/lib/types';

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  vendor: string;
  transaction_date: string;
  category_id: string | null;
}

interface ScheduleExpenseLinkerProps {
  templateId: string;
  expenses: (ScheduleExpense & { transaction?: Transaction })[];
  employmentType?: string;
  onLink: (transactionId: string, isDeductible: boolean) => Promise<void>;
  onUnlink: (expenseId: string) => Promise<void>;
  onToggleDeductible?: (expenseId: string, isDeductible: boolean) => Promise<void>;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export default function ScheduleExpenseLinker({
  templateId,
  expenses,
  employmentType,
  onLink,
  onUnlink,
  onToggleDeductible,
}: ScheduleExpenseLinkerProps) {
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  const is1099 = employmentType === '1099';
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.transaction?.amount || 0), 0);
  const deductibleTotal = expenses
    .filter(e => e.is_deductible)
    .reduce((sum, e) => sum + (e.transaction?.amount || 0), 0);

  // Search transactions when query changes
  useEffect(() => {
    if (!searching || !query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/finance/transactions?q=${encodeURIComponent(query)}&type=expense&limit=10`
        );
        if (res.ok) {
          const data = await res.json();
          // Filter out already-linked transactions
          const linkedIds = new Set(expenses.map(e => e.transaction_id));
          setResults((data.transactions || data).filter((t: Transaction) => !linkedIds.has(t.id)));
        }
      } catch (err) {
        console.error('[ScheduleExpenseLinker] Search failed:', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, searching, expenses]);

  const handleLink = async (transaction: Transaction) => {
    await onLink(transaction.id, false);
    setQuery('');
    setResults([]);
    setSearching(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-gray-500" aria-hidden="true" />
          <h4 className="text-sm font-medium text-gray-700">Job Expenses</h4>
        </div>
        <button
          type="button"
          onClick={() => setSearching(!searching)}
          className="min-h-11 text-sm text-sky-600 hover:text-sky-700 font-medium"
        >
          {searching ? 'Close' : '+ Link Expense'}
        </button>
      </div>

      {/* Summary */}
      {expenses.length > 0 && (
        <div className="flex gap-4 text-sm">
          <span className="text-gray-600">Total: {formatCurrency(totalExpenses)}</span>
          {is1099 && (
            <span className="text-green-600">Deductible: {formatCurrency(deductibleTotal)}</span>
          )}
        </div>
      )}

      {/* Search bar */}
      {searching && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search transactions by vendor, description, or amount..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
            autoFocus
          />
          {loading && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Searching...</span>}

          {results.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {results.map(txn => (
                <button
                  key={txn.id}
                  type="button"
                  onClick={() => handleLink(txn)}
                  className="min-h-11 w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{txn.vendor || txn.description}</p>
                      <p className="text-xs text-gray-500">{txn.transaction_date}</p>
                    </div>
                    <p className="text-sm font-medium text-red-600">{formatCurrency(txn.amount)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Linked expenses list */}
      {expenses.length > 0 && (
        <div className="space-y-2">
          {expenses.map(expense => (
            <div
              key={expense.id}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {expense.transaction?.vendor || expense.transaction?.description || expense.description || 'Expense'}
                </p>
                <p className="text-xs text-gray-500">{expense.expense_date}</p>
              </div>
              <p className="text-sm font-medium text-gray-700 shrink-0">
                {formatCurrency(expense.transaction?.amount || 0)}
              </p>
              {is1099 && onToggleDeductible && (
                <button
                  type="button"
                  onClick={() => onToggleDeductible(expense.id, !expense.is_deductible)}
                  className={`min-h-11 min-w-11 flex items-center justify-center rounded-lg border ${
                    expense.is_deductible
                      ? 'bg-green-100 border-green-300 text-green-700'
                      : 'bg-white border-gray-300 text-gray-400'
                  }`}
                  title={expense.is_deductible ? 'Tax deductible' : 'Not deductible'}
                  aria-label={expense.is_deductible ? 'Mark as not deductible' : 'Mark as tax deductible'}
                >
                  <Tag className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onUnlink(expense.id)}
                className="min-h-11 min-w-11 flex items-center justify-center text-red-400 hover:text-red-600"
                aria-label="Unlink expense"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      {expenses.length === 0 && !searching && (
        <p className="text-sm text-gray-400">No expenses linked to this schedule</p>
      )}
    </div>
  );
}
