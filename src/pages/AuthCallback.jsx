import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getMe } from '../api/auth.api'
import { Skeleton } from '../components/Skeleton'

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
          navigate('/customers')
        }
      })
      .catch(() => {
        const redirect = localStorage.getItem('auth_redirect')
        localStorage.removeItem('auth_redirect')
        navigate(redirect === '/business' ? '/business' : '/login')
      })
  }, [logIn, navigate, params])

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-64px)] bg-[#F7FCF9]">
      <div className="w-full max-w-sm p-8 rounded-3xl bg-white border border-zinc-200/80 shadow-xl text-center space-y-5">
        <Skeleton className="w-16 h-16 rounded-full mx-auto" />
        <div className="space-y-2">
          <Skeleton className="w-40 h-5 mx-auto rounded-md" />
          <Skeleton className="w-56 h-3.5 mx-auto rounded-md" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Synchronizing Identity...</p>
      </div>
    </div>
  )
}
