// lib/onboarding/tour-steps.ts
// Tour step definitions for module walkthroughs.

export interface TourStep {
  title: string;
  description: string;
  target?: string;        // CSS selector to highlight
  placement?: 'top' | 'bottom' | 'left' | 'right';
  action?: 'click' | 'navigate' | 'observe';
  nextRoute?: string;     // navigate to this route for next step
}

export interface ModuleTour {
  slug: string;
  app: 'main' | 'contractor' | 'lister';
  name: string;
  description: string;
  icon: string;
  steps: TourStep[];
}

// ────────────────────────────────────────────────
// Contractor (JobHub) Tours
// ────────────────────────────────────────────────

export const CONTRACTOR_TOURS: ModuleTour[] = [
  {
    slug: 'jobs',
    app: 'contractor',
    name: 'Job Tracking',
    description: 'Track every gig from assignment through payment.',
    icon: 'HardHat',
    steps: [
      {
        title: 'Welcome to Job Tracking',
        description: 'This is where all your jobs live. You\'ll see every gig organized by status — from assigned to paid.',
        target: '[data-tour="jobs-list"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Your jobs at a glance',
        description: 'These cards show how many jobs you have at each stage: assigned, in progress, completed, and paid.',
        target: '[data-tour="stat-cards"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Create a new job',
        description: 'Tap here to log a new job. Enter the client, event, venue, dates, and rates.',
        target: '[data-tour="new-job-btn"]',
        placement: 'left',
        action: 'observe',
      },
      {
        title: 'Job details',
        description: 'Each job has a detail page with time entries, documents, and an earnings summary. Let\'s look at one.',
        target: '[data-tour="job-card"]',
        placement: 'bottom',
        action: 'navigate',
        nextRoute: '/dashboard/contractor/jobs',
      },
      {
        title: 'Log your hours',
        description: 'Use Quick Log to clock your time — enter the work date, time in/out, and the system calculates ST, OT, and DT automatically.',
        target: '[data-tour="quick-log-btn"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Attach documents',
        description: 'Upload call sheets, W9s, certificates, and any paperwork related to this job.',
        target: '[data-tour="documents-tab"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Tour complete!',
        description: 'You now know how to track jobs, log time, and attach documents. Want to explore another feature?',
        action: 'observe',
      },
    ],
  },
  {
    slug: 'offers',
    app: 'contractor',
    name: 'Job Offers',
    description: 'View and respond to assignments from listers.',
    icon: 'Inbox',
    steps: [
      {
        title: 'Welcome to Job Offers',
        description: 'When a lister assigns you to a job, the offer appears here. You can accept, decline, or ask questions.',
        target: '[data-tour="offers-list"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Offer details',
        description: 'Each offer shows the job info, dates, rates, and any message from the lister.',
        target: '[data-tour="offer-card"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Respond to offers',
        description: 'Accept to confirm the gig or decline with a reason. Your response goes directly to the lister.',
        target: '[data-tour="offer-actions"]',
        placement: 'top',
        action: 'observe',
      },
      {
        title: 'Tour complete!',
        description: 'You know how to view and respond to job offers. Check back here whenever you get a new assignment.',
        action: 'observe',
      },
    ],
  },
  {
    slug: 'rate-cards',
    app: 'contractor',
    name: 'Rate Cards',
    description: 'Save reusable rate presets for quick job setup.',
    icon: 'CreditCard',
    steps: [
      {
        title: 'Welcome to Rate Cards',
        description: 'Rate cards save your standard rates so you don\'t re-enter them for every job. Create presets for different unions, departments, or clients.',
        target: '[data-tour="rate-cards-list"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Create a rate card',
        description: 'Set your union local, department, ST/OT/DT rates, benefits, and travel reimbursements.',
        target: '[data-tour="new-rate-card-btn"]',
        placement: 'left',
        action: 'observe',
      },
      {
        title: 'Apply to a job',
        description: 'When you create a new job, pick a rate card from the dropdown and all rates auto-fill.',
        target: '[data-tour="rate-card-item"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Tour complete!',
        description: 'Rate cards save you time on every job. Create one for each rate you commonly work at.',
        action: 'observe',
      },
    ],
  },
  {
    slug: 'compare',
    app: 'contractor',
    name: 'Rate Comparison',
    description: 'Compare earnings across venues, clients, and time.',
    icon: 'ArrowUpDown',
    steps: [
      {
        title: 'Welcome to Rate Comparison',
        description: 'See how your earnings stack up across different venues, clients, and time periods.',
        target: '[data-tour="compare-view"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Filter and compare',
        description: 'Use the filters to drill into specific date ranges, departments, or union locals.',
        target: '[data-tour="compare-filters"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Tour complete!',
        description: 'Use comparisons to negotiate better rates and prioritize your highest-paying gigs.',
        action: 'observe',
      },
    ],
  },
  {
    slug: 'reports',
    app: 'contractor',
    name: 'Reports & Analytics',
    description: 'Visual reports on earnings, hours, and trends.',
    icon: 'BarChart3',
    steps: [
      {
        title: 'Welcome to Reports',
        description: 'Charts and summaries that show your earnings, hours worked, and job frequency.',
        target: '[data-tour="reports-charts"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Date range filtering',
        description: 'Narrow down to any time period — this week, this month, this year, or a custom range.',
        target: '[data-tour="date-filter"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Tour complete!',
        description: 'Reports give you a bird\'s-eye view of your career. Check back regularly to spot trends.',
        action: 'observe',
      },
    ],
  },
  {
    slug: 'venues',
    app: 'contractor',
    name: 'Venue Management',
    description: 'Build a knowledge base for every venue you work.',
    icon: 'Building2',
    steps: [
      {
        title: 'Welcome to Venues',
        description: 'Track every venue you\'ve worked with location details and institutional knowledge.',
        target: '[data-tour="venues-list"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Venue knowledge base',
        description: 'Each venue has a knowledge base: parking instructions, load-in details, WiFi info, power locations, and more.',
        target: '[data-tour="venue-kb"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Tour complete!',
        description: 'Build your venue knowledge base as you work. When you return months later, everything is here.',
        action: 'observe',
      },
    ],
  },
  {
    slug: 'cities',
    app: 'contractor',
    name: 'City Guides',
    description: 'Your personal guide for every city you work in.',
    icon: 'MapPin',
    steps: [
      {
        title: 'Welcome to City Guides',
        description: 'Build personal guides with restaurants, hotels, coffee shops, and gyms for every city you travel to.',
        target: '[data-tour="cities-list"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Add entries',
        description: 'Each entry has a name, category, notes, and rating. Add your favorites as you discover them.',
        target: '[data-tour="city-entries"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Tour complete!',
        description: 'Your road knowledge, organized. Share guides with other contractors or keep them private.',
        action: 'observe',
      },
    ],
  },
  {
    slug: 'union',
    app: 'contractor',
    name: 'Union Hub',
    description: 'Memberships, dues, documents — all tracked.',
    icon: 'Scale',
    steps: [
      {
        title: 'Welcome to the Union Hub',
        description: 'Track your union memberships, dues payments, and important documents in one place.',
        target: '[data-tour="union-memberships"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Dues tracking',
        description: 'Log quarterly or monthly dues payments. See your payment history and upcoming due dates.',
        target: '[data-tour="dues-list"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Documents',
        description: 'Store permits, certifications, and union cards digitally. Access them from anywhere.',
        target: '[data-tour="union-docs"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Tour complete!',
        description: 'Your union life, organized. Never miss a payment or let a document expire.',
        action: 'observe',
      },
    ],
  },
  {
    slug: 'invoices',
    app: 'contractor',
    name: 'Invoicing',
    description: 'Generate invoices from your time entries.',
    icon: 'FileText',
    steps: [
      {
        title: 'Welcome to Invoicing',
        description: 'Create professional invoices directly from your logged time entries.',
        target: '[data-tour="invoices-list"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Create an invoice',
        description: 'Select a job and date range — line items with ST/OT/DT hours generate automatically.',
        target: '[data-tour="new-invoice-btn"]',
        placement: 'left',
        action: 'observe',
      },
      {
        title: 'Track payment status',
        description: 'Each invoice shows whether it\'s been sent, viewed, or paid.',
        target: '[data-tour="invoice-status"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Tour complete!',
        description: 'Invoicing turns your tracked time into money. No more spreadsheet gymnastics.',
        action: 'observe',
      },
    ],
  },
  {
    slug: 'finance',
    app: 'contractor',
    name: 'Finance Tracking',
    description: 'Income and expenses across all accounts.',
    icon: 'DollarSign',
    steps: [
      {
        title: 'Welcome to Finance',
        description: 'Track every dollar coming in and going out across all your accounts.',
        target: '[data-tour="finance-summary"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Add a transaction',
        description: 'Log income or expenses. Link transactions to jobs for complete financial visibility.',
        target: '[data-tour="new-transaction-btn"]',
        placement: 'left',
        action: 'observe',
      },
      {
        title: 'Tour complete!',
        description: 'Financial clarity starts with tracking. Link transactions to jobs for the full picture.',
        action: 'observe',
      },
    ],
  },
  {
    slug: 'travel',
    app: 'contractor',
    name: 'Travel & Mileage',
    description: 'Track trips, fuel, and vehicle maintenance.',
    icon: 'Car',
    steps: [
      {
        title: 'Welcome to Travel',
        description: 'Log every trip with distance, cost, and purpose. Track fuel and vehicle maintenance.',
        target: '[data-tour="travel-summary"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Log a trip',
        description: 'Enter origin, destination, distance, and mode of travel. Link to a job for tax deduction tracking.',
        target: '[data-tour="new-trip-btn"]',
        placement: 'left',
        action: 'observe',
      },
      {
        title: 'Tour complete!',
        description: 'Track every mile. Link travel to jobs. Make tax season painless.',
        action: 'observe',
      },
    ],
  },
  {
    slug: 'equipment',
    app: 'contractor',
    name: 'Equipment Tracker',
    description: 'Manage your gear inventory and valuations.',
    icon: 'Package',
    steps: [
      {
        title: 'Welcome to Equipment',
        description: 'Track your gear — cameras, lenses, tools, anything you use for work.',
        target: '[data-tour="equipment-list"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Add equipment',
        description: 'Log purchase price, current value, and category. Link to financial transactions.',
        target: '[data-tour="new-equipment-btn"]',
        placement: 'left',
        action: 'observe',
      },
      {
        title: 'Tour complete!',
        description: 'Know what you own, what it\'s worth, and when it needs attention.',
        action: 'observe',
      },
    ],
  },
  {
    slug: 'scan',
    app: 'contractor',
    name: 'Document Scanner',
    description: 'Capture receipts and documents instantly.',
    icon: 'ScanLine',
    steps: [
      {
        title: 'Welcome to Scan',
        description: 'Use your camera to capture receipts, call sheets, and documents.',
        target: '[data-tour="scan-area"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Capture and categorize',
        description: 'Take a photo, extract the data, and link it to a transaction or job.',
        target: '[data-tour="scan-btn"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Tour complete!',
        description: 'No more lost receipts. Scan it, link it, forget about it until tax time.',
        action: 'observe',
      },
    ],
  },
  {
    slug: 'board',
    app: 'contractor',
    name: 'Contractor Board',
    description: 'Connect with other contractors.',
    icon: 'Users',
    steps: [
      {
        title: 'Welcome to the Board',
        description: 'Browse profiles of other contractors. Find collaborators, check availability, and build your network.',
        target: '[data-tour="board-list"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Tour complete!',
        description: 'The board connects you with your professional community.',
        action: 'observe',
      },
    ],
  },
];

