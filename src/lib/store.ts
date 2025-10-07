// centenarian-os/src/lib/store.ts
import { create } from 'zustand';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from './firebase';

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: Date;
}

interface PlanState {
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  addTask: (task: { title: string }, userId: string) => Promise<void>;
  toggleTask: (taskId: string, completed: boolean, userId: string) => Promise<void>;
}

export const usePlanStore = create<PlanState>((set, get) => ({
  tasks: [],
  setTasks: (tasks) => set({ tasks }),
  addTask: async (task, userId) => {
    if (!userId) throw new Error("User not authenticated.");
    try {
      await addDoc(collection(db, 'users', userId, 'tasks'), {
        ...task,
        completed: false,
        createdAt: new Date(),
      });
      // The real-time listener will update the state, so no need to set() here.
    } catch (error) {
      console.error('Error adding task: ', error);
    }
  },
  toggleTask: async (taskId, completed, userId) => {
    if (!userId) throw new Error("User not authenticated.");
    try {
      const taskRef = doc(db, 'users', userId, 'tasks', taskId);
      await updateDoc(taskRef, { completed });
       // The real-time listener will update the state.
    } catch (error) {
      console.error('Error toggling task: ', error);
    }
  },
}));

