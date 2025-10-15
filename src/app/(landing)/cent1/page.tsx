/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from 'react';
import { 
    signInAnonymously, 
    signInWithCustomToken, 
    onAuthStateChanged 
} from 'firebase/auth';
import { 
    doc, 
    setDoc, 
    updateDoc, 
    onSnapshot, 
    getDoc,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase'; // <-- IMPORT a single, shared Firebase instance

// --- Type Definitions for Safety ---
type TaskTag = 'FITNESS' | 'CREATIVE' | 'SKILL' | 'OUTREACH' | 'LIFESTYLE' | 'MINDSET' | 'FUEL';
type ViewMode = 'WEEK' | 'THREE_DAY' | 'DAY'; 

interface Task {
    id: string;              // Unique ID (e.g., '2025-10-06-AM-FIT')
    date: string;            // Date of the task (YYYY-MM-DD)
    time: string;            // Time of the task (e.g., '05:50 AM')
    activity: string;        // Short, main description
    description: string;     // Detailed description
    tag: TaskTag;            // Tag for classification
    week: number;            // Week number relative to the start date (1-5)
    priority: number;        // Priority level (1=High, 3=Low)
    completed: boolean;      // Completion status
}

interface TemplateTask {
    dayOfWeek: number;       // 0=Sun, 1=Mon, ..., 6=Sat
    time: string;
    activity: string;
    description: string;
    tag: TaskTag;
    priority: number;
}

interface WeekRange {
    weekNumber: number;
    start: Date;
    end: Date;
    label: string;
}

// --- GLOBAL VARIABLES (Provided by the execution environment) ---
// Use a hardcoded or environment-variable-based appId.
const appId = process.env.NEXT_PUBLIC_APP_ID || 'default-centenarian-app';
const initialAuthToken: string | null = null; // Rely on anonymous sign-in.

// --- TASK TEMPLATE DATA (Updated with description) ---
const WEEKLY_TEMPLATE_PLAN: TemplateTask[] = [
    // Monday (dayOfWeek: 1)
    { dayOfWeek: 1, time: '05:50 AM', activity: 'Morning Strength: Push-ups, TRX Row, Plank.', description: 'Perform 3 sets of each exercise, aiming for max reps (12-15). Focus on core stability and slow negatives on the push and pull movements.', tag: 'FITNESS', priority: 1 },
    { dayOfWeek: 1, time: '06:50 AM', activity: 'High-Protein Pre-Commute Fuel.', description: 'Consume at least 25g of protein (e.g., Greek yogurt, eggs, or protein shake) before leaving to maintain energy levels and muscle synthesis.', tag: 'FUEL', priority: 3 },
    { dayOfWeek: 1, time: '07:00 AM', activity: 'Tactical Outreach: Teacher emails (Corvid K-5).', description: 'Use 5-min micro-breaks to send 3-4 personalized emails/texts to teachers. Track contacts in spreadsheet/CRM.', tag: 'OUTREACH', priority: 2 },
    { dayOfWeek: 1, time: '04:00 PM', activity: 'Creative Focus: Record Corvid Podcast.', description: 'Dedicated, quiet recording session for 1-2 written episodes. Ensure mic levels are optimal and review voice clarity (referencing VO Pro Training notes).', tag: 'CREATIVE', priority: 1 },

    // Tuesday (dayOfWeek: 2)
    { dayOfWeek: 2, time: '05:50 AM', activity: 'Creative Focus: Record Fitness Metrics Class (Module 1).', description: 'Record Module 1 of the Metrics Class. Focus on clear, concise delivery of the written script. Aim for a professional, high-energy tone.', tag: 'CREATIVE', priority: 1 },
    { dayOfWeek: 2, time: '06:50 AM', activity: 'High-Protein Pre-Commute Fuel.', description: 'Consume at least 25g of protein before leaving. Hydrate well.', tag: 'FUEL', priority: 3 },
    { dayOfWeek: 2, time: '07:00 AM', activity: 'Tactical Outreach: Teacher emails (Corvid K-5).', description: 'Send a follow-up batch of 3-4 personalized emails/texts to new teacher leads.', tag: 'OUTREACH', priority: 2 },
    { dayOfWeek: 2, time: '04:00 PM', activity: 'Evening Skill & Recovery (Front Lever Progression).', description: '45 min: 3 sets of max-hold Tuck Front Lever and 3 sets of 8-10 TRX Tuck Rows. 15 min: Cool Down/Stretching from `meditation-yoga.pdf`.', tag: 'SKILL', priority: 2 },

    // Wednesday (dayOfWeek: 3)
    { dayOfWeek: 3, time: '05:50 AM', activity: 'Morning Strength: Pike Push-ups, TRX Bicep Curl, Russian Twist.', description: 'Strength Wk 1 focuses: Pike Push-ups (3x8-10), TRX Curl (3x12-15), Russian Twist (3x15-20/side). Maintain strict form.', tag: 'FITNESS', priority: 1 },
    { dayOfWeek: 3, time: '06:50 AM', activity: 'High-Protein Pre-Commute Fuel.', description: 'Focus on complex carbohydrates and protein for sustained energy throughout the workday.', tag: 'FUEL', priority: 3 },
    { dayOfWeek: 3, time: '07:00 AM', activity: 'Tactical Outreach: Follow up on initial emails.', description: 'Follow up on Monday\'s and Tuesday\'s emails. Confirm receipt and ask for one piece of feedback on the K-5 activities.', tag: 'OUTREACH', priority: 2 },
    { dayOfWeek: 3, time: '04:00 PM', activity: 'Creative Focus: Record/Edit Corvid Podcast.', description: 'Secondary recording session or start editing the audio from Monday’s session. Focus on removing filler words and mastering volume levels (Referencing Ableton Manual).', tag: 'CREATIVE', priority: 2 },

    // Thursday (dayOfWeek: 4)
    { dayOfWeek: 4, time: '05:50 AM', activity: 'Creative Focus: Edit/Prep Metrics Class.', description: 'Review Monday\'s recording. Finalize sound, design title cards/thumbnails, and write the lesson summary for distribution. Apply 5 C\'s of Storytelling principles.', tag: 'CREATIVE', priority: 1 },
    { dayOfWeek: 4, time: '06:50 AM', activity: 'High-Protein Pre-Commute Fuel.', description: 'Ensure adequate fat intake today to support hormone balance and satiety.', tag: 'FUEL', priority: 3 },
    { dayOfWeek: 4, time: '07:00 AM', activity: 'Tactical Outreach: Send final batch of K-5 outreach emails.', description: 'Final batch of outreach emails for the week to reach target distribution goal. Log all recipients.', tag: 'OUTREACH', priority: 2 },
    { dayOfWeek: 4, time: '04:00 PM', activity: 'Evening Skill & Recovery (Shoulder Health & Press).', description: '45 min: 3 sets of Kettlebell Armbar (30-45 sec/side) and 3x12 Light Overhead Press (stability focus). 15 min: Cool Down/Stretching.', tag: 'SKILL', priority: 2 },

    // Friday (dayOfWeek: 5)
    { dayOfWeek: 5, time: '05:50 AM', activity: 'Morning Strength: TRX Chest Press, Inverted Row, Hollow Body Hold.', description: 'Strength Wk 1 focuses: TRX Chest Press (3xMax), Inverted Row (3xMax), Hollow Body Hold (3x45-60s). Focus on sustained core tension.', tag: 'FITNESS', priority: 1 },
    { dayOfWeek: 5, time: '06:50 AM', activity: 'High-Protein Pre-Commute Fuel.', description: 'Maintain consistent nutrient timing.', tag: 'FUEL', priority: 3 },
    { dayOfWeek: 5, time: '07:00 AM', activity: 'Tactical Outreach: Log all teacher contacts/responses.', description: 'Compile all teacher contacts and responses into a single summary document for strategic review next week. Note any feedback received.', tag: 'OUTREACH', priority: 2 },
    { dayOfWeek: 5, time: '04:00 PM', activity: 'Strategic Review & Upload (Content finalization).', description: 'Final check of all recorded/edited content (Podcast & Metrics Class). Upload all finalized files to hosting platforms for distribution.', tag: 'CREATIVE', priority: 1 },

    // Weekend - Recovery and Long-Term Art (dayOfWeek: 6, 0)
    { dayOfWeek: 6, time: '10:00 AM', activity: 'Long Run/Sprint Session (Speed work focus).', description: 'Aerobic TE focus: Include 4-6 short sprints (100m) at high intensity, followed by active recovery. Note Avg HR.', tag: 'FITNESS', priority: 1 },
    { dayOfWeek: 6, time: '04:00 PM', activity: 'Deconstruct [Skill] - Dedicated art practice.', description: '1 hour dedicated to art practice. Select an activity from `art storytelling-drawing.pdf` (e.g., practice the "Clarity Test" on a new sketch).', tag: 'CREATIVE', priority: 2 },
    { dayOfWeek: 0, time: '10:00 AM', activity: 'Mobility/Yoga Session.', description: 'Focus on hip mobility (splits progression) and deep stretches. Refer to the uploaded `meditation-yoga.pdf` for a new pose/breathing technique.', tag: 'LIFESTYLE', priority: 2 },
    { dayOfWeek: 0, time: '05:00 PM', activity: 'Weekly Review: Plan next week’s focus.', description: 'Review progress percentage, identify incomplete tasks, and adjust long-term goals. Decide on next week\'s exercise cycle.', tag: 'MINDSET', priority: 1 },
];

// --- Utility Functions ---

const getTypeColor = (tag: TaskTag, completed: boolean = false): string => {
    const baseColors: { [key in TaskTag]: string } = {
        'FITNESS': 'bg-lime-500 text-lime-900 border-lime-300',
        'CREATIVE': 'bg-sky-500 text-sky-900 border-sky-300',
        'SKILL': 'bg-fuchsia-500 text-fuchsia-900 border-fuchsia-300',
        'OUTREACH': 'bg-amber-500 text-amber-900 border-amber-300',
        'LIFESTYLE': 'bg-teal-500 text-teal-900 border-teal-300',
        'MINDSET': 'bg-indigo-500 text-indigo-900 border-indigo-300',
        'FUEL': 'bg-orange-500 text-orange-900 border-orange-300',
    };
    const colorClasses = baseColors[tag] || 'bg-gray-400 text-gray-800 border-gray-300';
    
    if (completed) {
        // Return a light, muted version for completed tasks
        return 'bg-gray-100 text-gray-500 border-gray-200 line-through';
    }

    // Return the specific Tailwind background class only for the badge, and a general text color for the card
    const badgeColor = colorClasses.split(' ').filter(c => c.startsWith('bg-')).join(' ');
    return `${badgeColor} text-gray-800`;
};

// Date utilities
const getStartOfWeek = (date: Date, startDay: number = 1): Date => {
    const day = date.getDay();
    const diff = date.getDate() - day + (startDay === 0 ? 0 : (day === 0 ? -6 : 1)); // Adjust for Monday start (1)
    const newDate = new Date(date.setDate(diff));
    newDate.setHours(0, 0, 0, 0);
    return newDate;
};

const formatDate = (date: Date): string => date.toISOString().split('T')[0];
const getDayName = (dayIndex: number): string => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayIndex];


