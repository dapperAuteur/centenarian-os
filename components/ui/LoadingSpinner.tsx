// components/ui/LoadingSpinner.tsx
// Accessible loading indicator with screen-reader support.
// Wraps Loader2 with role="status" and aria-live for WCAG compliance.

import { Loader2 } from 'lucide-react';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

const SIZE_MAP = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

export default function LoadingSpinner({ size = 'md', className = '', label = 'Loading...' }: Props) {
  return (
    <div role="status" aria-live="polite" className={`inline-flex items-center justify-center ${className}`}>
      <Loader2 className={`${SIZE_MAP[size]} animate-spin`} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
