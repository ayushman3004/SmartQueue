import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getMe } from '../api/auth.api'

export default function AuthCallback() {
  const [params] = useSearchParams()
  const { logIn } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const token = params.get('token')
    if (!token) { navigate('/login'); return }
    localStorage.setItem('token', token)
    getMe()
      .then(res => {
        logIn(res.data.data.user, token)
        navigate('/')
      })
      .catch(() => navigate('/login'))
  }, [])

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-2 border-[var(--cyan)] border-t-transparent rounded-full animate-spin mx-auto" />
        <p style={{ color: 'var(--text-secondary)' }}>Authenticating with Google...</p>
      </div>
    </div>
  )
}