// --- NEW UTILITY: Generates the week ranges array ---
const generateWeekRanges = (sDate: string, weeks: number): WeekRange[] => {
    const ranges: WeekRange[] = [];
    const baseDate = getStartOfWeek(new Date(sDate), 1); // Monday start
    for (let w = 0; w < weeks; w++) {
        const start = new Date(baseDate);
        start.setDate(baseDate.getDate() + (w * 7));
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        ranges.push({
            weekNumber: w + 1,
            start: start,
            end: end,
            label: `Week ${w + 1} (${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`,
        });
    }
    return ranges;
};


// --- Sub-Components ---

const TaskCard: React.FC<{ task: Task, onToggle: (task: Task) => void }> = ({ task, onToggle }) => {
    const { activity, description, time, tag, completed, priority } = task;
    const [isExpanded, setIsExpanded] = useState(false); 
    
    const { badgeColor, textColor } = useMemo(() => {
        const base = getTypeColor(tag);
        const [bg, text, border] = base.split(' ');
        
        return {
            badgeColor: completed ? 'bg-gray-300 text-gray-600' : `${bg} text-white`,
            textColor: completed ? 'text-gray-500 line-through' : 'text-gray-900',
        };
    }, [tag, completed]);

    return (
        <div 
            className={`flex flex-col p-4 mb-3 border-l-4 rounded-lg shadow-sm transition-all duration-200 
                ${completed 
                    ? 'bg-white opacity-70 border-lime-500' 
                    : 'bg-white hover:shadow-lg border-sky-500'
                }
            `}
        >
            <div className="flex items-start">
                <button
                    onClick={() => onToggle(task)}
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mr-3 mt-1 transition-colors duration-200 transform hover:scale-105 ${completed 
                        ? 'bg-lime-500 hover:bg-lime-600' 
                        : 'bg-white border-2 border-gray-300 hover:border-lime-500'
                    }`}
                    aria-label={`Mark task ${completed ? 'incomplete' : 'complete'}`}
                >
                    {completed && (
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                        </svg>
                    )}
                </button>
                <div className="flex-grow">
                    <div className="flex items-center justify-between">
                        <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${badgeColor}`}>{tag}</span>
                        <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-400">P{priority}</span>
                            {/* Toggle Button for Description */}
                            <button 
                                onClick={() => setIsExpanded(!isExpanded)} 
                                className="text-gray-400 hover:text-gray-600 p-1 rounded-full transition duration-150"
                                aria-expanded={isExpanded}
                                aria-controls={`task-detail-${task.id}`}
                            >
                                <svg className={`w-4 h-4 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : 'rotate-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <p className={`text-lg font-medium mt-1 ${textColor}`}>{activity}</p>
                    <p className="text-sm text-gray-500 mt-0.5 flex items-center">
                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        {time}
                    </p>
                </div>
            </div>
            
            {/* Detailed Description Expansion */}
            <div 
                id={`task-detail-${task.id}`}
                className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-96 opacity-100 pt-3' : 'max-h-0 opacity-0'}`}
            >
                <div className="pt-2 mt-2 border-t border-gray-100">
                    <p className="text-xs font-semibold uppercase text-gray-500 mb-1">Details:</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{description}</p>
                </div>
            </div>
        </div>
    );
};

