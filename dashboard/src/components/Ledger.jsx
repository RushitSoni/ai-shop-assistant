import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Ledger({ shopId }) {
  const [ledger, setLedger] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ customer_name: '', amount: '', type: 'credit', note: '' })
  const [saving, setSaving] = useState(false)
  const [expandedCustomer, setExpandedCustomer] = useState(null)
  const [clearConfirm, setClearConfirm] = useState(null)

  useEffect(() => {
    fetchLedger()
    const sub = supabase
      .channel('ledger-crud')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ledger' }, fetchLedger)
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [shopId])

  const fetchLedger = async () => {
    const { data } = await supabase
      .from('ledger')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
    setLedger(data || [])
    setLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)

    await supabase.from('ledger').insert({
      shop_id: shopId,
      customer_name: form.customer_name.trim(),
      amount: Number(form.amount),
      type: form.type,
      note: form.note || (form.type === 'credit' ? 'Dashboard se baaki add kiya' : 'Dashboard se payment add kiya')
    })

    setForm({ customer_name: '', amount: '', type: 'credit', note: '' })
    setShowForm(false)
    setSaving(false)
    fetchLedger()
  }

  const handleDeleteEntry = async (id) => {
    await supabase.from('ledger').delete().eq('id', id)
    fetchLedger()
  }

  const handleClearCustomer = async (customerName) => {
    await supabase
      .from('ledger')
      .delete()
      .eq('shop_id', shopId)
      .eq('customer_name', customerName)
    setClearConfirm(null)
    setExpandedCustomer(null)
    fetchLedger()
  }

  // Group by customer
  const balances = {}
  ledger.forEach(l => {
    if (!balances[l.customer_name]) balances[l.customer_name] = { total: 0, entries: [] }
    balances[l.customer_name].total += l.type === 'credit' ? Number(l.amount) : -Number(l.amount)
    balances[l.customer_name].entries.push(l)
  })

  const filteredCustomers = Object.entries(balances)
    .filter(([name]) => name.toLowerCase().includes(search.toLowerCase()))
    .sort(([_, a], [__, b]) => b.total - a.total)

  const totalOutstanding = Object.values(balances)
    .reduce((sum, b) => sum + (b.total > 0 ? b.total : 0), 0)

  if (loading) return <div className="text-center py-10 text-gray-400">Loading...</div>

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Total Outstanding</p>
          <p className="text-2xl font-bold text-red-500">₹{totalOutstanding.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Customers with Baaki</p>
          <p className="text-2xl font-bold text-gray-800">
            {filteredCustomers.filter(([_, b]) => b.total > 0).length}
          </p>
        </div>
      </div>

      {/* Search + Add */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="🔍 Search customer..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button
          onClick={() => setShowForm(true)}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium"
        >
          + Add
        </button>
      </div>

      {/* Add Entry Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold text-gray-800 mb-4">➕ Add Ledger Entry</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Customer Name *</label>
                <input
                  type="text"
                  value={form.customer_name}
                  onChange={e => setForm({ ...form, customer_name: e.target.value })}
                  placeholder="e.g. Rahul"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Type *</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, type: 'credit' })}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      form.type === 'credit'
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    📒 Baaki (Credit)
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, type: 'payment' })}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      form.type === 'payment'
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    💰 Payment
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Amount (₹) *</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Note (optional)</label>
                <input
                  type="text"
                  value={form.note}
                  onChange={e => setForm({ ...form, note: e.target.value })}
                  placeholder="e.g. Diwali purchase"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-green-500 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Add Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clear Confirm Modal */}
      {clearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold text-gray-800 mb-2">Clear All Records?</h2>
            <p className="text-sm text-gray-500 mb-4">
              Delete all ledger entries for <strong>{clearConfirm}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setClearConfirm(null)}
                className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleClearCustomer(clearConfirm)}
                className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-medium"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer list */}
      <div className="space-y-2">
        {filteredCustomers.map(([name, data]) => (
          <div key={name} className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Customer header */}
            <div
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
              onClick={() => setExpandedCustomer(expandedCustomer === name ? null : name)}
            >
              <div>
                <p className="font-medium text-gray-800">👤 {name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{data.entries.length} transactions</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className={`text-lg font-bold ${data.total > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    ₹{Math.abs(data.total).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400">
                    {data.total > 0 ? 'Baaki hai' : '✅ Saaf'}
                  </p>
                </div>
                <span className="text-gray-400">{expandedCustomer === name ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* Expanded entries */}
            {expandedCustomer === name && (
              <div className="border-t border-gray-100">
                {data.entries.map(entry => (
                  <div key={entry.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50">
                    <div>
                      <span className={`text-xs px-2 py-0.5 rounded-full mr-2 ${
                        entry.type === 'credit' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                      }`}>
                        {entry.type === 'credit' ? 'Baaki' : 'Payment'}
                      </span>
                      <span className="text-xs text-gray-400">{entry.note}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`font-medium text-sm ${entry.type === 'credit' ? 'text-red-500' : 'text-green-500'}`}>
                        {entry.type === 'credit' ? '+' : '-'}₹{entry.amount}
                      </span>
                      <button
                        onClick={() => handleDeleteEntry(entry.id)}
                        className="text-gray-300 hover:text-red-500 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
                <div className="p-3 flex gap-2">
                  <button
                    onClick={() => { setForm({ ...form, customer_name: name, type: 'payment' }); setShowForm(true) }}
                    className="flex-1 bg-green-50 text-green-600 text-xs py-2 rounded-lg hover:bg-green-100"
                  >
                    + Add Payment
                  </button>
                  <button
                    onClick={() => setClearConfirm(name)}
                    className="flex-1 bg-red-50 text-red-600 text-xs py-2 rounded-lg hover:bg-red-100"
                  >
                    🗑️ Clear All
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {filteredCustomers.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            {search ? 'No customer found' : 'No ledger entries yet'}
          </div>
        )}
      </div>
    </div>
  )
}