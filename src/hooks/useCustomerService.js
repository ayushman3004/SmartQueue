import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getBusiness } from '../api/business.api'
import { customerServicePath, normalizeServiceCategory, resolveCustomerService } from '../utils/customerService'

export function useCustomerService(businessId) {
  const { user } = useAuth()
  const location = useLocation()
  const routerNavigate = useNavigate()
  const storageKey = `customer-service:${user?._id || user?.id}`
  const requested = new URLSearchParams(location.search).get('category')
  const selected = resolveCustomerService(requested, sessionStorage.getItem(storageKey))
  const [linked, setLinked] = useState(null)
  const serviceCategory = selected || (linked && linked.id === businessId ? linked.category : null)
  const resolvingService = !selected && Boolean(businessId) && linked?.id !== businessId

  // A direct venue link without an existing choice can establish its service.
  useEffect(() => {
    if (selected || !businessId) return
    let current = true
    getBusiness(businessId).then(res => {
      if (current) setLinked({ id: businessId, category: normalizeServiceCategory(res.data?.data?.business?.category) })
    }).catch(() => {
      if (current) setLinked({ id: businessId, category: null })
    })
    return () => { current = false }
  }, [selected, businessId])

  useEffect(() => {
    if (!serviceCategory) return
    sessionStorage.setItem(storageKey, serviceCategory)
    if (!normalizeServiceCategory(requested)) {
      const path = `${location.pathname}${location.search}${location.hash}`
      const scopedPath = customerServicePath(path, serviceCategory)
      if (scopedPath !== path) routerNavigate(scopedPath, { replace: true })
    }
  }, [serviceCategory, storageKey, requested, location.pathname, location.search, location.hash, routerNavigate])

  const navigate = useCallback((to, options) => {
    routerNavigate(customerServicePath(to, serviceCategory), options)
  }, [routerNavigate, serviceCategory])

  return { serviceCategory, resolvingService, navigate }
}
