import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    signInAnonymously, 
    signInWithCustomToken, 
    onAuthStateChanged 
} from 'firebase/auth';
import { 
    getFirestore, 
    doc, 
    setDoc, 
    updateDoc, 
    onSnapshot, 
    query, 
    where,
    collection,
    getDoc,
    setLogLevel
} from 'firebase/firestore';

// --- GLOBAL VARIABLES (Provided by the execution environment) ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-centenarian-app';

// The weekly plan data based on the plan.md file
const initialWeeklyTasks = [
    // Monday
    { id: 'mon-am', day: 'Monday', time: '05:50 AM', activity: 'Morning Fitness: Strength Wk 1 (Push-ups, TRX Row, Plank)', type: 'FITNESS', completed: false },
    { id: 'mon-pm', day: 'Monday', time: '04:00 PM', activity: 'Creative Focus: Record Corvid Podcast (1-2 episodes)', type: 'CREATIVE', completed: false },
    { id: 'mon-out', day: 'Monday', time: '07:00 AM', activity: 'Tactical Outreach: Send 3-4 teacher emails for Corvid K-5 activities.', type: 'OUTREACH', completed: false },

    // Tuesday
    { id: 'tue-am', day: 'Tuesday', time: '05:50 AM', activity: 'Creative Focus: Record Fitness Metrics Class (Module 1)', type: 'CREATIVE', completed: false },
    { id: 'tue-pm', day: 'Tuesday', time: '04:00 PM', activity: 'Evening Skill & Recovery (Front Lever Progression)', type: 'SKILL', completed: false },
    { id: 'tue-out', day: 'Tuesday', time: '07:00 AM', activity: 'Tactical Outreach: Send 3-4 teacher emails for Corvid K-5 activities.', type: 'OUTREACH', completed: false },

    // Wednesday
    { id: 'wed-am', day: 'Wednesday', time: '05:50 AM', activity: 'Morning Fitness: Strength Wk 1 (Pike Push-ups, TRX Bicep Curl, Russian Twist)', type: 'FITNESS', completed: false },
    { id: 'wed-pm', day: 'Wednesday', time: '04:00 PM', activity: 'Creative Focus: Record Corvid Podcast (Secondary session/editing)', type: 'CREATIVE', completed: false },
    { id: 'wed-out', day: 'Wednesday', time: '07:00 AM', activity: 'Tactical Outreach: Follow up on initial emails/Confirm receipt.', type: 'OUTREACH', completed: false },

    // Thursday
    { id: 'thu-am', day: 'Thursday', time: '05:50 AM', activity: 'Creative Focus: Edit/Prep Metrics Class (Review recording, Finalize sound/cards)', type: 'CREATIVE', completed: false },
    { id: 'thu-pm', day: 'Thursday', time: '04:00 PM', activity: 'Evening Skill & Recovery (Shoulder Health: Kettlebell Armbar & Light Overhead Press)', type: 'SKILL', completed: false },
    { id: 'thu-out', day: 'Thursday', time: '07:00 AM', activity: 'Tactical Outreach: Send final batch of K-5 outreach emails.', type: 'OUTREACH', completed: false },

    // Friday
    { id: 'fri-am', day: 'Friday', time: '05:50 AM', activity: 'Morning Fitness: Strength Wk 1 (TRX Chest Press, TRX Inverted Row, Hollow Body Hold)', type: 'FITNESS', completed: false },
    { id: 'fri-pm', day: 'Friday', time: '04:00 PM', activity: 'Strategic Review & Upload (Final review and upload of all content)', type: 'CREATIVE', completed: false },
    { id: 'fri-out', day: 'Friday', time: '07:00 AM', activity: 'Tactical Outreach: Log all teacher contacts/responses.', type: 'OUTREACH', completed: false },
];

// Helper function to get color based on task type
const getTypeColor = (type) => {
    switch (type) {
        case 'FITNESS': return 'bg-lime-500 text-lime-900 border-lime-300';
        case 'CREATIVE': return 'bg-sky-500 text-sky-900 border-sky-300';
        case 'SKILL': return 'bg-fuchsia-500 text-fuchsia-900 border-fuchsia-300';
        case 'OUTREACH': return 'bg-amber-500 text-amber-900 border-amber-300';
        default: return 'bg-gray-400 text-gray-800 border-gray-300';
    }
};

