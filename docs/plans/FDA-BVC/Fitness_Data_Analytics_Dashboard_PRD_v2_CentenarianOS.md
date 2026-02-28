# Product Requirements Document: Fitness Data Analytics Dashboard

**Version:** 2.0 — CentenarianOS Platform Alignment  
**Date:** February 27, 2026  
**Original Date:** September 23, 2025  
**Author:** Brand Anthony McDonald  
**Status:** Revised Draft

> **Revision Note (v2.0):** All references to Heartbeat.chat have been replaced with CentenarianOS. The course platform, authentication, API integration, database fields, environment variables, and test references now reflect the CentenarianOS architecture. The CentOS Integration Plan (separate document) contains the authoritative database schema (`043_health_metrics.sql`) and Supabase-based auth that supersedes the Prisma/NextAuth patterns in this PRD. This PRD should be read alongside that integration plan for current technical decisions.

---

## 1. Introduction & Purpose

This document outlines the requirements for the **Fitness Data Analytics Dashboard**, an interactive web application that enhances the existing "Foundations of Fitness and Health Metrics" course delivered through CentenarianOS. The primary goal is to transform static worksheets and assignments into dynamic, data-driven tools that improve student engagement and learning outcomes.

---

## 2. The Problem

**Current State:** Students complete fitness tracking assignments using static PDFs and spreadsheets, manually calculating metrics and insights. This creates several issues:

- **Low Engagement:** Static forms are boring and don't provide immediate feedback
- **Manual Errors:** Students make calculation mistakes that impact learning
- **Limited Insights:** Basic spreadsheet analysis misses meaningful patterns
- **Inconsistent Data:** No standardized format across student submissions
- **Instructor Overhead:** Manual grading and feedback requires significant time

**Proposed Solution:** An integrated web dashboard that automatically processes fitness data, generates insights, and provides interactive visualizations while maintaining seamless integration with the existing CentenarianOS course structure.

---

## 3. Target Audience & Personas

### Primary Persona: "The Data-Curious Health Coach" - Sarah Chen
- **Role:** Certified health coach enrolled in the course to expand data analysis skills
- **Goals:** Learn to use client fitness data to create better coaching programs
- **Pain Points:** Overwhelmed by spreadsheets, wants immediate insights from data
- **Tech Comfort:** Moderate - uses smartphones and basic software daily
- **Success Metrics:** Can analyze client patterns and make data-driven recommendations

### Secondary Persona: "The Fitness Professional" - Marcus Rodriguez  
- **Role:** Personal trainer looking to differentiate services with data insights
- **Goals:** Offer premium data analysis services to clients
- **Pain Points:** Knows fitness but struggles with data interpretation
- **Tech Comfort:** Low to Moderate - prefers simple, intuitive interfaces
- **Success Metrics:** Confident explaining fitness metrics to clients

### Tertiary Persona: "The Wellness Enthusiast" - Jennifer Park
- **Role:** Corporate employee focused on personal health optimization
- **Goals:** Use personal fitness data to improve health outcomes
- **Pain Points:** Has device data but doesn't know what it means
- **Tech Comfort:** High - comfortable with apps and technology
- **Success Metrics:** Makes lifestyle changes based on data insights

---

## 4. Goals & Success Metrics

### Primary Success Metrics
- **Course Completion Rate:** Increase from current baseline to 85%+ 
- **Student Engagement:** 90%+ of students use interactive tools weekly
- **Learning Outcomes:** 80%+ of students demonstrate data fluency in final assessment
- **Instructor Satisfaction:** Reduce grading time by 60%

### Secondary Success Metrics
- **Tool Adoption:** 95%+ of enrolled students create accounts within 72 hours
- **Data Quality:** 90%+ of student data entries pass validation checks
- **User Satisfaction:** Net Promoter Score of 70+ from student feedback
- **Technical Performance:** 95%+ uptime, <3 second page load times

---

## 5. MVP Features & User Stories

### 5.1 Authentication & Course Integration
- **As a student**, I want to log in using my CentenarianOS credentials so I don't need separate accounts
- **As a student**, I want my course progress to sync automatically so tools unlock as I complete lessons  
- **As an instructor**, I want to see which students are using the tools so I can provide targeted support

