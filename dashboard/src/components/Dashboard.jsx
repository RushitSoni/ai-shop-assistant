import { useState } from 'react'
import Inventory from './Inventory'
import Orders from './Orders'
import Ledger from './Ledger'
import Analytics from './Analytics'

const tabs = [
  { id: 'inventory', label: '📦 Inventory' },
  { id: 'orders', label: '🛒 Orders' },
  { id: 'ledger', label: '📒 Ledger' },
  { id: 'analytics', label: '📈 Analytics' },
]

export default function Dashboard({ shop, onLogout }) {
  const [activeTab, setActiveTab] = useState('inventory')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏪</span>
          <div>
            <h1 className="font-bold text-gray-800">{shop.shop_name || 'My Shop'}</h1>
            <p className="text-xs text-green-500">● Live</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="text-sm text-gray-500 hover:text-red-500 transition-colors"
        >
          Logout
        </button>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-4 flex gap-1 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`py-3 px-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <main className="p-4 max-w-6xl mx-auto">
        {activeTab === 'inventory' && <Inventory shopId={shop.id} />}
        {activeTab === 'orders' && <Orders shopId={shop.id} />}
        {activeTab === 'ledger' && <Ledger shopId={shop.id} />}
        {activeTab === 'analytics' && <Analytics shopId={shop.id} />}
      </main>
    </div>
  )
}