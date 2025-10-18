// File: app/dashboard/engine/page.tsx
// Focus tracking and debrief module - Coming in Phase 2

export default function EnginePage() {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">The Engine</h1>
        <p className="text-gray-600">Focus tracking and daily debriefs</p>
      </header>

      <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
        <div className="text-6xl mb-4">⚙️</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Coming Soon</h2>
        <p className="text-gray-600 mb-6">
          The Engine module connects Work and Fuel to generate the Story through 
          focus tracking and daily debriefs.
        </p>
        <div className="text-left max-w-md mx-auto">
          <h3 className="font-semibold text-gray-900 mb-2">Planned Features:</h3>
          <ul className="space-y-2 text-gray-600">
            <li>• Focus timer linked to tasks</li>
            <li>• Daily energy ratings (1-5)</li>
            <li>• Daily win/challenge logging</li>
            <li>• Pain tracking (body check)</li>
            <li>• Weekly AI-assisted review</li>
          </ul>
        </div>
      </div>
    </div>
  );
}