### 5.2 Smart Data Collection Dashboard
- **As a student**, I want to input daily metrics (sleep, steps, energy) in under 2 minutes
- **As a student**, I want to import data from my fitness device so I don't need manual entry
- **As a student**, I want real-time validation so I catch errors immediately
- **As a student**, I want to see weekly summaries so I understand my patterns

### 5.3 Interactive Assignment Builder  
- **As a student**, I want guided assignment completion with progress tracking
- **As a student**, I want instant feedback on my responses so I learn while working
- **As a student**, I want to save partially completed assignments so I can work in multiple sessions
- **As an instructor**, I want assignments to auto-grade basic components so I focus on complex feedback

### 5.4 Data Visualization & Analytics
- **As a student**, I want to see my data as charts and graphs so patterns are obvious
- **As a student**, I want automated insights like "Your energy is 23% higher after 7+ hours of sleep"
- **As a student**, I want correlation analysis so I understand relationships between metrics
- **As a student**, I want to export visualizations so I can share them with others

### 5.5 Goal Setting & Progress Tracking
- **As a student**, I want to set SMART fitness goals with built-in validation
- **As a student**, I want automatic progress calculation so I know if I'm on track
- **As a student**, I want milestone celebrations so I stay motivated
- **As a student**, I want goal recommendations based on my data patterns

### 5.6 Community Data Sharing (Anonymous)
- **As a student**, I want to see how my progress compares to classmates (anonymously)
- **As a student**, I want to share insights that helped me so I contribute to community learning
- **As a student**, I want to see successful patterns from other students so I can adapt them
- **As an instructor**, I want class-wide analytics so I can adjust course content

---

## 6. Technical Architecture

### 6.1 Tech Stack
```typescript
// Frontend
Framework: Next.js 14 (App Router)
Language: TypeScript (strict mode)
Styling: Tailwind CSS + Shadcn/ui
Charts: Recharts + D3.js for advanced visualizations
Animations: Framer Motion
State Management: Zustand (for complex state) + React hooks

// Backend  
Runtime: Node.js (Vercel serverless functions)
Database: Vercel Postgres with Prisma ORM
Authentication: NextAuth.js with custom CentenarianOS provider
API: tRPC for type-safe API calls
Validation: Zod schemas for all data

// External Integrations
Course Platform: CentenarianOS API
Fitness APIs: Fitbit, Apple Health, Google Fit, Garmin Connect  
Email: Resend for notifications
Analytics: Vercel Analytics + custom logging

// Deployment
Platform: Vercel (optimal for Next.js)
Database: Vercel Postgres (serverless)
CDN: Vercel Edge Network
Monitoring: Vercel monitoring + custom logging system
```

### 6.2 Database Schema (Core Tables)
```prisma
model User {
  id              String   @id @default(cuid())
  centenarianOsId     String   @unique
  email           String   @unique  
  name            String?
  enrolledAt      DateTime @default(now())
  currentWeek     Int      @default(1)
  completedLessons String[]
  unlockedTools   String[]
  
  dailyMetrics    DailyMetrics[]
  goals          HealthGoal[]
  assignments    Assignment[]
}

model DailyMetrics {
  id              String   @id @default(cuid())
  userId          String
  date            DateTime @unique
  
  // Sleep data
  bedtime         String?
  wakeTime        String?
  sleepQuality    Int?     // 1-10
  sleepHours      Float?
  
  // Activity data  
  steps           Int?
  activeMinutes   Int?
  calories        Int?
  exerciseType    String?
  exerciseDuration Int?
  
  // Wellness data
  energyMorning   Int?     // 1-10
  energyAfternoon Int?     // 1-10
  energyEvening   Int?     // 1-10
  stressLevel     Int?     // 1-10
  mood            Int?     // 1-10
  waterIntake     Int?
  
  notes           String?
  source          String   @default("manual") // manual, fitbit, apple, etc.
  
  user User @relation(fields: [userId], references: [id])
}

model HealthGoal {
  id              String   @id @default(cuid())
  userId          String
  title           String
  description     String?
  category        String   // sleep, activity, wellness, energy
  targetValue     Float
  targetMetric    String
  targetFrequency String   // daily, weekly, monthly
  deadline        DateTime
  progress        Float    @default(0) // 0-100%
  isActive        Boolean  @default(true)
  
  user User @relation(fields: [userId], references: [id])
}

model Assignment {
  id              String   @id @default(cuid())
  userId          String
  weekNumber      Int
  assignmentType  String   // goal-setting, data-analysis, n-of-1, etc.
  status          String   @default("not_started") // not_started, in_progress, completed
  responses       Json     // Flexible storage for assignment answers
  autoGradeScore  Float?   // 0-100 for auto-gradable components
  instructorFeedback String?
  submittedAt     DateTime?
  
  user User @relation(fields: [userId], references: [id])
}
```

