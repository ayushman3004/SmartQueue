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
        const loggedUser = res.data.data.user
        logIn(loggedUser, token)
        const redirect = localStorage.getItem('auth_redirect')
        localStorage.removeItem('auth_redirect')
        if (redirect) {
          navigate(redirect)
        } else if (loggedUser?.role === 'owner') {
          navigate('/business')
        } else {
          navigate('/')
        }
      })
      .catch(() => {
        const redirect = localStorage.getItem('auth_redirect')
        localStorage.removeItem('auth_redirect')
        navigate(redirect === '/business' ? '/business' : '/login')
      })
  }, [])

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-64px)] bg-slate-50">
      <div className="text-center space-y-6">
        <div className="w-16 h-16 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto shadow-xl" />
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Synchronizing Identity...</p>
      </div>
    </div>
  )
}
