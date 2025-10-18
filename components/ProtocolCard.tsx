// File: components/ProtocolCard.tsx

import { ProtocolWithIngredients } from '@/lib/types';
import { Edit2, Trash2 } from 'lucide-react';

interface ProtocolCardProps {
  protocol: ProtocolWithIngredients;
  onEdit: (protocol: ProtocolWithIngredients) => void;
  onDelete: (id: string) => void;
}

const NCV_COLORS = {
  Green: 'bg-lime-100 text-lime-800 border-lime-500',
  Yellow: 'bg-amber-100 text-amber-800 border-amber-500',
  Red: 'bg-red-100 text-red-800 border-red-500',
};

export function ProtocolCard({ protocol, onEdit, onDelete }: ProtocolCardProps) {
  const ingredientCount = protocol.protocol_ingredients?.length || 0;

  return (
    <div className={`bg-white rounded-xl shadow-md border-l-4 ${NCV_COLORS[protocol.ncv_score].split(' ')[2]} p-4 hover:shadow-lg transition`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex-grow">
          <h3 className="text-lg font-bold text-gray-900">{protocol.name}</h3>
          <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold mt-1 ${NCV_COLORS[protocol.ncv_score]}`}>
            {protocol.ncv_score}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(protocol)}
            className="text-gray-400 hover:text-sky-600 transition"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(protocol.id)}
            className="text-gray-400 hover:text-red-600 transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {protocol.description && (
        <p className="text-sm text-gray-600 mb-3">{protocol.description}</p>
      )}

      <div className="space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-gray-500">Calories:</span>
            <span className="font-semibold text-gray-900 ml-1">{protocol.total_calories.toFixed(0)}</span>
          </div>
          <div>
            <span className="text-gray-500">Protein:</span>
            <span className="font-semibold text-gray-900 ml-1">{protocol.total_protein.toFixed(1)}g</span>
          </div>
        </div>

        <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
          <div>
            <span className="text-gray-500">Cost:</span>
            <span className="font-semibold text-gray-900 ml-1">${protocol.total_cost.toFixed(2)}</span>
          </div>
          <div className="text-xs text-gray-500">
            {ingredientCount} ingredient{ingredientCount !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    </div>
  );
}