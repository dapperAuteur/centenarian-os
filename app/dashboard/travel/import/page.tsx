'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, Upload, Camera, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface GarminResult {
  inserted: number;
  skipped: number;
  unsupported: number;
  errors?: string[];
}

export default function TravelImportPage() {
  // Garmin CSV import
  const [garminFile, setGarminFile] = useState<File | null>(null);
  const [garminLoading, setGarminLoading] = useState(false);
  const [garminResult, setGarminResult] = useState<GarminResult | null>(null);
  const [garminError, setGarminError] = useState('');
  const garminRef = useRef<HTMLInputElement>(null);

  // Fuel OCR batch
  const [fuelFiles, setFuelFiles] = useState<File[]>([]);
  const [fuelLoading, setFuelLoading] = useState(false);
  const [fuelOcrResults, setFuelOcrResults] = useState<object[]>([]);
  const [fuelError, setFuelError] = useState('');
  const fuelRef = useRef<HTMLInputElement>(null);

  const handleGarminImport = async () => {
    if (!garminFile) return;
    setGarminLoading(true);
    setGarminResult(null);
    setGarminError('');
    try {
      const fd = new FormData();
      fd.append('file', garminFile);
      const res = await fetch('/api/travel/import/garmin', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setGarminError(data.error ?? 'Import failed'); return; }
      setGarminResult(data);
    } catch {
      setGarminError('Network error');
    } finally {
      setGarminLoading(false);
    }
  };

  const handleFuelOcr = async () => {
    if (!fuelFiles.length) return;
    setFuelLoading(true);
    setFuelOcrResults([]);
    setFuelError('');
    try {
      // Process in groups of 4 (one fill-up set per batch)
      const results: object[] = [];
      for (let i = 0; i < fuelFiles.length; i += 4) {
        const batch = fuelFiles.slice(i, i + 4);
        const fd = new FormData();
        batch.forEach((f) => fd.append('images', f));
        const res = await fetch('/api/travel/fuel/ocr', { method: 'POST', body: fd });
        if (res.ok) {
          const { extracted } = await res.json();
          results.push(extracted);
        }
      }
      setFuelOcrResults(results);
    } catch {
      setFuelError('OCR failed — try again');
    } finally {
      setFuelLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/travel" className="text-gray-400 hover:text-gray-600 transition">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Import Data</h1>
          <p className="text-sm text-gray-500">Bulk-load Garmin activities and historical fuel photos</p>
        </div>
      </div>

      {/* ── Garmin CSV Import ─────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
            <Upload className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Garmin Activities CSV</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Import your Garmin activity history. Cycling, walking, running, and hiking will be
              added to your trip log. Pure fitness activities (strength, yoga, HIIT, etc.) are skipped.
              Duplicates are automatically detected.
            </p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500 space-y-1">
          <p className="font-medium text-gray-700">How to export from Garmin Connect:</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>Go to Garmin Connect → Activities → All Activities</li>
            <li>Click the export button (↓) and choose Export to CSV</li>
            <li>Upload the downloaded <code className="bg-gray-200 px-1 rounded">Activities.csv</code> file below</li>
          </ol>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">Select CSV file</label>
          <div
            className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition"
            onClick={() => garminRef.current?.click()}
          >
            {garminFile ? (
              <p className="text-sm font-medium text-blue-700">{garminFile.name}</p>
            ) : (
              <>
                <Upload className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Click to select Activities.csv</p>
              </>
            )}
            <input
              ref={garminRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                setGarminFile(e.target.files?.[0] ?? null);
                setGarminResult(null);
                setGarminError('');
              }}
            />
          </div>
        </div>

        {garminError && (
          <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {garminError}
          </div>
        )}

        {garminResult && (
          <div className="flex items-start gap-2 text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm">
            <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Import complete!</p>
              <p>{garminResult.inserted} trips added · {garminResult.skipped} skipped (duplicates or invalid) · {garminResult.unsupported} unsupported activity types</p>
              {garminResult.errors && garminResult.errors.length > 0 && (
                <p className="text-amber-700 mt-1">Partial errors: {garminResult.errors[0]}</p>
              )}
            </div>
          </div>
        )}

        <button
          onClick={handleGarminImport}
          disabled={!garminFile || garminLoading}
          className="w-full bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-blue-700 transition disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {garminLoading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</>
          ) : (
            <><Upload className="w-4 h-4" /> Import Activities</>
          )}
        </button>
      </div>

      {/* ── Fuel Photo OCR ────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center shrink-0">
            <Camera className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Fuel Photos (Historical)</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Upload your historical dashboard + pump photos. Each fill-up is typically 4 photos:
              Trip A display, Trip B display, odometer, and pump receipt.
              Select multiple sets at once and AI will extract the data.
            </p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-600 space-y-1">
          <p className="font-medium text-gray-700">What each photo should show:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li><strong>Photo 1:</strong> Dashboard — Trip A (miles since last fill)</li>
            <li><strong>Photo 2:</strong> Dashboard — Trip B (miles this month)</li>
            <li><strong>Photo 3:</strong> Dashboard — ODO (total odometer) + MPG reading</li>
            <li><strong>Photo 4:</strong> Fuel pump — gallons, total cost, price/gal</li>
          </ul>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">
            Select photos ({fuelFiles.length} selected)
          </label>
          <div
            className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition"
            onClick={() => fuelRef.current?.click()}
          >
            {fuelFiles.length > 0 ? (
              <div className="space-y-1">
                <p className="text-sm font-medium text-purple-700">{fuelFiles.length} photos selected</p>
                <p className="text-xs text-gray-500">≈ {Math.ceil(fuelFiles.length / 4)} fill-up set{Math.ceil(fuelFiles.length / 4) !== 1 ? 's' : ''}</p>
              </div>
            ) : (
              <>
                <Camera className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Click to select fuel photos</p>
                <p className="text-xs text-gray-400 mt-0.5">Select in groups of 4 per fill-up</p>
              </>
            )}
            <input
              ref={fuelRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                setFuelFiles(Array.from(e.target.files ?? []));
                setFuelOcrResults([]);
                setFuelError('');
              }}
            />
          </div>
        </div>

        {fuelError && (
          <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {fuelError}
          </div>
        )}

        {fuelOcrResults.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 text-green-700 text-sm font-medium mb-2">
              <CheckCircle className="w-4 h-4" />
              {fuelOcrResults.length} fill-up{fuelOcrResults.length !== 1 ? 's' : ''} extracted
            </div>
            <p className="text-xs text-green-700">
              Go to the{' '}
              <Link href="/dashboard/travel/fuel" className="underline font-medium">Fuel Log</Link>{' '}
              page and use the Scan Photos button to add each fill-up individually for review before saving.
            </p>
          </div>
        )}

        <button
          onClick={handleFuelOcr}
          disabled={!fuelFiles.length || fuelLoading}
          className="w-full bg-purple-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-purple-700 transition disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {fuelLoading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Scanning photos…</>
          ) : (
            <><Camera className="w-4 h-4" /> Scan with AI</>
          )}
        </button>

        <p className="text-xs text-gray-400 text-center">
          For best results, scan one fill-up at a time using the{' '}
          <Link href="/dashboard/travel/fuel" className="text-sky-600 hover:underline">Fuel Log</Link> page.
        </p>
      </div>

      {/* Commute Settings */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Commute Settings</h2>
        <p className="text-sm text-gray-500 mb-4">
          Set your typical one-way commute distance and duration to enable one-tap commute logging.
        </p>
        <CommuteSettingsForm />
      </div>
    </div>
  );
}

function CommuteSettingsForm() {
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load existing settings
  useState(() => {
    fetch('/api/travel/settings')
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) {
          setDistance(d.settings.commute_distance_miles ?? '');
          setDuration(d.settings.commute_duration_min ?? '');
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await fetch('/api/travel/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commute_distance_miles: distance ? parseFloat(distance) : null,
          commute_duration_min: duration ? parseInt(duration) : null,
        }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return <div className="h-16 animate-pulse bg-gray-100 rounded-xl" />;

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">One-way distance (miles)</label>
          <input
            type="number" step="0.1" value={distance} placeholder="3.5"
            onChange={(e) => { setDistance(e.target.value); setSaved(false); }}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Typical duration (minutes)</label>
          <input
            type="number" value={duration} placeholder="20"
            onChange={(e) => { setDuration(e.target.value); setSaved(false); }}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-sky-600 text-white rounded-xl text-sm font-medium hover:bg-sky-700 transition disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
        {saved && <span className="text-xs text-green-600 font-medium">Saved!</span>}
      </div>
    </form>
  );
}
