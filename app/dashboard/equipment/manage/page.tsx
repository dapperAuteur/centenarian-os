'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, RotateCcw, Archive, Settings2 } from 'lucide-react';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import Modal from '@/components/ui/Modal';
import EquipmentForm, { type EquipmentFormData } from '@/components/equipment/EquipmentForm';
import type { EquipmentItem } from '@/components/equipment/EquipmentCard';

interface Category {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
}

export default function EquipmentManagePage() {
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRetired, setShowRetired] = useState(false);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editItem, setEditItem] = useState<EquipmentItem | null>(null);
  const [showCatModal, setShowCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [eqRes, catRes] = await Promise.all([
        offlineFetch(`/api/equipment?include_retired=${showRetired}`),
        offlineFetch('/api/equipment/categories'),
      ]);
      const [eqData, catData] = await Promise.all([eqRes.json(), catRes.json()]);
      setItems(eqData.equipment || []);
      setCategories(catData.categories || []);
    } catch { /* handled by offlineFetch */ }
    finally { setLoading(false); }
  }, [showRetired]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (data: EquipmentFormData) => {
    const res = await offlineFetch('/api/equipment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        purchase_price: data.purchase_price ? Number(data.purchase_price) : null,
        current_value: data.current_value ? Number(data.current_value) : null,
      }),
    });
    if (res.ok) {
      setShowAddModal(false);
      load();
    }
  };

  const handleEdit = async (data: EquipmentFormData) => {
    if (!editItem) return;
    const res = await offlineFetch(`/api/equipment/${editItem.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        purchase_price: data.purchase_price ? Number(data.purchase_price) : null,
        current_value: data.current_value ? Number(data.current_value) : null,
      }),
    });
    if (res.ok) {
      setEditItem(null);
      load();
    }
  };

  const handleRetire = async (item: EquipmentItem) => {
    await offlineFetch(`/api/equipment/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ retire: !item.is_active ? false : true, reactivate: !item.is_active }),
    });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this equipment item?')) return;
    await offlineFetch(`/api/equipment/${id}`, { method: 'DELETE' });
    load();
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    const res = await offlineFetch('/api/equipment/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCatName.trim() }),
    });
    if (res.ok) {
      setNewCatName('');
      load();
    }
  };

  const handleDeleteCategory = async (id: string) => {
    const res = await offlineFetch(`/api/equipment/categories/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || 'Cannot delete category');
      return;
    }
    load();
  };

  const itemToFormData = (item: EquipmentItem): Partial<EquipmentFormData> => ({
    name: item.name,
    category_id: item.category_id,
    brand: item.brand || '',
    model: item.model || '',
    serial_number: item.serial_number || '',
    purchase_date: item.purchase_date || '',
    purchase_price: item.purchase_price ? String(item.purchase_price) : '',
    current_value: item.current_value ? String(item.current_value) : '',
    warranty_expires: item.warranty_expires || '',
    condition: item.condition || '',
    image_url: item.image_url || '',
    image_public_id: item.image_public_id || '',
    notes: item.notes || '',
    transaction_id: item.transaction_id || null,
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Equipment</h1>
          <p className="text-sm text-gray-500 mt-0.5">Add, edit, and organize your gear</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCatModal(true)}
            className="px-3 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition flex items-center gap-1.5"
          >
            <Settings2 className="w-4 h-4" />
            Categories
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-fuchsia-600 hover:bg-fuchsia-700 rounded-xl transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        </div>
      </div>

      {/* Show retired toggle */}
      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
        <input
          type="checkbox"
          checked={showRetired}
          onChange={(e) => setShowRetired(e.target.checked)}
          className="rounded border-gray-300"
        />
        Show retired items
      </label>

      {/* Items list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No equipment items yet.</div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const catName = item.equipment_categories?.name;
            return (
              <div
                key={item.id}
                className={`bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 ${
                  !item.is_active ? 'opacity-60' : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-900 truncate">{item.name}</span>
                    {catName && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                        {catName}
                      </span>
                    )}
                    {!item.is_active && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-500 rounded-full">
                        Retired
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 mt-1 text-xs text-gray-500">
                    {item.brand && <span>{item.brand} {item.model || ''}</span>}
                    {item.purchase_price != null && <span>Paid ${Number(item.purchase_price).toLocaleString()}</span>}
                    {item.current_value != null && <span>Value ${Number(item.current_value).toLocaleString()}</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => setEditItem(item)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleRetire(item)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
                    title={item.is_active ? 'Retire' : 'Reactivate'}
                  >
                    {item.is_active ? <Archive className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Equipment" size="lg">
        <EquipmentForm
          categories={categories}
          onSubmit={handleAdd}
          onCancel={() => setShowAddModal(false)}
          submitLabel="Add Item"
        />
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editItem} onClose={() => setEditItem(null)} title="Edit Equipment" size="lg">
        {editItem && (
          <EquipmentForm
            categories={categories}
            initial={itemToFormData(editItem)}
            onSubmit={handleEdit}
            onCancel={() => setEditItem(null)}
            submitLabel="Save Changes"
          />
        )}
      </Modal>

      {/* Categories Modal */}
      <Modal isOpen={showCatModal} onClose={() => setShowCatModal(false)} title="Manage Categories">
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); } }}
              placeholder="New category name"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
            <button
              onClick={handleAddCategory}
              className="px-3 py-2 text-sm font-medium text-white bg-fuchsia-600 hover:bg-fuchsia-700 rounded-lg transition"
            >
              Add
            </button>
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">{cat.name}</span>
                <button
                  onClick={() => handleDeleteCategory(cat.id)}
                  className="text-gray-400 hover:text-red-500 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
