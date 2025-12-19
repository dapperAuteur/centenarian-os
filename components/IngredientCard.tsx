// File: components/IngredientCard.tsx

import { Ingredient } from '@/lib/types';
import { Edit2, Trash2 } from 'lucide-react';

interface IngredientCardProps {
  ingredient: Ingredient;
  onEdit: (ingredient: Ingredient) => void;
  onDelete: (id: string) => void;
}

const NCV_COLORS = {
  Green: 'bg-lime-100 text-lime-800 border-lime-500',
  Yellow: 'bg-amber-100 text-amber-800 border-amber-500',
  Red: 'bg-red-100 text-red-800 border-red-500',
};

export function IngredientCard({ ingredient, onEdit, onDelete }: IngredientCardProps) {
  return (
    <div className={`bg-white rounded-xl shadow-md border-l-4 ${NCV_COLORS[ingredient.ncv_score].split(' ')[2]} p-4 hover:shadow-lg transition`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex-grow">
          <h3 className="text-lg font-bold text-gray-900">{ingredient.name}</h3>
          <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold mt-1 ${NCV_COLORS[ingredient.ncv_score]}`}>
            {ingredient.ncv_score}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(ingredient)}
            className="text-gray-400 hover:text-sky-600 transition"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(ingredient.id)}
            className="text-gray-400 hover:text-red-600 transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-gray-500">Calories:</span>
            <span className="font-semibold text-gray-900 ml-1">{Number(ingredient.calories_per_100g).toFixed(2)}</span>
          </div>
          <div>
            <span className="text-gray-500">Protein:</span>
            <span className="font-semibold text-gray-900 ml-1">{Number(ingredient.protein_per_100g).toFixed(2)}g</span>
          </div>
          <div>
            <span className="text-gray-500">Carbs:</span>
            <span className="font-semibold text-gray-900 ml-1">{Number(ingredient.carbs_per_100g).toFixed(2)}g</span>
          </div>
          <div>
            <span className="text-gray-500">Fat:</span>
            <span className="font-semibold text-gray-900 ml-1">{Number(ingredient.fat_per_100g).toFixed(2)}g</span>
          </div>
        </div>

        <div className="pt-2 border-t border-gray-200">
          <span className="text-gray-500">Cost:</span>
          <span className="font-semibold text-gray-900 ml-1">
            ${ingredient.cost_per_unit.toFixed(2)}/{ingredient.unit}
          </span>
        </div>

        {ingredient.notes && (
          <p className="text-gray-600 text-xs pt-2 border-t border-gray-200">
            {ingredient.notes}
          </p>
        )}
      </div>
    </div>
  );
}