### 6.3 API Architecture
```typescript
// tRPC router structure
const appRouter = router({
  auth: authRouter,           // CentenarianOS integration, session management
  metrics: metricsRouter,     // CRUD for daily metrics, bulk import
  analytics: analyticsRouter, // Insights, correlations, pattern recognition
  goals: goalsRouter,         // Goal CRUD, progress calculation
  assignments: assignmentsRouter, // Assignment management, auto-grading
  community: communityRouter, // Anonymous data sharing, class insights
  integrations: integrationsRouter, // Fitness device APIs
})

// Example metrics router
export const metricsRouter = router({
  create: protectedProcedure
    .input(dailyMetricsSchema)
    .mutation(async ({ ctx, input }) => {
      // Validate data, save to DB, trigger analytics update
    }),
    
  getWeeklyData: protectedProcedure
    .input(z.object({ startDate: z.date(), endDate: z.date() }))
    .query(async ({ ctx, input }) => {
      // Return user's metrics with calculated insights
    }),
    
  importFromDevice: protectedProcedure
    .input(z.object({ deviceType: z.enum(['fitbit', 'apple', 'garmin']) }))
    .mutation(async ({ ctx, input }) => {
      // Fetch from external API, validate, bulk insert
    }),
})
```

---

## 7. UI/UX Requirements

### 7.1 Design System
```css
/* Color Palette */
:root {
  --primary: #8B5CF6;        /* Purple - matches course branding */
  --primary-light: #A78BFA;
  --primary-dark: #7C3AED;
  
  --success: #10B981;        /* Green for positive metrics */
  --warning: #F59E0B;        /* Amber for attention needed */
  --error: #EF4444;          /* Red for issues/problems */
  
  --neutral-50: #F8FAFC;     /* Backgrounds */
  --neutral-100: #F1F5F9;
  --neutral-500: #64748B;    /* Text secondary */
  --neutral-900: #0F172A;    /* Text primary */
}

/* Typography Scale */
--font-xs: 0.75rem;      /* 12px - labels, captions */
--font-sm: 0.875rem;     /* 14px - body text, buttons */
--font-base: 1rem;       /* 16px - body text */
--font-lg: 1.125rem;     /* 18px - subheadings */
--font-xl: 1.25rem;      /* 20px - headings */
--font-2xl: 1.5rem;      /* 24px - page titles */
--font-3xl: 2rem;        /* 32px - hero text */

/* Spacing Scale (Tailwind-based) */
--space-1: 0.25rem;      /* 4px */
--space-2: 0.5rem;       /* 8px */
--space-4: 1rem;         /* 16px */
--space-6: 1.5rem;       /* 24px */
--space-8: 2rem;         /* 32px */
```

### 7.2 Component Library (Shadcn/ui based)
```typescript
// Core UI Components
Button        // Primary, Secondary, Ghost, Destructive variants
Input         // Text, Number, Date inputs with validation states
Select        // Dropdowns with search functionality
Slider        // For 1-10 rating scales (energy, mood, etc.)
Card          // Container for metric displays and widgets
Badge         // Status indicators, progress labels
Progress      // Goal progress, completion indicators
Dialog        // Modals for detailed views, confirmations
Tabs          // Navigation between dashboard sections
Calendar      // Date selection for data entry
Chart         // Recharts wrapper components for data visualization

// Custom Fitness Components  
MetricCard           // Display single metric with trend
WeeklyProgressGrid   // 7-day view of selected metrics
GoalProgressBar      // Visual goal tracking with milestones
DataEntryForm        // Smart form with validation and suggestions
InsightPanel         // Automated insights display
CorrelationChart     // Scatter plots for metric relationships
DeviceSyncButton     // Connect fitness devices
AssignmentBuilder    // Interactive assignment completion
```

