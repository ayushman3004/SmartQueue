import { useDialog } from '../hooks/useDialog'
import NotificationCenter from '../components/NotificationCenter'
import AdminWorkspaceSwitcher from '../components/AdminWorkspaceSwitcher'
import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { signin } from '../api/auth.api'
import { changeDoctorPassword, doctorVisitAction, getDoctorDashboard, getPrescriptionNotification, savePrescription } from '../api/doctor.api'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import Prescriptions from '../components/Prescriptions'
import { prescriptionFields, usePrescriptions } from '../hooks/usePrescriptions'
import '../styles/business-admission.css'

const notificationText = {
  queued: 'WhatsApp notification queued.',
  pending: 'WhatsApp notification queued.',
  claimed: 'WhatsApp notification queued.',
  sending: 'Sending WhatsApp notification.',
  accepted: 'WhatsApp accepted the notification.',
  sent: 'WhatsApp notification sent.',
  delivered: 'WhatsApp notification delivered.',
  read: 'WhatsApp notification read.',
  skipped: 'WhatsApp notification was skipped.',
  failed: 'WhatsApp notification could not be delivered.',
  unknown: 'WhatsApp delivery could not be confirmed.',
  disabled: 'WhatsApp notifications are disabled.',
}

const errorText = error => error.response?.data?.message || 'Unable to complete this action. Please retry.'
const button = 'rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 disabled:opacity-50'
const panel = 'business-surface space-y-4 rounded-3xl border border-zinc-200 bg-white p-5 sm:p-7'

export function DoctorLogin() {
  const { user, logIn } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (['doctor', 'admin'].includes(user?.role)) return <Navigate to="/doctor/dashboard" replace />
  return <main className="admission w-full max-w-lg mx-auto py-12">
    <img src="/serveq-logo.png" alt="ServeQ" className="h-8 w-auto" />
    <h1>Doctor sign in</h1>
    <form onSubmit={async event => {
      event.preventDefault()
      setBusy(true)
      setError('')
      try {
        const form = Object.fromEntries(new FormData(event.currentTarget))
        const { data } = await signin({ ...form, requiredRole: 'doctor' })
        logIn(data.data.user)
        navigate('/doctor/dashboard', { replace: true })
      } catch (failure) { setError(errorText(failure)) }
      finally { setBusy(false) }
    }}>
      <label>Doctor email<input type="email" name="email" required autoComplete="username" /></label>
      <label>Password<input type="password" name="password" required autoComplete="current-password" /></label>
      {error && <p role="alert">{error}</p>}
      <button className="admission-primary" disabled={busy}>Sign in</button>
    </form>
    <Link to="/support">Get help</Link>
  </main>
}

function DoctorPassword() {
  const { logIn, logOut } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <main className="admission w-full max-w-lg mx-auto py-12">
    <h1>Change your temporary password</h1>
    <p>Use at least eight characters, including uppercase and lowercase letters, a number, and a symbol.</p>
    <form onSubmit={async event => {
      event.preventDefault()
      setBusy(true)
      setError('')
      try {
        const { data } = await changeDoctorPassword(Object.fromEntries(new FormData(event.currentTarget)))
        logIn(data.data.user)
      } catch (failure) { setError(errorText(failure)) }
      finally { setBusy(false) }
    }}>
      <label>Current password<input name="currentPassword" type="password" required autoComplete="current-password" /></label>
      <label>New password<input name="newPassword" type="password" required minLength={8} maxLength={128} autoComplete="new-password" /></label>
      {error && <p role="alert">{error}</p>}
      <button className="admission-primary" disabled={busy}>Save password</button>
    </form>
    <button type="button" onClick={() => logOut()}>Sign out</button>
  </main>
}

