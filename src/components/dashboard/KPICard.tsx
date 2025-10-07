// centenarian-os/src/components/dashboard/KPICard.tsx
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Type definition for strategic accent colors
 * Maps to the Centenarian OS Strategic Color Palette
 */
type StrategicAccent = 'fitness' | 'creative' | 'mindset' | 'lifestyle' | 'default';

/**
 * Type definition for color class props
 * Restricts to approved Tailwind color classes from style guide
 */
type ColorClass = 
  | 'text-lime-500'    // Fitness
  | 'text-sky-500'     // Creative
  | 'text-fuchsia-500' // Mindset
  | 'text-teal-500'    // Lifestyle
  | 'text-indigo-500'  // Default
  | 'text-orange-500'  // Fuel
  | 'text-amber-500';  // Outreach

interface KpiCardProps {
  /** Display title of the KPI */
  title: string;
  
  /** Primary metric value (e.g., "4,231" or "88") */
  value: string;
  
  /** Unit of measurement (e.g., "lbs", "score", "hrs/day") */
  unit: string;
  
  /** Change description (e.g., "+12.5% vs. avg") */
  change: string;
  
  /** Visual indicator of change direction */
  changeType: "increase" | "decrease" | "neutral";
  
  /** Lucide icon component to display */
  Icon: LucideIcon;
  
  /** Tailwind color class for the icon */
  colorClass: ColorClass;
  
  /** Strategic accent for semantic categorization */
  strategicAccent: StrategicAccent;
}

/**
 * Returns the background color class for the card top border
 * This matches the icon color for visual consistency
 */
const getBorderColor = (colorClass: ColorClass): string => {
  const borderMap: Record<ColorClass, string> = {
    'text-lime-500': 'border-lime-500',
    'text-sky-500': 'border-sky-500',
    'text-fuchsia-500': 'border-fuchsia-500',
    'text-teal-500': 'border-teal-500',
    'text-indigo-500': 'border-indigo-500',
    'text-orange-500': 'border-orange-500',
    'text-amber-500': 'border-amber-500',
  };
  return borderMap[colorClass] || 'border-gray-300';
};

/**
 * Returns the icon background color for the circular container
 */
const getIconBgColor = (colorClass: ColorClass): string => {
  const bgMap: Record<ColorClass, string> = {
    'text-lime-500': 'bg-lime-100',
    'text-sky-500': 'bg-sky-100',
    'text-fuchsia-500': 'bg-fuchsia-100',
    'text-teal-500': 'bg-teal-100',
    'text-indigo-500': 'bg-indigo-100',
    'text-orange-500': 'bg-orange-100',
    'text-amber-500': 'bg-amber-100',
  };
  return bgMap[colorClass] || 'bg-gray-100';
};

/**
 * KPI Card Component
 * 
 * DESIGN PRINCIPLES:
 * 1. Clear visual hierarchy: Title -> Value -> Change
 * 2. Color-coded icons for quick scanning
 * 3. Hover effects for interactivity
 * 4. Responsive typography (scales on different screen sizes)
 * 
 * ACCESSIBILITY:
 * - Semantic HTML structure
 * - High contrast text colors (WCAG AA compliant)
 * - Clear focus indicators
 */
export function KpiCard({
  title,
  value,
  unit,
  change,
  changeType,
  Icon,
  colorClass,
  strategicAccent,
}: KpiCardProps) {
  // Determine change indicator color based on type
  const changeColor =
    changeType === "increase"
      ? "text-lime-600" // Positive change uses lime (Strategic Performance Color)
      : changeType === "decrease"
      ? "text-red-600"  // Negative change uses red
      : "text-gray-600"; // Neutral change uses gray

  const borderColor = getBorderColor(colorClass);
  const iconBgColor = getIconBgColor(colorClass);

  return (
    <Card 
      className={cn(
        "bg-white rounded-xl shadow-md border-t-2 transition-all duration-200",
        "hover:shadow-xl hover:-translate-y-1",
        borderColor
      )}
      data-strategic-accent={strategicAccent} // For potential analytics tracking
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
          {title}
        </CardTitle>
        
        {/* Icon Container - Circular background with color */}
        <div className={cn("p-3 rounded-full", iconBgColor)}>
          <Icon className={cn("h-5 w-5", colorClass)} />
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Primary Metric Display */}
        <div className="flex items-baseline space-x-2">
          <span className="text-3xl md:text-4xl font-extrabold text-gray-900 leading-none">
            {value}
          </span>
          <span className="text-sm font-medium text-gray-500">
            {unit}
          </span>
        </div>
        
        {/* Change Indicator */}
        <div className="mt-2 flex items-center space-x-1">
          {/* Visual indicator icon */}
          {changeType === "increase" && (
            <svg 
              className="w-4 h-4 text-lime-600" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth="2" 
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
          )}
          {changeType === "decrease" && (
            <svg 
              className="w-4 h-4 text-red-600" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth="2" 
                d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
              />
            </svg>
          )}
          
          <p className={cn("text-xs font-medium", changeColor)}>
            {change}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}