### 7.3 User Flow Examples

#### Flow 1: First-Time User Onboarding
```
1. Student completes Week 1 lesson in CentenarianOS → Webhook triggers
2. Dashboard access unlocked → Email notification sent  
3. Student clicks link → Auto-login via CentenarianOS session
4. Onboarding wizard:
   a. Connect fitness device (optional)
   b. Set 3 initial health goals using guided prompts
   c. Complete 7-day baseline data entry
   d. View first insights dashboard
5. Redirect to Week 1 assignment: "Analyze Your Baseline Data"
```

#### Flow 2: Daily Data Entry (Returning User)
```
1. Student opens dashboard → Personalized greeting + today's goal progress
2. "Quick Entry" card shows required metrics for the day
3. Smart form pre-fills previous patterns (bedtime, exercise type)
4. Validation feedback in real-time ("That seems high for resting HR - double check?")
5. Submit → Immediate visual feedback ("Great! 4-day streak on sleep goal!")
6. Updated weekly chart animates with new data point
7. Insight notification: "New pattern detected - check your analytics"
```

#### Flow 3: Week 3 Assignment - N-of-1 Experiment
```
1. Student navigates to Week 3 tools (unlocked after lesson completion)
2. Assignment Builder guides through experiment design:
   a. "What do you want to test?" → Dropdown of common hypotheses
   b. "What will you measure?" → Auto-suggests relevant metrics
   c. "How long will you test?" → Calendar picker with minimum duration
3. Experiment tracking dashboard generated automatically  
4. Daily prompts for data collection and adherence check-ins
5. Automatic statistical analysis after experiment period
6. Guided reflection questions based on results
7. One-click export to portfolio for course completion requirement
```

### 7.4 Mobile Responsiveness
```typescript
// Breakpoint Strategy
Mobile: 320px - 768px    // Single column, simplified navigation
Tablet: 768px - 1024px   // Hybrid layout, collapsible sidebar  
Desktop: 1024px+         // Full featured dashboard with multiple columns

// Key Mobile Adaptations
- Bottom navigation for main sections (Dashboard, Data Entry, Goals, Analytics)
- Swipeable chart galleries for limited screen space
- Voice-to-text for notes and reflections
- Simplified data entry with larger touch targets
- Progressive disclosure to reduce cognitive load
- Offline data entry with sync when connected
```

---

## 8. Development Phases

### Phase 1: Foundation & Authentication (Weeks 1-3)
**Goal:** Establish secure connection with CentenarianOS and core user management

**Deliverables:**
- NextAuth.js integration with CentenarianOS API
- Basic user dashboard with welcome message
- Database schema implementation  
- Webhook endpoint for course progress sync
- User account creation and session management
- Basic logging system implementation

**Acceptance Criteria:**
- Students can authenticate using CentenarianOS credentials
- User accounts auto-create when enrolled in course
- Course progress syncs and unlocks appropriate tools
- All authentication flows work on mobile devices
- Comprehensive logging captures all user actions and errors

### Phase 2: Core Data Management (Weeks 4-6)
**Goal:** Students can input, store, and retrieve their daily fitness metrics

**Deliverables:**
- Daily metrics input form with validation
- Weekly data visualization dashboard
- Basic fitness device integration (Fitbit API)
- Data export functionality
- Automated insight generation for simple patterns

**Acceptance Criteria:**
- Students can complete daily data entry in <2 minutes
- Form validation prevents common data entry errors
- Weekly charts update in real-time as data is entered
- Fitbit integration imports data automatically
- Basic insights like "average sleep this week" display correctly

### Phase 3: Interactive Assignments (Weeks 7-9)
**Goal:** Transform static worksheets into guided, interactive experiences

