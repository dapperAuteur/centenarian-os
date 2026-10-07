// app/dashboard/categories/organize/page.tsx
// Organize categories: the one category tree (plans/63 E, migration 223). Life areas are the top
// level; budget categories sit under them, and a transaction's life area follows its budget
// category. Here the person:
//   - places each budget category under a life area (drag it, or pick from the list), starting
//     with "Needs a life area", where a suggestion by name waits for a click to confirm;
//   - creates, renames, merges and deletes life areas and budget categories.
// Nothing is placed without the person's click: migration 223 does not guess.
// Data: GET /api/categories/tree; writes through /api/finance/categories, /api/life-categories
// and POST /api/categories/merge.
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, Check, GripVertical, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useTrackPageView } from '@/lib/hooks/useTrackPageView';
import { invalidateCategoryTree, useCategoryTreeData } from '@/lib/hooks/useCategoryTree';
import { buildCategoryTree, type BudgetCategoryRow, type LifeAreaRow } from '@/lib/categories/tree';

type Budget = BudgetCategoryRow & { life_category_id: string | null };

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

async function send(url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'That could not be saved. Please try again.');
  return data;
}

export default function OrganizeCategoriesPage() {
  useTrackPageView('life_categories', '/dashboard/categories/organize');
  const { data, loading } = useCategoryTreeData();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [newArea, setNewArea] = useState({ name: '', color: '#6b7280' });
  const [newChild, setNewChild] = useState<Record<string, string>>({});

  const tree = useMemo(
    () => buildCategoryTree<Budget>(data?.lifeAreas ?? [], (data?.budgetCategories ?? []) as Budget[]),
    [data],
  );
  const ready = data?.ready ?? false;
  const suggestions = data?.suggestions ?? {};
  const suggested = tree.unassigned.filter((c) => suggestions[c.id]);

  const run = async (key: string, action: () => Promise<string>) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      setNotice(await action());
      invalidateCategoryTree();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That could not be saved. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const place = (category: Budget, lifeId: string | null) =>
    run(`place-${category.id}`, async () => {
      const result = await send('/api/finance/categories', 'PATCH', { id: category.id, life_category_id: lifeId });
      const area = lifeId ? tree.lifeById.get(lifeId)?.name : null;
      const count = result?.retagged?.transactions ?? 0;
      const follow = count > 0 ? ` Its ${count} transaction${count === 1 ? '' : 's'} follow it.` : '';
      return area ? `${category.name} is now under ${area}.${follow}` : `${category.name} no longer has a life area.${follow}`;
    });

  const acceptAll = () =>
    run('accept-all', async () => {
      let done = 0;
      for (const category of suggested) {
        await send('/api/finance/categories', 'PATCH', { id: category.id, life_category_id: suggestions[category.id].lifeAreaId });
        done += 1;
      }
      return `${done} categor${done === 1 ? 'y' : 'ies'} placed under the suggested life areas.`;
    });

  const renameBudget = (category: Budget, name: string) =>
    run(`rename-${category.id}`, async () => {
      await send('/api/finance/categories', 'PATCH', { id: category.id, name });
      setEditing(null);
      return `Renamed to ${name}.`;
    });

  const renameArea = (area: LifeAreaRow, name: string, color: string) =>
    run(`rename-${area.id}`, async () => {
      await send(`/api/life-categories/${area.id}`, 'PATCH', { name, color });
      setEditing(null);
      return `Saved ${name}.`;
    });

  const deleteBudget = (category: Budget) => {
    if (!confirm(`Delete the budget category "${category.name}"? Its transactions become uncategorized. To keep them together, merge it into another category instead.`)) return;
    run(`delete-${category.id}`, async () => {
      await send(`/api/finance/categories?id=${encodeURIComponent(category.id)}`, 'DELETE');
      return `${category.name} deleted.`;
    });
  };

  const deleteArea = (area: LifeAreaRow) => {
    if (!confirm(`Delete the life area "${area.name}"? Its budget categories move to "Needs a life area" and its tags are removed. To keep them, merge it into another life area instead.`)) return;
    run(`delete-${area.id}`, async () => {
      await send(`/api/life-categories/${area.id}`, 'DELETE');
      return `${area.name} deleted.`;
    });
  };

  const mergeBudget = (category: Budget, intoId: string) => {
    const into = tree.budgetById.get(intoId);
    if (!into) return;
    if (!confirm(`Merge "${category.name}" into "${into.name}"? Everything in ${category.name} (transactions, recurring payments, invoices, vendors' default category...) moves to ${into.name}, and ${category.name} is deleted. ${into.name} keeps its own budgets.`)) return;
    run(`merge-${category.id}`, async () => {
      const result = await send('/api/categories/merge', 'POST', { level: 'budget', from_id: category.id, into_id: intoId });
      setEditing(null);
      const count = result?.transactions ?? 0;
      return `${category.name} merged into ${into.name} (${count} transaction${count === 1 ? '' : 's'} moved).`;
    });
  };

  const mergeArea = (area: LifeAreaRow, intoId: string) => {
    const into = tree.lifeById.get(intoId);
    if (!into) return;
    if (!confirm(`Merge the life area "${area.name}" into "${into.name}"? Its budget categories and tags move to ${into.name}, and ${area.name} is deleted.`)) return;
    run(`merge-${area.id}`, async () => {
      await send('/api/categories/merge', 'POST', { level: 'life', from_id: area.id, into_id: intoId });
      setEditing(null);
      return `${area.name} merged into ${into.name}.`;
    });
  };

  const addChild = (area: LifeAreaRow) => {
    const name = (newChild[area.id] ?? '').trim();
    if (!name) return;
    run(`add-${area.id}`, async () => {
      const result = await send('/api/finance/categories', 'POST', { name, life_category_id: area.id, color: area.color || undefined });
      setNewChild((prev) => ({ ...prev, [area.id]: '' }));
      return result?.notice ?? `${name} added under ${area.name}.`;
    });
  };

  const addArea = () => {
    const name = newArea.name.trim();
    if (!name) return;
    run('add-area', async () => {
      await send('/api/life-categories', 'POST', { name, color: newArea.color });
      setNewArea({ name: '', color: '#6b7280' });
      return `Life area ${name} added.`;
    });
  };

  // Drag a budget category onto a life area (or onto "Needs a life area").
  const dropProps = (target: string, lifeId: string | null) => ({
    onDragOver: (event: React.DragEvent) => {
      if (!dragId || !ready) return;
      event.preventDefault();
      setDropTarget(target);
    },
    onDragLeave: () => setDropTarget((current) => (current === target ? null : current)),
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      setDropTarget(null);
      const category = dragId ? tree.budgetById.get(dragId) : null;
      setDragId(null);
      if (category && (tree.parentOf.get(category.id)?.id ?? null) !== lifeId) place(category, lifeId);
    },
  });

  const budgetRow = (category: Budget, currentLife: string | null) => {
    const isEditing = editing === category.id;
    const suggestion = currentLife ? null : suggestions[category.id];
    const others = [...tree.budgetById.values()].filter((c) => c.id !== category.id);
    const working = busy !== null;
    return (
      <li
        key={category.id}
        draggable={ready}
        onDragStart={(event) => {
          event.dataTransfer.setData('text/plain', category.id);
          event.dataTransfer.effectAllowed = 'move';
          setDragId(category.id);
        }}
        onDragEnd={() => {
          setDragId(null);
          setDropTarget(null);
        }}
        className={`bg-white border rounded-xl p-3 ${dragId === category.id ? 'opacity-50' : ''} border-gray-200`}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {ready && <GripVertical className="w-4 h-4 text-gray-400 shrink-0 hidden sm:block cursor-grab" aria-hidden="true" />}
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: category.color || '#6366f1' }} aria-hidden="true" />
            <span className="font-medium text-gray-900 truncate">{category.name}</span>
            {category.monthly_budget ? (
              <span className="text-xs text-gray-600 shrink-0">{money(Number(category.monthly_budget))}/mo</span>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {suggestion && (
              <button
                type="button"
                disabled={!ready || working}
                onClick={() => place(category, suggestion.lifeAreaId)}
                className="min-h-11 px-3 rounded-lg border border-sky-600 text-sky-700 text-sm font-medium hover:bg-sky-50 disabled:opacity-50"
              >
                Use {suggestion.lifeAreaName}
              </button>
            )}
            <label htmlFor={`life-${category.id}`} className="sr-only">Life area for {category.name}</label>
            <select
              id={`life-${category.id}`}
              value={currentLife ?? ''}
              disabled={!ready || working}
              onChange={(event) => place(category, event.target.value || null)}
              className="min-h-11 rounded-lg border border-gray-300 px-3 text-sm bg-white text-gray-900 disabled:bg-gray-50"
            >
              <option value="">{currentLife ? 'No life area' : 'Choose a life area…'}</option>
              {tree.lifeAreas.map((area) => (
                <option key={area.id} value={area.id}>{area.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setEditing(isEditing ? null : category.id)}
              aria-expanded={isEditing}
              aria-label={isEditing ? `Close editing ${category.name}` : `Rename, merge or delete ${category.name}`}
              className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
            >
              {isEditing ? <X className="w-4 h-4" aria-hidden="true" /> : <Pencil className="w-4 h-4" aria-hidden="true" />}
            </button>
          </div>
        </div>
        {suggestion && (
          <p className="mt-1 text-xs text-gray-600">
            Suggested from the name: {suggestion.lifeAreaName}. Nothing changes until you choose.
          </p>
        )}
        {isEditing && (
          <BudgetEditor
            category={category}
            others={others}
            busy={working}
            onRename={(name) => renameBudget(category, name)}
            onMerge={(intoId) => mergeBudget(category, intoId)}
            onDelete={() => deleteBudget(category)}
          />
        )}
      </li>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div>
        <Link href="/dashboard/categories" className="inline-flex items-center gap-1 min-h-11 text-sm text-sky-700 hover:text-sky-800">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Categories
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Organize categories</h1>
        <p className="text-sm text-gray-600 mt-1">
          One set of categories. Life areas are the top level and budget categories sit under them. A transaction&apos;s
          life area comes from its budget category, so you only pick one thing. Budgets stay on the budget categories.
        </p>
      </div>

      {!loading && data && !ready && (
        <div role="status" className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            Run migration 223 first. Until the database has that update, budget categories can&apos;t be placed under
            life areas. You can still add, rename, merge and delete categories.
          </p>
        </div>
      )}
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {notice && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <Check className="w-4 h-4 shrink-0" aria-hidden="true" /> {notice}
        </div>
      )}

      {loading && !data ? (
        <div className="flex justify-center py-16" role="status">
          <Loader2 className="w-6 h-6 animate-spin text-sky-600" aria-hidden="true" />
          <span className="sr-only">Loading categories...</span>
        </div>
      ) : !data ? (
        <p role="alert" className="text-sm text-red-800">The categories could not be loaded. Please refresh the page.</p>
      ) : (
        <>
          {/* Budget categories with no life area yet */}
          <section
            aria-labelledby="unassigned-heading"
            {...dropProps('unassigned', null)}
            className={`rounded-2xl border-2 border-dashed p-4 space-y-3 ${
              dropTarget === 'unassigned' ? 'border-sky-400 bg-sky-50' : 'border-amber-300 bg-amber-50/40'
            }`}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 id="unassigned-heading" className="font-semibold text-gray-900">
                  Needs a life area{tree.unassigned.length > 0 ? ` (${tree.unassigned.length})` : ''}
                </h2>
                <p className="text-sm text-gray-600">
                  {tree.unassigned.length > 0
                    ? 'Pick a life area for each, drag it onto one below, or use the suggestion.'
                    : 'Every budget category sits under a life area.'}
                </p>
              </div>
              {suggested.length > 0 && (
                <button
                  type="button"
                  onClick={acceptAll}
                  disabled={!ready || busy !== null}
                  className="min-h-11 px-4 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {busy === 'accept-all' && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                  Use all {suggested.length} suggestion{suggested.length === 1 ? '' : 's'}
                </button>
              )}
            </div>
            {tree.unassigned.length > 0 && (
              <ul className="space-y-2">{tree.unassigned.map((category) => budgetRow(category, null))}</ul>
            )}
          </section>

          {/* Life areas and their budget categories */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {tree.lifeAreas.map((area) => {
              const target = `life-${area.id}`;
              return (
                <section
                  key={area.id}
                  aria-labelledby={`${target}-heading`}
                  {...dropProps(target, area.id)}
                  className={`rounded-2xl border p-4 space-y-3 ${dropTarget === target ? 'border-sky-400 bg-sky-50' : 'border-gray-200 bg-gray-50'}`}
                  style={{ borderLeftColor: area.color || undefined, borderLeftWidth: 4 }}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: area.color || '#6b7280' }} aria-hidden="true" />
                    <h2 id={`${target}-heading`} className="font-semibold text-gray-900 flex-1 min-w-0 truncate">
                      {area.name}
                      <span className="ml-2 text-xs font-normal text-gray-600">
                        {area.children.length} budget categor{area.children.length === 1 ? 'y' : 'ies'}
                      </span>
                    </h2>
                    <button
                      type="button"
                      onClick={() => setEditing(editing === area.id ? null : area.id)}
                      aria-expanded={editing === area.id}
                      aria-label={editing === area.id ? `Close editing ${area.name}` : `Rename, merge or delete ${area.name}`}
                      className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-gray-600 hover:bg-white"
                    >
                      {editing === area.id ? <X className="w-4 h-4" aria-hidden="true" /> : <Pencil className="w-4 h-4" aria-hidden="true" />}
                    </button>
                  </div>
                  {editing === area.id && (
                    <AreaEditor
                      area={area}
                      others={tree.lifeAreas.filter((other) => other.id !== area.id)}
                      busy={busy !== null}
                      onSave={(name, color) => renameArea(area, name, color)}
                      onMerge={(intoId) => mergeArea(area, intoId)}
                      onDelete={() => deleteArea(area)}
                    />
                  )}
                  {area.children.length > 0 ? (
                    <ul className="space-y-2">{area.children.map((category) => budgetRow(category, area.id))}</ul>
                  ) : (
                    <p className="text-sm text-gray-600">No budget categories here yet.</p>
                  )}
                  <form
                    className="flex flex-col gap-2 sm:flex-row"
                    onSubmit={(event) => {
                      event.preventDefault();
                      addChild(area);
                    }}
                  >
                    <label htmlFor={`new-child-${area.id}`} className="sr-only">New budget category under {area.name}</label>
                    <input
                      id={`new-child-${area.id}`}
                      type="text"
                      value={newChild[area.id] ?? ''}
                      onChange={(event) => setNewChild((prev) => ({ ...prev, [area.id]: event.target.value }))}
                      placeholder={`New budget category under ${area.name}`}
                      className="flex-1 min-h-11 rounded-lg border border-gray-300 px-3 text-sm bg-white text-gray-900"
                    />
                    <button
                      type="submit"
                      disabled={busy !== null || !(newChild[area.id] ?? '').trim()}
                      className="min-h-11 px-4 rounded-lg border border-sky-600 text-sky-700 text-sm font-medium hover:bg-sky-50 disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      <Plus className="w-4 h-4" aria-hidden="true" /> Add
                    </button>
                  </form>
                </section>
              );
            })}
          </div>

          {/* New life area */}
          <form
            className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              addArea();
            }}
          >
            <div className="flex-1">
              <label htmlFor="new-area-name" className="block text-xs font-medium text-gray-600 mb-1">New life area</label>
              <input
                id="new-area-name"
                type="text"
                value={newArea.name}
                onChange={(event) => setNewArea((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="e.g. Family, Faith, Pets"
                className="w-full min-h-11 rounded-lg border border-gray-300 px-3 text-sm bg-white text-gray-900"
              />
            </div>
            <div>
              <label htmlFor="new-area-color" className="block text-xs font-medium text-gray-600 mb-1">Color</label>
              <input
                id="new-area-color"
                type="color"
                value={newArea.color}
                onChange={(event) => setNewArea((prev) => ({ ...prev, color: event.target.value }))}
                className="w-11 h-11 rounded-lg border border-gray-300 cursor-pointer"
              />
            </div>
            <button
              type="submit"
              disabled={busy !== null || !newArea.name.trim()}
              className="min-h-11 px-4 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-50 flex items-center justify-center gap-1"
            >
              <Plus className="w-4 h-4" aria-hidden="true" /> Add life area
            </button>
          </form>
        </>
      )}
    </div>
  );
}

function BudgetEditor({
  category,
  others,
  busy,
  onRename,
  onMerge,
  onDelete,
}: {
  category: Budget;
  others: Budget[];
  busy: boolean;
  onRename: (name: string) => void;
  onMerge: (intoId: string) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(category.name);
  const [into, setInto] = useState('');
  return (
    <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() && name.trim() !== category.name) onRename(name.trim());
        }}
      >
        <div className="flex-1">
          <label htmlFor={`rename-${category.id}`} className="block text-xs font-medium text-gray-600 mb-1">Name</label>
          <input
            id={`rename-${category.id}`}
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full min-h-11 rounded-lg border border-gray-300 px-3 text-sm text-gray-900"
          />
        </div>
        <button type="submit" disabled={busy || !name.trim() || name.trim() === category.name} className="min-h-11 px-4 rounded-lg border border-sky-600 text-sky-700 text-sm font-medium hover:bg-sky-50 disabled:opacity-50">
          Rename
        </button>
      </form>
      {others.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor={`merge-${category.id}`} className="block text-xs font-medium text-gray-600 mb-1">Merge into</label>
            <select
              id={`merge-${category.id}`}
              value={into}
              onChange={(event) => setInto(event.target.value)}
              className="w-full min-h-11 rounded-lg border border-gray-300 px-3 text-sm bg-white text-gray-900"
            >
              <option value="">Choose a budget category…</option>
              {others.map((other) => (
                <option key={other.id} value={other.id}>{other.name}</option>
              ))}
            </select>
          </div>
          <button type="button" disabled={busy || !into} onClick={() => onMerge(into)} className="min-h-11 px-4 rounded-lg border border-sky-600 text-sky-700 text-sm font-medium hover:bg-sky-50 disabled:opacity-50">
            Merge
          </button>
        </div>
      )}
      <button type="button" disabled={busy} onClick={onDelete} className="min-h-11 px-3 rounded-lg text-red-700 text-sm font-medium hover:bg-red-50 disabled:opacity-50 inline-flex items-center gap-1">
        <Trash2 className="w-4 h-4" aria-hidden="true" /> Delete {category.name}
      </button>
    </div>
  );
}

