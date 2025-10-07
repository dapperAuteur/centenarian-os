// centenarian-os/src/components/dashboard/plan-initializer.tsx
"use client";

import { useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { usePlanStore, Task } from '@/lib/store';
import { useAuth } from '@/context/auth-context';

function PlanInitializer() {
  const { setTasks } = usePlanStore();
  const { currentUser } = useAuth();

  useEffect(() => {
    if (!currentUser) {
      // Clear tasks if user logs out
      setTasks([]);
      return;
    }

    const q = query(
      collection(db, 'users', currentUser.uid, 'tasks'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const tasks: Task[] = [];
      querySnapshot.forEach((doc) => {
        tasks.push({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt.toDate(),
        } as Task);
      });
      setTasks(tasks);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [currentUser, setTasks]);

  return null; // This component does not render anything
}

export default PlanInitializer;

