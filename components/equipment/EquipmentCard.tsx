'use client';

import { Package, TrendingDown, TrendingUp } from 'lucide-react';
import Image from 'next/image';

interface Category {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
}

export interface EquipmentItem {
  id: string;
  name: string;
  category_id: string | null;
  equipment_categories: Category | null;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  current_value: number | null;
  warranty_expires: string | null;
  condition: string | null;
  image_url: string | null;
  image_public_id: string | null;
  notes: string | null;
  is_active: boolean;
  transaction_id: string | null;
}

interface EquipmentCardProps {
  item: EquipmentItem;
  onClick?: () => void;
}

export default function EquipmentCard({ item, onClick }: EquipmentCardProps) {
  const purchase = Number(item.purchase_price) || 0;
  const current = Number(item.current_value) || 0;
  const diff = current - purchase;
  const diffPct = purchase > 0 ? (diff / purchase) * 100 : 0;
  const catName = item.equipment_categories?.name;
  const catColor = item.equipment_categories?.color;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-white border border-gray-200 rounded-2xl p-4 hover:border-gray-300 hover:shadow-sm transition"
    >
      <div className="flex gap-3">
        {/* Image or placeholder */}
        <div className="w-16 h-16 rounded-xl bg-gray-100 shrink-0 overflow-hidden flex items-center justify-center">
          {item.image_url ? (
            <Image
              src={item.image_url}
              alt={item.name}
              width={64}
              height={64}
              className="w-full h-full object-cover"
            />
          ) : (
            <Package className="w-6 h-6 text-gray-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 truncate">{item.name}</h3>
              {(item.brand || item.model) && (
                <p className="text-xs text-gray-500 truncate">
                  {[item.brand, item.model].filter(Boolean).join(' ')}
                </p>
              )}
            </div>
            {catName && (
              <span
                className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium border"
                style={catColor ? {
                  backgroundColor: `${catColor}15`,
                  color: catColor,
                  borderColor: `${catColor}40`,
                } : undefined}
              >
                {catName}
              </span>
            )}
          </div>

          {/* Value row */}
          <div className="flex items-center gap-3 mt-2">
            {purchase > 0 && (
              <span className="text-xs text-gray-500">
                Paid <span className="font-medium text-gray-700">${purchase.toLocaleString()}</span>
              </span>
            )}
            {current > 0 && purchase > 0 && (
              <span className={`text-xs flex items-center gap-0.5 ${diff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {diff >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {diffPct >= 0 ? '+' : ''}{diffPct.toFixed(0)}%
              </span>
            )}
            {item.condition && (
              <span className="text-[10px] text-gray-400 capitalize">{item.condition}</span>
            )}
          </div>
        </div>
      </div>

      {!item.is_active && (
        <span className="mt-2 inline-block text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
          Retired
        </span>
      )}
    </button>
  );
}