function DoctorWorkspace() {
  const { socket, joinRoom, leaveRoom } = useSocket()
  const { user, logOut } = useAuth()
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [visit, setVisit] = useState(null)
  const prescriptionDialog = useDialog(Boolean(visit), () => setVisit(null))
  const [recentPrescription, setRecentPrescription] = useState(null)
  const recentPrescriptionId = recentPrescription?.id
  const notificationPending = ['queued', 'pending', 'claimed', 'sending'].includes(recentPrescription?.status)
  useEffect(() => {
    if (!recentPrescriptionId || !notificationPending) return
    let active = true
    const timer = setInterval(async () => {
      try {
        const { data } = await getPrescriptionNotification(recentPrescriptionId)
        if (active) setRecentPrescription({ id: recentPrescriptionId, status: data.data.status })
      } catch { /* Keep the save confirmation visible during a status outage. */ }
    }, 5000)
    return () => { active = false; clearInterval(timer) }
  }, [recentPrescriptionId, notificationPending])
  const [revision, setRevision] = useState(0)
  const [extension, setExtension] = useState(5)
  const prescriptions = usePrescriptions(user._id, revision)
  const refresh = useCallback(async () => {
    try {
      const response = await getDoctorDashboard()
      setData(response.data.data)
      setLoadError('')
    } catch (failure) { setLoadError(errorText(failure)); setData(null) }
  }, [])
  useEffect(() => {
    void refresh()
    const timer = setInterval(refresh, 10000)
    return () => clearInterval(timer)
  }, [refresh])
  const clinicId = data?.clinic._id
  useEffect(() => {
    if (!clinicId || !socket) return
    const reconnect = () => { joinRoom(clinicId); void refresh() }
    const queueChanged = event => { if (String(event?.businessId) === clinicId) void refresh() }
    const bookingsChanged = () => { void refresh() }
    joinRoom(clinicId)
    socket.on('connect', reconnect)
    socket.on('queue:updated', queueChanged)
    socket.on('bookings:updated', bookingsChanged)
    return () => {
      leaveRoom(clinicId)
      socket.off('connect', reconnect)
      socket.off('queue:updated', queueChanged)
      socket.off('bookings:updated', bookingsChanged)
    }
  }, [clinicId, joinRoom, leaveRoom, refresh, socket])

  async function act(kind, id, action, serviceStep) {
    if (action === 'payment' && !window.confirm('Record this payment as received at the counter?')) return
    setBusy(true)
    setError('')
    try { await doctorVisitAction(kind, id, action, { minutes: extension, serviceStep }); await refresh() }
    catch (failure) { setError(errorText(failure)) }
    finally { setBusy(false) }
  }

  function visitCard(row, kind) {
    const queue = kind === 'queue'
    const id = queue ? row.userId?._id : row._id
    const booking = queue ? row.bookingId : row._id
    const record = prescriptions?.records.find(item => String(item.booking) === String(booking))
    const controls = row.status !== 'completed' && id
    const active = ['serving', 'in-progress'].includes(row.status)
    const serviceStep = row.serviceStep ?? 0
    const showServiceProgress = data.clinic.hasServiceSequencing && active && row.services?.length > 1
    return <article key={row._id} className="space-y-3 rounded-2xl border border-zinc-200 p-4">
      <div className="flex flex-wrap justify-between gap-2">
        <h3 className="font-bold">{row.userId?.name || 'Patient'}</h3>
        <span className="text-sm capitalize text-emerald-900">{row.status?.replaceAll('_', ' ')}</span>
      </div>
      <p className="break-words text-sm text-zinc-600">{[row.userId?.email, row.userId?.phone].filter(value => value && !value.endsWith('@accounts.serveq.invalid')).join(' · ')}</p>
      <p className="text-sm">{row.walkIn && 'Walk-in · '}{row.serviceType} · {row.serviceTime || row.duration} min · Payment {row.paymentStatus}</p>
      {showServiceProgress && <p className="text-sm font-semibold">Service {serviceStep + 1} of {row.services.length} · {row.services[serviceStep]?.name}</p>}
      {!queue && <p className="text-sm text-zinc-600">{new Date(row.startTime).toLocaleString()}</p>}
      <div className="flex flex-wrap gap-2">
        {controls && showServiceProgress && serviceStep < row.services.length - 1 && <button type="button" className={button} disabled={busy} onClick={() => act(kind, id, 'advance-service', serviceStep)}>Start next service</button>}
        {controls && active && <button type="button" className={button} disabled={busy} onClick={() => act(kind, id, queue ? 'next' : 'complete')}>{queue ? 'Complete and call next' : 'Complete consultation'}</button>}
        {controls && queue && row.walkIn && row.status === 'waiting' && data.queue[0] === row && <button type="button" className={button} disabled={busy} onClick={() => act(kind, id, 'start')}>Call next patient</button>}
        {controls && !queue && !row.walkIn && ['waiting', 'scheduled', 'confirmed'].includes(row.status) && <button type="button" className={button} disabled={busy} onClick={() => act(kind, id, 'start')}>Start consultation</button>}
        {controls && <button type="button" className={button} disabled={busy} onClick={() => act(kind, id, 'extend')}>Extend {extension} min</button>}
        {controls && row.paymentStatus === 'pending' && (!row.paymentMethod || ['counter', 'PAY_AT_BUSINESS'].includes(row.paymentMethod)) && <button type="button" className={button} disabled={busy} onClick={() => act(kind, id, 'payment')}>Record counter payment</button>}
        {booking && !record && (active || row.status === 'completed') && <button type="button" className={button} onClick={() => { setVisit({ booking, name: row.userId?.name || 'Patient' }); setError('') }}>Write prescription</button>}
        {record && <Prescriptions result={prescriptions} bookingId={booking} compact />}
      </div>
    </article>
  }

  return <div className={user.role === 'admin' ? 'admin-doctor-layout' : undefined}>
    {user.role === 'admin' && <aside className="admin-doctor-sidebar"><AdminWorkspaceSwitcher /></aside>}
    <main className="business-page mx-auto w-full max-w-6xl space-y-5 px-4 py-8 sm:px-8">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <img src="/serveq-logo.png" alt="ServeQ" className="h-8 w-auto" />
      <div className="flex items-center gap-3"><NotificationCenter /><button type="button" className={button} onClick={() => logOut()}>Sign out</button></div>
    </header>
    <div><h1 className="text-3xl font-bold">Doctor dashboard</h1><p className="text-zinc-600">{data && `${data.clinic.name} · ${data.doctor.name} · ${data.doctor.doctorId}`}</p></div>
    {loadError && <p role="alert">{loadError}</p>}
    {!data && !loadError && <p role="status">Loading assigned patients…</p>}
    {data && <>
      {error && <p role="alert" className="text-red-800">{error}</p>}
      <label className="flex items-center gap-2 text-sm">Extend consultation by
        <select className={button} value={extension} onChange={event => setExtension(Number(event.target.value))}>
          {[5, 10, 15, 30, 60].map(value => <option key={value} value={value}>{value} minutes</option>)}
        </select>
      </label>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className={panel}><h2 className="text-xl font-bold">My live queue</h2>{data.queue.length ? data.queue.map(row => visitCard(row, 'queue')) : <p>No patients assigned in the queue.</p>}</section>
        <section className={panel}><h2 className="text-xl font-bold">My appointments and visits</h2>{data.bookings.filter(row => !data.queue.some(entry => String(entry.bookingId) === String(row._id))).map(row => visitCard(row, 'bookings'))}{!data.bookings.length && <p>No appointments assigned.</p>}</section>
      </div>
      {recentPrescription && <p role="status">Prescription saved. {notificationText[recentPrescription.status]}</p>}
      <Prescriptions result={prescriptions} />
    </>}
    {data && visit && <div className="app-modal-layer fixed inset-0 z-100 flex items-center justify-center bg-black/40 p-4">
      <form ref={prescriptionDialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Write prescription" className={`app-dialog ${panel} max-h-[90dvh] w-full max-w-xl overflow-y-auto`} onSubmit={async event => {
        event.preventDefault()
        setBusy(true)
        setError('')
        try {
          const { data: response } = await savePrescription({ ...Object.fromEntries(new FormData(event.currentTarget)), bookingId: visit.booking })
          setRecentPrescription({ id: response.data.prescription._id, status: response.data.whatsappNotification })
          setVisit(null)
          setRevision(value => value + 1)
        } catch (failure) { setError(errorText(failure)) }
        finally { setBusy(false) }
      }}>
        <h2 className="text-xl font-bold">Prescription for {visit.name}</h2>
        {prescriptionFields.map(([key, title]) => <label className="block font-medium" key={key}>{title}
          <textarea name={key} required={key === 'diagnosis'} rows={3} maxLength={key === 'followUp' ? 2000 : 10000} className="mt-1 block w-full rounded-xl border border-zinc-300 p-3 font-normal" />
        </label>)}
        {error && <p role="alert">{error}</p>}
        <label className="block font-medium">Follow-up date (optional)
          <input type="date" name="followUpDate" className="mt-1 block w-full rounded-xl border border-zinc-300 p-3 font-normal" />
          <span className="mt-1 block text-sm font-normal text-zinc-600">A date schedules a reminder for the patient. Dates use India Standard Time.</span>
        </label>
        <div className="flex gap-2"><button disabled={busy} className={button}>Save prescription</button><button type="button" className={button} disabled={busy} onClick={() => { setVisit(null); setError('') }}>Cancel</button></div>
      </form>
    </div>}
  </main>
  </div>
}

export default function DoctorPage() {
  const { user } = useAuth()
  return user?.role === 'doctor' && user?.doctorAccess?.mustChangePassword ? <DoctorPassword /> : <DoctorWorkspace />
}