function AreaEditor({
  area,
  others,
  busy,
  onSave,
  onMerge,
  onDelete,
}: {
  area: LifeAreaRow;
  others: LifeAreaRow[];
  busy: boolean;
  onSave: (name: string, color: string) => void;
  onMerge: (intoId: string) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(area.name);
  const [color, setColor] = useState(area.color || '#6b7280');
  const [into, setInto] = useState('');
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3">
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) onSave(name.trim(), color);
        }}
      >
        <div className="flex-1">
          <label htmlFor={`area-name-${area.id}`} className="block text-xs font-medium text-gray-600 mb-1">Name</label>
          <input
            id={`area-name-${area.id}`}
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full min-h-11 rounded-lg border border-gray-300 px-3 text-sm text-gray-900"
          />
        </div>
        <div>
          <label htmlFor={`area-color-${area.id}`} className="block text-xs font-medium text-gray-600 mb-1">Color</label>
          <input
            id={`area-color-${area.id}`}
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            className="w-11 h-11 rounded-lg border border-gray-300 cursor-pointer"
          />
        </div>
        <button type="submit" disabled={busy || !name.trim()} className="min-h-11 px-4 rounded-lg border border-sky-600 text-sky-700 text-sm font-medium hover:bg-sky-50 disabled:opacity-50">
          Save
        </button>
      </form>
      {others.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor={`area-merge-${area.id}`} className="block text-xs font-medium text-gray-600 mb-1">Merge into</label>
            <select
              id={`area-merge-${area.id}`}
              value={into}
              onChange={(event) => setInto(event.target.value)}
              className="w-full min-h-11 rounded-lg border border-gray-300 px-3 text-sm bg-white text-gray-900"
            >
              <option value="">Choose a life area…</option>
              {others.map((other) => (
                <option key={other.id} value={other.id}>{other.name}</option>
              ))}
            </select>
          </div>
          <button type="button" disabled={busy || !into} onClick={() => onMerge(into)} className="min-h-11 px-4 rounded-lg border border-sky-600 text-sky-700 text-sm font-medium hover:bg-sky-50 disabled:opacity-50">
            Merge
          </button>
        </div>
      )}
      <button type="button" disabled={busy} onClick={onDelete} className="min-h-11 px-3 rounded-lg text-red-700 text-sm font-medium hover:bg-red-50 disabled:opacity-50 inline-flex items-center gap-1">
        <Trash2 className="w-4 h-4" aria-hidden="true" /> Delete {area.name}
      </button>
    </div>
  );
}
