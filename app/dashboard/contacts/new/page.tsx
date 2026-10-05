// app/dashboard/contacts/new/page.tsx
// Add a saved contact: name, optional address (saved as its default location)
// and notes. The type comes from ?type=vendor|customer|location (default
// vendor) and the name can be prefilled with ?name=.
//
// RideWitUS links here ("Add it in CentenarianOS") when the vendor a person
// wants is not in their list yet: RideWitUS reads vendors from CentenarianOS
// and never creates them (RideWitUS PRD §6.9, Q14). The link comes from
// create_vendor_url in GET /api/v1/ride/vendors.
//
// Data: POST /api/contacts (an existing contact with the same name and type is
// reused, not duplicated), then POST /api/contacts/[id]/locations.
'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';

type ContactType = 'vendor' | 'customer' | 'location';
const TYPES: ContactType[] = ['vendor', 'customer', 'location'];
const TYPE_LABEL: Record<ContactType, string> = { vendor: 'vendor', customer: 'customer', location: 'location' };

export default function NewContactPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20" role="status">
          <Loader2 className="w-6 h-6 animate-spin text-sky-600" aria-hidden="true" />
          <span className="sr-only">Loading...</span>
        </div>
      }
    >
      <NewContactForm />
    </Suspense>
  );
}

function NewContactForm() {
  const params = useSearchParams();
  const requested = params.get('type');
  const type: ContactType = TYPES.includes(requested as ContactType) ? (requested as ContactType) : 'vendor';

  const [name, setName] = useState(() => (params.get('name') ?? '').slice(0, 100));
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ name: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Enter a name.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), contact_type: type, notes: notes.trim() || undefined }),
      });
      const contact = await res.json().catch(() => null);
      if (!res.ok || !contact?.id) throw new Error(contact?.error || 'The contact could not be saved.');

      if (address.trim()) {
        const loc = await fetch(`/api/contacts/${contact.id}/locations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: 'Main', address: address.trim(), is_default: true }),
        });
        if (!loc.ok) throw new Error('The contact was saved, but its address could not be. Try adding it again.');
      }
      setSaved({ name: contact.name ?? name.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The contact could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 min-h-11 text-sm text-sky-700 hover:text-sky-800"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Dashboard
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mt-2">Add a {TYPE_LABEL[type]}</h1>
      <p className="text-sm text-gray-600 mt-1">
        Saved contacts fill in forms across CentenarianOS. Vendors also show up in RideWitUS when you log fuel or a
        service.
      </p>

      {saved ? (
        <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4" role="status">
          <p className="flex items-center gap-2 font-medium text-green-800">
            <Check className="w-5 h-5" aria-hidden="true" /> Saved {saved.name}.
          </p>
          <p className="text-sm text-green-800 mt-1">
            If you came from RideWitUS, go back and search for it: it is in your list now.
          </p>
          <button
            type="button"
            onClick={() => {
              setSaved(null);
              setName('');
              setAddress('');
              setNotes('');
            }}
            className="mt-3 min-h-11 px-4 rounded-lg border border-green-300 bg-white text-sm font-medium text-green-800 hover:bg-green-100"
          >
            Add another
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4 rounded-lg border border-gray-200 bg-white p-4">
          <div>
            <label htmlFor="contact-name" className="block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              id="contact-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              required
              className="mt-1 w-full min-h-11 rounded-lg border border-gray-300 px-3 text-gray-900"
            />
          </div>
          <div>
            <label htmlFor="contact-address" className="block text-sm font-medium text-gray-700">
              Address <span className="font-normal text-gray-500">(optional)</span>
            </label>
            <input
              id="contact-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              maxLength={500}
              className="mt-1 w-full min-h-11 rounded-lg border border-gray-300 px-3 text-gray-900"
            />
          </div>
          <div>
            <label htmlFor="contact-notes" className="block text-sm font-medium text-gray-700">
              Notes <span className="font-normal text-gray-500">(optional)</span>
            </label>
            <textarea
              id="contact-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={2000}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="submit"
              disabled={saving}
              className="min-h-11 px-4 rounded-lg bg-sky-600 text-white font-medium hover:bg-sky-700 disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              Save {TYPE_LABEL[type]}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
