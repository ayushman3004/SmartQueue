import { useNavigate } from 'react-router-dom'

export function useCustomerService() {
  const navigate = useNavigate()
  return { serviceCategory: 'clinic', navigate }
}
