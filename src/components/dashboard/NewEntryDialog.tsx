// centenarian-os/src/components/dashboard/NewEntryDialog.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useEntryStore, type Entry, type TaskTag } from '@/lib/store';

/**
 * Enhanced NewEntryDialog Component
 * TYPE-SAFE VERSION that matches your store structure
 */
export function NewEntryDialog() {
  const { user } = useAuth();
  
  // Form state
  const [entryType, setEntryType] = useState<'task' | 'note'>('task');
  const [content, setContent] = useState('');
  const [description, setDescription] = useState('');
  const [tag, setTag] = useState<TaskTag>('MINDSET');
  const [priority, setPriority] = useState<1 | 2 | 3>(2);
  const [time, setTime] = useState('');
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const addEntry = useEntryStore((state) => state.addEntry);

  /**
   * Form submission handler
   * FIXED: Properly typed to match store's expected type
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!content.trim() || !user) {
      console.error('Missing required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      // Build entry object with CORRECT TYPE
      // Type: Omit<Entry, 'id' | 'createdAt' | 'userId'>
      const newEntryData: Omit<Entry, 'id' | 'createdAt' | 'userId'> = {
        type: entryType,
        content: content.trim(),
      };

      // Add task-specific fields
      if (entryType === 'task') {
        newEntryData.completed = false;
        newEntryData.tag = tag;
        newEntryData.priority = priority;
        
        // Optional fields (only add if provided)
        if (description.trim()) {
          newEntryData.description = description.trim();
        }
        if (time.trim()) {
          newEntryData.time = time.trim();
        }
      }

      // Submit to Firestore (now properly typed!)
      await addEntry(newEntryData, user.uid);

      // Success: Reset form and close dialog
      resetForm();
      setOpen(false);
    } catch (error) {
      console.error('Error creating entry:', error);
      // TODO: Show user-friendly error message
      alert('Failed to create entry. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Resets all form fields to default values
   */
  const resetForm = () => {
    setContent('');
    setDescription('');
    setTag('MINDSET');
    setPriority(2);
    setTime('');
    setEntryType('task');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-sky-500 hover:bg-sky-600 text-white shadow-lg">
          <PlusCircle className="mr-2 h-4 w-4" />
          New Entry
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Create New Entry</DialogTitle>
          <DialogDescription>
            Add a task, note, or other data point to track your progress.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 py-4">
            
            {/* Entry Type Selector */}
            <div className="grid w-full items-center gap-2">
              <Label htmlFor="entryType">Entry Type</Label>
              <Select
                value={entryType}
                onValueChange={(value: 'task' | 'note') => setEntryType(value)}
              >
                <SelectTrigger id="entryType">
                  <SelectValue placeholder="Select an entry type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Content Input (Required) */}
            <div className="grid w-full items-center gap-2">
              <Label htmlFor="content">
                {entryType === 'task' ? 'Task Title' : 'Note Content'}
                <span className="text-red-500 ml-1">*</span>
              </Label>
              {entryType === 'task' ? (
                <Input
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="e.g., Morning Fitness: Push-ups, TRX Row, Plank"
                  required
                />
              ) : (
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="e.g., A reflection on today's progress..."
                  required
                  rows={4}
                />
              )}
            </div>
            
            {/* Task-Specific Fields (Only show for tasks) */}
            {entryType === 'task' && (
              <>
                {/* Task Tag */}
                <div className="grid w-full items-center gap-2">
                  <Label htmlFor="tag">Category</Label>
                  <Select
                    value={tag}
                    onValueChange={(value: TaskTag) => setTag(value)}
                  >
                    <SelectTrigger id="tag">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FITNESS">🏋️ Fitness</SelectItem>
                      <SelectItem value="CREATIVE">🎨 Creative</SelectItem>
                      <SelectItem value="SKILL">🎯 Skill</SelectItem>
                      <SelectItem value="OUTREACH">📧 Outreach</SelectItem>
                      <SelectItem value="LIFESTYLE">🌿 Lifestyle</SelectItem>
                      <SelectItem value="MINDSET">🧠 Mindset</SelectItem>
                      <SelectItem value="FUEL">🍽️ Fuel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Priority Level */}
                <div className="grid w-full items-center gap-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={priority.toString()}
                    onValueChange={(value: string) => setPriority(parseInt(value) as 1 | 2 | 3)}
                  >
                    <SelectTrigger id="priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">🔴 High (P1)</SelectItem>
                      <SelectItem value="2">🟡 Medium (P2)</SelectItem>
                      <SelectItem value="3">🟢 Low (P3)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Time (Optional) */}
                <div className="grid w-full items-center gap-2">
                  <Label htmlFor="time">Time (Optional)</Label>
                  <Input
                    id="time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    placeholder="e.g., 05:50"
                  />
                </div>
                
                {/* Description (Optional) */}
                <div className="grid w-full items-center gap-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add detailed instructions, context, or notes..."
                    rows={3}
                  />
                </div>
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !content.trim()}
              className="bg-sky-500 hover:bg-sky-600"
            >
              {isSubmitting ? (
                <>
                  <svg 
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" 
                    xmlns="http://www.w3.org/2000/svg" 
                    fill="none" 
                    viewBox="0 0 24 24"
                  >
                    <circle 
                      className="opacity-25" 
                      cx="12" 
                      cy="12" 
                      r="10" 
                      stroke="currentColor" 
                      strokeWidth="4"
                    />
                    <path 
                      className="opacity-75" 
                      fill="currentColor" 
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Saving...
                </>
              ) : (
                'Save Entry'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}