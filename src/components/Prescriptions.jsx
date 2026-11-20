import { prescriptionFields } from '../hooks/usePrescriptions'
import { useRef, useState } from 'react'
import { downloadPrescription } from '../api/doctor.api'
import { toast } from 'react-hot-toast'

export default function Prescriptions({ result, bookingId, compact = false }) {
  const dialog = useRef(null)
  const [selected, setSelected] = useState(null)
  const records = (result?.records || []).filter(record => !bookingId || String(record.booking) === String(bookingId))
  if (compact && (!bookingId || !records.length)) return null
  return <section aria-label="Prescriptions" className={compact ? 'flex flex-wrap gap-2' : 'rounded-3xl border border-zinc-200 bg-white p-6 space-y-3'}>
    {!compact && <h2 className="text-xl font-bold">Prescriptions</h2>}
    {!compact && !records.length && <p className="text-sm text-zinc-600">{result?.error || (result ? 'No prescriptions yet.' : 'Loading prescriptions…')}</p>}
    {records.map(record => <button type="button" key={record._id} className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900"
      onClick={() => { setSelected(record); dialog.current.showModal() }}>
      {compact ? 'View prescription' : `${record.clinicName} · ${record.doctorName} · ${new Date(record.createdAt).toLocaleDateString()}`}
    </button>)}
    <dialog ref={dialog} aria-label="Prescription preview" className="m-auto max-h-[88dvh] w-[min(92vw,42rem)] overflow-y-auto rounded-3xl border border-zinc-200 bg-white p-6 text-zinc-900 backdrop:bg-black/40">
      {selected && <div className="space-y-4 text-left">
        <header className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold">Prescription</h2>
          <button type="button" onClick={() => dialog.current.close()} className="underline">Close</button>
        </header>
        <p>{selected.patientName} · {selected.clinicName}</p>
        <p className="text-sm text-zinc-600">{selected.doctorName} · {selected.doctorId} · {new Date(selected.createdAt).toLocaleDateString()}</p>
        {prescriptionFields.map(([key, title]) => selected[key] && <div key={key}><h3 className="font-semibold">{title}</h3><p className="whitespace-pre-wrap break-words text-sm">{selected[key]}</p></div>)}
        <button type="button" className="rounded-xl bg-emerald-900 px-4 py-2 font-semibold text-white" onClick={() => downloadPrescription(selected._id).catch(() => toast.error('Could not download the prescription.'))}>Download PDF</button>
      </div>}
    </dialog>
  </section>
}