const DailyAccordion: React.FC<{ day: string, date: string, tasks: Task[], onToggle: (task: Task) => void, dailyProgress: number }> = ({ day, date, tasks, onToggle, dailyProgress }) => {
    const [isOpen, setIsOpen] = useState(true);
    
    // Always open for today
    useEffect(() => {
        const today = new Date();
        const todayDate = formatDate(today);
        // Find the task date if it exists, otherwise default to today
        const taskDate = tasks.find(t => t.date === todayDate)?.date || ''; 
        if (todayDate === taskDate) {
            setIsOpen(true);
        }
    }, [tasks]);


    return (
        <div className="bg-white rounded-2xl shadow-xl flex flex-col overflow-hidden">
            <button 
                className="flex items-center justify-between p-5 border-b border-gray-100 focus:outline-none" 
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="text-left">
                    <h3 className="text-xl font-bold text-gray-800">{day}</h3>
                    <p className="text-sm text-gray-500">{date}</p>
                </div>
                <div className="flex items-center">
                    <div className="w-20 mr-4">
                        <div className="h-2 bg-gray-200 rounded-full">
                            <div 
                                className="h-full rounded-full transition-all duration-700 ease-out" 
                                style={{ 
                                    width: `${dailyProgress}%`, 
                                    backgroundColor: dailyProgress === 100 ? '#4ADE80' : '#3B82F6' 
                                }}
                            ></div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{dailyProgress}%</p>
                    </div>
                    <svg className={`w-6 h-6 text-gray-500 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                </div>
            </button>
            <div className={`transition-max-height duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-screen' : 'max-h-0'}`}>
                <div className="p-4 pt-0 space-y-2">
                    {tasks.sort((a, b) => a.time.localeCompare(b.time)).map(task => (
                        <TaskCard key={task.id} task={task} onToggle={onToggle} />
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- Main Template Component ---

interface StrategyTemplateProps {
    startDate: string; // YYYY-MM-DD format
    weeksToShow: number;
    templatePlan: TemplateTask[];
}

const StrategyTemplate: React.FC<StrategyTemplateProps> = ({ 
    startDate, 
    weeksToShow = 5, 
    templatePlan 
}) => {
    // --- State & Initialization ---
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [userId, setUserId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [activeWeek, setActiveWeek] = useState<number>(1);
    const [viewMode, setViewMode] = useState<ViewMode>('WEEK');
    
    const COLLECTION_PATH = 'centenarian-strategy-v2';
    const WEEK_DOCUMENT_ID = `plan-from-${formatDate(new Date(startDate))}-${weeksToShow}-weeks`;

    // --- CRITICAL FIX 1: Define weekRanges using useMemo ---
    const weekRanges = useMemo(() => {
        return generateWeekRanges(startDate, weeksToShow);
    }, [startDate, weeksToShow]);


    // --- 1. FIREBASE INITIALIZATION & AUTH ---
    useEffect(() => {
        try {
            const authInstance = auth; // Use the imported auth instance

            const signIn = async () => {
                try {
                    if (initialAuthToken) {
                        await signInWithCustomToken(authInstance, initialAuthToken);
                    } else {
                        await signInAnonymously(authInstance);
                    }
                } catch (e: any) {
                    console.error("Auth Error:", e);
                    setError("Authentication failed: " + e.message);
                }
            };

            const unsubscribe = onAuthStateChanged(authInstance, (user) => {
                if (user) {
                    setUserId(user.uid);
                } else {
                    signIn();
                }
            });

            return () => unsubscribe();
        } catch (e: any) {
            console.error("Firebase Init Error:", e);
            setError("Failed to initialize Firebase services: " + e.message);
            setLoading(false);
        }
    }, []);

    // --- 2. GENERATE FULL TASK LIST (TEMPLATE EXPANSION) ---
    const generateFullTaskList = (sDate: string, weeks: number, template: TemplateTask[]): Task[] => {
        const tasks: Task[] = [];
        const baseDate = getStartOfWeek(new Date(sDate), 1);

        for (let w = 0; w < weeks; w++) {
            for (const t of template) {
                const dayOffset = t.dayOfWeek - 1;
                
                // Calculate date for the specific day of the week in the current week (w)
                const taskDate = new Date(baseDate);
                taskDate.setDate(baseDate.getDate() + (w * 7) + dayOffset);

                const formattedDate = formatDate(taskDate);
                
                // Use a stable, unique ID for persistence
                const id = `${formattedDate}-${t.time.replace(':', '').replace(' ', '')}-${t.tag}`;

                tasks.push({
                    id,
                    date: formattedDate,
                    time: t.time,
                    activity: t.activity,
                    description: t.description, 
                    tag: t.tag,
                    week: w + 1,
                    priority: t.priority,
                    completed: false,
                });
            }
        }
        return tasks;
    };

    // --- 3. DATA LISTENER (onSnapshot) & INITIALIZATION ---
    useEffect(() => {
        if (db && userId) { // `db` is now imported and always available if firebase.ts is correct
            setLoading(true);
            const docRef = doc(db, `artifacts/${appId}/users/${userId}/${COLLECTION_PATH}`, WEEK_DOCUMENT_ID);
            
            const checkAndInitialize = async () => {
                try {
                    const docSnap = await getDoc(docRef);
                    if (!docSnap.exists()) {
                        console.log("Initializing new multi-week plan.");
                        const initialTasks = generateFullTaskList(startDate, weeksToShow, templatePlan);
                        await setDoc(docRef, { 
                            tasks: initialTasks,
                            createdAt: new Date(),
                            userId: userId,
                            template: WEEKLY_TEMPLATE_PLAN,
                            startDate: startDate,
                            weeksToShow: weeksToShow
                        });
                        setTasks(initialTasks);
                    }
                } catch (e) {
                    console.error("Initialization check failed:", e);
                }
            };
            checkAndInitialize();

            const unsubscribe = onSnapshot(docRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const fetchedTasks = (data.tasks as Task[]) || [];
                    
                    const initialTasks = generateFullTaskList(startDate, weeksToShow, templatePlan);
                    
                    const mergedTasks = initialTasks.map(t => {
                        const savedTask = fetchedTasks.find(ft => ft.id === t.id);
                        // Merge saved completion status back into the latest template
                        return savedTask ? { ...t, completed: savedTask.completed, description: savedTask.description } : t; 
                    });

                    setTasks(mergedTasks);
                    
                    // Auto-set active week to the current week
                    const today = new Date();
                    const currentWeek = weekRanges.find(wr => today >= wr.start && today <= wr.end)?.weekNumber || 1;
                    setActiveWeek(currentWeek);

                } else {
                    console.log("Document does not exist after initialization attempt (waiting for initialization).");
                }
                setLoading(false);
            }, (err: any) => {
                console.error("Firestore Snapshot Error:", err);
                // --- FIX: Enhanced Error Handling for Permissions ---
                if (err.code === 'permission-denied') {
                     setError(`Authentication Error: Missing or insufficient permissions. This usually means the Firebase Security Rules need to allow reads/writes for user ID: ${userId}. (Data is being blocked from loading)`);
                } else {
                     setError("Error loading weekly plan: " + err.message);
                }
                // Do NOT set tasks to empty on permission error, keep the last loaded state/initial template
                setLoading(false);
            });

            return () => unsubscribe();
        }
    }, [userId, startDate, weeksToShow, JSON.stringify(templatePlan), weekRanges]); // Removed `db` from dependencies as it's a stable import


    // --- 4. TASK COMPLETION TOGGLE ---
    const toggleTaskCompletion = async (taskToToggle: Task) => {
        if (!db || !userId) return;

        const newTasks = tasks.map(t =>
            t.id === taskToToggle.id ? { ...t, completed: !t.completed } : t
        );
        setTasks(newTasks);

        try {
            const docRef = doc(db, `artifacts/${appId}/users/${userId}/${COLLECTION_PATH}`, WEEK_DOCUMENT_ID);
            // Only update the minimal necessary data to prevent large payload size
            // Note: Since this document holds all 5 weeks, the entire array must be sent.
            await updateDoc(docRef, {
                tasks: newTasks,
            });
        } catch (e: any) {
            console.error("Error updating task status:", e);
            setError("Failed to save progress: " + e.message);
            // Rollback optimistic update on failure
            setTasks(tasks); 
        }
    };

    // --- 5. CALCULATIONS & FILTERING ---
    
    // Get the array of dates to display based on activeWeek and viewMode
    const getDisplayDates = (activeWeek: number, mode: ViewMode): string[] => {
        const today = new Date();
        const startOfWeek = weekRanges.find(wr => wr.weekNumber === activeWeek)?.start;
        
        if (!startOfWeek) return [];

        let currentDay: Date;
        if (mode === 'WEEK') {
            currentDay = startOfWeek;
        } else {
            // For DAY/THREE_DAY, always start the sequence from today
            currentDay = new Date(today.setHours(0, 0, 0, 0));
        }

        const dates: string[] = [];
        const numDays = mode === 'DAY' ? 1 : mode === 'THREE_DAY' ? 3 : 7;
        
        for (let i = 0; i < numDays; i++) {
            const date = new Date(currentDay);
            // If in WEEK mode, offset from the start of the week. Otherwise, offset from the current day.
            date.setDate(currentDay.getDate() + i);

            // Ensure we don't accidentally pull tasks from another week if in WEEK mode
            if (mode === 'WEEK') {
                const activeWeekEnd = weekRanges.find(wr => wr.weekNumber === activeWeek)?.end.getTime();
                if (activeWeekEnd && date.getTime() > activeWeekEnd) {
                    break;
                }
            }
            dates.push(formatDate(date));
        }
        return dates;
    };

    const datesToDisplay = getDisplayDates(activeWeek, viewMode);

    const filteredTasks = tasks.filter(t => 
        (viewMode === 'WEEK' && t.week === activeWeek) ||
        (viewMode !== 'WEEK' && datesToDisplay.includes(t.date))
    );
    
    // Group by Day for the Active View
    const tasksByDay = useMemo(() => {
        const grouped: { [day: string]: Task[] } = {};
        
        // Use the datesToDisplay to ensure days are ordered correctly
        datesToDisplay.forEach(dateStr => {
            const dateObj = new Date(dateStr);
            const dayName = getDayName(dateObj.getDay());
            
            grouped[dayName] = filteredTasks.filter(t => t.date === dateStr);
        });

        // This clean-up logic should be safe now that datesToDisplay is correctly derived.
        return grouped;
    }, [filteredTasks, datesToDisplay]);

    // Calculate Daily Progress
    const dailyProgress = useMemo(() => {
        const progress: { [day: string]: number } = {};
        Object.entries(tasksByDay).forEach(([day, dailyTasks]) => {
            const total = dailyTasks.length;
            const completed = dailyTasks.filter(t => t.completed).length;
            progress[day] = total > 0 ? Math.round((completed / total) * 100) : 0;
        });
        return progress;
    }, [tasksByDay]);

    // Calculate Tag Progress (based on ALL tasks, not just filtered)
    const tagProgress = useMemo(() => {
        const tagMap: { [tag in TaskTag]: { total: number, completed: number } } = { 
            'FITNESS': { total: 0, completed: 0 }, 
            'CREATIVE': { total: 0, completed: 0 }, 
            'SKILL': { total: 0, completed: 0 }, 
            'OUTREACH': { total: 0, completed: 0 },
            'LIFESTYLE': { total: 0, completed: 0 },
            'MINDSET': { total: 0, completed: 0 },
            'FUEL': { total: 0, completed: 0 },
        };
        tasks.forEach(t => {
            tagMap[t.tag].total += 1;
            if (t.completed) {
                tagMap[t.tag].completed += 1;
            }
        });
        return tagMap;
    }, [tasks]);

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.completed).length;
    const globalProgressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // The order of days to display in the grid
    const dayOrder = datesToDisplay.map(dateStr => getDayName(new Date(dateStr).getDay()));
    const gridColsClass = viewMode === 'WEEK' ? 'xl:grid-cols-7' : viewMode === 'THREE_DAY' ? 'xl:grid-cols-3' : 'xl:grid-cols-1';
    
    if (error) {
        return <div className="p-8 text-center text-red-600 bg-red-100 rounded-lg max-w-4xl mx-auto mt-10 font-mono">{error}</div>;
    }

    const ViewSelector: React.FC = () => (
        <div className="flex space-x-2">
            {(['DAY', 'THREE_DAY', 'WEEK'] as ViewMode[]).map(mode => (
                <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors duration-200 whitespace-nowrap
                        ${viewMode === mode 
                            ? 'bg-fuchsia-500 text-white shadow-md' 
                            : 'bg-gray-100 text-gray-600 hover:bg-fuchsia-100 hover:text-fuchsia-700'
                        }
                    `}
                >
                    {mode.replace('_', ' ')}
                </button>
            ))}
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 font-['Inter'] p-4 sm:p-8">
            <div className="max-w-7xl mx-auto">
                
                {/* Header and Global Progress */}
                <header className="mb-10 text-center">
                    <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight">
                        Centenarian Strategy <span className="text-sky-600">Template</span>
                    </h1>
                    <p className="mt-2 text-xl text-gray-500">
                        **{weeksToShow} Week Strategic Plan** | Starting: {new Date(startDate).toLocaleDateString()}
                    </p>
                    {userId && <p className="mt-1 text-xs text-gray-400">User ID: {userId}</p>}
                </header>

                {/* Overall Progress Infographic */}
                <div className="bg-white p-6 rounded-2xl shadow-xl mb-8 border-t-4 border-lime-600">
                    {/* ... (Progress and Tag Bars unchanged) ... */}
                    <div className="flex flex-col sm:flex-row items-center justify-between">
                        <div className="w-full sm:w-1/3 text-center sm:text-left mb-4 sm:mb-0">
                            <p className="text-xl font-semibold text-gray-700 uppercase tracking-wider">Total Progress ({weeksToShow} Weeks)</p>
                            <h2 className="text-6xl font-extrabold text-gray-900 mt-1">
                                {globalProgressPercentage}%
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">{completedTasks} of {totalTasks} Tasks Complete</p>
                        </div>
                        <div className="w-full sm:w-2/3 space-y-3">
                            {/* Global Progress Bar */}
                            <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-lime-500 transition-all duration-700 ease-out" 
                                    style={{ width: `${globalProgressPercentage}%` }}
                                ></div>
                            </div>
                            {/* Tag Progress Bars */}
                            {(Object.keys(tagProgress) as TaskTag[]).filter(tag => tagProgress[tag].total > 0).map(tag => {
                                const tagData = tagProgress[tag];
                                const percentage = tagData.total > 0 ? Math.round((tagData.completed / tagData.total) * 100) : 0;
                                const baseColor = getTypeColor(tag).split(' ')[0]; // Extract base color class

                                return (
                                    <div key={tag} className="flex items-center text-sm">
                                        <span className={`w-20 text-xs font-semibold uppercase tracking-wide mr-2 ${getTypeColor(tag).split(' ').filter(c => c.startsWith('text-')).join(' ')}`}>{tag}:</span>
                                        <div className="flex-grow h-2 bg-gray-200 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-500 ease-out ${baseColor}`} 
                                                style={{ width: `${percentage}%` }}
                                            ></div>
                                        </div>
                                        <span className="w-10 text-right text-gray-600 font-medium text-xs">{percentage}%</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
                
                {/* Navigation and View Selectors */}
                <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 mb-8">
                    {/* Week Tabs Navigation */}
                    <div className="flex space-x-2 p-2 bg-white rounded-xl shadow-inner overflow-x-auto">
                        {weekRanges.map(range => (
                            <button
                                key={range.weekNumber}
                                onClick={() => { setActiveWeek(range.weekNumber); setViewMode('WEEK'); }} // Reset to WEEK view when changing weeks
                                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors duration-200 whitespace-nowrap
                                    ${activeWeek === range.weekNumber 
                                        ? 'bg-sky-500 text-white shadow-md' 
                                        : 'bg-gray-100 text-gray-600 hover:bg-sky-100 hover:text-sky-700'
                                    }
                                `}
                            >
                                {range.label}
                            </button>
                        ))}
                    </div>
                    {/* NEW: Day/3-Day/Week Selector */}
                    <ViewSelector />
                </div>

                {/* Daily Task Breakdown */}
                {loading && (
                    <div className="text-center py-20">
                        <svg className="animate-spin h-8 w-8 text-lime-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="text-gray-500 mt-3">Loading multi-week strategy...</p>
                    </div>
                )}
                
                {!loading && (
                    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ${gridColsClass} gap-6`}>
                        {datesToDisplay.map(dateStr => {
                            const dateObj = new Date(dateStr);
                            const day = getDayName(dateObj.getDay());
                            const tasksForDay = tasksByDay[day] || [];
                            
                            // If in WEEK mode, skip days with no tasks. In DAY/THREE_DAY, show it for context.
                            if (viewMode === 'WEEK' && tasksForDay.length === 0) return null;

                            return (
                                <DailyAccordion 
                                    key={dateStr} // Use date string as key for unique identity across weeks/views
                                    day={day}
                                    date={dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    tasks={tasksForDay} 
                                    onToggle={toggleTaskCompletion}
                                    dailyProgress={dailyProgress[day] || 0}
                                />
                            );
                        })}
                    </div>
                )}
            </div>
            
            {/* Footer Note */}
            <footer className="mt-12 text-center text-sm text-gray-500 border-t pt-6 max-w-7xl mx-auto">
                <p>Strategy powered by Google Firestore persistence layer. Plan based on {weeksToShow} weeks of the Centenarian Template.</p>
                <p>Current Active Week: {activeWeek}. Current View: {viewMode}.</p>
            </footer>
        </div>
    );
};

// --- Parent Component for Initializing the Template ---
const App: React.FC = () => {
    // You can change the starting date and number of weeks here:
    // This will generate a full 5-week plan starting from the specified Monday.
    const START_DATE = '2025-10-06'; // Monday, October 6th, 2025
    const WEEKS_TO_SHOW = 5;

    return (
        <StrategyTemplate 
            startDate={START_DATE} 
            weeksToShow={WEEKS_TO_SHOW} 
            templatePlan={WEEKLY_TEMPLATE_PLAN}
        />
    );
};

export default App;
