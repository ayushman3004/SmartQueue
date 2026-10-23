/**
 * AmbientBackground
 * Shared decorative background lighting with soft mint/forest ambient glows
 * and blurred circular color orbs positioned behind page content.
 * 
 * - Pointer events disabled (non-blocking)
 * - Hardware-accelerated with CSS blur & transforms
 * - Zero layout shift & no horizontal overflow
 */
export default function AmbientBackground({ variant = 'default', className = '' }) {
  const isAuth = variant === 'auth'
  const isGlow = variant === 'glow' || variant === 'dashboard'

  return (
    <div
      className={`fixed inset-0 pointer-events-none overflow-hidden select-none -z-10 ${className}`}
      aria-hidden="true"
    >
      {/* ── Top-Left Mint Glow ── */}
      <div
        className={`ambient-orb ambient-orb-primary ${
          isAuth
            ? 'w-[520px] h-[520px] -top-24 -left-24 opacity-85'
            : isGlow
            ? 'w-[560px] h-[560px] -top-28 -left-24 opacity-75'
            : 'w-[440px] h-[440px] -top-20 -left-20 opacity-65'
        } animate-orb-slow`}
      />

      {/* ── Top-Right Emerald / Soft Glow ── */}
      <div
        className={`ambient-orb ambient-orb-mint ${
          isAuth
            ? 'w-[480px] h-[480px] top-8 -right-20 opacity-80'
            : isGlow
            ? 'w-[520px] h-[520px] top-4 -right-24 opacity-70'
            : 'w-[400px] h-[400px] top-6 -right-16 opacity-60'
        } animate-orb-reverse`}
      />

      {/* ── Center Soft Ambient Wash for Dashboards ── */}
      {isGlow && (
        <div className="ambient-orb ambient-orb-soft w-[640px] h-[640px] top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-40 animate-orb-slow" />
      )}

      {/* ── Bottom-Right Corner Soft Mint Glow ── */}
      <div
        className={`ambient-orb ambient-orb-mint ${
          isAuth
            ? 'w-[560px] h-[560px] -bottom-32 right-1/4 opacity-75'
            : isGlow
            ? 'w-[540px] h-[540px] -bottom-24 -right-20 opacity-65'
            : 'w-[460px] h-[460px] -bottom-20 -right-16 opacity-55'
        } animate-orb-slow`}
      />

      {/* ── Bottom-Left Soft Glow ── */}
      <div
        className={`ambient-orb ambient-orb-soft ${
          isGlow ? 'w-[460px] h-[460px] -bottom-24 left-10 opacity-45' : 'w-[380px] h-[380px] -bottom-16 left-8 opacity-35'
        } animate-orb-reverse`}
      />
    </div>
  )
}
