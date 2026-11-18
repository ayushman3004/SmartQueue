import { Check } from 'lucide-react'

export default function BusinessSetupProgress({ current }) {
  return <ol className="business-setup-progress" aria-label="Business registration progress">
    {['Verify email', 'Choose a plan', 'Set up business'].map((label, index) => <li key={label} aria-current={current === index + 1 ? 'step' : undefined} data-complete={current > index + 1}><span>{current > index + 1 ? <Check size={12} /> : index + 1}</span><span>{label}</span></li>)}
  </ol>
}
