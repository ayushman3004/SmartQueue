import { useEffect, useState } from 'react'
import { getPrescriptions } from '../api/doctor.api'

export const prescriptionFields = [
  ['symptoms', 'Symptoms and findings'], ['diagnosis', 'Diagnosis'],
  ['medications', 'Medications and instructions'], ['investigations', 'Investigations'],
  ['advice', 'Advice'], ['followUp', 'Follow-up'],
]

export function usePrescriptions(accountId, revision = 0) {
  const [result, setResult] = useState(null)
  useEffect(() => {
    if (!accountId) return
    let active = true
    getPrescriptions().then(({ data }) => {
      if (active) setResult({ accountId, records: data.data.prescriptions })
    }).catch(() => {
      if (active) setResult({ accountId, records: [], error: 'Could not load prescriptions.' })
    })
    return () => { active = false }
  }, [accountId, revision])
  return accountId && result?.accountId === accountId ? result : null
}

