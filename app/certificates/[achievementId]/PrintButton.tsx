'use client';

import { Printer } from 'lucide-react';

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-1.5 px-4 py-2 bg-fuchsia-600 text-white text-sm rounded-lg font-medium hover:bg-fuchsia-700 transition"
    >
      <Printer className="w-4 h-4" />
      Save as PDF
    </button>
  );
}
