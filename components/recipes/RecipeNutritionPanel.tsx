'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Recipe } from '@/lib/types';
import { perServing } from '@/lib/recipes/nutrition';

interface RecipeNutritionPanelProps {
  recipe: Pick<
    Recipe,
    'total_calories' | 'total_protein_g' | 'total_carbs_g' | 'total_fat_g' | 'total_fiber_g' |
    'ncv_score' | 'servings'
  >;
}

const NCV_CONFIG = {
  Green: { label: 'Nutrient Dense', color: 'text-green-700 bg-green-100', dot: 'bg-green-500' },
  Yellow: { label: 'Moderate', color: 'text-yellow-700 bg-yellow-100', dot: 'bg-yellow-500' },
  Red: { label: 'Calorie Dense', color: 'text-red-700 bg-red-100', dot: 'bg-red-500' },
};

export default function RecipeNutritionPanel({ recipe }: RecipeNutritionPanelProps) {
  const [open, setOpen] = useState(false);

  const hasNutrition = recipe.total_calories != null;
  if (!hasNutrition) return null;

  const totals = {
    total_calories: recipe.total_calories!,
    total_protein_g: recipe.total_protein_g ?? 0,
    total_carbs_g: recipe.total_carbs_g ?? 0,
    total_fat_g: recipe.total_fat_g ?? 0,
    total_fiber_g: recipe.total_fiber_g ?? 0,
    ncv_score: (recipe.ncv_score ?? 'Yellow') as 'Green' | 'Yellow' | 'Red',
  };

  const perSv = recipe.servings && recipe.servings > 1
    ? perServing(totals, recipe.servings)
    : null;

  const ncvConfig = NCV_CONFIG[totals.ncv_score];

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition"
      >
        <div className="flex items-center gap-3">
          <span className="font-medium text-sm text-gray-900">Nutrition Info</span>
          {recipe.ncv_score && (
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${ncvConfig.color}`}>
              <span className={`w-2 h-2 rounded-full ${ncvConfig.dot}`} />
              {ncvConfig.label}
            </span>
          )}
          <span className="text-sm text-gray-500">{Math.round(totals.total_calories)} kcal total</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 py-4 bg-white">
          {perSv && (
            <p className="text-xs text-gray-500 mb-3">
              Per serving ({recipe.servings} servings total)
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Calories', value: Math.round(perSv?.total_calories ?? totals.total_calories), unit: 'kcal' },
              { label: 'Protein', value: (perSv?.total_protein_g ?? totals.total_protein_g).toFixed(1), unit: 'g' },
              { label: 'Carbs', value: (perSv?.total_carbs_g ?? totals.total_carbs_g).toFixed(1), unit: 'g' },
              { label: 'Fat', value: (perSv?.total_fat_g ?? totals.total_fat_g).toFixed(1), unit: 'g' },
              { label: 'Fiber', value: (perSv?.total_fiber_g ?? totals.total_fiber_g).toFixed(1), unit: 'g' },
            ].map(({ label, value, unit }) => (
              <div key={label} className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-lg font-semibold text-gray-900">{value}</div>
                <div className="text-xs text-gray-500">{unit}</div>
                <div className="text-xs text-gray-400">{label}</div>
              </div>
            ))}
          </div>
          {perSv && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                Total recipe: {Math.round(totals.total_calories)} kcal · {totals.total_protein_g.toFixed(1)}g protein
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
