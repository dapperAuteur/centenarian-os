// centenarian-os/src/lib/store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Task {
  id: string;
  label: string;
  completed: boolean;
}

interface PlanState {
  tasks: Task[];
  toggleTask: (taskId: string) => void;
  addTask: (label: string) => void;
}

const initialTasks: Task[] = [
    { id: "task1", label: "Morning Mobility: 15 minutes CARs routine.", completed: true },
    { id: "task2", label: "Strength A: 5x5 Heavy Squats, 3x8 Bench Press.", completed: false },
    { id: "task3", label: "Deep Work: 90 minutes on Centenarian OS dev.", completed: false },
    { id: "task4", label: "Read: 30 pages of 'Outlive' by Peter Attia.", completed: true },
    { id: "task5", label: "Skill: 20 minutes handstand practice against wall.", completed: false },
    { id: "task6", label: "Evening Wind Down: 10 minutes of box breathing.", completed: false },
];

export const usePlanStore = create<PlanState>()(
  persist(
    (set) => ({
      tasks: initialTasks,
      toggleTask: (taskId) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId ? { ...task, completed: !task.completed } : task
          ),
        })),
      addTask: (label) =>
        set((state) => ({
          tasks: [
            { id: crypto.randomUUID(), label, completed: false },
            ...state.tasks,
          ],
        })),
    }),
    {
      name: 'centenarian-os-plan-storage',
    }
  )
);

