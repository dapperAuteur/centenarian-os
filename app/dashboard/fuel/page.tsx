// File: app/dashboard/fuel/page.tsx
// Nutrition module - Coming in Phase 2

export default function FuelPage() {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">The Fuel</h1>
        <p className="text-gray-600">Track nutrition with the NCV framework</p>
      </header>

      <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
        <div className="text-6xl mb-4">🍽️</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Coming Soon</h2>
        <p className="text-gray-600 mb-6">
          The Nutrition OS module will include ingredient tracking, protocols (recipes), 
          and NCV scoring.
        </p>
        <div className="text-left max-w-md mx-auto">
          <h3 className="font-semibold text-gray-900 mb-2">Planned Features:</h3>
          <ul className="space-y-2 text-gray-600">
            <li>• Ingredient library with NCV data</li>
            <li>• Protocol builder (custom recipes)</li>
            <li>• Meal logging</li>
            <li>• Cost tracking per meal</li>
            <li>• Low stock alerts</li>
          </ul>
        </div>
      </div>
    </div>
  );
}