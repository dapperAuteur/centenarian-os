// lib/features/contractor-features.ts
// Feature page configs for Contractor (JobHub) app.

export interface FeatureConfig {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  highlights: string[];
  demoRedirect: string;
  icon: string; // Lucide icon name
  group: string;
}

export const CONTRACTOR_FEATURES: FeatureConfig[] = [
  // ── Jobs group ──
  {
    slug: 'jobs',
    title: 'Job Tracking',
    tagline: 'Every gig from assignment through payment.',
    description:
      'Track every job from the moment you get the call to the day the check clears. Log time entries with clock-in/clock-out, attach call sheets and documents, and monitor status as jobs move from assigned to confirmed, in progress, completed, invoiced, and paid. Each job shows its client, event, venue, dates, and pay rates — so you always know what you\'re working, where, and for how much.',
    highlights: [
      'Status tracking from assigned through paid',
      'Time entries with ST/OT/DT hour calculations',
      'Document attachments (call sheets, W9s, certificates)',
      'Job detail with earnings summary and history',
      'Quick-log hours from any job page',
      'Link jobs to invoices, travel, and expenses',
    ],
    demoRedirect: '/dashboard/contractor/jobs',
    icon: 'HardHat',
    group: 'Jobs',
  },
  {
    slug: 'offers',
    title: 'Job Offers',
    tagline: 'Accept, decline, or negotiate — all in one place.',
    description:
      'When a lister assigns you to a job, the offer appears here with all the details: event, dates, location, rates, and any message from the lister. You can accept to confirm the gig, decline with a reason, or reach out to negotiate. Every offer tracks its status so nothing falls through the cracks.',
    highlights: [
      'View all incoming job assignments',
      'Accept or decline with one tap',
      'See lister messages and job details',
      'Status history for every offer',
      'Automatic notification on new offers',
    ],
    demoRedirect: '/dashboard/contractor/assignments',
    icon: 'Inbox',
    group: 'Jobs',
  },
  {
    slug: 'board',
    title: 'Contractor Board',
    tagline: 'Connect with other contractors in your field.',
    description:
      'Browse profiles of other contractors to find collaborators, check availability, and build your network. See skills, experience, and availability at a glance. Whether you\'re looking for a camera op to cover your off day or want to share a city guide, the board connects you to your professional community.',
    highlights: [
      'Browse contractor profiles',
      'Search by skills and availability',
      'View professional details and experience',
      'Network with peers in your industry',
    ],
    demoRedirect: '/dashboard/contractor/board',
    icon: 'Users',
    group: 'Jobs',
  },
  {
    slug: 'rate-cards',
    title: 'Rate Cards',
    tagline: 'Save your rates. Apply them instantly.',
    description:
      'Create reusable rate presets that capture your standard rates by union local, department, and role. Each card stores straight time, overtime, and double time rates plus benefits and travel reimbursements. When you create a new job, pick a rate card and the rates populate automatically — no re-entering numbers every time.',
    highlights: [
      'Reusable rate presets with ST/OT/DT rates',
      'Union local and department tagging',
      'Benefits and travel reimbursement fields',
      'Apply to any new job with one click',
      'Compare rates across cards',
    ],
    demoRedirect: '/dashboard/contractor/rate-cards',
    icon: 'CreditCard',
    group: 'Jobs',
  },
  {
    slug: 'compare',
    title: 'Rate Comparison',
    tagline: 'Know your worth. See the numbers.',
    description:
      'Compare your earnings across venues, clients, departments, and time periods. See where you\'re making the most per hour, which clients pay fastest, and how your rates trend over time. The comparison tools help you make data-driven decisions about which gigs to prioritize.',
    highlights: [
      'Compare earnings across venues and clients',
      'Year-over-year rate trends',
      'Identify your highest-paying gigs',
      'Department and union local breakdowns',
      'Data-driven rate negotiation support',
    ],
    demoRedirect: '/dashboard/contractor/compare',
    icon: 'ArrowUpDown',
    group: 'Jobs',
  },
  {
    slug: 'reports',
    title: 'Reports & Analytics',
    tagline: 'Visual reports on everything you earn and do.',
    description:
      'Charts and summaries that show your earnings, hours worked, job frequency, and client breakdowns. Filter by date range, client, venue, or department to see exactly what matters. Export reports for taxes, union reporting, or just to know where your career stands.',
    highlights: [
      'Earnings charts by period',
      'Hours breakdown (ST/OT/DT)',
      'Client and venue analytics',
      'Exportable for taxes and union reports',
      'Custom date range filtering',
    ],
    demoRedirect: '/dashboard/contractor/reports',
    icon: 'BarChart3',
    group: 'Jobs',
  },
  // ── Places group ──
  {
    slug: 'venues',
    title: 'Venue Management',
    tagline: 'Know every venue before you arrive.',
    description:
      'Build a knowledge base for every venue you work at. Track parking options, load-in instructions, WiFi passwords, power locations, catering contacts, and security protocols. When you get called back to a venue months later, everything you learned is right here waiting.',
    highlights: [
      'Venue profiles with location and contact info',
      'Knowledge base: parking, load-in, WiFi, power, catering, security',
      'Link venues to jobs and city guides',
      'Search and filter your venue library',
      'Never re-learn a venue\'s quirks',
    ],
    demoRedirect: '/dashboard/contractor/venues',
    icon: 'Building2',
    group: 'Places',
  },
  {
    slug: 'cities',
    title: 'City Guides',
    tagline: 'Your personal travel guide for every city you work in.',
    description:
      'Build city-specific guides with the restaurants, hotels, coffee shops, gyms, and local spots you rely on when you\'re on the road. Each entry can include notes, ratings, and location. Share your guides with other contractors or keep them private — your road knowledge, organized.',
    highlights: [
      'Per-city guides with categorized entries',
      'Restaurants, hotels, coffee, gyms, and more',
      'Notes and ratings for each spot',
      'Link to venues in the same city',
      'Build once, use every time you return',
    ],
    demoRedirect: '/dashboard/contractor/cities',
    icon: 'MapPin',
    group: 'Places',
  },
  // ── Union group ──
  {
    slug: 'union',
    title: 'Union Hub',
    tagline: 'Memberships, dues, documents — all tracked.',
    description:
      'Track your union memberships, dues payments, important documents, and fellow members. Whether you carry one card or five, the Union Hub keeps everything organized: local numbers, initiation dates, quarterly dues, permits, and certifications. Never miss a payment or let a document expire.',
    highlights: [
      'Multiple union membership tracking',
      'Dues payment history and scheduling',
      'Document storage (permits, certs, cards)',
      'Member directory and union chat',
      'Expiration reminders for documents',
    ],
    demoRedirect: '/dashboard/contractor/union',
    icon: 'Scale',
    group: 'Union',
  },
  // ── Money group ──
  {
    slug: 'invoices',
    title: 'Invoicing',
    tagline: 'Generate invoices from your time entries.',
    description:
      'Create professional invoices directly from your logged time entries. Select a job, pick the date range, and an invoice generates with line items for straight time, overtime, and double time hours. Track payment status, add notes, and export PDF. Each invoice links back to the job and your financial records.',
    highlights: [
      'Auto-generate from time entries',
      'ST/OT/DT line items calculated automatically',
      'Payment status tracking',
      'Link to jobs and financial transactions',
      'Professional format for clients',
    ],
    demoRedirect: '/dashboard/finance/invoices',
    icon: 'FileText',
    group: 'Money',
  },
  {
    slug: 'finance',
    title: 'Finance Tracking',
    tagline: 'See where every dollar comes from and goes.',
    description:
      'Track income and expenses across checking, savings, credit, and cash accounts. Every transaction can be categorized, linked to a job, and tagged with a life category. Set budgets, monitor spending trends, and see your complete financial picture — including how each gig contributes to your bottom line.',
    highlights: [
      'Multi-account tracking (checking, savings, credit, cash)',
      'Link transactions to specific jobs',
      'Budget categories with spending alerts',
      'Income vs expense trends over time',
      'Tax-ready categorization',
    ],
    demoRedirect: '/dashboard/finance/transactions',
    icon: 'DollarSign',
    group: 'Money',
  },
  {
    slug: 'travel',
    title: 'Travel & Mileage',
    tagline: 'Track every trip, every mile, every dollar.',
    description:
      'Log trips with origin, destination, distance, and cost. Track fuel fill-ups, vehicle maintenance, and CO2 emissions. Multi-stop routes let you plan complex travel days. Link travel costs to specific jobs for complete financial visibility and tax deduction tracking.',
    highlights: [
      'Trip logging with distance and cost',
      'Multi-stop route planning',
      'Fuel log with per-gallon tracking',
      'Vehicle maintenance schedules',
      'Link travel expenses to jobs',
      'CO2 emission calculations',
    ],
    demoRedirect: '/dashboard/travel',
    icon: 'Car',
    group: 'Money',
  },
  {
    slug: 'equipment',
    title: 'Equipment Tracker',
    tagline: 'Know what you own, what it\'s worth, and where it is.',
    description:
      'Manage your gear inventory: cameras, lenses, audio kits, tools — anything you own and use for work. Track purchase prices, current valuations, and depreciation over time. Link equipment to jobs and financial transactions. See the full lifecycle of every piece of gear you rely on.',
    highlights: [
      'Gear inventory with categories',
      'Purchase price and current valuation tracking',
      'Depreciation history charts',
      'Link equipment to jobs and transactions',
      'Activity links to related records across modules',
    ],
    demoRedirect: '/dashboard/equipment',
    icon: 'Package',
    group: 'Money',
  },
  // ── Tools group ──
  {
    slug: 'scan',
    title: 'Document Scanner',
    tagline: 'Capture receipts and documents instantly.',
    description:
      'Use your phone or tablet camera to capture receipts, call sheets, permits, and any paper document. The scanner extracts key data and stores it digitally. No more lost receipts at tax time — everything is captured, categorized, and linked to your financial records.',
    highlights: [
      'Camera-based document capture',
      'Auto-extract receipt data',
      'Link to financial transactions',
      'Organized document library',
      'Never lose a receipt again',
    ],
    demoRedirect: '/dashboard/scan',
    icon: 'ScanLine',
    group: 'Tools',
  },
];

export function getContractorFeature(slug: string): FeatureConfig | undefined {
  return CONTRACTOR_FEATURES.find((f) => f.slug === slug);
}

export const CONTRACTOR_FEATURE_GROUPS = [
  { label: 'Jobs', slugs: ['jobs', 'offers', 'board', 'rate-cards', 'compare', 'reports'] },
  { label: 'Places', slugs: ['venues', 'cities'] },
  { label: 'Union', slugs: ['union'] },
  { label: 'Money', slugs: ['invoices', 'finance', 'travel', 'equipment'] },
  { label: 'Tools', slugs: ['scan'] },
];
