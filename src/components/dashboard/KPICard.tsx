// centenarian-os/src/components/dashboard/KPICard.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils"; // Assuming you have a standard cn utility

interface KpiCardProps {
  title: string;
  value: string;
  unit: string;
  change: string;
  changeType: "increase" | "decrease" | "neutral";
  Icon: LucideIcon;
  strategicAccent: string; // Strategic color for icon/key value
  colorClass?: string; // Strategic color for icon/key value
}

export function KpiCard({
  title,
  value,
  unit,
  change,
  changeType,
  Icon,
  colorClass = "text-gray-500", // Default to gray if not provided
}: KpiCardProps) {
  const changeColor =
    changeType === "increase"
      ? "text-lime-500" // Use strategic lime for positive change
      : changeType === "decrease"
      ? "text-red-500"
      : "text-gray-500";

  return (
    // Explicitly enforce bg-white and soft shadow for the clean look
    <Card className="bg-white rounded-xl shadow-lg border-none transition-all hover:shadow-2xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        {/* Enforce strong foreground text */}
        <CardTitle className="text-sm font-semibold text-gray-700">{title}</CardTitle>
        {/* Apply strategic color to the icon */}
        <Icon className={cn("h-5 w-5", colorClass)} />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-extrabold text-gray-900">
          {value} <span className="text-base font-medium text-gray-500">{unit}</span>
        </div>
        <p className={cn("text-xs mt-1 font-medium", changeColor)}>{change}</p>
      </CardContent>
    </Card>
  );
}
