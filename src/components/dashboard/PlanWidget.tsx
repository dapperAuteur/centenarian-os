import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

// Mock data for the plan
const dailyPlan = [
  { id: "task1", label: "Morning Mobility: 15 minutes CARs routine.", completed: true },
  { id: "task2", label: "Strength A: 5x5 Heavy Squats, 3x8 Bench Press.", completed: false },
  { id: "task3", label: "Deep Work: 90 minutes on Centenarian OS dev.", completed: false },
  { id: "task4", label: "Read: 30 pages of 'Outlive' by Peter Attia.", completed: true },
  { id: "task5", label: "Skill: 20 minutes handstand practice against wall.", completed: false },
  { id: "task6", label: "Evening Wind Down: 10 minutes of box breathing.", completed: false },
];

export function PlanWidget() {
  return (
    <Card className="col-span-1 md:col-span-3 lg:col-span-4">
      <CardHeader>
        <CardTitle>Today&apos;s Plan</CardTitle>
        <CardDescription>Tuesday, October 7, 2025</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {dailyPlan.map((task) => (
            <div className="flex items-center space-x-3" key={task.id}>
              <Checkbox id={task.id} checked={task.completed} />
              <Label
                htmlFor={task.id}
                className={`flex-1 text-sm ${
                  task.completed ? "text-muted-foreground line-through" : ""
                }`}
              >
                {task.label}
              </Label>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