**Deliverables:**
- Week 1 assignment: "Set Your Health Goals" (interactive SMART goal builder)
- Week 2 assignment: "Device Accuracy Testing" (comparison tool)
- Week 3 assignment: "Design Your N-of-1 Experiment" (experiment builder)
- Auto-grading system for objective components
- Progress tracking and partial save functionality

**Acceptance Criteria:**
- All Week 1-3 assignments work interactively with immediate feedback
- Students can save partial progress and return later
- Auto-grading accurately scores objective responses
- Assignment completion triggers tool unlocks for next week
- Mobile experience works seamlessly for all assignments

### Phase 4: Advanced Analytics & Community Features (Weeks 10-12)
**Goal:** Provide sophisticated insights and enable community learning

**Deliverables:**
- Correlation analysis tools (sleep vs energy, steps vs mood, etc.)
- Anonymous community benchmarking dashboard
- Advanced visualization library (heatmaps, scatter plots, trend analysis)
- Week 4-5 assignment builders (longevity optimization, behavior design)
- Instructor analytics dashboard for class-wide insights

**Acceptance Criteria:**
- Correlation calculations provide statistically meaningful results
- Community features maintain complete anonymity
- Advanced charts load quickly and work on mobile
- Week 4-5 assignments have same quality as earlier weeks
- Instructors can identify struggling students and successful patterns

---

## 9. Developer Experience (DX) & Code Standards

### 9.1 Development Environment Setup
```bash
# Required tools and versions
Node.js: v20.x or higher
pnpm: v8.x (package manager)
Docker: v24.x (for local database)
VS Code: recommended editor with extensions:
  - ESLint
  - Prettier  
  - Tailwind CSS IntelliSense
  - Prisma
  - TypeScript Hero

# Environment variables template
CENTENARIANOS_API_KEY=          # API key for CentenarianOS integration
CENTENARIANOS_WEBHOOK_SECRET=   # Webhook signature verification
DATABASE_URL=               # Postgres connection string
NEXTAUTH_SECRET=           # Authentication signing secret
FITBIT_CLIENT_ID=          # Fitbit API credentials
FITBIT_CLIENT_SECRET=
```

### 9.2 Code Style & Standards
```typescript
// Follow established patterns from project knowledge
// Naming Conventions:
- Variables/Functions: camelCase (getUserMetrics, dailyStepCount)
- React Components: PascalCase (MetricCard, DashboardLayout)  
- Files: PascalCase for components, kebab-case for utilities
- Constants: UPPER_SNAKE_CASE (MAX_DAILY_ENTRIES, API_ENDPOINTS)

// File Organization:
app/                     # Next.js 14 app router
  dashboard/            # Main dashboard pages  
  api/                  # API routes (tRPC)
components/
  ui/                   # Shadcn/ui components
  dashboard/           # Dashboard-specific components
  forms/               # Data entry forms
  charts/              # Data visualization components
lib/
  auth/                # Authentication utilities
  db/                  # Database connection and queries
  integrations/        # External API wrappers
  analytics/           # Data processing and insights
  validations/         # Zod schemas
types/
  database.ts          # Prisma-generated types
  api.ts               # API request/response types
  metrics.ts           # Fitness data types

// Component Pattern Example:
interface MetricCardProps {
  title: string
  value: number | string
  trend?: 'up' | 'down' | 'stable'
  loading?: boolean
}

export const MetricCard = ({ title, value, trend, loading = false }: MetricCardProps) => {
  if (loading) return <MetricCardSkeleton />
  
  return (
    <Card className="p-6">
      <h3 className="font-medium text-neutral-500 mb-2">{title}</h3>
      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold">{value}</span>
        {trend && <TrendIndicator direction={trend} />}
      </div>
    </Card>
  )
}
```

