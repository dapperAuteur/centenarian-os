/* eslint-disable @typescript-eslint/no-explicit-any */
// centenarian-os/src/lib/store.ts
import { create } from 'zustand';
import { db } from './firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';

export interface Task {
  id: string;
  label: string;
  completed: boolean;
  createdAt: any; // Using 'any' for serverTimestamp flexibility
}

interface PlanState {
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  addTask: (label: string) => Promise<void>;
  toggleTask: (taskId: string, currentStatus: boolean) => Promise<void>;
}

// TODO: Replace with dynamic user ID upon implementing authentication
const userId = 'default-user';
const tasksCollectionRef = collection(db, 'users', userId, 'tasks');

export const usePlanStore = create<PlanState>((set) => ({
  tasks: [],
  setTasks: (tasks) => set({ tasks }),
  addTask: async (label) => {
    try {
      await addDoc(tasksCollectionRef, {
        label,
        completed: false,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error adding task: ", error);
      // Here you might want to add user-facing error handling
    }
  },
  toggleTask: async (taskId, currentStatus) => {
    const taskDocRef = doc(db, 'users', userId, 'tasks', taskId);
    try {
      await updateDoc(taskDocRef, {
        completed: !currentStatus,
      });
    } catch (error) {
      console.error("Error toggling task: ", error);
    }
  },
}));

