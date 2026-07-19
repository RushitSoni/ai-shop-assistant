import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './components/Login'
import Dashboard from './components/Dashboard'

export default function App() {
  const [shop, setShop] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if shop is already logged in via localStorage
    const savedShop = localStorage.getItem('shop')
    if (savedShop) setShop(JSON.parse(savedShop))
    setLoading(false)
  }, [])

  const handleLogin = (shopData) => {
    localStorage.setItem('shop', JSON.stringify(shopData))
    setShop(shopData)
  }

  const handleLogout = () => {
    localStorage.removeItem('shop')
    setShop(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="text-gray-500">Loading...</div>
    </div>
  )

  return shop
    ? <Dashboard shop={shop} onLogout={handleLogout} />
    : <Login onLogin={handleLogin} />
}