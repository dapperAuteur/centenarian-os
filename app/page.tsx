// File: app/page.tsx
// Landing page

import Link, { LinkProps } from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center p-4">
      <div className="max-w-4xl text-center text-white">
        <h1 className="text-6xl font-bold mb-6">CentenarianOS</h1>
        <p className="text-2xl mb-4">The Multi-Decade Personal Operating System</p>
        <p className="text-xl mb-12 opacity-90">
          Transform audacious long-term goals into daily, data-driven execution
        </p>
        
        <div className="flex gap-4 justify-center">
          <Link 
            href="/login"
            className="px-8 py-4 bg-white text-sky-600 rounded-xl font-bold text-lg hover:bg-gray-100 transition shadow-lg"
          >
            Login
          </Link>
          <Link 
            href="/signup"
            className="px-8 py-4 bg-sky-700 text-white rounded-xl font-bold text-lg hover:bg-sky-800 transition shadow-lg"
          >
            Get Started
          </Link>
        </div>

        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white/10 backdrop-blur-sm p-6 rounded-xl">
            <h3 className="text-xl font-bold mb-2">The Planner</h3>
            <p className="opacity-90">Connect daily tasks to multi-year goals</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-6 rounded-xl">
            <h3 className="text-xl font-bold mb-2">The Fuel</h3>
            <p className="opacity-90">Track nutrition with the NCV framework</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-6 rounded-xl">
            <h3 className="text-xl font-bold mb-2">The Engine</h3>
            <p className="opacity-90">Focus tracking and daily debriefs</p>
          </div>
        </div>
      </div>
    </div>
  );
}