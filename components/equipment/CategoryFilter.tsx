'use client';

interface Category {
  id: string;
  name: string;
  color?: string | null;
}

interface CategoryFilterProps {
  categories: Category[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}

export default function CategoryFilter({ categories, selected, onSelect }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
          selected === null
            ? 'bg-gray-900 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          onClick={() => onSelect(cat.id)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
            selected === cat.id
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          style={selected === cat.id && cat.color ? {
            backgroundColor: cat.color,
          } : undefined}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}
