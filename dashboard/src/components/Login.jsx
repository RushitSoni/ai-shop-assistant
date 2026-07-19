import { useState } from 'react'

// const BACKEND_URL = 'https://squeegee-hypnotist-scarring.ngrok-free.dev'
const BACKEND_URL = 'https://your-render-url.onrender.com'

export default function Login({ onLogin }) {
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState('phone') // phone | otp
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSendOTP = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${BACKEND_URL}/webhook/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong')
      } else {
        setSuccess('OTP sent on WhatsApp! Check your messages.')
        setStep('otp')
      }
    } catch (err) {
      console.error("Fetch Error:", err);
      setError('Cannot connect to server. Make sure backend is running!')
    }
    setLoading(false)
  }

  const handleVerifyOTP = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${BACKEND_URL}/webhook/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: otp })
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Invalid OTP')
      } else {
        onLogin(data.shop)
      }
    } catch (err) {
      setError('Cannot connect to server!')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🏪</div>
          <h1 className="text-2xl font-bold text-gray-800">WhatsApp Shop</h1>
          <p className="text-gray-500 mt-1">Dashboard Login</p>
        </div>

        {step === 'phone' ? (
          <form onSubmit={handleSendOTP} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                WhatsApp Number
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                  +91
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="8320002605"
                  className="flex-1 rounded-r-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>
            </div>

            {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Sending OTP...' : 'Send OTP on WhatsApp →'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div className="bg-green-50 text-green-700 text-sm p-3 rounded-lg">
              ✅ {success}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Enter 6-digit OTP
              </label>
              <input
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value)}
                placeholder="123456"
                maxLength={6}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              />
            </div>

            {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify OTP →'}
            </button>

            <button
              type="button"
              onClick={() => { setStep('phone'); setError(''); setOtp('') }}
              className="w-full text-gray-500 text-sm hover:text-gray-700"
            >
              ← Change number
            </button>
          </form>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          OTP will be sent to your WhatsApp
        </p>
      </div>
    </div>
  )
}