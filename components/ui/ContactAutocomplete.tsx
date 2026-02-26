'use client';

// components/ui/ContactAutocomplete.tsx
// Autocomplete input backed by saved user_contacts.
// - Shows datalist suggestions sorted by use_count (most-used first)
// - On blur with a new (unsaved) value, offers a "Save" inline prompt
// - When a saved contact is selected, fires onChange with optional default_category_id
// - Increments use_count server-side on selection

import { useEffect, useRef, useState } from 'react';

interface Contact {
  id: string;
  name: string;
  contact_type: string;
  default_category_id: string | null;
}

interface ContactAutocompleteProps {
  value: string;
  onChange: (name: string, defaultCategoryId?: string | null) => void;
  contactType: 'vendor' | 'customer' | 'location';
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

export default function ContactAutocomplete({
  value,
  onChange,
  contactType,
  placeholder,
  className,
  inputClassName,
}: ContactAutocompleteProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showSave, setShowSave] = useState(false);
  const listId = `contacts-${contactType}-${Math.random().toString(36).slice(2, 7)}`;
  const listIdRef = useRef(listId);

  useEffect(() => {
    fetch(`/api/contacts?type=${contactType}`)
      .then((r) => r.json())
      .then((d) => setContacts(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [contactType]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    setShowSave(false);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    if (!val) { setShowSave(false); return; }

    const match = contacts.find((c) => c.name.toLowerCase() === val.toLowerCase());
    if (match) {
      // Known contact — increment use_count and pass default_category_id
      fetch(`/api/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: match.name, contact_type: contactType }),
      });
      onChange(match.name, match.default_category_id);
      setShowSave(false);
    } else {
      // Unknown value — offer to save
      setShowSave(true);
    }
  };

  const handleSave = async () => {
    if (!value.trim()) return;
    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: value.trim(), contact_type: contactType }),
    });
    if (res.ok) {
      const newContact = await res.json();
      setContacts((prev) => [newContact, ...prev.filter((c) => c.id !== newContact.id)]);
    }
    setShowSave(false);
  };

  return (
    <div className={className}>
      <input
        type="text"
        list={listIdRef.current}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={inputClassName}
        autoComplete="off"
      />
      <datalist id={listIdRef.current}>
        {contacts.map((c) => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>
      {showSave && value.trim() && (
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-xs text-gray-400">Save &ldquo;{value.trim()}&rdquo; as a contact?</span>
          <button
            type="button"
            onClick={handleSave}
            className="text-xs text-fuchsia-600 hover:underline font-medium"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setShowSave(false)}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
