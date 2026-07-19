import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const emptyForm = { name: '', quantity: '', unit: 'units', price: '', low_threshold: 5 }

export default function Inventory({ shopId }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  useEffect(() => {
    fetchProducts()
    const sub = supabase
      .channel('products-crud')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchProducts)
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [shopId])

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('shop_id', shopId)
      .order('name')
    setProducts(data || [])
    setLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)

    const payload = {
      name: form.name.trim(),
      quantity: Number(form.quantity),
      unit: form.unit || 'units',
      price: Number(form.price) || 0,
      low_threshold: Number(form.low_threshold) || 5,
      shop_id: shopId,
      updated_at: new Date()
    }

    if (editId) {
      await supabase.from('products').update(payload).eq('id', editId)
    } else {
      await supabase.from('products').insert(payload)
    }

    setForm(emptyForm)
    setEditId(null)
    setShowForm(false)
    setSaving(false)
    fetchProducts()
  }

  const handleEdit = (p) => {
    setForm({
      name: p.name,
      quantity: p.quantity,
      unit: p.unit,
      price: p.price || '',
      low_threshold: p.low_threshold
    })
    setEditId(p.id)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    await supabase.from('products').delete().eq('id', id)
    setDeleteConfirm(null)
    fetchProducts()
  }

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )
  const lowStock = products.filter(p => p.quantity <= p.low_threshold)

  if (loading) return <div className="text-center py-10 text-gray-400">Loading...</div>

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Total Products</p>
          <p className="text-2xl font-bold text-gray-800">{products.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Low Stock</p>
          <p className="text-2xl font-bold text-red-500">{lowStock.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Total Value</p>
          <p className="text-2xl font-bold text-green-600">
            ₹{products.reduce((sum, p) => sum + (p.price || 0) * p.quantity, 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-medium text-red-700 mb-2">⚠️ Low Stock Alert</p>
          <div className="flex flex-wrap gap-2">
            {lowStock.map(p => (
              <span key={p.id} className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full">
                {p.name}: {p.quantity} {p.unit}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Search + Add button */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="🔍 Search products..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button
          onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(true) }}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          + Add
        </button>
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              {editId ? '✏️ Edit Product' : '➕ Add Product'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Product Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Maggi"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Quantity *</label>
                  <input
                    type="number"
                    value={form.quantity}
                    onChange={e => setForm({ ...form, quantity: e.target.value })}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Unit</label>
                  <input
                    type="text"
                    value={form.unit}
                    onChange={e => setForm({ ...form, unit: e.target.value })}
                    placeholder="units/kg/pcs"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Price (₹)</label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={e => setForm({ ...form, price: e.target.value })}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Min Stock Alert</label>
                  <input
                    type="number"
                    value={form.low_threshold}
                    onChange={e => setForm({ ...form, low_threshold: e.target.value })}
                    placeholder="5"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditId(null) }}
                  className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editId ? 'Update' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold text-gray-800 mb-2">Delete Product?</h2>
            <p className="text-sm text-gray-500 mb-4">
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm.id)}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg text-sm font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Products table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Product</th>
              <th className="text-right px-4 py-3">Stock</th>
              <th className="text-right px-4 py-3">Price</th>
              <th className="text-right px-4 py-3">Value</th>
              <th className="text-center px-4 py-3">Status</th>
              <th className="text-center px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                <td className="px-4 py-3 text-right text-gray-600">{p.quantity} {p.unit}</td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {p.price ? `₹${p.price}` : '—'}
                </td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {p.price ? `₹${(p.price * p.quantity).toLocaleString()}` : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  {p.quantity <= p.low_threshold ? (
                    <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">Low</span>
                  ) : (
                    <span className="bg-green-100 text-green-600 text-xs px-2 py-0.5 rounded-full">OK</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => handleEdit(p)}
                      className="text-blue-500 hover:text-blue-700 text-xs px-2 py-1 rounded border border-blue-200 hover:bg-blue-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(p)}
                      className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded border border-red-200 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            {search ? 'No products found' : 'No products yet. Add your first product!'}
          </div>
        )}
      </div>
    </div>
  )
}