'use client';

// Depreciation and work miles for one vehicle (migration 214). Vehicles have no
// price column, so the cost is entered here. Estimates, not tax advice.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import AssetDepreciationPanel from '@/components/equipment/AssetDepreciationPanel';

export default function VehicleDepreciationPage() {
  const { id } = useParams<{ id: string }>();
  const [name, setName] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/equipment/depreciation?kind=vehicle&id=${id}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) { setNotFound(true); return; }
        const d = await r.json();
        setName(d.item?.name ?? 'Vehicle');
      })
      .catch(() => setNotFound(true));
  }, [id]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/dashboard/travel" className="min-h-11 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Travel
      </Link>
      {notFound ? (
        <p className="text-sm text-gray-500">Vehicle not found.</p>
      ) : name === null ? (
        <p role="status" className="text-sm text-gray-500">Loading...</p>
      ) : (
        <>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{name}</h1>
            <p className="text-sm text-gray-500">Depreciation, work miles and cost per mile. Miles come from this vehicle&apos;s trips.</p>
          </div>
          <AssetDepreciationPanel kind="vehicle" id={id} name={name} />
        </>
      )}
    </div>
  );
}
