import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

const TOUR_STORAGE_KEY = 'serveq_tour_completed'
const TOUR_PROMPT_KEY = 'serveq_tour_prompt_dismissed'

/**
 * 5-Step Interactive Website Tour for serveQ
 */
export default function WebsiteTour({ manualTrigger, onTourClose }) {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [targetRect, setTargetRect] = useState(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  )

  const tooltipRef = useRef(null)

  // Tour Steps Configuration (Exactly 5 Steps)
  const steps = useMemo(
    () => [
      {
        stepNumber: 1,
        title: 'Welcome to serveQ',
        badge: 'Virtual Queuing',
        description:
          'ServeQ is a smart real-time virtual queue and booking platform. Eliminate crowded waiting rooms by joining live queues remotely from your smartphone.',
        selector: '#tour-welcome-hero',
        fallbackPlacement: 'center',
      },
      {
        stepNumber: 2,
        title: 'Navigation & Portals',
        badge: 'Main Navigation',
        description:
          'Use the header navigation to explore how virtual queuing works, browse verified venues, or switch to the Hub Owner Portal if you operate a venue.',
        selector: isMobile ? '#tour-mobile-nav-btn' : '#tour-header-nav',
        fallbackPlacement: 'bottom',
      },
      {
        stepNumber: 3,
        title: 'Live Queue Pass & Telemetry',
        badge: 'Core Feature',
        description:
          'Monitor your live token number, see who is currently being served at the counter, and watch your estimated turnaround time sync in real-time via WebSockets.',
        selector: '#tour-live-pass-card',
        fallbackPlacement: 'bottom',
      },
      {
        stepNumber: 4,
        title: 'Find Venues & Join Queues',
        badge: 'Key Action',
        description:
          'Tap "Join a Queue" to search nearby salons, medical clinics, and wellness lounges. Reserve your virtual place in line before stepping out of your home.',
        selector: '#tour-join-queue-btn',
        fallbackPlacement: 'bottom',
      },
      {
        stepNumber: 5,
        title: "You're All Set!",
        badge: 'Tour Complete',
        description:
          'You are now ready to explore serveQ independently. Join live queues as a customer, or set up zero-friction virtual queues for your business.',
        selector: '#tour-cta-banner',
        fallbackPlacement: 'top',
      },
    ],
    [isMobile]
  )

  // Track viewport changes
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Check first-time visitor status for subtle prompt
  useEffect(() => {
    try {
      const isCompleted = localStorage.getItem(TOUR_STORAGE_KEY)
      const isDismissed = localStorage.getItem(TOUR_PROMPT_KEY)
      if (!isCompleted && !isDismissed) {
        const timer = setTimeout(() => setShowPrompt(true), 1200)
        return () => clearTimeout(timer)
      }
    } catch {
      // localStorage unavailable; do not show prompt automatically
    }
  }, [])

  // Navigation handlers
  const handleCloseTour = useCallback(() => {
    setIsOpen(false)
    if (onTourClose) onTourClose()
  }, [onTourClose])

  const handleSkipTour = useCallback(() => {
    setIsOpen(false)
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, 'skipped')
    } catch {
      // Ignore storage errors
    }
    if (onTourClose) onTourClose()
  }, [onTourClose])

  const handleFinishTour = useCallback(() => {
    setIsOpen(false)
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, 'completed')
    } catch {
      // Ignore storage errors
    }
    if (onTourClose) onTourClose()
  }, [onTourClose])

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1)
    } else {
      handleFinishTour()
    }
  }, [currentStep, steps.length, handleFinishTour])

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1)
    }
  }, [currentStep])

  const startTour = useCallback(() => {
    setShowPrompt(false)
    setCurrentStep(0)
    setIsOpen(true)
  }, [])

  const dismissPrompt = useCallback(() => {
    setShowPrompt(false)
    try {
      localStorage.setItem(TOUR_PROMPT_KEY, 'true')
    } catch {
      // Ignore storage errors
    }
  }, [])

  const handleExploreAction = useCallback(() => {
    handleFinishTour()
    navigate('/customers')
  }, [handleFinishTour, navigate])

  // Listen to manual triggers from parent components
  useEffect(() => {
    if (manualTrigger) {
      const timer = setTimeout(() => {
        setCurrentStep(0)
        setIsOpen(true)
        setShowPrompt(false)
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [manualTrigger])

  // Measure and position spotlight for the active step
  const updateTargetRect = useCallback(() => {
    if (!isOpen) return
    const step = steps[currentStep]
    if (!step?.selector) {
      setTargetRect(null)
      return
    }

    const element = document.querySelector(step.selector)
    if (element) {
      const rect = element.getBoundingClientRect()
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom,
        right: rect.right,
      })
    } else {
      // Element missing; graceful fallback to centered dialog
      setTargetRect(null)
    }
  }, [isOpen, currentStep, steps])

  // Scroll target element into view and update bounding box
  useEffect(() => {
    if (!isOpen) return

    const step = steps[currentStep]
    if (step?.selector) {
      const element = document.querySelector(step.selector)
      if (element) {
        element.scrollIntoView({
          behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
            ? 'auto'
            : 'smooth',
          block: 'center',
          inline: 'nearest',
        })
      }
    }

    // Measure after scroll settling
    const timer = setTimeout(updateTargetRect, 200)
    const resizeListener = () => updateTargetRect()
    const scrollListener = () => updateTargetRect()

    window.addEventListener('resize', resizeListener, { passive: true })
    window.addEventListener('scroll', scrollListener, { passive: true })

    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', resizeListener)
      window.removeEventListener('scroll', scrollListener)
    }
  }, [isOpen, currentStep, steps, updateTargetRect])

  // Keyboard navigation & Escape handler
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleCloseTour()
      } else if (e.key === 'ArrowRight' && currentStep < steps.length - 1) {
        setCurrentStep((prev) => prev + 1)
      } else if (e.key === 'ArrowLeft' && currentStep > 0) {
        setCurrentStep((prev) => prev - 1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, currentStep, steps.length, handleCloseTour])

  const currentStepData = steps[currentStep]

  // Calculate dynamic popover coordinates
  const calculateTooltipStyle = () => {
    const tooltipWidth = Math.min(
      typeof window !== 'undefined' ? window.innerWidth - 32 : 360,
      400
    )

    // If no target rect or centered step, place in center of screen
    if (!targetRect || currentStep === 0 || currentStep === 4) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: `${tooltipWidth}px`,
        maxWidth: '92vw',
        zIndex: 10002,
      }
    }

    const margin = 16
    let top = targetRect.bottom + margin
    let left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2

    // Flip to top if overflowing bottom
    if (typeof window !== 'undefined' && top + 260 > window.innerHeight) {
      top = Math.max(margin, targetRect.top - 280)
    }

    // Clamp horizontally to prevent overflow
    const maxLeft =
      typeof window !== 'undefined' ? window.innerWidth - tooltipWidth - margin : 300
    left = Math.max(margin, Math.min(left, maxLeft))

    return {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${tooltipWidth}px`,
      maxWidth: '92vw',
      zIndex: 10002,
    }
  }

  return (
    <>
      {/* ── Subtle Floating Tour Prompt for First-Time Visitors ── */}
      <AnimatePresence>
        {showPrompt && !isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-5 left-4 sm:left-6 z-40 bg-zinc-950 text-white rounded-2xl p-4 sm:p-4.5 shadow-2xl border border-zinc-800 max-w-sm sm:max-w-md flex items-start gap-3.5 backdrop-blur-md"
            role="region"
            aria-label="Website tour recommendation"
          >
            <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 font-bold shrink-0 text-sm mt-0.5">
              ✨
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-teal-400">
                  New to serveQ?
                </span>
                <button
                  type="button"
                  onClick={dismissPrompt}
                  className="text-zinc-400 hover:text-white text-xs font-bold p-1 -mr-1 leading-none rounded-md transition-colors cursor-pointer"
                  aria-label="Dismiss tour prompt"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-zinc-300 leading-snug">
                Take a quick 5-step interactive tour to learn how virtual waiting lines and counter calling work.
              </p>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={startTour}
                  className="px-3.5 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold text-xs shadow-md transition-transform active:scale-95 cursor-pointer"
                >
                  Take 5-Step Tour →
                </button>
                <button
                  type="button"
                  onClick={dismissPrompt}
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
                >
                  Maybe Later
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Active 5-Step Interactive Guided Tour ── */}
      <AnimatePresence>
        {isOpen && (
          <div
            className="fixed inset-0 z-[10000] overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Interactive Website Tour"
          >
            {/* Dimmed Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={handleCloseTour}
              className="fixed inset-0 bg-zinc-950/70 backdrop-blur-xs transition-opacity"
            />

            {/* Target Element Spotlight Ring */}
            {targetRect && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  top: targetRect.top - 6,
                  left: targetRect.left - 6,
                  width: targetRect.width + 12,
                  height: targetRect.height + 12,
                }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="fixed pointer-events-none rounded-2xl border-2 border-teal-400 ring-4 ring-teal-500/30 shadow-[0_0_0_9999px_rgba(9,9,11,0.55)] z-[10001]"
              />
            )}

            {/* Interactive Tooltip / Popover */}
            <motion.div
              key={currentStep}
              ref={tooltipRef}
              style={calculateTooltipStyle()}
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-zinc-200/90 text-zinc-900 text-left space-y-4 font-sans select-none"
            >
              {/* Header: Progress, Badge & Close Button */}
              <div className="flex items-center justify-between gap-2 border-b border-zinc-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200/70">
                    {currentStepData.badge}
                  </span>
                  <span className="text-[11px] font-bold text-zinc-500">
                    Step {currentStep + 1} of {steps.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCloseTour}
                  className="w-7 h-7 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 hover:text-zinc-900 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                  aria-label="Close tour"
                >
                  ✕
                </button>
              </div>

              {/* Progress Bar (5 Steps Indicator) */}
              <div className="flex items-center gap-1.5 w-full">
                {steps.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                      idx === currentStep
                        ? 'bg-teal-600'
                        : idx < currentStep
                        ? 'bg-teal-300'
                        : 'bg-zinc-200'
                    }`}
                  />
                ))}
              </div>

              {/* Content Body */}
              <div className="space-y-1.5">
                <h3 className="text-lg sm:text-xl font-black text-zinc-950 tracking-tight leading-snug">
                  {currentStepData.title}
                </h3>
                <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed font-normal">
                  {currentStepData.description}
                </p>
              </div>

              {/* Step 5 Special Action: Explore Venues */}
              {currentStep === 4 && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleExploreAction}
                    className="w-full py-2.5 px-4 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200/80 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Browse Venues Directly</span>
                    <span>→</span>
                  </button>
                </div>
              )}

              {/* Footer Controls: Back, Skip, Next / Finish */}
              <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                <div>
                  {currentStep > 0 ? (
                    <button
                      type="button"
                      onClick={handleBack}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 transition-colors cursor-pointer"
                    >
                      ← Back
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSkipTour}
                      className="text-xs font-bold text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer px-2 py-1"
                    >
                      Skip Tour
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {currentStep > 0 && currentStep < steps.length - 1 && (
                    <button
                      type="button"
                      onClick={handleSkipTour}
                      className="text-xs font-bold text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer hidden sm:inline-block px-2"
                    >
                      Skip
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-teal-600/20 active:scale-95 transition-all cursor-pointer"
                  >
                    {currentStep === 0
                      ? 'Start Tour →'
                      : currentStep === steps.length - 1
                      ? 'Finish Tour ✓'
                      : 'Next →'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
