/* eslint-disable @typescript-eslint/no-explicit-any */
// centenarian-os/src/lib/store.ts
import { create } from 'zustand';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * Task Tag Types - Strategic categorization for activities
 * Follows the Centenarian OS Strategic Color Palette
 */
export type TaskTag = 
  | 'FITNESS'    // Physical training and exercise
  | 'CREATIVE'   // Content creation, art, podcasts
  | 'SKILL'      // Skill development and learning
  | 'OUTREACH'   // Networking and communication
  | 'LIFESTYLE'  // Daily habits and routines
  | 'MINDSET'    // Mental health and reflection
  | 'FUEL';      // Nutrition and meal planning
/**
 * Entry interface - Represents all data types in the system
 * 
 * DESIGN NOTES:
 * - All fields except id, type, and content are optional
 * - Task-specific fields (tag, priority, etc.) only apply when type='task'
 * - createdAt is auto-populated by Firestore
 * 
 * TYPE SAFETY:
 * - TypeScript ensures only valid tags can be assigned
 * - Priority must be 1, 2, or 3
 */
export interface Entry {
  /** Unique identifier (Firestore document ID) */
  id: string;
  
  /** Entry type - determines which fields are relevant */
  type: 'task' | 'note';
  
  /** Main content - task title or note body */
  content: string;
  
  /** Completion status - only applicable for tasks */
  completed?: boolean;
  createdAt: any; // Firestore timestamp
  userId: string;
  
  // NEW OPTIONAL FIELDS (won't break existing data)
  tag?: TaskTag;
  description?: string;
  priority?: 1 | 2 | 3;
  time?: string;
}

/**
 * Store state and actions
 */
interface EntryState {
  entries: Entry[];
  setEntries: (entries: Entry[]) => void;
  addEntry: (newEntry: Omit<Entry, 'id' | 'createdAt' | 'userId'>, userId: string) => Promise<void>;
  updateEntry: (entryId: string, updates: Partial<Entry>, userId: string) => Promise<void>;
  clearEntries: () => void;
}

/**
 * Entry Store - Manages all tasks and notes
 * 
 * FIREBASE INTEGRATION:
 * - All mutations immediately sync to Firestore
 * - Real-time listener in PlanInitializer keeps state updated
 * 
 * ERROR HANDLING:
 * - All async operations include try-catch blocks
 * - Errors are logged to console (production should send to monitoring service)
 * 
 * SECURITY:
 * - UserId is required for all operations
 * - Firestore security rules enforce user-level isolation
 */
export const useEntryStore = create<EntryState>((set, get) => ({
  entries: [],
  
  /**
   * Sets the entire entries array (used by real-time listener)
   * @param entries - Array of entries from Firestore
   */
  setEntries: (entries) => set({ entries }),
  
  /**
   * Adds a new entry to Firestore
   * 
   * @param newEntry - Entry data (without id and createdAt)
   * @param userId - Firebase Auth user ID
   * 
   * VALIDATION:
   * - content must not be empty
   * - type must be 'task' or 'note'
   * - if type='task' and tag is provided, must be valid TaskTag
   * - if type='task' and priority is provided, must be 1, 2, or 3
   * 
   * SECURITY:
   * - Firestore security rules verify userId matches auth.uid
   */
  addEntry: async (newEntry, userId) => {
    try {
      // Validate required fields
      if (!newEntry.content?.trim()) {
        throw new Error('Content is required');
      }
      
      // Validate tag if provided
      if (newEntry.tag) {
        const validTags: TaskTag[] = ['FITNESS', 'CREATIVE', 'SKILL', 'OUTREACH', 'LIFESTYLE', 'MINDSET', 'FUEL'];
        if (!validTags.includes(newEntry.tag)) {
          console.error('Invalid tag:', newEntry.tag);
          throw new Error('Invalid tag provided');
        }
      }
      
      // Validate priority if provided
      if (newEntry.priority && ![1, 2, 3].includes(newEntry.priority)) {
        console.error('Invalid priority:', newEntry.priority);
        throw new Error('Priority must be 1, 2, or 3');
      }
      
      await addDoc(collection(db, 'users', userId, 'entries'), {
        ...newEntry,
        createdAt: serverTimestamp(),
        userId: userId,
      });
      
      console.log('Entry added successfully:', newEntry.type, newEntry.content.substring(0, 30));
    } catch (error) {
      console.error('Error adding entry:', error);
      throw error; // Re-throw to allow UI to handle
    }
  },
  
  /**
   * Updates an existing entry in Firestore
   * 
   * @param entryId - Document ID
   * @param updates - Partial entry object with fields to update
   * @param userId - Firebase Auth user ID
   * 
   * COMMON USE CASES:
   * - Toggle completion: updateEntry(id, { completed: !task.completed }, userId)
   * - Edit content: updateEntry(id, { content: newContent }, userId)
   * - Change priority: updateEntry(id, { priority: 1 }, userId)
   */
  updateEntry: async (entryId, updates, userId) => {
    const entryRef = doc(db, 'users', userId, 'entries', entryId);
    try {
      await updateDoc(entryRef, updates);
      console.log('Entry updated successfully:', entryId);
    } catch (error) {
      console.error('Error updating entry:', error);
      throw error;
    }
  },

  /**
   * Deletes an entry from Firestore
   * 
   * @param entryId - Document ID
   * @param userId - Firebase Auth user ID
   * 
   * WARNING: This is permanent and cannot be undone
   * Consider adding a 'deleted' flag instead for soft deletes
   */
  // deleteEntry: async (entryId, userId) => {
  //   try {
  //     const entryRef = doc(db, 'users', userId, 'entries', id);
  //     await deleteDoc(entryRef);
      
  //     console.log('Entry deleted successfully:', id);
  //   } catch (error) {
  //     console.error('Error deleting entry:', error);
  //     throw error;
  //   }
  // },
  
  clearEntries: () => set({ entries: [] }),
}));

/**
 * FUTURE ENHANCEMENTS:
 * 
 * 1. Add filtering/sorting helpers:
 *    - getTasksByTag(tag: TaskTag): Entry[]
 *    - getTasksByPriority(priority: 1 | 2 | 3): Entry[]
 *    - getPendingTasks(): Entry[]
 * 
 * 2. Add batch operations:
 *    - markMultipleComplete(ids: string[]): Promise<void>
 *    - deleteMultiple(ids: string[]): Promise<void>
 * 
 * 3. Add undo/redo functionality:
 *    - Store action history
 *    - Implement undo/redo stack
 * 
 * 4. Add optimistic updates:
 *    - Update UI immediately
 *    - Rollback on error
 *    - Show loading states
 */