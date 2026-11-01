export function Skeleton({ className = '', ...props }) {
  return (
    <div
      className={`skeleton-shimmer rounded-xl ${className}`}
      {...props}
    />
  )
}

/**
 * Skeleton placeholder for a single Business Card in Customer Dashboard
 */
export function BusinessCardSkeleton() {
  return (
    <div className="bg-white rounded-3xl border border-zinc-200/80 p-4 sm:p-5 shadow-xs space-y-4">
      {/* Photo Header */}
      <div className="relative w-full h-44 sm:h-48 rounded-2xl overflow-hidden skeleton-shimmer">
        <div className="absolute top-3 left-3 flex gap-2">
          <Skeleton className="w-16 h-5 rounded-full bg-white/70" />
          <Skeleton className="w-12 h-5 rounded-full bg-white/70" />
        </div>
      </div>

      {/* Title & Info */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="w-3/5 h-5 rounded-md" />
          <Skeleton className="w-12 h-4 rounded-md" />
        </div>
        <Skeleton className="w-4/5 h-3.5 rounded-md" />
      </div>

      {/* Service Selector Placeholder */}
      <div className="p-3 rounded-2xl bg-zinc-50/80 border border-zinc-100 space-y-2">
        <div className="flex justify-between items-center">
          <Skeleton className="w-20 h-3 rounded-md" />
          <Skeleton className="w-14 h-3 rounded-md" />
        </div>
        <Skeleton className="w-full h-8 rounded-xl" />
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-10 rounded-xl" />
      </div>
    </div>
  )
}

/**
 * Grid of Business Card Skeletons
 */
export function BusinessGridSkeleton({ count = 6 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <BusinessCardSkeleton key={i} />
      ))}
    </div>
  )
}

/**
 * Skeleton for Hub Command Center (Owner Portal)
 */
export function HubCommandCenterSkeleton({ count = 3 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-xs space-y-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3.5">
              <Skeleton className="w-12 h-12 rounded-2xl" />
              <div className="space-y-2">
                <Skeleton className="w-32 h-4 rounded-md" />
                <Skeleton className="w-20 h-3 rounded-md" />
              </div>
            </div>
            <Skeleton className="w-14 h-6 rounded-full" />
          </div>

          <div className="grid grid-cols-2 gap-2.5 p-3 rounded-2xl bg-zinc-50 border border-zinc-100">
            <div className="space-y-1">
              <Skeleton className="w-16 h-3 rounded-md" />
              <Skeleton className="w-10 h-5 rounded-md" />
            </div>
            <div className="space-y-1">
              <Skeleton className="w-16 h-3 rounded-md" />
              <Skeleton className="w-10 h-5 rounded-md" />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Skeleton className="flex-1 h-9 rounded-xl" />
            <Skeleton className="w-9 h-9 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Skeleton for Queue Page (Ticket Pass & Wait Status)
 */
export function QueuePageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Top Banner Skeleton */}
      <div className="bg-white rounded-3xl p-6 border border-zinc-200/80 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="w-14 h-14 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="w-48 h-5 rounded-md" />
            <Skeleton className="w-32 h-3.5 rounded-md" />
          </div>
        </div>
        <Skeleton className="w-24 h-8 rounded-full" />
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        {/* Left Pass Card */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-7 border border-zinc-200/80 shadow-xs space-y-6">
          <div className="flex justify-between items-center">
            <Skeleton className="w-24 h-6 rounded-full" />
            <Skeleton className="w-16 h-4 rounded-md" />
          </div>

          <div className="py-6 text-center space-y-3">
            <Skeleton className="w-20 h-4 mx-auto rounded-md" />
            <Skeleton className="w-36 h-14 mx-auto rounded-2xl" />
            <Skeleton className="w-28 h-3.5 mx-auto rounded-md" />
          </div>

          <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 space-y-2.5">
            <div className="flex justify-between">
              <Skeleton className="w-20 h-3 rounded-md" />
              <Skeleton className="w-24 h-3 rounded-md" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="w-20 h-3 rounded-md" />
              <Skeleton className="w-16 h-3 rounded-md" />
            </div>
          </div>

          <Skeleton className="w-full h-11 rounded-2xl" />
        </div>

        {/* Right Info Card */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-7 border border-zinc-200/80 shadow-xs space-y-5">
          <div className="flex justify-between items-center pb-4 border-b border-zinc-100">
            <Skeleton className="w-40 h-5 rounded-md" />
            <Skeleton className="w-20 h-4 rounded-md" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>

          <div className="space-y-3 pt-2">
            <Skeleton className="w-full h-12 rounded-2xl" />
            <Skeleton className="w-full h-12 rounded-2xl" />
            <Skeleton className="w-full h-12 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Skeleton for Booking Page (Services + Calendar + Slots)
 */
export function BookingPageSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Venue & Services */}
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-white rounded-3xl p-6 border border-zinc-200/80 shadow-xs space-y-4">
          <div className="flex items-start gap-4">
            <Skeleton className="w-16 h-16 rounded-2xl shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="w-3/4 h-5 rounded-md" />
              <Skeleton className="w-1/2 h-3.5 rounded-md" />
              <Skeleton className="w-16 h-4 rounded-full" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-zinc-200/80 shadow-xs space-y-3">
          <Skeleton className="w-32 h-4 rounded-md" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-3 rounded-2xl border border-zinc-100 flex items-center justify-between">
                <div className="space-y-1">
                  <Skeleton className="w-28 h-4 rounded-md" />
                  <Skeleton className="w-16 h-3 rounded-md" />
                </div>
                <Skeleton className="w-14 h-4 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column: Calendar & Time Slots */}
      <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-7 border border-zinc-200/80 shadow-xs space-y-6">
        <div className="flex justify-between items-center pb-4 border-b border-zinc-100">
          <Skeleton className="w-44 h-5 rounded-md" />
          <Skeleton className="w-24 h-4 rounded-md" />
        </div>

        {/* Date Row Skeleton */}
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="w-16 h-20 rounded-2xl shrink-0" />
          ))}
        </div>

        {/* Time Slots Grid */}
        <div className="space-y-3 pt-2">
          <Skeleton className="w-32 h-4 rounded-md" />
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-xl" />
            ))}
          </div>
        </div>

        {/* Summary Footer */}
        <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 flex justify-between items-center">
          <div className="space-y-1">
            <Skeleton className="w-24 h-3 rounded-md" />
            <Skeleton className="w-20 h-5 rounded-md" />
          </div>
          <Skeleton className="w-32 h-11 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

