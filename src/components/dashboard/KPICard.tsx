import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string;
  unit: string;
  change: string;
  changeType: "increase" | "decrease" | "neutral";
  Icon: LucideIcon;
}

export function KpiCard({
  title,
  value,
  unit,
  change,
  changeType,
  Icon,
}: KpiCardProps) {
  const changeColor =
    changeType === "increase"
      ? "text-green-500"
      : changeType === "decrease"
      ? "text-red-500"
      : "text-muted-foreground";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {value} <span className="text-sm font-normal text-muted-foreground">{unit}</span>
        </div>
        <p className={`text-xs ${changeColor}`}>{change}</p>
      </CardContent>
    </Card>
  );
}
