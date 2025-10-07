// centenarian-os/src/components/dashboard/plan-initializer.tsx
"use client";

import { useEffect, useRef } from 'react';
import { usePlanStore, Task } from '@/lib/store';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';

function PlanInitializer() {
  const setTasks = usePlanStore((state) => state.setTasks);
  const initialized = useRef(false);

  useEffect(() => {
    // Prevent multiple listeners from being set up, especially in React Strict Mode
    if (initialized.current) return;
    initialized.current = true;

    // TODO: Replace with dynamic user ID upon implementing authentication
    const userId = 'default-user';
    const tasksCollectionRef = collection(db, 'users', userId, 'tasks');
    const q = query(tasksCollectionRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const tasks: Task[] = [];
      querySnapshot.forEach((doc) => {
        tasks.push({ id: doc.id, ...doc.data() } as Task);
      });
      setTasks(tasks);
    });

    // Clean up the listener when the component unmounts
    return () => unsubscribe();
  }, [setTasks]);

  return null; // This component does not render anything
}

export default PlanInitializer;