### 9.3 Logging Implementation
```typescript
// Based on project knowledge logging examples
// lib/logging/dashboard-logger.ts

export enum LogContext {
  AUTH = "auth",
  METRICS = "metrics", 
  ANALYTICS = "analytics",
  ASSIGNMENTS = "assignments",
  INTEGRATIONS = "integrations",
  UI = "ui",
  ERROR = "error"
}

export enum LogLevel {
  DEBUG = "debug",
  INFO = "info", 
  WARNING = "warning",
  ERROR = "error"
}

interface LogEntry {
  context: LogContext
  level: LogLevel
  message: string
  userId?: string
  sessionId?: string
  metadata?: Record<string, any>
  timestamp: Date
}

export class DashboardLogger {
  static async log(
    context: LogContext,
    level: LogLevel, 
    message: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    const entry: LogEntry = {
      context,
      level,
      message,
      metadata,
      timestamp: new Date(),
      userId: await getCurrentUserId(),
      sessionId: getSessionId()
    }

    // Console logging in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${context}] ${level.toUpperCase()}: ${message}`, metadata)
    }

    // Database logging for production
    if (level === LogLevel.ERROR || level === LogLevel.WARNING) {
      await saveLogToDatabase(entry)
    }

    // External monitoring for critical errors
    if (level === LogLevel.ERROR) {
      await sendToMonitoring(entry)
    }
  }

  // Convenience methods
  static info(context: LogContext, message: string, metadata?: Record<string, any>) {
    return this.log(context, LogLevel.INFO, message, metadata)
  }

  static error(context: LogContext, message: string, error?: Error, metadata?: Record<string, any>) {
    const enrichedMetadata = {
      ...metadata,
      errorMessage: error?.message,
      errorStack: error?.stack,
    }
    return this.log(context, LogLevel.ERROR, message, enrichedMetadata)
  }
}

// Usage examples throughout the application:
// DashboardLogger.info(LogContext.METRICS, "Daily metrics saved successfully", { userId, metricsCount: 5 })
// DashboardLogger.error(LogContext.INTEGRATIONS, "Fitbit API call failed", error, { endpoint: "/api/fitbit/steps" })
```

### 9.4 Testing Strategy
```typescript
// Testing approach based on project standards
// Write tests before implementing features (TDD)

// Unit Tests (Jest + React Testing Library)
__tests__/
  components/           # Component unit tests
  lib/                 # Utility function tests
  api/                 # API route tests

// Integration Tests (Jest)
__tests__/integration/
  auth-flow.test.ts    # CentenarianOS authentication  
  data-sync.test.ts    # Fitness device integration
  assignment-flow.test.ts # End-to-end assignment completion

// E2E Tests (Cypress)
cypress/e2e/
  onboarding.cy.ts     # First-time user experience
  daily-entry.cy.ts    # Data entry workflow
  assignments.cy.ts    # Assignment completion flow
  analytics.cy.ts      # Chart interactions and insights

