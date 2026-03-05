// app/institutions/page.tsx
// Public institution directory — searchable list of aggregated institution data.

import { Metadata } from 'next';
import InstitutionDirectory from './InstitutionDirectory';

export const metadata: Metadata = {
  title: 'Financial Institutions Directory | CentenarianOS',
  description: 'Compare APRs, fees, rewards, and policies across financial institutions. Community-sourced, anonymized data for educational purposes.',
};

export default function InstitutionsPage() {
  return <InstitutionDirectory />;
}
