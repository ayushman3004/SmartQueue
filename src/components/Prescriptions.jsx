import { prescriptionFields } from '../hooks/usePrescriptions'
import { useRef, useState } from 'react'
import { downloadPrescription } from '../api/doctor.api'
import NotificationStatus from '../modules/notification/NotificationStatus'
import { useInlineFeedback } from '../modules/notification/useNotificationFeedback'
import { ArrowUpRight, FileText } from 'lucide-react'

export default function Prescriptions({ result, bookingId, compact = false, title = 'Prescriptions' }) {
  const dialog = useRef(null)
  const [selected, setSelected] = useState(null)
  const [feedback, feedbackScope] = useInlineFeedback(Boolean(selected))
  const records = (result?.records || []).filter(record => !bookingId || String(record.booking) === String(bookingId))
  if (compact && (!bookingId || !records.length)) return null
  return <section aria-label={title} className={compact ? 'flex flex-wrap gap-2' : 'customer-surface rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 text-left'}>
    {!compact && <div className="flex items-start gap-3.5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#c1d5c7] bg-[#e6f0e8] text-[#315b45]"><FileText className="h-5 w-5" aria-hidden="true" /></span>
      <div><h2 className="text-lg font-black text-[#153c2b]">{title}</h2><p className="mt-1 text-sm text-[#617168]">View and download saved prescriptions.</p></div>
    </div>}
    {!compact && !records.length && <div className="mt-5 rounded-2xl border border-dashed border-[#c1d5c7] bg-[#f8fbf8] px-4 py-5 text-sm text-[#52675b]" role="status">
      {result?.error || (result ? (title === 'Saved prescriptions' ? 'No prescriptions yet. Prescriptions saved by your doctor will appear here.' : 'No prescriptions yet.') : 'Loading prescriptions…')}
      {result?.error && <button type="button" onClick={result.retry} className="ml-2 font-bold text-[#315b45] underline">Try again</button>}
    </div>}
    <div className={compact ? 'contents' : 'mt-5 divide-y divide-[#e4eee6] border-t border-[#e4eee6]'}>
      {records.map(record => <button type="button" key={record._id} className={compact ? 'rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900' : 'flex w-full items-center justify-between gap-4 py-4 text-left text-[#153c2b] hover:text-[#315b45]'}
        onClick={() => { setSelected(record); dialog.current.showModal() }}>
        {compact ? 'View prescription' : <><span className="min-w-0"><span className="block break-words text-sm font-bold">{record.clinicName}</span><span className="mt-1 block break-words text-xs font-medium text-[#617168]">{record.doctorName} · {new Date(record.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></span><span className="flex shrink-0 items-center gap-1 text-xs font-bold">View <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></span></>}
      </button>)}
    </div>
    <dialog ref={dialog} onClose={() => setSelected(null)} aria-label="Prescription preview" className="m-auto max-h-[88dvh] w-[min(92vw,42rem)] overflow-y-auto rounded-3xl border border-zinc-200 bg-white p-6 text-zinc-900 backdrop:bg-black/40">
      {selected && <div className="space-y-4 text-left">
        <header className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold">Prescription</h2>
          <button type="button" onClick={() => dialog.current.close()} className="underline">Close</button>
        </header>
        <p>{selected.patientName} · {selected.clinicName}</p>
        <p className="text-sm text-zinc-600">{selected.doctorName} · {selected.doctorId} · {new Date(selected.createdAt).toLocaleDateString()}</p>
        {prescriptionFields.map(([key, title]) => selected[key] && <div key={key}><h3 className="font-semibold">{title}</h3><p className="whitespace-pre-wrap break-words text-sm">{selected[key]}</p></div>)}
        {selected.followUpDate && <p className="text-sm"><strong>Follow-up date</strong> {new Intl.DateTimeFormat(undefined, { dateStyle: "long", timeZone: "UTC" }).format(new Date(selected.followUpDate))}</p>}
        <NotificationStatus scope={feedbackScope} />
        <button type="button" className="rounded-xl bg-emerald-900 px-4 py-2 font-semibold text-white" onClick={() => downloadPrescription(selected._id).catch(() => feedback.error('Could not download the prescription.'))}>Download PDF</button>
      </div>}
    </dialog>
  </section>
}
