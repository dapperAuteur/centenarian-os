'use client';

// app/dashboard/data/import/[module]/page.tsx
// Dynamic import page — renders GenericImportPage for any module slug.

import { useParams, redirect } from 'next/navigation';
import GenericImportPage from '@/components/data/GenericImportPage';

interface ModuleConfig {
  moduleName: string;
  apiEndpoint: string;
  templateUrl: string;
  instructions: string;
  columns: { key: string; label: string; required?: boolean }[];
  previewColumns: string[];
  maxRows?: number;
}

const MODULE_CONFIGS: Record<string, ModuleConfig> = {
  'health-metrics': {
    moduleName: 'Health Metrics',
    apiEndpoint: '/api/health-metrics/import',
    templateUrl: '/templates/health-metrics-import-template.csv',
    instructions:
      'Upload your daily health metrics. Required: logged_date. All other fields are optional — include only the metrics you track.',
    columns: [
      { key: 'logged_date', label: 'Date (YYYY-MM-DD)', required: true },
      { key: 'resting_hr', label: 'Resting HR (bpm)' },
      { key: 'steps', label: 'Steps' },
      { key: 'sleep_hours', label: 'Sleep (hours)' },
      { key: 'activity_min', label: 'Activity (min)' },
      { key: 'sleep_score', label: 'Sleep Score' },
      { key: 'hrv_ms', label: 'HRV (ms)' },
      { key: 'spo2_pct', label: 'SpO2 (%)' },
      { key: 'active_calories', label: 'Active Calories' },
      { key: 'stress_score', label: 'Stress Score' },
      { key: 'recovery_score', label: 'Recovery Score' },
      { key: 'weight_lbs', label: 'Weight (lbs)' },
      { key: 'notes', label: 'Notes' },
    ],
    previewColumns: ['logged_date', 'resting_hr', 'steps', 'sleep_hours', 'activity_min', 'notes'],
  },
  trips: {
    moduleName: 'Trips',
    apiEndpoint: '/api/travel/trips/import',
    templateUrl: '/templates/trips-import-template.csv',
    instructions:
      'Upload trip logs. Required: date, mode (car/bike/walk/transit/flight/boat). Optional: origin, destination, distance, cost, and more. Vehicle nicknames will be matched to your existing vehicles.',
    columns: [
      { key: 'date', label: 'Date (YYYY-MM-DD)', required: true },
      { key: 'mode', label: 'Mode', required: true },
      { key: 'origin', label: 'Origin' },
      { key: 'destination', label: 'Destination' },
      { key: 'distance_miles', label: 'Distance (mi)' },
      { key: 'duration_min', label: 'Duration (min)' },
      { key: 'purpose', label: 'Purpose' },
      { key: 'cost', label: 'Cost ($)' },
      { key: 'trip_category', label: 'Category' },
      { key: 'tax_category', label: 'Tax Category' },
      { key: 'is_round_trip', label: 'Round Trip' },
      { key: 'vehicle_nickname', label: 'Vehicle Nickname' },
      { key: 'notes', label: 'Notes' },
    ],
    previewColumns: ['date', 'mode', 'origin', 'destination', 'distance_miles', 'cost'],
  },
  fuel: {
    moduleName: 'Fuel Logs',
    apiEndpoint: '/api/travel/fuel/import',
    templateUrl: '/templates/fuel-import-template.csv',
    instructions:
      'Upload fuel fill-up records. Required: date. If you provide total_cost and gallons, cost_per_gallon is auto-calculated. Vehicle nicknames must match existing vehicles.',
    columns: [
      { key: 'date', label: 'Date (YYYY-MM-DD)', required: true },
      { key: 'vehicle_nickname', label: 'Vehicle Nickname' },
      { key: 'odometer_miles', label: 'Odometer (mi)' },
      { key: 'gallons', label: 'Gallons' },
      { key: 'total_cost', label: 'Total Cost ($)' },
      { key: 'cost_per_gallon', label: 'Cost/Gallon ($)' },
      { key: 'fuel_grade', label: 'Grade' },
      { key: 'station', label: 'Station' },
      { key: 'notes', label: 'Notes' },
    ],
    previewColumns: ['date', 'vehicle_nickname', 'gallons', 'total_cost', 'station'],
  },
  maintenance: {
    moduleName: 'Maintenance Records',
    apiEndpoint: '/api/travel/maintenance/import',
    templateUrl: '/templates/maintenance-import-template.csv',
    instructions:
      'Upload vehicle service records. Required: date, service_type (oil_change, tire_rotation, brake_service, etc.). Vehicle nicknames must match existing vehicles.',
    columns: [
      { key: 'date', label: 'Date (YYYY-MM-DD)', required: true },
      { key: 'vehicle_nickname', label: 'Vehicle Nickname' },
      { key: 'service_type', label: 'Service Type', required: true },
      { key: 'odometer_at_service', label: 'Odometer (mi)' },
      { key: 'cost', label: 'Cost ($)' },
      { key: 'vendor', label: 'Vendor' },
      { key: 'next_service_date', label: 'Next Service Date' },
      { key: 'next_service_miles', label: 'Next Service Miles' },
      { key: 'notes', label: 'Notes' },
    ],
    previewColumns: ['date', 'vehicle_nickname', 'service_type', 'cost', 'vendor'],
  },
  vehicles: {
    moduleName: 'Vehicles',
    apiEndpoint: '/api/travel/vehicles/import',
    templateUrl: '/templates/vehicles-import-template.csv',
    instructions:
      'Upload your vehicle fleet. Required: type (car/truck/suv/motorcycle/bicycle/etc.), nickname. Existing vehicles with the same nickname are skipped. Max 200 vehicles.',
    columns: [
      { key: 'type', label: 'Type', required: true },
      { key: 'nickname', label: 'Nickname', required: true },
      { key: 'make', label: 'Make' },
      { key: 'model', label: 'Model' },
      { key: 'year', label: 'Year' },
      { key: 'color', label: 'Color' },
      { key: 'ownership_type', label: 'Ownership' },
      { key: 'trip_mode', label: 'Trip Mode' },
    ],
    previewColumns: ['type', 'nickname', 'make', 'model', 'year'],
    maxRows: 200,
  },
  equipment: {
    moduleName: 'Equipment',
    apiEndpoint: '/api/equipment/import',
    templateUrl: '/templates/equipment-import-template.csv',
    instructions:
      'Upload equipment and gear. Required: name. Categories are auto-created if they don\'t exist. If current_value is empty, it defaults to purchase_price. ownership_type: \'own\' (default) or \'access\'.',
    columns: [
      { key: 'name', label: 'Name', required: true },
      { key: 'category_name', label: 'Category' },
      { key: 'brand', label: 'Brand' },
      { key: 'model', label: 'Model' },
      { key: 'serial_number', label: 'Serial Number' },
      { key: 'purchase_date', label: 'Purchase Date' },
      { key: 'purchase_price', label: 'Purchase Price ($)' },
      { key: 'current_value', label: 'Current Value ($)' },
      { key: 'warranty_expires', label: 'Warranty Expires' },
      { key: 'condition', label: 'Condition' },
      { key: 'notes', label: 'Notes' },
      { key: 'ownership_type', label: 'Ownership Type' },
    ],
    previewColumns: ['name', 'category_name', 'brand', 'purchase_price', 'condition', 'ownership_type'],
  },
  contacts: {
    moduleName: 'Contacts',
    apiEndpoint: '/api/contacts/import',
    templateUrl: '/templates/contacts-import-template.csv',
    instructions:
      'Upload contacts. Required: name, contact_type (vendor/customer/location). Duplicates by name+type are updated, not created twice. Include location fields to add saved locations. Max 500.',
    columns: [
      { key: 'name', label: 'Name', required: true },
      { key: 'contact_type', label: 'Type', required: true },
      { key: 'notes', label: 'Notes' },
      { key: 'location_label', label: 'Location Label' },
      { key: 'address', label: 'Address' },
      { key: 'lat', label: 'Latitude' },
      { key: 'lng', label: 'Longitude' },
    ],
    previewColumns: ['name', 'contact_type', 'notes', 'location_label', 'address'],
    maxRows: 500,
  },
  tasks: {
    moduleName: 'Tasks',
    apiEndpoint: '/api/planner/import',
    templateUrl: '/templates/tasks-import-template.csv',
    instructions:
      'Upload planner tasks. Required: date (due date), activity (task title). Tasks are placed under an "Imported Tasks" milestone (auto-created if needed). Default tag: personal, priority: 2.',
    columns: [
      { key: 'date', label: 'Date (YYYY-MM-DD)', required: true },
      { key: 'activity', label: 'Activity / Title', required: true },
      { key: 'time', label: 'Time (HH:MM)' },
      { key: 'description', label: 'Description' },
      { key: 'tag', label: 'Tag' },
      { key: 'priority', label: 'Priority (1-3)' },
      { key: 'estimated_cost', label: 'Estimated Cost ($)' },
    ],
    previewColumns: ['date', 'activity', 'tag', 'priority', 'estimated_cost'],
  },
  workouts: {
    moduleName: 'Workouts',
    apiEndpoint: '/api/workouts/logs/import',
    templateUrl: '/templates/workouts-import-template.csv',
    instructions:
      'Upload workout logs. Required: name (workout name), date. Rows with the same name + date are grouped into one workout with multiple exercises. Each row becomes one exercise. Optional columns: purpose (semicolon-separated), overall_feeling (1-5), RPE (1-10), tempo (e.g. 3-1-2-0), boolean flags (true/false).',
    columns: [
      { key: 'date', label: 'Date (YYYY-MM-DD)', required: true },
      { key: 'name', label: 'Workout Name', required: true },
      { key: 'duration_min', label: 'Duration (min)' },
      { key: 'purpose', label: 'Purpose (;-separated)' },
      { key: 'overall_feeling', label: 'Overall Feeling (1-5)' },
      { key: 'exercise_name', label: 'Exercise Name' },
      { key: 'sets_completed', label: 'Sets' },
      { key: 'reps_completed', label: 'Reps' },
      { key: 'weight_lbs', label: 'Weight (lbs)' },
      { key: 'duration_sec', label: 'Exercise Duration (sec)' },
      { key: 'rest_sec', label: 'Rest (sec)' },
      { key: 'rpe', label: 'RPE (1-10)' },
      { key: 'tempo', label: 'Tempo' },
      { key: 'notes', label: 'Notes' },
    ],
    previewColumns: ['date', 'name', 'exercise_name', 'sets_completed', 'reps_completed', 'weight_lbs'],
  },
  exercises: {
    moduleName: 'Exercises',
    apiEndpoint: '/api/exercises/import',
    templateUrl: '/templates/exercises-import-template.csv',
    instructions:
      'Upload your exercise library. Required: name. Categories are auto-created if they don\'t exist. Primary muscles are semicolon-separated (e.g. chest;triceps). Existing exercises with the same name are updated.',
    columns: [
      { key: 'name', label: 'Name', required: true },
      { key: 'category', label: 'Category' },
      { key: 'instructions', label: 'Instructions' },
      { key: 'form_cues', label: 'Form Cues' },
      { key: 'video_url', label: 'Video URL' },
      { key: 'primary_muscles', label: 'Primary Muscles (;-separated)' },
      { key: 'default_sets', label: 'Default Sets' },
      { key: 'default_reps', label: 'Default Reps' },
      { key: 'default_weight_lbs', label: 'Default Weight (lbs)' },
      { key: 'default_duration_sec', label: 'Default Duration (sec)' },
      { key: 'default_rest_sec', label: 'Default Rest (sec)' },
      { key: 'notes', label: 'Notes' },
    ],
    previewColumns: ['name', 'category', 'primary_muscles', 'default_sets', 'default_reps'],
  },
  media: {
    moduleName: 'Media',
    apiEndpoint: '/api/media/import',
    templateUrl: '/templates/media-import-template.csv',
    instructions:
      'Upload media items. Required: title, media_type (book/tv_show/movie/video/song/album/podcast/art/article/other). Genre and tags are semicolon-separated. Status defaults to want_to_consume.',
    columns: [
      { key: 'title', label: 'Title', required: true },
      { key: 'creator', label: 'Creator / Author' },
      { key: 'media_type', label: 'Media Type', required: true },
      { key: 'status', label: 'Status' },
      { key: 'rating', label: 'Rating (1-5)' },
      { key: 'start_date', label: 'Start Date' },
      { key: 'end_date', label: 'End Date' },
      { key: 'genre', label: 'Genre (;-separated)' },
      { key: 'tags', label: 'Tags (;-separated)' },
      { key: 'year_released', label: 'Year Released' },
      { key: 'source_platform', label: 'Platform' },
      { key: 'notes', label: 'Notes' },
      { key: 'favorite', label: 'Favorite (true/false)' },
    ],
    previewColumns: ['title', 'creator', 'media_type', 'status', 'rating'],
  },
  blog: {
    moduleName: 'Blog Posts',
    apiEndpoint: '/api/blog/import',
    templateUrl: '/templates/blog-import-template.csv',
    instructions:
      'Upload blog posts. Required: title. Content is markdown (converted to rich text automatically). Tags are pipe-separated (e.g. tag1|tag2). Video URL is optional — placed at the top of the post.',
    columns: [
      { key: 'title', label: 'Title', required: true },
      { key: 'slug', label: 'Slug' },
      { key: 'excerpt', label: 'Excerpt' },
      { key: 'visibility', label: 'Visibility (draft/private/public)' },
      { key: 'tags', label: 'Tags (pipe-separated)' },
      { key: 'video_url', label: 'Video URL' },
      { key: 'content', label: 'Content (markdown)' },
    ],
    previewColumns: ['title', 'slug', 'visibility', 'tags'],
  },
};

export default function DynamicImportPage() {
  const params = useParams();
  const slug = params.module as string;

  // Finance and existing health-metrics import pages already exist
  if (slug === 'finance') {
    redirect('/dashboard/finance/import');
  }

  const config = MODULE_CONFIGS[slug];
  if (!config) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Module Not Found</h1>
        <p className="text-gray-500">
          The import module &quot;{slug}&quot; does not exist. Go back to the{' '}
          <a href="/dashboard/data" className="text-fuchsia-600 underline">Data Hub</a>.
        </p>
      </div>
    );
  }

  return (
    <GenericImportPage
      moduleName={config.moduleName}
      backHref="/dashboard/data"
      apiEndpoint={config.apiEndpoint}
      templateUrl={config.templateUrl}
      columns={config.columns}
      instructions={config.instructions}
      previewColumns={config.previewColumns}
      maxRows={config.maxRows}
    />
  );
}
