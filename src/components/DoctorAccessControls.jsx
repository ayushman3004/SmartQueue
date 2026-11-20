import { useState } from 'react'
import { changeDoctorAccess, checkDoctorDelivery } from '../api/doctor.api'
import { toast } from 'react-hot-toast'

export default function DoctorAccessControls({ businessId, staffId, doctors, onUpdate }) {
  const [busy, setBusy] = useState(false)
  const record = doctors.find(doctor => doctor.staffId === staffId)
  if (!record) return null
  async function change(action) {
    if ((action === 'revoke' || record.status === 'ACTIVE') && !window.confirm(action === 'revoke' ? 'Revoke this doctor’s dashboard access?' : 'Replace this doctor’s password and sign out their current sessions?')) return
    setBusy(true)
    try {
      const { data } = await changeDoctorAccess(businessId, staffId, action)
      if (data.data?.delivery === 'FAILED') toast.error('Invitation email failed. Retry after checking email delivery.')
      else toast.success(action === 'revoke' ? 'Access revoked.' : 'Email provider accepted the invitation.')
      await onUpdate()
    } catch (error) { toast.error(error.response?.data?.message || 'Could not update doctor access.') }
    finally { setBusy(false) }
  }

  async function checkDelivery() {
    setBusy(true)
    try {
      await checkDoctorDelivery(businessId, staffId)
      await onUpdate()
    } catch (error) { toast.error(error.response?.data?.message || 'Could not check email delivery.') }
    finally { setBusy(false) }
  }

  const delivery = {
    SENT: 'Email accepted for sending',
    DELIVERED: 'Accepted by recipient’s mail server',
    BOUNCED: 'Email bounced. Check the address or use another mailbox.',
    DELAYED: 'Email delivery delayed',
    FAILED: 'Email could not be sent',
  }[record.delivery]

  return <div className="space-y-2 border-t border-zinc-200 pt-3 text-xs">
    <p className="break-all">{record.email || 'Email missing'} · {record.doctorId || 'Registration ID missing'}</p>
    <p>{record.status === 'ACTIVE' ? (record.mustChangePassword ? 'Invited · password change pending' : 'Access active') : record.status === 'REVOKED' ? 'Access revoked' : 'Not invited'}</p>
    {delivery && <p role="status">{delivery}</p>}
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={busy || !record.email || !record.doctorId} onClick={() => change('invite')} className="font-bold text-teal-800 underline disabled:opacity-50">{record.status === 'ACTIVE' ? 'Reissue login' : 'Send invitation'}</button>
      {record.canCheckDelivery && <button type="button" disabled={busy} onClick={checkDelivery} className="font-bold text-teal-800 underline">Check email delivery</button>}
      {record.status === 'ACTIVE' && <button type="button" disabled={busy} onClick={() => change('revoke')} className="font-bold text-rose-800 underline">Revoke access</button>}
    </div>
  </div>
}
