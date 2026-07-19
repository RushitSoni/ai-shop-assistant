import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

export default function Analytics({ shopId }) {
  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [shopId])

  const fetchData = async () => {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    const [ordersRes, productsRes] = await Promise.all([
      supabase.from('orders').select('*').eq('shop_id', shopId).gte('created_at', weekAgo.toISOString()),
      supabase.from('products').select('*').eq('shop_id', shopId)
    ])

    setOrders(ordersRes.data || [])
    setProducts(productsRes.data || [])
    setLoading(false)
  }

  // Sales by product
  const salesByProduct = {}
  orders.forEach(order => {
    (order.items_json || []).forEach(item => {
      if (!salesByProduct[item.name]) salesByProduct[item.name] = { qty: 0, revenue: 0 }
      salesByProduct[item.name].qty += item.qty
      salesByProduct[item.name].revenue += (item.price || 0) * item.qty
    })
  })

  const productChartData = Object.entries(salesByProduct)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6)

  // Daily sales last 7 days
  const dailySales = {}
  for (let i = 6; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const key = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    dailySales[key] = 0
  }

  orders.forEach(order => {
    const key = new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    if (dailySales[key] !== undefined) dailySales[key] += Number(order.total_amount)
  })

  const dailyChartData = Object.entries(dailySales).map(([date, revenue]) => ({ date, revenue }))

  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total_amount), 0)

  if (loading) return <div className="text-center py-10 text-gray-400">Loading...</div>

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Revenue (7 days)</p>
          <p className="text-2xl font-bold text-green-600">₹{totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">Orders (7 days)</p>
          <p className="text-2xl font-bold text-gray-800">{orders.length}</p>
        </div>
      </div>

      {/* Daily revenue chart */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <h3 className="text-sm font-medium text-gray-700 mb-4">📈 Daily Revenue (Last 7 Days)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={dailyChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(val) => [`₹${val}`, 'Revenue']} />
            <Bar dataKey="revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top products */}
      {productChartData.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-medium text-gray-700 mb-4">🏆 Top Products by Revenue</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={productChartData}
                dataKey="revenue"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {productChartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(val) => [`₹${val}`, 'Revenue']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Product sales table */}
      {productChartData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Product</th>
                <th className="text-right px-4 py-3">Qty Sold</th>
                <th className="text-right px-4 py-3">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {productChartData.map((p, i) => (
                <tr key={p.name} className="hover:bg-gray-50">
                  <td className="px-4 py-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    {p.name}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{p.qty}</td>
                  <td className="px-4 py-3 text-right font-medium text-green-600">₹{p.revenue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {productChartData.length === 0 && (
        <div className="bg-white rounded-xl p-8 text-center text-gray-400 shadow-sm">
          No sales data yet. Place some orders first!
        </div>
      )}
    </div>
  )
}