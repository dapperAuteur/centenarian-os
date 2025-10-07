// centenarian-os/src/components/dashboard/plan-initializer.tsx
"use client";

import { useEffect, useRef } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { useEntryStore, Entry } from '@/lib/store'; // Use the new Entry store
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/auth-context';

function PlanInitializer() {
  const { user } = useAuth();
  const setEntries = useEntryStore((state) => state.setEntries);
  // Correctly initialize useRef with null to create a mutable ref object.
  const unsubscribeRef = useRef<() => void | undefined>(null);

  useEffect(() => {
    if (user) {
      // Unsubscribe from the previous listener if it exists
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }

      const q = query(
        collection(db, 'users', user.uid, 'entries'),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const entries: Entry[] = [];
        querySnapshot.forEach((doc) => {
          entries.push({ id: doc.id, ...doc.data() } as Entry);
        });
        setEntries(entries);
      });

      // Store the new unsubscribe function
      unsubscribeRef.current = unsubscribe;
    } else {
      // If user logs out, unsubscribe and clear the plan
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      setEntries([]);
    }

    // Cleanup function to unsubscribe when the component unmounts
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [user, setEntries]);

  // useEffect(() => {
  //   if (!user) {
  //     // Clear tasks if user logs out
  //     setTasks([]);
  //     return;
  //   }

  //   const q = query(
  //     collection(db, 'users', user.uid, 'tasks'),
  //     orderBy('createdAt', 'desc')
  //   );

  //   const unsubscribe = onSnapshot(q, (querySnapshot) => {
  //     const tasks: Task[] = [];
  //     querySnapshot.forEach((doc) => {
  //       tasks.push({
  //         id: doc.id,
  //         ...doc.data(),
  //         createdAt: doc.data().createdAt.toDate(),
  //       } as Task);
  //     });
  //     setTasks(tasks);
  //   });

  //   // Cleanup subscription on unmount
  //   return () => unsubscribe();
  // }, [user, setTasks]);

  return null; // This component does not render anything
}

export default PlanInitializer;