/**
 * Skeleton for History Page
 */
export function HistoryPageSkeleton({ count = 4 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-3xl p-5 sm:p-6 border border-zinc-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Skeleton className="w-12 h-12 rounded-2xl shrink-0" />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="w-36 h-4 rounded-md" />
                <Skeleton className="w-16 h-4 rounded-full" />
              </div>
              <Skeleton className="w-48 h-3 rounded-md" />
            </div>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100">
            <Skeleton className="w-20 h-5 rounded-md" />
            <Skeleton className="w-24 h-9 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Skeleton for Business Dashboard (Owner Venue Console)
 */
export function BusinessDashboardSkeleton() {
  return (
    <div className="min-h-screen app-background flex">
      {/* Left Sidebar Skeleton */}
      <div className="w-64 shrink-0 hidden lg:flex flex-col p-5 border-r border-zinc-200/70 bg-white/60 space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="w-28 h-4 rounded-md" />
            <Skeleton className="w-16 h-3 rounded-md" />
          </div>
        </div>
        <div className="space-y-2 pt-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="w-full h-9 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto w-full">
        {/* Top Header Card */}
        <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-xs flex justify-between items-center">
          <div className="space-y-2">
            <Skeleton className="w-48 h-6 rounded-md" />
            <Skeleton className="w-32 h-4 rounded-md" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="w-24 h-9 rounded-xl" />
            <Skeleton className="w-28 h-9 rounded-xl" />
          </div>
        </div>

        {/* 4 KPI Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-3xl p-5 border border-zinc-200/80 shadow-xs space-y-2">
              <Skeleton className="w-20 h-3 rounded-md" />
              <Skeleton className="w-28 h-7 rounded-md" />
              <Skeleton className="w-16 h-3 rounded-md" />
            </div>
          ))}
        </div>

        {/* Live Queue Active Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-zinc-200/80 shadow-xs space-y-4">
            <Skeleton className="w-36 h-5 rounded-md" />
            <Skeleton className="w-full h-36 rounded-2xl" />
            <Skeleton className="w-full h-11 rounded-xl" />
          </div>
          <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-zinc-200/80 shadow-xs space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-100">
              <Skeleton className="w-32 h-5 rounded-md" />
              <Skeleton className="w-16 h-4 rounded-md" />
            </div>
            <div className="space-y-2.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="w-full h-12 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Skeleton for Admin Dashboard
 */
export function AdminDashboardSkeleton() {
  return (
    <div className="min-h-screen app-background p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Welcome & Summary Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200 shadow-xs flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div className="space-y-2">
          <Skeleton className="w-56 h-7 rounded-md" />
          <Skeleton className="w-72 h-4 rounded-md" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="w-28 h-10 rounded-xl" />
          <Skeleton className="w-28 h-10 rounded-xl" />
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-3xl p-5 border border-zinc-200/80 shadow-xs space-y-2">
            <Skeleton className="w-24 h-3.5 rounded-md" />
            <Skeleton className="w-32 h-8 rounded-md" />
            <Skeleton className="w-20 h-3 rounded-md" />
          </div>
        ))}
      </div>

      {/* Main Admin Table Skeleton */}
      <div className="bg-white rounded-3xl border border-zinc-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-zinc-100 flex justify-between items-center">
          <Skeleton className="w-40 h-5 rounded-md" />
          <Skeleton className="w-64 h-9 rounded-xl" />
        </div>
        <div className="divide-y divide-zinc-100 p-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                <div className="space-y-1.5">
                  <Skeleton className="w-36 h-4 rounded-md" />
                  <Skeleton className="w-24 h-3 rounded-md" />
                </div>
              </div>
              <div className="hidden sm:flex gap-4">
                <Skeleton className="w-20 h-4 rounded-md" />
                <Skeleton className="w-16 h-4 rounded-full" />
              </div>
              <Skeleton className="w-20 h-8 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Skeleton for Subscription Page
 */
export function SubscriptionPlansSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="p-6 sm:p-8 rounded-3xl bg-white border border-[#BDE8CB] shadow-xs flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="w-28 h-6 rounded-md" />
              <Skeleton className="w-16 h-5 rounded-full" />
            </div>
            <div className="flex items-baseline gap-2">
              <Skeleton className="w-24 h-9 rounded-md" />
              <Skeleton className="w-16 h-4 rounded-md" />
            </div>
            <Skeleton className="w-3/4 h-3.5 rounded-md" />
            <div className="space-y-2 pt-2">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="flex items-center gap-2">
                  <Skeleton className="w-4 h-4 rounded-full shrink-0" />
                  <Skeleton className="w-4/5 h-3 rounded-md" />
                </div>
              ))}
            </div>
          </div>
          <Skeleton className="w-full h-12 rounded-2xl" />
        </div>
      ))}
    </div>
  )
}

