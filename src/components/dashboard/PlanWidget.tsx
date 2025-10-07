"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { usePlanStore } from "@/lib/store";

export function PlanWidget() {
  const { tasks, toggleTask } = usePlanStore();

  return (
    <Card className="col-span-1 md:col-span-3 lg:col-span-4">
      <CardHeader>
        <CardTitle>Today&apos;s Plan</CardTitle>
        <CardDescription>Tuesday, October 7, 2025</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {tasks.map((task) => (
            <div className="flex items-center space-x-3" key={task.id}>
              <Checkbox 
                id={task.id} 
                checked={task.completed}
                onCheckedChange={() => toggleTask(task.id)}
              />
              <Label
                htmlFor={task.id}
                className={`flex-1 text-sm transition-colors ${
                  task.completed ? "text-muted-foreground line-through" : "text-primary"
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

