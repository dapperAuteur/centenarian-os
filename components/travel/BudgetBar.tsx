'use client';

interface BudgetBarProps {
  budget: number | null;
  spent: number | null;
}

export default function BudgetBar({ budget, spent }: BudgetBarProps) {
  if (!budget) return null;

  const actualSpent = spent ?? 0;
  const percentage = (actualSpent / budget) * 100;
  const barWidth = Math.min(100, percentage);
  const overAmount = actualSpent - budget;

  const barColor =
    percentage > 100
      ? 'bg-red-500'
      : percentage >= 80
        ? 'bg-amber-500'
        : 'bg-green-500';

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-sm mb-1">
        <span>Budget</span>
        <span>
          ${actualSpent.toFixed(2)} / ${budget.toFixed(2)}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      {overAmount > 0 && (
        <p className="text-xs text-red-500 mt-1">
          Over by ${overAmount.toFixed(2)}
        </p>
      )}
    </div>
  );
}
