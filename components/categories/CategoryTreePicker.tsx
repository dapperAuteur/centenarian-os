'use client';

// components/categories/CategoryTreePicker.tsx
// The one category picker (plans/63 E, migration 223): life areas on top, budget categories
// under them, searchable, for every place a category is chosen.
//
//   mode 'budget'  choose a budget category; life areas are headings (transactions, budgets,
//                  the importer, recurring payments...). The life area follows automatically.
//   mode 'life'    choose a life area only (tasks, trips, workouts and other modules with no
//                  budget meaning).
//   mode 'any'     either (bulk edit: a category, or just a life-area tag).
//
// Keyboard: the button opens a panel whose search box is an ARIA 1.2 combobox; Up/Down move
// through the options (Home/End stay with the text box), Enter picks, Escape closes and returns
// focus to the button. Every option and control is at least 44px tall. "Add “…”" creates a
// category from the search text.
//
// The panel is position: fixed, placed from the button's rectangle (below it, or above when
// there is more room there), so a table or card with overflow: hidden never clips it.

import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Check, ChevronDown, Loader2, Plus, Search, X } from 'lucide-react';
import {
  hasExactName,
  pickerGroups,
  selectionLabel,
  suggestLifeArea,
  type CategoryTree,
  type PickerMode,
  type PickerOption,
  type TreeSelection,
} from '@/lib/categories/tree';

export interface CategoryTreePickerProps {
  tree: CategoryTree;
  value: TreeSelection | null;
  onChange: (value: TreeSelection | null) => void;
  mode?: PickerMode;
  /** The field's name, also used for screen readers when hidden. */
  label: string;
  hideLabel?: boolean;
  id?: string;
  /** Shown on the closed control when nothing is picked. */
  placeholder?: string;
  /** Offer a "none" option (default true in 'budget' mode). */
  allowNone?: boolean;
  noneLabel?: string;
  disabled?: boolean;
  /** Keys ('life:<id>' / 'budget:<id>') to leave out, e.g. life areas already tagged. */
  exclude?: ReadonlySet<string>;
  /**
   * Creates a category named from the search text. In 'budget'/'any' mode a budget category under
   * the chosen life area (null = none); in 'life' mode a life area (lifeAreaId is always null).
   * Resolve with what to select, or null when it failed (show your own message).
   */
  onCreate?: (name: string, lifeAreaId: string | null) => Promise<TreeSelection | null>;
  /** 'field' looks like a select; 'button' is a compact trigger (e.g. "+ Tag"). */
  variant?: 'field' | 'button';
  buttonLabel?: ReactNode;
  /** Which edge the panel lines up with. */
  align?: 'left' | 'right';
  className?: string;
  /** Heading for budget categories without a life area. */
  unassignedHeading?: string;
}

interface Indexed {
  option: PickerOption;
  /** Position in the flat keyboard order. */
  index: number;
}

interface Section {
  key: string;
  heading: string;
  color: string | null;
  /** The life area itself, when it can be picked. */
  self: Indexed | null;
  options: Indexed[];
}

const NONE_OPTION: PickerOption = { key: 'none', kind: 'none', id: null, label: '', path: '', color: null };
const CREATE_KEY = 'create';

