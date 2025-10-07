// centenarian-os/src/components/dashboard/plan-widget.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { usePlanStore } from "@/lib/store";
import { useAuth } from "@/context/auth-context";

export default function PlanWidget() {
  const { tasks, toggleTask } = usePlanStore();
  const { currentUser } = useAuth();

  const handleCheckedChange = (taskId: string, checked: boolean) => {
    if (!currentUser) return;
    toggleTask(taskId, checked, currentUser.uid);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today&apos;s Plan</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center space-x-4">
              <Checkbox
                id={task.id}
                checked={task.completed}
                onCheckedChange={(checked) => handleCheckedChange(task.id, !!checked)}
              />
              <label
                htmlFor={task.id}
                className={`flex-1 text-sm font-medium leading-none ${
                  task.completed ? "line-through text-muted-foreground" : ""
                }`}
              >
                {task.title}
              </label>
            </div>
          ))}
          {tasks.length === 0 && (
             <p className="text-sm text-muted-foreground">No tasks for today. Add one above.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

