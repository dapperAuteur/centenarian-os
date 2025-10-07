// centenarian-os/src/components/dashboard/quick-capture.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePlanStore } from "@/lib/store";
import { useAuth } from "@/context/auth-context";

export default function QuickCapture() {
  const [taskTitle, setTaskTitle] = useState("");
  const { addTask } = usePlanStore();
  const { user } = useAuth();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('taskTitle :>> ', taskTitle);
    if (taskTitle.trim() === "" || !user) return;
    addTask({ title: taskTitle.trim() }, user.uid);
    setTaskTitle("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full items-center space-x-2">
      <Input
        type="text"
        placeholder="Add a new task..."
        value={taskTitle}
        onChange={(e) => setTaskTitle(e.target.value)}
        className="flex-1"
      />
      <Button type="submit">Add Task</Button>
    </form>
  );
}

