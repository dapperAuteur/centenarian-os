// centenarian-os/src/components/dashboard/plan-widget.tsx
"use client";

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { usePlanStore } from "@/lib/store";

export function PlanWidget() {
  const tasks = usePlanStore((state) => state.tasks);
  const toggleTask = usePlanStore((state) => state.toggleTask);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today&apos;s Plan</CardTitle>
        <CardDescription>
          The day&apos;s mission-critical objectives. Add new tasks via Quick Capture.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <div key={task.id} className="flex items-center space-x-3">
              <Checkbox
                id={task.id}
                checked={task.completed}
                onCheckedChange={() => toggleTask(task.id, task.completed)}
              />
              <label
                htmlFor={task.id}
                className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
                  task.completed ? "line-through text-muted-foreground" : ""
                }`}
              >
                {task.label}
              </label>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No tasks for today. Add one above.</p>
        )}
      </CardContent>
    </Card>
  );
}

