import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const STATUS_COLORS = {
  pending: 'bg-orange-100 text-orange-600',
  ready: 'bg-blue-100 text-blue-600',
  delivered: 'bg-green-100 text-green-600',
  cancelled: 'bg-red-100 text-red-600'
}

export default function Orders({ shopId }) {
  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ customer_name: '', product_id: '', quantity: 1 })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchOrders()
    fetchProducts()
    const sub = supabase
      .channel('orders-crud')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [shopId])

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(50)
    setOrders(data || [])
    setLoading(false)
  }

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('shop_id', shopId)
      .order('name')
    setProducts(data || [])
  }

  const handleAddOrder = async (e) => {
    e.preventDefault()
    setSaving(true)

    const product = products.find(p => p.id === form.product_id)
    if (!product) return

    const qty = Number(form.quantity)
    const total = (product.price || 0) * qty

    const { data: order } = await supabase
      .from('orders')
      .insert({
        shop_id: shopId,
        customer_name: form.customer_name || 'Walk-in',
        items_json: [{ name: product.name, qty, unit: product.unit, price: product.price || 0 }],
        total_amount: total,
        status: 'pending'
      })
      .select()
      .single()

    // Deduct stock
    await supabase
      .from('products')
      .update({ quantity: product.quantity - qty, updated_at: new Date() })
      .eq('id', product.id)

    setForm({ customer_name: '', product_id: '', quantity: 1 })
    setShowForm(false)
    setSaving(false)
    fetchOrders()
  }

  const updateStatus = async (orderId, status) => {
    await supabase.from('orders').update({ status }).eq('id', orderId)
    fetchOrders()
  }

  const cancelOrder = async (order) => {
    // Restore stock
    for (const item of order.items_json || []) {
      const product = products.find(p => p.name === item.name)
      if (product) {
        await supabase
          .from('products')
          .update({ quantity: product.quantity + item.qty, updated_at: new Date() })
          .eq('id', product.id)
      }
    }
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id)
    fetchOrders()
  }

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)
  const totalRevenue = orders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + Number(o.total_amount), 0)

  if (loading) return <div className="text-center py-10 text-gray-400">Loading...</div>

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Total Orders</p>
          <p className="text-2xl font-bold text-gray-800">{orders.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Revenue</p>
          <p className="text-2xl font-bold text-green-600">₹{totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Pending</p>
          <p className="text-2xl font-bold text-orange-500">
            {orders.filter(o => o.status === 'pending').length}
          </p>
        </div>
      </div>

      {/* Filter + Add */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'pending', 'ready', 'delivered', 'cancelled'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === s ? 'bg-green-500 text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <button
          onClick={() => setShowForm(true)}
          className="ml-auto bg-green-500 hover:bg-green-600 text-white px-4 py-1.5 rounded-full text-xs font-medium"
        >
          + New Order
        </button>
      </div>

      {/* Add Order Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold text-gray-800 mb-4">➕ New Order</h2>
            <form onSubmit={handleAddOrder} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Customer Name</label>
                <input
                  type="text"
                  value={form.customer_name}
                  onChange={e => setForm({ ...form, customer_name: e.target.value })}
                  placeholder="Walk-in"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Product *</label>
                <select
                  value={form.product_id}
                  onChange={e => setForm({ ...form, product_id: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                >
                  <option value="">Select product...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.quantity} {p.unit} @ ₹{p.price || 0}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Quantity *</label>
                <input
                  type="number"
                  value={form.quantity}
                  onChange={e => setForm({ ...form, quantity: e.target.value })}
                  min="1"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>
              {form.product_id && (
                <div className="bg-green-50 rounded-lg p-3 text-sm text-green-700">
                  💰 Total: ₹{(products.find(p => p.id === form.product_id)?.price || 0) * Number(form.quantity)}
                </div>
              )}
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
                  {saving ? 'Placing...' : 'Place Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Orders list */}
      <div className="space-y-2">
        {filtered.map(order => (
          <div key={order.id} className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-gray-400">#{order.id.slice(0, 8).toUpperCase()}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status] || ''}`}>
                    {order.status}
                  </span>
                </div>
                <p className="font-medium text-gray-800 mt-1">👤 {order.customer_name}</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {order.items_json?.map(i => `${i.qty} ${i.name}`).join(', ')}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-800">₹{order.total_amount}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(order.created_at).toLocaleDateString('en-IN')}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            {order.status !== 'cancelled' && order.status !== 'delivered' && (
              <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100">
                {order.status === 'pending' && (
                  <button
                    onClick={() => updateStatus(order.id, 'ready')}
                    className="flex-1 bg-blue-50 text-blue-600 text-xs py-1.5 rounded-lg hover:bg-blue-100"
                  >
                    Mark Ready
                  </button>
                )}
                {order.status === 'ready' && (
                  <button
                    onClick={() => updateStatus(order.id, 'delivered')}
                    className="flex-1 bg-green-50 text-green-600 text-xs py-1.5 rounded-lg hover:bg-green-100"
                  >
                    Mark Delivered
                  </button>
                )}
                <button
                  onClick={() => cancelOrder(order)}
                  className="flex-1 bg-red-50 text-red-600 text-xs py-1.5 rounded-lg hover:bg-red-100"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-400">No orders found</div>
        )}
      </div>
    </div>
  )
}