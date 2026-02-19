'use client';

import { useState } from 'react';
import { ChefHat } from 'lucide-react';
import AddToFuelModal from '@/components/recipes/AddToFuelModal';
import type { Recipe } from '@/lib/types';

interface AddToFuelButtonProps {
  recipe: Pick<Recipe, 'id' | 'title'>;
}

export default function AddToFuelButton({ recipe }: AddToFuelButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition"
      >
        <ChefHat className="w-4 h-4" />
        Add to my Fuel
      </button>
      <AddToFuelModal
        recipe={recipe}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
