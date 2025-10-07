// centenarian-os/src/components/dashboard/quick-capture.tsx
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { usePlanStore } from "@/lib/store";

export function QuickCapture() {
  const [taskLabel, setTaskLabel] = useState("");
  const addTask = usePlanStore((state) => state.addTask);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (taskLabel.trim()) {
      addTask(taskLabel.trim());
      setTaskLabel("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <PlusCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
      <Input
        placeholder="Quick Capture: Add a task to your plan..."
        className="pl-10"
        value={taskLabel}
        onChange={(e) => setTaskLabel(e.target.value)}
      />
      <Button type="submit" size="sm" className="absolute right-2 top-1/2 -translate-y-1/2">
        Add Task
      </Button>
    </form>
  );
}