// ────────────────────────────────────────────────
// Lister (CrewOps) Tours
// ────────────────────────────────────────────────

export const LISTER_TOURS: ModuleTour[] = [
  {
    slug: 'dashboard',
    app: 'lister',
    name: 'Lister Dashboard',
    description: 'Your crew operation at a glance.',
    icon: 'ClipboardList',
    steps: [
      {
        title: 'Welcome to CrewOps',
        description: 'This is your command center. At a glance you\'ll see total jobs, roster size, fill rates, and pending offers.',
        target: '[data-tour="lister-stats"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Quick actions',
        description: 'Create a job, assign a contractor, or send a message — right from the dashboard.',
        target: '[data-tour="quick-actions"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Upcoming jobs',
        description: 'Your upcoming jobs are listed here with event name, client, and dates.',
        target: '[data-tour="upcoming-jobs"]',
        placement: 'top',
        action: 'observe',
      },
      {
        title: 'Tour complete!',
        description: 'The dashboard keeps you on top of your operation. Explore the other features to go deeper.',
        action: 'observe',
      },
    ],
  },
  {
    slug: 'jobs',
    app: 'lister',
    name: 'Job Creation',
    description: 'Create jobs that need crew.',
    icon: 'Briefcase',
    steps: [
      {
        title: 'Welcome to Jobs',
        description: 'Create and manage jobs that need contractors. Each job tracks dates, location, rates, and staffing.',
        target: '[data-tour="jobs-list"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Create a job',
        description: 'Fill in the event details, dates, location, and rates. The job is ready for assignment.',
        target: '[data-tour="new-job-btn"]',
        placement: 'left',
        action: 'observe',
      },
      {
        title: 'Tour complete!',
        description: 'Create jobs, then head to Assign to staff them with contractors from your roster.',
        action: 'observe',
      },
    ],
  },
  {
    slug: 'roster',
    app: 'lister',
    name: 'Crew Roster',
    description: 'Your contractors, organized and ready.',
    icon: 'Users',
    steps: [
      {
        title: 'Welcome to Your Roster',
        description: 'This is your list of contractors — everyone you might assign to a job.',
        target: '[data-tour="roster-list"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Add a contractor',
        description: 'Enter their name, email, phone, skills, and availability notes. Link to their platform account if they have one.',
        target: '[data-tour="add-contractor-form"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Skills and search',
        description: 'Tag contractors with skills like Camera Op, Audio, or Utility. Search your roster by name, email, or skill.',
        target: '[data-tour="roster-search"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Tour complete!',
        description: 'Build your roster, then use Assign to match contractors to jobs.',
        action: 'observe',
      },
    ],
  },
  {
    slug: 'assign',
    app: 'lister',
    name: 'Job Assignment',
    description: 'Match contractors to jobs.',
    icon: 'UserPlus',
    steps: [
      {
        title: 'Welcome to Assignments',
        description: 'This is where you assign contractors from your roster to specific jobs.',
        target: '[data-tour="assignments-list"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Create an assignment',
        description: 'Pick a job, select a contractor, and optionally add a message. The contractor gets notified.',
        target: '[data-tour="assign-form"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Track status',
        description: 'Filter by status to see what\'s pending, accepted, or declined. Contractor responses appear inline.',
        target: '[data-tour="status-filters"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Tour complete!',
        description: 'Assign, track, and manage — all from one view.',
        action: 'observe',
      },
    ],
  },
  {
    slug: 'availability',
    app: 'lister',
    name: 'Availability Calendar',
    description: 'See contractor availability at a glance.',
    icon: 'CalendarCheck',
    steps: [
      {
        title: 'Welcome to Availability',
        description: 'See which contractors are free before you make assignments.',
        target: '[data-tour="availability-calendar"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Tour complete!',
        description: 'Plan your staffing around real availability. No more phone tag.',
        action: 'observe',
      },
    ],
  },
  {
    slug: 'messages',
    app: 'lister',
    name: 'Crew Messaging',
    description: 'Reach your crew individually or by group.',
    icon: 'Send',
    steps: [
      {
        title: 'Welcome to Messages',
        description: 'Send messages to individual contractors or entire groups. Keep all crew communication in one place.',
        target: '[data-tour="messages-list"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Compose a message',
        description: 'Choose individual or group mode, select recipients, add a subject and body, and send.',
        target: '[data-tour="compose-btn"]',
        placement: 'left',
        action: 'observe',
      },
      {
        title: 'Read tracking',
        description: 'See which messages have been read with the mail icon status indicator.',
        target: '[data-tour="message-card"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Tour complete!',
        description: 'Keep your crew in the loop. Individual or group — one place for all communication.',
        action: 'observe',
      },
    ],
  },
  {
    slug: 'groups',
    app: 'lister',
    name: 'Message Groups',
    description: 'Organize crew for targeted messaging.',
    icon: 'UsersRound',
    steps: [
      {
        title: 'Welcome to Groups',
        description: 'Create groups like "Camera Department" or "Indianapolis Crew" for targeted messaging.',
        target: '[data-tour="groups-list"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Create a group',
        description: 'Name your group, add a description, and select roster members.',
        target: '[data-tour="new-group-btn"]',
        placement: 'left',
        action: 'observe',
      },
      {
        title: 'Tour complete!',
        description: 'Groups make targeted communication easy. Create as many as you need.',
        action: 'observe',
      },
    ],
  },
  {
    slug: 'reports',
    app: 'lister',
    name: 'Reports',
    description: 'Fill rates, performance, and job metrics.',
    icon: 'BarChart3',
    steps: [
      {
        title: 'Welcome to Reports',
        description: 'Analyze fill rates, contractor performance, and job metrics across your operation.',
        target: '[data-tour="reports-charts"]',
        placement: 'bottom',
        action: 'observe',
      },
      {
        title: 'Tour complete!',
        description: 'Use reports to improve your crew management and client satisfaction.',
        action: 'observe',
      },
    ],
  },
];

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────

export function getTour(app: 'contractor' | 'lister', slug: string): ModuleTour | undefined {
  const tours = app === 'contractor' ? CONTRACTOR_TOURS : LISTER_TOURS;
  return tours.find((t) => t.slug === slug);
}

export function getAllTours(app: 'contractor' | 'lister'): ModuleTour[] {
  return app === 'contractor' ? CONTRACTOR_TOURS : LISTER_TOURS;
}
