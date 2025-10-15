// centenarian-os/src/components/dashboard/plan-widget.tsx
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useEntryStore } from '@/lib/store'; // Use new Entry store
import { useAuth } from '@/context/auth-context';

export function PlanWidget() {
  const { user } = useAuth();
  const entries = useEntryStore((state) => state.entries);
  const updateEntry = useEntryStore((state) => state.updateEntry);
  
  // Filter entries to only show tasks
  // NOTE: You'll need to update this logic when moving to multi-day views
  const tasks = entries.filter(entry => entry.type === 'task');

  const handleToggle = (id: string, completed: boolean) => {
    if (user) {
      // Assuming updateEntry handles the Firestore call to toggle the completion status
      updateEntry(id, { completed: !completed }, user.uid);
    }
  };

  return (
    // Explicitly enforce bg-white and shadow for the card container
    <Card className="bg-white rounded-2xl shadow-xl border-none">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-gray-900">Today&apos;s Plan</CardTitle>
        <CardDescription className="text-gray-500">
          A list of your tasks for today. Stay focused.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {tasks.length > 0 ? (
            tasks.map((task) => (
              <div
                key={task.id}
                // Use white background and soft border for task items
                className="flex items-center space-x-4 bg-gray-50 rounded-lg p-4 transition-shadow hover:shadow-md"
              >
                {/* Custom Checkbox Styling: Apply strategic color lime-500 */}
                <Checkbox
                  id={task.id}
                  checked={task.completed}
                  onCheckedChange={() => handleToggle(task.id, task.completed || false)}
                  className="h-5 w-5 border-gray-300 data-[state=checked]:bg-lime-500 data-[state=checked]:text-white"
                />
                <label
                  htmlFor={task.id}
                  className={`flex-1 text-base font-medium leading-none transition-all ${
                    task.completed ? 'line-through text-gray-500' : 'text-gray-900'
                  }`}
                >
                  {task.content}
                </label>
              </div>
            ))
          ) : (
            <p className="text-base text-gray-500 p-2">
              No tasks for today. Use the &quot;New Entry&quot; button to add one.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
