import { useEffect, useRef, useState } from "react"
import { usePerfMode } from "../utils/cookiePerf"

// ─────────────────────────────────────────────────────────────
// THE CITY OPENS — adaptive video hero
// Supports both high-performance desktop scroll-scrubbing and
// zero-jank hardware-accelerated autoplay for Android & Windows.
// ─────────────────────────────────────────────────────────────

const DEFAULT_VIDEO = "https://cdn.21st.dev/assets/mirror/21/21a77eac28eacbb7e142016eefeaa0b4a766619e51113629a3bc6df6af066c0f.mp4"
const DEFAULT_SIGNATURE = { name: "guglielmogiannattasio.exe", url: "https://www.guglielmogiannattasio.it" }
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

const COL_BG = "#05070d"
const COL_TEXT = "#f2f4f8"

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v))
}

export default function MetroHero({
  videoSrc = DEFAULT_VIDEO,
  title = "ELIMINATE THE WAITING ROOM",
  scrollHint = "SCROLL TO EXPLORE",
  tagline = "Zero-friction virtual waiting queues. Every door in the city is open without the wait.",
  signature = false,
  scrubDistance = 3000,
  className = "",
  style = {},
  onExplore,
  children,
}) {
  const { isOptimized, isAndroid, isWindows, isMobile, isLowPower } = usePerfMode()
  const disableScrollLock = isOptimized || isAndroid || isMobile || isLowPower

  const sectionRef = useRef(null)
  const videoRef = useRef(null)
  const titleRef = useRef(null)
  const hintRef = useRef(null)
  const taglineRef = useRef(null)
  const progressBarRef = useRef(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    const section = sectionRef.current
    if (!video || !section) return

    // ── Optimized Mode for Android, Windows, Mobile & Low-Power ──
    if (disableScrollLock) {
      video.loop = true
      video.muted = true
      video.playsInline = true
      const playPromise = video.play()
      if (playPromise !== undefined) {
        playPromise.catch(() => {})
      }
      setReady(true)

      const onWindowScroll = () => {
        const y = window.scrollY
        const h = window.innerHeight || 700
        const p = clamp(y / (h * 0.7), 0, 1)

        if (titleRef.current) {
          titleRef.current.style.opacity = String(1 - p * 1.4)
          titleRef.current.style.transform = `translateY(${p * -28}px) translateZ(0)`
        }
        if (taglineRef.current) {
          const t = clamp((p - 0.25) / 0.5, 0, 1)
          taglineRef.current.style.opacity = String(t)
          taglineRef.current.style.transform = `translateY(${(1 - t) * 20}px) translateZ(0)`
          taglineRef.current.style.pointerEvents = t > 0.5 ? "auto" : "none"
        }
        if (hintRef.current) {
          hintRef.current.style.opacity = y > 40 ? "0" : "1"
        }
      }

      window.addEventListener("scroll", onWindowScroll, { passive: true })
      onWindowScroll()

      return () => {
        window.removeEventListener("scroll", onWindowScroll)
      }
    }

    // ── Full Cinematic Scroll Scrub for High-Power Desktops ──
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

    let duration = 0
    let rafId = 0
    let targetProgress = 0
    let currentProgress = 0
    let hasStartedScrolling = false
    let isSeeking = false
    let pendingTime = null
    let locked = false
    let lockedScrollY = 0
    let touchStartY = 0
    let lastSeekTime = 0

    const onLoadedData = () => {
      duration = video.duration || 0
      setReady(true)
      if (reduceMotion) {
        video.currentTime = duration * 0.92
      }
    }
    video.addEventListener("loadeddata", onLoadedData)

    const kickstartLoad = () => {
      const p = video.play()
      if (p && typeof p.then === "function") {
        p.then(() => video.pause()).catch(() => {})
      } else {
        video.pause()
      }
    }
    kickstartLoad()

    const onSeeked = () => {
      isSeeking = false
      if (pendingTime !== null) {
        const t = pendingTime
        pendingTime = null
        isSeeking = true
        video.currentTime = t
      }
    }
    video.addEventListener("seeked", onSeeked)

    function seekTo(t) {
      const now = performance.now()
      if (now - lastSeekTime < 33) {
        pendingTime = t
        return
      }
      lastSeekTime = now
      if (isSeeking) {
        pendingTime = t
        return
      }
      isSeeking = true
      video.currentTime = t
    }

    function engageLock() {
      if (locked || typeof document === "undefined") return
      locked = true
      lockedScrollY = window.scrollY
      const b = document.body.style
      b.position = "fixed"
      b.top = `-${lockedScrollY}px`
      b.left = "0"
      b.right = "0"
      b.width = "100%"
      b.height = "100%"
      b.overscrollBehavior = "none"
    }

    function releaseLock() {
      if (!locked || typeof document === "undefined") return
      locked = false
      const y = lockedScrollY
      const b = document.body.style
      b.position = ""
      b.top = ""
      b.left = ""
      b.right = ""
      b.width = ""
      b.height = ""
      b.overscrollBehavior = ""
      window.scrollTo(0, y)
    }

    if (typeof window !== "undefined" && window.scrollY <= 10) {
      engageLock()
    }

    function unlockAndScrollNext() {
      releaseLock()
      const nextElem = document.getElementById("features") || section.nextElementSibling
      if (nextElem) {
        nextElem.scrollIntoView({ behavior: "smooth" })
      } else {
        window.scrollBy({ top: window.innerHeight * 0.8, behavior: "smooth" })
      }
      onExplore?.()
    }

    function addDelta(deltaY) {
      if (locked) {
        if (deltaY > 0 && targetProgress >= 1) {
          releaseLock()
          window.scrollBy({ top: Math.max(deltaY, 80), behavior: "smooth" })
          onExplore?.()
          return false
        }
        if (deltaY < 0 && targetProgress <= 0) {
          return true
        }

        const next = clamp(targetProgress + deltaY / scrubDistance, 0, 1)
        targetProgress = next
        if (targetProgress > 0.001) hasStartedScrolling = true
        return true
      } else {
        if (window.scrollY <= 5 && deltaY < 0) {
          engageLock()
          targetProgress = 1
          const next = clamp(targetProgress + deltaY / scrubDistance, 0, 1)
          targetProgress = next
          return true
        }
        return false
      }
    }

    const onWheel = (e) => {
      if (locked) {
        const intercepted = addDelta(e.deltaY)
        if (intercepted) {
          e.preventDefault()
        }
      } else if (window.scrollY <= 5 && e.deltaY < 0) {
        const intercepted = addDelta(e.deltaY)
        if (intercepted) {
          e.preventDefault()
        }
      }
    }

    const onTouchStart = (e) => {
      touchStartY = e.touches[0]?.clientY ?? 0
    }

    const onTouchMove = (e) => {
      const y = e.touches[0]?.clientY ?? touchStartY
      const deltaY = touchStartY - y
      touchStartY = y

      if (locked) {
        const intercepted = addDelta(deltaY)
        if (intercepted && e.cancelable) {
          e.preventDefault()
        }
      } else if (window.scrollY <= 5 && deltaY < 0) {
        const intercepted = addDelta(deltaY)
        if (intercepted && e.cancelable) {
          e.preventDefault()
        }
      }
    }

    window.addEventListener("wheel", onWheel, { passive: false })
    window.addEventListener("touchstart", onTouchStart, { passive: true })
    window.addEventListener("touchmove", onTouchMove, { passive: false })
    section.addEventListener("touchstart", onTouchStart, { passive: true, capture: true })
    section.addEventListener("touchmove", onTouchMove, { passive: false, capture: true })

    const hintElement = hintRef.current
    if (hintElement) {
      hintElement.addEventListener("click", unlockAndScrollNext)
    }

    function frame() {
      currentProgress += (targetProgress - currentProgress) * 0.18

      if (duration > 0) {
        seekTo(currentProgress * duration)
      }

      if (videoRef.current) {
        const scale = 1 + currentProgress * 0.06
        videoRef.current.style.transform = `scale(${scale}) translateZ(0)`
      }
      if (titleRef.current) {
        const t = 1 - clamp(currentProgress / 0.35, 0, 1)
        titleRef.current.style.opacity = String(t)
        titleRef.current.style.transform = `translateY(${(1 - t) * -24}px) scale(${0.96 + t * 0.04}) translateZ(0)`
      }
      if (hintRef.current) {
        hintRef.current.style.opacity = hasStartedScrolling ? "0" : "1"
      }
      if (taglineRef.current) {
        const t = clamp((currentProgress - 0.82) / 0.18, 0, 1)
        taglineRef.current.style.opacity = String(t)
        taglineRef.current.style.transform = `translateY(${(1 - t) * 20}px) scale(${0.97 + t * 0.03}) translateZ(0)`
        taglineRef.current.style.pointerEvents = t > 0.5 ? "auto" : "none"
      }
      if (progressBarRef.current) {
        progressBarRef.current.style.transform = `scaleX(${currentProgress})`
      }

      rafId = requestAnimationFrame(frame)
    }

    if (!reduceMotion) {
      rafId = requestAnimationFrame(frame)
    }

    return () => {
      video.removeEventListener("loadeddata", onLoadedData)
      video.removeEventListener("seeked", onSeeked)
      window.removeEventListener("wheel", onWheel)
      window.removeEventListener("touchstart", onTouchStart)
      window.removeEventListener("touchmove", onTouchMove)
      section.removeEventListener("touchstart", onTouchStart, true)
      section.removeEventListener("touchmove", onTouchMove, true)
      if (hintElement) {
        hintElement.removeEventListener("click", unlockAndScrollNext)
      }
      cancelAnimationFrame(rafId)
      releaseLock()
    }
  }, [scrubDistance, onExplore, disableScrollLock])

  return (
    <div
      ref={sectionRef}
      className={`metro-hero-container ${className}`}
      style={{
        position: "relative",
        height: "100dvh",
        minHeight: "100vh",
        width: "100%",
        overflow: "hidden",
        background: COL_BG,
        touchAction: disableScrollLock ? "pan-y" : "none",
        ...style,
      }}
    >
      <video
        ref={videoRef}
        src={videoSrc}
        muted
        playsInline
        preload="auto"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: ready ? 1 : 0,
          transformOrigin: "center center",
          willChange: "transform",
          transition: "opacity 0.6s ease",
          touchAction: disableScrollLock ? "pan-y" : "none",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(5,7,13,0.35), rgba(5,7,13,0) 30%, rgba(5,7,13,0.15) 70%, rgba(5,7,13,0.55))",
          pointerEvents: "none",
        }}
      />

      <div
        ref={titleRef}
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.25rem",
          padding: "0 6%",
          textAlign: "center",
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            fontFamily: SANS,
            fontSize: "clamp(10px, 1.2vw, 12px)",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.35em",
            color: "#2dd4bf",
            padding: "6px 16px",
            borderRadius: "9999px",
            background: "rgba(13, 148, 136, 0.2)",
            border: "1px solid rgba(45, 212, 191, 0.35)",
            backdropFilter: "blur(8px)",
          }}
        >
          Virtual Queue Infrastructure
        </span>
        <span
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: "clamp(30px, 6.5vw, 84px)",
            lineHeight: 1.05,
            letterSpacing: "-0.025em",
            color: COL_TEXT,
            textShadow: "0 4px 30px rgba(0,0,0,0.6)",
            display: "inline-block",
            willChange: "transform, filter, opacity",
            maxWidth: "960px",
          }}
        >
          {title}
        </span>
      </div>

      {tagline && (
        <div
          ref={taglineRef}
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1.5rem",
            padding: "0 8%",
            textAlign: "center",
            opacity: 0,
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              fontFamily: SANS,
              fontSize: "clamp(10px, 1.2vw, 12px)",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.3em",
              color: "#2dd4bf",
            }}
          >
            Live Global Operations
          </span>
          <span
            style={{
              fontFamily: SANS,
              fontWeight: 700,
              fontSize: "clamp(20px, 3.2vw, 40px)",
              lineHeight: 1.25,
              letterSpacing: "-0.015em",
              color: COL_TEXT,
              textShadow: "0 4px 24px rgba(0,0,0,0.6)",
              maxWidth: "850px",
            }}
          >
            {tagline}
          </span>
          {children}
        </div>
      )}

      <div
        ref={hintRef}
        style={{
          position: "absolute",
          left: "50%",
          bottom: "clamp(20px, 6vh, 48px)",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          color: "rgba(240,244,248,0.75)",
          fontFamily: SANS,
          fontSize: "clamp(10px, 1.4vw, 12px)",
          fontWeight: 600,
          letterSpacing: "0.3em",
          transition: "opacity 0.4s ease",
          cursor: "pointer",
          zIndex: 3,
        }}
        title="Scroll or click to explore"
      >
        <span>{scrollHint}</span>
        <svg
          width="14"
          height="18"
          viewBox="0 0 14 18"
          style={{ animation: "metro-hero-bounce 1.6s ease-in-out infinite" }}
        >
          <style>{`
            @keyframes metro-hero-bounce {
              0%, 100% { transform: translateY(0); opacity: 0.5; }
              50% { transform: translateY(5px); opacity: 1; }
            }
          `}</style>
          <path
            d="M7 1 L7 17 M2 12 L7 17 L12 12"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Thin progress line — fills as the video advances. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 2,
          background: "rgba(255,255,255,0.12)",
        }}
      >
        <div
          ref={progressBarRef}
          style={{
            height: "100%",
            width: "100%",
            background: "linear-gradient(90deg, rgba(255,255,255,0.5), rgba(255,255,255,0.95))",
            transform: "scaleX(0)",
            transformOrigin: "left center",
          }}
        />
      </div>

      {signature && (
        <span
          style={{
            position: "absolute",
            right: "clamp(12px, 2.5vw, 24px)",
            bottom: "clamp(10px, 2vw, 18px)",
            fontFamily: SANS,
            fontWeight: 500,
            fontSize: "clamp(11px, 1.4vw, 13px)",
            letterSpacing: "0.01em",
            color: "rgba(220,224,232,0.6)",
            zIndex: 2,
          }}
        >
          by{" "}
          <a
            href={signature.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "rgba(220,224,232,0.6)",
              textDecoration: "none",
              transition: "color 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = COL_TEXT
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "rgba(220,224,232,0.6)"
            }}
          >
            {signature.name}
          </a>
        </span>
      )}
    </div>
  )
}