// Example component test:
describe('MetricCard', () => {
  it('displays metric value and title correctly', () => {
    render(<MetricCard title="Steps" value="10,532" />)
    expect(screen.getByText('Steps')).toBeInTheDocument()
    expect(screen.getByText('10,532')).toBeInTheDocument()
  })

  it('shows loading state when loading prop is true', () => {
    render(<MetricCard title="Steps" value="0" loading={true} />)
    expect(screen.getByTestId('metric-card-skeleton')).toBeInTheDocument()
  })

  it('displays trend indicator when trend prop provided', () => {
    render(<MetricCard title="Steps" value="10,532" trend="up" />)
    expect(screen.getByTestId('trend-up')).toBeInTheDocument()
  })
})
```

---

## 10. Non-Functional Requirements

### 10.1 Performance Requirements
- **Page Load Time:** <2 seconds on 3G mobile connection
- **Interactive Time:** <1 second for form inputs and button clicks
- **Chart Rendering:** <500ms for standard visualizations
- **Database Queries:** <200ms for typical user data retrieval
- **API Response Time:** <300ms for 95% of requests

### 10.2 Scalability Requirements  
- **Concurrent Users:** Support 500 simultaneous active users
- **Data Growth:** Handle 10,000+ daily metric entries per day
- **Course Enrollment:** Support up to 200 students per course cohort
- **Storage:** Efficiently handle 1GB+ of user data and analytics

### 10.3 Security Requirements
- **Authentication:** Secure integration with CentenarianOS OAuth
- **Data Encryption:** All sensitive data encrypted at rest and in transit
- **API Security:** Rate limiting, input validation, and CSRF protection
- **Privacy:** HIPAA-compliant handling of health data
- **Session Management:** Secure session handling with proper expiration

### 10.4 Accessibility Requirements
- **WCAG 2.1 AA Compliance:** Meet accessibility standards for screen readers
- **Keyboard Navigation:** All functionality accessible via keyboard
- **Color Contrast:** Minimum 4.5:1 contrast ratio for text
- **Mobile Accessibility:** Touch targets minimum 44px, swipe gestures
- **Alternative Text:** All charts and images have meaningful alt text

### 10.5 Browser Support
- **Modern Browsers:** Chrome 100+, Firefox 100+, Safari 15+, Edge 100+  
- **Mobile Browsers:** iOS Safari 15+, Chrome Mobile 100+
- **Progressive Enhancement:** Core functionality works without JavaScript
- **Offline Support:** Data entry works offline with sync when connected

---

## 11. Out of Scope (For MVP)

### 11.1 Advanced Features (Post-MVP)
- **AI-Powered Coaching:** Personalized recommendations based on machine learning
- **Social Features:** Student-to-student messaging, study groups, challenges
- **Advanced Device Integration:** Apple Watch apps, Garmin Connect IQ
- **Nutrition Tracking:** Food logging and nutrition analysis
- **Advanced Analytics:** Predictive modeling, anomaly detection

### 11.2 Administrative Features
- **Multi-Course Support:** Supporting courses beyond "Foundations of Fitness"
- **Instructor Tools:** Advanced grading interface, bulk student management
- **Enterprise Features:** White-labeling, multi-tenant architecture
- **Payment Integration:** Direct course enrollment and payment processing

### 11.3 Technical Enhancements
- **Real-Time Collaboration:** Live editing of assignments, real-time chat
- **Advanced Caching:** Redis caching layer, CDN optimization
- **Microservices Architecture:** Service decomposition for scalability
- **Advanced Monitoring:** APM tools, detailed performance analytics

---

## 12. Assumptions & Constraints

### 12.1 Technical Assumptions
- **CentenarianOS API Stability: Assumes continued API access and stability
- **Fitness Device APIs:** Assumes continued access to major fitness device APIs
- **Vercel Platform:** Assumes Vercel continues to provide reliable hosting
- **TypeScript Ecosystem:** Assumes continued support for TypeScript and React

### 12.2 Business Assumptions  
- **Course Demand:** Students are willing to use additional tools for better learning
- **Data Sharing:** Students are comfortable sharing anonymized fitness data
- **Mobile Usage:** Majority of students will access tools via mobile devices
- **Technical Literacy:** Target audience has basic smartphone/web app experience

### 12.3 Development Constraints
- **Timeline:** MVP must be completed within 12 weeks for course launch
- **Budget:** Development resources limited to single developer + Claude assistance
- **Compliance:** Must adhere to HIPAA guidelines for health data handling
- **Integration:** Must not disrupt existing CentenarianOS course experience

### 12.4 Operational Constraints
- **Maintenance:** Single person responsible for ongoing maintenance and updates
- **Support:** Student support must integrate with existing course support channels  
- **Data Backup:** Automated backup and disaster recovery procedures required
- **Monitoring:** 24/7 uptime monitoring and alerting system needed

---

## 13. Success Criteria & Next Steps

### 13.1 MVP Success Criteria
**Technical Success:**
- ✅ 99%+ uptime during first course cohort
- ✅ <2 second average page load times
- ✅ Zero data loss incidents
- ✅ All major user flows work on mobile and desktop

**User Success:**
- ✅ 90%+ of enrolled students create accounts and use tools
- ✅ 85%+ course completion rate (improvement from baseline)
- ✅ 4.5+ stars average rating from student feedback  
- ✅ 60%+ reduction in instructor grading time

**Business Success:**
- ✅ Successful deployment for first cohort (50+ students)
- ✅ Positive instructor feedback and continued usage
- ✅ Foundation established for future course integration
- ✅ Technical architecture proves scalable for growth

### 13.2 Immediate Next Steps
1. **Technical Setup** (Week 1)
   - Create Next.js project with TypeScript configuration
   - Set up Vercel deployment pipeline
   - Configure Prisma database with initial schema
   - Implement basic authentication flow

2. **CentenarianOS Integration** (Week 2)  
   - Obtain CentenarianOS API credentials and documentation
   - Build webhook endpoint for course progress sync
   - Test authentication flow with CentenarianOS credentials
   - Create user account sync system

3. **Core Dashboard** (Week 3)
   - Design and implement main dashboard layout
   - Create daily metrics input form
   - Build basic data visualization components
   - Add logging system and error handling

4. **First Assignment** (Week 4)
   - Convert Week 1 static worksheet to interactive tool
   - Implement goal-setting functionality
   - Add progress tracking and milestone recognition
   - Test complete user flow from authentication to assignment

This PRD serves as the comprehensive blueprint for building the Fitness Data Analytics Dashboard that will transform static course materials into an engaging, data-driven learning experience.

---

## Appendix: Platform Reference Change Log (v2.0)

| Line/Section | Old Reference | New Reference |
|---|---|---|
| Section 1 (Introduction) | "delivered through Heartbeat.chat" | "delivered through CentenarianOS" |
| Section 2 (Proposed Solution) | "Heartbeat.chat course structure" | "CentenarianOS course structure" |
| Section 5.1 (User Stories) | "log in using my Heartbeat credentials" | "log in using my CentenarianOS credentials" |
| Section 6.1 (Tech Stack) | "Authentication: NextAuth.js with custom Heartbeat provider" | "Authentication: NextAuth.js with custom CentenarianOS provider" |
| Section 6.1 (External Integrations) | "Course Platform: Heartbeat.chat API" | "Course Platform: CentenarianOS API" |
| Section 6.2 (Database Schema) | `heartbeatId String @unique` | `centenarianOsId String @unique` |
| Section 7.1 (API Router) | `// Heartbeat integration, session management` | `// CentenarianOS integration, session management` |
| Section 7.3 (User Flow 1) | "lesson in Heartbeat → Webhook triggers" | "lesson in CentenarianOS → Webhook triggers" |
| Section 7.3 (User Flow 1) | "Auto-login via Heartbeat session" | "Auto-login via CentenarianOS session" |
| Phase 1 (Development) | "Establish secure connection with Heartbeat" | "Establish secure connection with CentenarianOS" |
| Phase 1 (Deliverables) | "NextAuth.js integration with Heartbeat.chat API" | "NextAuth.js integration with CentenarianOS API" |
| Phase 1 (Acceptance) | "authenticate using Heartbeat credentials" | "authenticate using CentenarianOS credentials" |
| Section 9.1 (Env Variables) | `HEARTBEAT_API_KEY` / `HEARTBEAT_WEBHOOK_SECRET` | `CENTENARIANOS_API_KEY` / `CENTENARIANOS_WEBHOOK_SECRET` |
| Section 9.4 (Testing) | `# Heartbeat authentication` | `# CentenarianOS authentication` |
| Section 10.3 (Security) | "Heartbeat.chat OAuth" | "CentenarianOS OAuth" |
| Section 12.1 (Assumptions) | "Heartbeat.chat API Stability" | "CentenarianOS API Stability" |
| Section 12.3 (Constraints) | "Must not disrupt existing Heartbeat.chat course experience" | "Must not disrupt existing CentenarianOS course experience" |
| Section 13.2 (Next Steps) | "Heartbeat Integration (Week 2)" | "CentenarianOS Integration (Week 2)" |
| Section 13.2 (Next Steps) | "Obtain Heartbeat API credentials" | "Obtain CentenarianOS API credentials" |
| Section 13.2 (Next Steps) | "authentication flow with Heartbeat credentials" | "authentication flow with CentenarianOS credentials" |

**Technical note:** The `centenarianOsId` field in the Prisma schema and the `CENTENARIANOS_*` environment variables should be validated against the actual CentenarianOS API documentation. The CentOS Integration Plan uses Supabase Auth (`auth.users(id)`) rather than NextAuth.js with a custom provider — the auth architecture in this PRD may need further revision to align with the Supabase-based approach.