const TaskCard = ({ task, onToggle }) => {
    const { activity, time, type, completed } = task;
    const colorClasses = getTypeColor(type);

    return (
        <div 
            className={`flex items-start p-4 mb-3 border-l-4 rounded-md shadow-lg transition-all duration-300 ${completed 
                ? 'bg-white opacity-60 border-lime-500' 
                : `${colorClasses.split(' ').filter(c => c.startsWith('bg-')).join(' ')}/10 border-lime-500 border-opacity-70 backdrop-blur-sm`
            }`}
        >
            <button
                onClick={() => onToggle(task)}
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mr-3 transition-all duration-300 transform hover:scale-105 ${completed 
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
                <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${colorClasses}`}>{type}</span>
                <p className={`text-lg font-medium mt-1 ${completed ? 'line-through text-gray-500' : 'text-gray-800'}`}>{activity}</p>
                <p className="text-sm text-gray-500 mt-0.5 flex items-center">
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    {time}
                </p>
            </div>
        </div>
    );
};

const App = () => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [error, setError] = useState(null);

    const WEEK_DOCUMENT_ID = 'week-1-infographic-plan';
    const COLLECTION_PATH = 'centenarian-dashboard';

    // --- FIREBASE INITIALIZATION AND AUTHENTICATION ---
    useEffect(() => {
        setLogLevel('debug'); // Enable Firestore logging

        if (Object.keys(firebaseConfig).length === 0) {
            setError("Firebase configuration is missing. Cannot save progress.");
            setLoading(false);
            return;
        }

        try {
            const app = initializeApp(firebaseConfig);
            const firestore = getFirestore(app);
            const authInstance = getAuth(app);
            
            setDb(firestore);
            setAuth(authInstance);

            // 1. Handle Authentication
            const signIn = async () => {
                try {
                    if (initialAuthToken) {
                        await signInWithCustomToken(authInstance, initialAuthToken);
                    } else {
                        await signInAnonymously(authInstance);
                    }
                } catch (e) {
                    console.error("Auth Error:", e);
                    setError("Authentication failed. Check Firebase config/token.");
                }
            };

            // 2. Auth State Listener
            const unsubscribe = onAuthStateChanged(authInstance, (user) => {
                if (user) {
                    setUserId(user.uid);
                    console.log("User signed in with ID:", user.uid);
                } else {
                    signIn(); // Attempt sign-in if not signed in
                }
            });

            return () => unsubscribe();
        } catch (e) {
            console.error("Firebase Initialization Error:", e);
            setError("Failed to initialize Firebase services.");
            setLoading(false);
        }
    }, []);

    // --- DATA LISTENER (onSnapshot) ---
    useEffect(() => {
        if (db && userId) {
            setLoading(true);
            const docRef = doc(db, `artifacts/${appId}/users/${userId}/${COLLECTION_PATH}`, WEEK_DOCUMENT_ID);

            // Check if document exists and initialize if not
            const checkAndInitialize = async () => {
                try {
                    const docSnap = await getDoc(docRef);
                    if (!docSnap.exists()) {
                        console.log("No existing plan found. Initializing new plan.");
                        await setDoc(docRef, { 
                            tasks: initialWeeklyTasks,
                            createdAt: new Date(),
                            userId: userId
                        });
                    }
                } catch (e) {
                    console.error("Initialization check failed:", e);
                }
            };
            checkAndInitialize();


            // Set up real-time listener
            const unsubscribe = onSnapshot(docRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setTasks(data.tasks || []);
                    console.log("Plan data received from Firestore.");
                } else {
                    // This case is handled by checkAndInitialize
                    console.log("Document does not exist after initialization attempt.");
                }
                setLoading(false);
            }, (err) => {
                console.error("Firestore Snapshot Error:", err);
                setError("Error loading weekly plan: " + err.message);
                setLoading(false);
            });

            return () => unsubscribe();
        }
    }, [db, userId]);

    // --- TASK COMPLETION TOGGLE ---
    const toggleTaskCompletion = async (taskToToggle) => {
        if (!db || !userId) {
            console.warn("Database or User ID not ready.");
            return;
        }

        const newTasks = tasks.map(t =>
            t.id === taskToToggle.id ? { ...t, completed: !t.completed } : t
        );
        
        // Optimistically update UI
        setTasks(newTasks);

        try {
            const docRef = doc(db, `artifacts/${appId}/users/${userId}/${COLLECTION_PATH}`, WEEK_DOCUMENT_ID);
            await updateDoc(docRef, {
                tasks: newTasks,
            });
            console.log(`Task ${taskToToggle.id} toggled successfully.`);
        } catch (e) {
            console.error("Error updating task status:", e);
            setError("Failed to save progress. Please check connection.");
            // Revert UI if save fails
            setTasks(tasks);
        }
    };

    // --- CALCULATIONS FOR INFOGRAPHIC ---
    const totalTasks = initialWeeklyTasks.length;
    const completedTasks = tasks.filter(t => t.completed).length;
    const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    const tasksByDay = useMemo(() => {
        const grouped = {};
        tasks.forEach(task => {
            if (!grouped[task.day]) {
                grouped[task.day] = [];
            }
            grouped[task.day].push(task);
        });
        return grouped;
    }, [tasks]);

    const dailyProgress = useMemo(() => {
        const progress = {};
        Object.entries(tasksByDay).forEach(([day, dailyTasks]) => {
            const total = dailyTasks.length;
            const completed = dailyTasks.filter(t => t.completed).length;
            progress[day] = total > 0 ? Math.round((completed / total) * 100) : 0;
        });
        return progress;
    }, [tasksByDay]);

    if (error) {
        return <div className="p-8 text-center text-red-600 bg-red-100 rounded-lg max-w-4xl mx-auto mt-10 font-mono">{error}</div>;
    }

    // --- RENDER COMPONENT ---
    return (
        <div className="min-h-screen bg-gray-50 font-['Inter'] p-4 sm:p-8">
            <script src="https://cdn.tailwindcss.com"></script>
            <div className="max-w-7xl mx-auto">
                
                {/* Header and Global Progress */}
                <header className="mb-10 text-center">
                    <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight">
                        Centenarian Weekly Strategy <span className="text-lime-600">Dashboard</span>
                    </h1>
                    <p className="mt-2 text-xl text-gray-500">
                        **Week 1:** Upper Body & Core Endurance Cycle
                    </p>
                    {userId && <p className="mt-1 text-xs text-gray-400">User ID: {userId}</p>}
                </header>

                {/* Overall Progress Infographic */}
                <div className="bg-white p-6 rounded-2xl shadow-xl mb-12 border-t-4 border-sky-600">
                    <div className="flex flex-col sm:flex-row items-center justify-between">
                        <div className="w-full sm:w-1/3 text-center sm:text-left mb-4 sm:mb-0">
                            <p className="text-xl font-semibold text-gray-700 uppercase tracking-wider">Overall Progress</p>
                            <h2 className="text-6xl font-extrabold text-gray-900 mt-1">
                                {progressPercentage}%
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">{completedTasks} of {totalTasks} Tasks Complete</p>
                        </div>
                        <div className="w-full sm:w-2/3">
                            <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-lime-500 transition-all duration-700 ease-out" 
                                    style={{ width: `${progressPercentage}%` }}
                                ></div>
                            </div>
                            <div className="flex justify-around mt-4">
                                {['FITNESS', 'CREATIVE', 'SKILL', 'OUTREACH'].map(type => (
                                    <div key={type} className="text-center">
                                        <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${getTypeColor(type)}`}>
                                            {type}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Daily Task Breakdown */}
                {loading && (
                    <div className="text-center py-20">
                        <svg className="animate-spin h-8 w-8 text-lime-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="text-gray-500 mt-3">Loading weekly plan...</p>
                    </div>
                )}
                
                {!loading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => (
                            <div key={day} className="bg-white p-5 rounded-2xl shadow-md flex flex-col h-full">
                                <div className="pb-3 border-b border-gray-200">
                                    <h3 className="text-2xl font-bold text-gray-800">{day}</h3>
                                    <div className="mt-2 h-2 bg-gray-200 rounded-full">
                                        <div 
                                            className="h-full rounded-full transition-all duration-700 ease-out" 
                                            style={{ 
                                                width: `${dailyProgress[day] || 0}%`, 
                                                backgroundColor: dailyProgress[day] === 100 ? '#4ADE80' : '#3B82F6' 
                                            }}
                                        ></div>
                                    </div>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {dailyProgress[day] || 0}% Complete
                                    </p>
                                </div>
                                <div className="mt-4 flex-grow space-y-4">
                                    {(tasksByDay[day] || []).map(task => (
                                        <TaskCard key={task.id} task={task} onToggle={toggleTaskCompletion} />
                                    ))}
                                    {(tasksByDay[day] || []).length === 0 && (
                                        <p className="text-gray-400 italic">No tasks planned.</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            {/* Footer Note */}
            <footer className="mt-12 text-center text-sm text-gray-500 border-t pt-6 max-w-7xl mx-auto">
                <p>This dashboard is persistent using Google Firestore, allowing you to track progress across sessions.</p>
                <p>Priorities for the week: Recording Corvid Podcast, sharing K-5 activities, and recording the Fitness Metrics Class.</p>
            </footer>
        </div>
    );
};

export default App;