export default function CategoryTreePicker({
  tree,
  value,
  onChange,
  mode = 'budget',
  label,
  hideLabel = false,
  id,
  placeholder,
  allowNone,
  noneLabel,
  disabled = false,
  exclude,
  onCreate,
  variant = 'field',
  buttonLabel,
  align = 'left',
  className = '',
  unassignedHeading,
}: CategoryTreePickerProps) {
  const autoId = useId().replace(/:/g, '');
  const baseId = id ?? `ctp-${autoId}`;
  const labelId = `${baseId}-label`;
  const listboxId = `${baseId}-listbox`;
  const searchId = `${baseId}-search`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState<{ name: string; lifeAreaId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const withNone = allowNone ?? mode === 'budget';
  const noneText = noneLabel ?? (mode === 'life' ? 'No life area' : 'No category');
  const current = selectionLabel(tree, value);

  // What the list shows: an optional "none", one section per life area (plus "No life area"),
  // an optional "Add …", and the same options flattened for keyboard movement.
  const { none, sections, createOption, options } = useMemo(() => {
    const groups = pickerGroups(tree, {
      mode,
      query,
      unassignedHeading: unassignedHeading ?? (tree.lifeAreas.length === 0 ? 'Categories' : undefined),
    })
      .map((group) => ({
        ...group,
        self: group.self && exclude?.has(group.self.key) ? null : group.self,
        options: group.options.filter((option) => !exclude?.has(option.key)),
      }))
      .filter((group) => group.self || group.options.length > 0);

    const list: PickerOption[] = [];
    const add = (option: PickerOption): Indexed => {
      list.push(option);
      return { option, index: list.length - 1 };
    };
    const noneEntry = withNone && !query.trim() ? add({ ...NONE_OPTION, label: noneText, path: noneText }) : null;
    const built: Section[] = groups.map((group) => ({
      key: group.key,
      heading: group.heading,
      color: group.color,
      self: group.self ? add(group.self) : null,
      options: group.options.map(add),
    }));
    const text = query.trim();
    const createEntry =
      onCreate && text && !hasExactName(tree, text, mode)
        ? add({
            key: CREATE_KEY,
            kind: mode === 'life' ? 'life' : 'budget',
            id: null,
            label: `Add “${text}”`,
            path: `Add “${text}”`,
            color: null,
          })
        : null;
    return { none: noneEntry, sections: built, createOption: createEntry, options: list };
  }, [tree, mode, query, exclude, withNone, noneText, onCreate, unassignedHeading]);

  // Keep the highlighted option in range and on screen.
  const activeIndex = Math.min(active, Math.max(options.length - 1, 0));
  const activeOption = options[activeIndex];
  const optionDomId = (option: PickerOption) => `${baseId}-opt-${option.key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

  useEffect(() => {
    if (!open || !activeOption) return;
    document.getElementById(optionDomId(activeOption))?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeIndex, activeOption?.key]);

  // Close on a click outside.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) close(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  // Where the fixed panel goes: under the button, or above it when the space below is short.
  const placePanel = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const gutter = 16;
    const viewportWidth = window.innerWidth;
    const width = Math.min(Math.max(rect.width, viewportWidth < 640 ? 256 : 288), viewportWidth - gutter * 2);
    let left = align === 'right' ? rect.right - width : rect.left;
    left = Math.max(gutter, Math.min(left, viewportWidth - width - gutter));
    const below = window.innerHeight - rect.bottom - gutter;
    const above = rect.top - gutter;
    const openUp = below < 280 && above > below;
    const maxHeight = Math.max(Math.min(openUp ? above : below, 448), 160);
    setPanelStyle(
      openUp
        ? { position: 'fixed', left, width, bottom: window.innerHeight - rect.top + 4, maxHeight }
        : { position: 'fixed', left, width, top: rect.bottom + 4, maxHeight },
    );
  }, [align]);

  // Follow the button while the page scrolls or resizes.
  useEffect(() => {
    if (!open) return;
    placePanel();
    window.addEventListener('resize', placePanel);
    window.addEventListener('scroll', placePanel, true);
    return () => {
      window.removeEventListener('resize', placePanel);
      window.removeEventListener('scroll', placePanel, true);
    };
  }, [open, placePanel]);

  function openPanel() {
    if (disabled) return;
    setQuery('');
    setCreating(null);
    setCreateError(null);
    setOpen(true);
    // Start on the current value.
    requestAnimationFrame(() => {
      searchRef.current?.focus();
    });
  }

  useEffect(() => {
    if (!open) return;
    const currentKey = value ? `${value.kind}:${value.id}` : withNone ? 'none' : null;
    const index = currentKey ? options.findIndex((option) => option.key === currentKey) : -1;
    setActive(index >= 0 ? index : 0);
    // Only when the panel opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close(returnFocus = true) {
    setOpen(false);
    setCreating(null);
    if (returnFocus) triggerRef.current?.focus();
  }

  function pick(option: PickerOption | undefined) {
    if (!option) return;
    if (option.key === CREATE_KEY) {
      const name = query.trim();
      if (mode === 'life') {
        void create(name, null);
        return;
      }
      const suggestion = suggestLifeArea(name, tree.lifeAreas);
      setCreating({ name, lifeAreaId: suggestion?.lifeAreaId ?? '' });
      setCreateError(null);
      return;
    }
    if (option.kind === 'none') onChange(null);
    else onChange({ kind: option.kind, id: option.id as string });
    close();
  }

  async function create(name: string, lifeAreaId: string | null) {
    if (!onCreate || !name || busy) return;
    setBusy(true);
    setCreateError(null);
    try {
      const created = await onCreate(name, lifeAreaId);
      if (created) {
        onChange(created);
        close();
      } else {
        setCreateError('It could not be added. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActive((i) => Math.min(Math.min(i, options.length - 1) + 1, options.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActive((i) => Math.max(Math.min(i, options.length - 1) - 1, 0));
        break;
      case 'Enter':
        event.preventDefault();
        pick(activeOption);
        break;
      case 'Escape':
        event.preventDefault();
        close();
        break;
      case 'Tab':
        close(false);
        break;
      default:
        break;
    }
  }

  function renderOption({ option, index }: Indexed, depth: 0 | 1) {
    const selected = value ? option.key === `${value.kind}:${value.id}` : option.kind === 'none';
    const isActive = index === activeIndex;
    const isCreate = option.key === CREATE_KEY;
    const isLife = option.kind === 'life' && !isCreate;
    const domId = optionDomId(option);
    return (
      <div
        key={option.key}
        id={domId}
        role="option"
        aria-selected={selected}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => pick(option)}
        onMouseMove={() => setActive(index)}
        className={`min-h-11 flex items-center gap-2 px-3 text-sm cursor-pointer ${depth === 1 ? 'pl-7' : ''} ${
          isActive ? 'bg-sky-50 text-sky-900' : 'text-gray-800'
        } ${isLife ? 'font-semibold' : ''} ${isCreate ? 'text-sky-700 border-t border-gray-100' : ''}`}
      >
        {isCreate ? (
          <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
        ) : (
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={option.color ? { backgroundColor: option.color } : undefined}
            aria-hidden="true"
          />
        )}
        <span id={`${domId}-text`} className="flex-1 min-w-0 truncate">
          {option.label}
          {isLife && mode === 'any' && <span className="ml-1 font-normal text-xs text-gray-600">(life area only)</span>}
        </span>
        {selected && <Check className="w-4 h-4 shrink-0 text-sky-700" aria-hidden="true" />}
      </div>
    );
  }

  const shown = current
    ? current.path
    : placeholder ?? (withNone ? noneText : mode === 'life' ? 'Choose a life area' : 'Choose a category');
  const resultCount = options.filter((option) => option.key !== CREATE_KEY && option.kind !== 'none').length;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <span id={labelId} className={hideLabel ? 'sr-only' : 'block text-xs font-medium text-gray-600 mb-1'}>
        {label}
      </span>
      {variant === 'field' ? (
        <button
          ref={triggerRef}
          id={baseId}
          type="button"
          disabled={disabled}
          onClick={() => (open ? close() : openPanel())}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              openPanel();
            }
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={`${labelId} ${baseId}`}
          className="w-full min-h-11 flex items-center gap-2 px-3 py-2 text-sm text-left border border-gray-300 rounded-lg bg-white text-gray-900 hover:border-gray-400 disabled:bg-gray-50 disabled:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          {current?.color && (
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: current.color }} aria-hidden="true" />
          )}
          <span className={`flex-1 min-w-0 truncate ${current ? '' : 'text-gray-500'}`}>{shown}</span>
          <ChevronDown className={`w-4 h-4 shrink-0 text-gray-500 transition ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      ) : (
        <button
          ref={triggerRef}
          id={baseId}
          type="button"
          disabled={disabled}
          onClick={() => (open ? close() : openPanel())}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={`${labelId} ${baseId}`}
          className="min-h-11 min-w-11 inline-flex items-center justify-center gap-1 px-2 text-xs font-medium text-fuchsia-700 rounded-lg hover:bg-fuchsia-50 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          {buttonLabel ?? (
            <>
              <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Add
            </>
          )}
        </button>
      )}

      {open && (
        <div
          style={panelStyle ?? { position: 'fixed', visibility: 'hidden' }}
          className="z-50 flex flex-col overflow-hidden bg-white border border-gray-200 rounded-xl shadow-lg"
        >
          {creating ? (
            // Not a <form>: this picker often sits inside the caller's form, and forms can't nest.
            <div
              role="group"
              aria-label={`Add ${creating.name}`}
              className="p-3 space-y-2"
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setCreating(null);
                  requestAnimationFrame(() => searchRef.current?.focus());
                }
              }}
            >
              <p className="text-sm font-medium text-gray-900">Add “{creating.name}”</p>
              <label htmlFor={`${baseId}-new-life`} className="block text-xs font-medium text-gray-600">
                Under which life area?
              </label>
              <select
                id={`${baseId}-new-life`}
                value={creating.lifeAreaId}
                onChange={(event) => setCreating({ ...creating, lifeAreaId: event.target.value })}
                className="w-full min-h-11 px-3 text-sm border border-gray-300 rounded-lg bg-white text-gray-900"
                autoFocus
              >
                <option value="">No life area yet</option>
                {tree.lifeAreas.map((area) => (
                  <option key={area.id} value={area.id}>{area.name}</option>
                ))}
              </select>
              {createError && <p role="alert" className="text-xs text-red-700">{createError}</p>}
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => void create(creating.name, creating.lifeAreaId || null)}
                  disabled={busy}
                  className="min-h-11 flex-1 px-3 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Plus className="w-4 h-4" aria-hidden="true" />}
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setCreating(null)}
                  className="min-h-11 px-3 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200"
                >
                  Back
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="p-2 border-b border-gray-100 flex items-center gap-1">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
                  <input
                    ref={searchRef}
                    id={searchId}
                    type="text"
                    role="combobox"
                    aria-expanded="true"
                    aria-controls={listboxId}
                    aria-autocomplete="list"
                    aria-activedescendant={activeOption ? optionDomId(activeOption) : undefined}
                    aria-label={`Search ${label.toLowerCase()}`}
                    autoComplete="off"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setActive(0);
                    }}
                    onKeyDown={onSearchKeyDown}
                    placeholder={mode === 'life' ? 'Search life areas' : 'Search categories and life areas'}
                    className="w-full min-h-11 pl-8 pr-2 text-sm border border-gray-200 rounded-lg text-gray-900"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => close()}
                  aria-label="Close"
                  className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
              <p className="sr-only" role="status" aria-live="polite">
                {resultCount === 1 ? '1 result' : `${resultCount} results`}
              </p>
              <div id={listboxId} role="listbox" aria-label={label} className="flex-1 min-h-0 overflow-y-auto py-1">
                {options.length === 0 && <p className="px-3 py-3 text-sm text-gray-500">Nothing matches.</p>}
                {none && renderOption(none, 0)}
                {sections.map((section) => {
                  const headingId = `${baseId}-h-${section.key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
                  return (
                    <div key={section.key} role="presentation">
                      {!section.self && (
                        <div
                          id={headingId}
                          aria-hidden="true"
                          className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-1.5"
                        >
                          {section.color && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: section.color }} />}
                          {section.heading}
                        </div>
                      )}
                      <div role="group" aria-labelledby={section.self ? `${optionDomId(section.self.option)}-text` : headingId}>
                        {section.self && renderOption(section.self, 0)}
                        {section.options.map((entry) => renderOption(entry, 1))}
                      </div>
                    </div>
                  );
                })}
                {createOption && renderOption(createOption, 0)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
