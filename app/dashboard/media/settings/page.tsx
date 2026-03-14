'use client';

import { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, Plus, Edit3, Trash2, Check, X, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { offlineFetch } from '@/lib/offline/offline-fetch';

interface SavedItem {
  id: string;
  name: string;
  use_count: number;
}

function SavedItemList({
  title,
  items,
  loading,
  onAdd,
  onRename,
  onDelete,
}: {
  title: string;
  items: SavedItem[];
  loading: boolean;
  onAdd: (name: string) => Promise<boolean>;
  onRename: (id: string, name: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [addValue, setAddValue] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [error, setError] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addValue.trim()) return;
    setAdding(true);
    setError('');
    const ok = await onAdd(addValue.trim());
    if (ok) {
      setAddValue('');
      setShowAdd(false);
    } else {
      setError('Already exists');
    }
    setAdding(false);
  };

  const handleRename = async (id: string) => {
    if (!editValue.trim()) return;
    setError('');
    const ok = await onRename(id, editValue.trim());
    if (ok) {
      setEditingId(null);
    } else {
      setError('Already exists');
    }
  };

  return (
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
        <button
          type="button"
          onClick={() => { setShowAdd(!showAdd); setError(''); }}
          className="flex items-center gap-1 text-xs text-fuchsia-600 hover:text-fuchsia-700 font-medium min-h-11"
          aria-expanded={showAdd}
          aria-label={`Add new ${title.toLowerCase().replace(/s$/, '')}`}
        >
          {showAdd ? <X className="w-3.5 h-3.5" aria-hidden="true" /> : <Plus className="w-3.5 h-3.5" aria-hidden="true" />}
          {showAdd ? 'Cancel' : 'Add'}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
          <input
            type="text"
            value={addValue}
            onChange={(e) => setAddValue(e.target.value)}
            placeholder={`New ${title.toLowerCase().replace(/s$/, '')} name...`}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-11"
            autoFocus
            aria-label={`New ${title.toLowerCase().replace(/s$/, '')} name`}
          />
          <button
            type="submit"
            disabled={adding || !addValue.trim()}
            className="flex items-center justify-center min-h-11 min-w-11 bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700 transition disabled:opacity-50"
            aria-label="Save"
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Check className="w-4 h-4" aria-hidden="true" />}
          </button>
        </form>
      )}

      {error && <p className="px-4 py-2 text-xs text-red-600 bg-red-50" role="alert">{error}</p>}

      {loading && (
        <div className="flex items-center gap-2 px-4 py-6 justify-center text-sm text-gray-400" role="status">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          Loading...
        </div>
      )}

      {!loading && items.length === 0 && (
        <p className="px-4 py-6 text-center text-xs text-gray-400">
          No saved {title.toLowerCase()} yet. They&apos;ll appear here as you add media.
        </p>
      )}

      {items.length > 0 && (
        <ul className="divide-y divide-gray-50" role="list">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 px-4 py-2 group" role="listitem">
              {editingId === item.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm min-h-11"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(item.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    aria-label="Edit name"
                  />
                  <button
                    type="button"
                    onClick={() => handleRename(item.id)}
                    className="flex items-center justify-center min-h-11 min-w-11 text-green-600 hover:text-green-700"
                    aria-label="Confirm rename"
                  >
                    <Check className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="flex items-center justify-center min-h-11 min-w-11 text-gray-400 hover:text-gray-600"
                    aria-label="Cancel rename"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="flex-1 text-sm text-gray-700 truncate">{item.name}</span>
                  <span className="text-[10px] text-gray-400 tabular-nums shrink-0">{item.use_count}x</span>
                  <button
                    type="button"
                    onClick={() => { setEditingId(item.id); setEditValue(item.name); setError(''); }}
                    className="flex items-center justify-center min-h-11 min-w-11 text-gray-400 hover:text-fuchsia-600 opacity-0 group-hover:opacity-100 transition"
                    aria-label={`Rename ${item.name}`}
                  >
                    <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(item.id)}
                    className="flex items-center justify-center min-h-11 min-w-11 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                    aria-label={`Delete ${item.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function MediaSettingsPage() {
  const [creators, setCreators] = useState<SavedItem[]>([]);
  const [platforms, setPlatforms] = useState<SavedItem[]>([]);
  const [loadingCreators, setLoadingCreators] = useState(true);
  const [loadingPlatforms, setLoadingPlatforms] = useState(true);

  const loadCreators = useCallback(async () => {
    setLoadingCreators(true);
    try {
      const res = await offlineFetch('/api/media/creators');
      if (res.ok) setCreators(await res.json());
    } catch { /* offline */ }
    setLoadingCreators(false);
  }, []);

  const loadPlatforms = useCallback(async () => {
    setLoadingPlatforms(true);
    try {
      const res = await offlineFetch('/api/media/platforms');
      if (res.ok) setPlatforms(await res.json());
    } catch { /* offline */ }
    setLoadingPlatforms(false);
  }, []);

  useEffect(() => { loadCreators(); loadPlatforms(); }, [loadCreators, loadPlatforms]);

  const addCreator = async (name: string): Promise<boolean> => {
    const res = await offlineFetch('/api/media/creators', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.ok) { loadCreators(); return true; }
    return false;
  };

  const renameCreator = async (id: string, name: string): Promise<boolean> => {
    const res = await offlineFetch(`/api/media/creators/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.ok) { loadCreators(); return true; }
    return false;
  };

  const deleteCreator = async (id: string) => {
    await offlineFetch(`/api/media/creators/${id}`, { method: 'DELETE' });
    loadCreators();
  };

  const addPlatform = async (name: string): Promise<boolean> => {
    const res = await offlineFetch('/api/media/platforms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.ok) { loadPlatforms(); return true; }
    return false;
  };

  const renamePlatform = async (id: string, name: string): Promise<boolean> => {
    const res = await offlineFetch(`/api/media/platforms/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.ok) { loadPlatforms(); return true; }
    return false;
  };

  const deletePlatform = async (id: string) => {
    await offlineFetch(`/api/media/platforms/${id}`, { method: 'DELETE' });
    loadPlatforms();
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/media"
          className="flex items-center justify-center min-h-11 min-w-11 text-gray-500 hover:text-gray-700 transition"
          aria-label="Back to media"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </Link>
        <h1 className="text-lg font-bold text-gray-900">Media Settings</h1>
      </div>

      <p className="text-sm text-gray-500">
        Manage your saved creators and platforms. These appear as suggestions when adding media to reduce typos and speed up entry.
      </p>

      <div className="grid grid-cols-1 gap-6">
        <SavedItemList
          title="Creators"
          items={creators}
          loading={loadingCreators}
          onAdd={addCreator}
          onRename={renameCreator}
          onDelete={deleteCreator}
        />

        <SavedItemList
          title="Platforms"
          items={platforms}
          loading={loadingPlatforms}
          onAdd={addPlatform}
          onRename={renamePlatform}
          onDelete={deletePlatform}
        />
      </div>
    </div>
  );
}