/**
 * Skeleton for Business Onboarding Studio
 */
export function OnboardingStudioSkeleton() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/75 backdrop-blur-md p-2 sm:p-4 md:p-6 overflow-hidden">
      <div className="w-full h-full max-w-6xl max-h-[96vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-zinc-200/90 relative">
        {/* Top Header Bar */}
        <div className="bg-white border-b border-zinc-200/80 px-6 py-4 flex items-center justify-between">
          <Skeleton className="w-32 h-4 rounded-md" />
          <Skeleton className="w-44 h-5 rounded-md" />
          <Skeleton className="w-16 h-8 rounded-xl" />
        </div>
        {/* Body Content */}
        <div className="flex-1 p-6 sm:p-8 flex flex-col md:flex-row gap-6 overflow-y-auto">
          {/* Step list on left */}
          <div className="w-full md:w-64 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-3 rounded-xl border border-zinc-100 flex items-center gap-3">
                <Skeleton className="w-6 h-6 rounded-full shrink-0" />
                <Skeleton className="w-28 h-3.5 rounded-md" />
              </div>
            ))}
          </div>
          {/* Form area on right */}
          <div className="flex-1 space-y-5 bg-zinc-50/50 p-6 rounded-3xl border border-zinc-100">
            <Skeleton className="w-48 h-6 rounded-md" />
            <Skeleton className="w-72 h-4 rounded-md" />
            <div className="space-y-4 pt-3">
              <Skeleton className="w-full h-11 rounded-xl" />
              <Skeleton className="w-full h-11 rounded-xl" />
              <Skeleton className="w-full h-24 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Global Initial App Loading Skeleton (Replaces spinning circle in App.jsx)
 */
export function AppLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[#F7FCF9] text-zinc-900 flex flex-col justify-between selection:bg-emerald-500/20">
      {/* Top Navbar Placeholder */}
      <header className="border-b border-zinc-200/70 bg-white/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="w-28 h-7 rounded-lg" />
            <Skeleton className="hidden sm:block w-20 h-5 rounded-full" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="hidden md:block w-64 h-9 rounded-full" />
            <Skeleton className="w-9 h-9 rounded-full" />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 w-full">
        {/* Hero Banner Skeleton */}
        <div className="w-full h-40 sm:h-52 rounded-3xl overflow-hidden skeleton-shimmer border border-[#D5EEDB]" />

        {/* Filter Pills Skeleton */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <div className="flex gap-2">
            <Skeleton className="w-24 h-9 rounded-xl" />
            <Skeleton className="w-24 h-9 rounded-xl" />
          </div>
          <Skeleton className="w-32 h-9 rounded-xl" />
        </div>

        {/* 6-Card Grid Skeleton */}
        <BusinessGridSkeleton count={6} />
      </main>
    </div>
  )
}

