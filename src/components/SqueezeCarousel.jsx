import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*                                  geometry                                  */
/* -------------------------------------------------------------------------- */

const size = (value) => (typeof value === "number" ? `${value}px` : value);

const clamp = (value, low, high) =>
  Math.max(low, Math.min(high, value));

/**
 * The row is four columns and a tail of slats, and it is a strip that slides
 * rather than a ring that turns.
 *
 * Four columns share out whatever is left once the open card, the slats and the
 * gaps are paid for. The open card starts from a 16:9 block and then gives a
 * little back — hence the negative first share. Column −1 and anything past
 * column 3 is a slat, so a card leaving the front simply narrows to a slat and
 * carries on out of the left edge.
 */
const SHARES = [-0.06, 0.61, 0.3, 0.15];

/** The hovered column takes more room. */
const STRETCHED = [0, 0.71, 0.4, 0.25];

/** Its neighbours give a little up to pay for it. */
const SQUEEZED = [-0.12, 0.59, 0.28, 0.13];

/* -------------------------------------------------------------------------- */
/*                                    hooks                                   */
/* -------------------------------------------------------------------------- */

/** True while the reader asks for less movement. */
function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setReduced(query.matches);
    read();
    query.addEventListener("change", read);
    return () => query.removeEventListener("change", read);
  }, []);

  return reduced;
}

/* -------------------------------------------------------------------------- */
/*                                 component                                  */
/* -------------------------------------------------------------------------- */

const GEIST = `
@font-face{font-family:"Geist";font-style:normal;font-weight:100 900;font-display:swap;
src:url(https://cdn.21st.dev/assets/mirror/9b/9b6f5ff45b278c744b5f379a2c4ecbaf858a842b8eaf82ac8d21b699ca16c608.woff2) format("woff2");
unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:"Geist";font-style:normal;font-weight:100 900;font-display:swap;
src:url(https://cdn.21st.dev/assets/mirror/58/58a6b173d5ca1dec92166ea3c6cb1a84a4144556d10928ac14e8e6b40e4787bd.woff2) format("woff2");
unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:"Geist";font-style:normal;font-weight:100 900;font-display:swap;
src:url(https://cdn.21st.dev/assets/mirror/61/6129fc8571c3e0cb0a4c41f5160c974a843b055009dc4ad8858bd808e18a2d86.woff2) format("woff2");
unicode-range:U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116}
`;

/**
 * A carousel that gives one panel the room and squeezes the rest into slats
 * down the right-hand side. Opening a slat widens it and slides the row along;
 * the copy and the button underneath cross-fade to match.
 */
export function SqueezeCarousel({
  slides,
  defaultIndex = 0,
  onIndexChange,
  height = "clamp(240px, 34cqi, 400px)",
  slatWidth = 8,
  slatGap = 8,
  gap = 16,
  radius = 16,
  duration = 1000,
  hoverGrow = true,
  autoplay = true,
  interval = 5000,
  controls = true,
  accent = "#09090b",
  accentForeground = "#ffffff",
  label = "Featured",
  panelClassName,
  className,
  style,
  ...props
}) {
  const count = slides?.length ?? 0;
  const wrap = useCallback((i) => ((i % count) + count) % count, [count]);

  // Four columns plus a tail of slats. Fewer slides, shorter tail.
  const slats = clamp(count - 4, 1, 3);
  const visible = 4 + slats;

  const reduced = useReducedMotion();
  const ms = reduced ? 0 : duration;

  const ids = useId();
  const seed = useRef(visible);
  const strip = useRef(null);

  /* --- the strip -------------------------------------------------------- */

  const [cards, setCards] = useState(() =>
    Array.from({ length: visible }, (_, p) => ({
      key: p,
      slide: wrap(defaultIndex + p),
    }))
  );
  // Which column each card sits in: its place in the strip plus this. Stepping
  // on pushes it down, so the card that was column 0 becomes column −1 — a
  // slat, on its way out of the left edge.
  const [column, setColumn] = useState(0);
  // Read by the tidy-up below, which runs from a timer and so cannot trust a
  // value captured when it was scheduled.
  const columnRef = useRef(0);
  const forward = useRef(true);
  // How far the strip is slid, counted in slats. Normally the same as
  // `column`; it parts company for the one frame after a trim or before a
  // step back, where the strip has to move without being seen to.
  const [slid, setSlid] = useState(0);
  const [still, setStill] = useState(false);
  const [hover, setHover] = useState(-1);

  const open = cards[-column]?.slide ?? defaultIndex;
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const settle = useCallback(() => {
    setCards((stripCards) =>
      forward.current ? stripCards.slice(-visible) : stripCards.slice(0, visible),
    );
    columnRef.current = 0;
    setColumn(0);
    setSlid(0);
    setStill(true);
  }, [visible]);

  useLayoutEffect(() => {
    if (!still) return;
    const id = requestAnimationFrame(() => setStill(false));
    return () => cancelAnimationFrame(id);
  }, [still]);

  const step = useCallback(
    (by) => {
      if (count < 2 || by === 0) return;

      timers.current.forEach(clearTimeout);
      timers.current = [];
      forward.current = by > 0;

      if (by > 0) {
        setCards((stripCards) => [
          ...stripCards,
          ...Array.from({ length: by }, (_, k) => ({
            key: seed.current++,
            slide: wrap(stripCards[stripCards.length - 1].slide + 1 + k),
          })),
        ]);
        columnRef.current -= by;
        setColumn(columnRef.current);
        setSlid((s) => s - by);
      } else {
        setCards((stripCards) => [
          ...Array.from({ length: -by }, (_, k) => ({
            key: seed.current++,
            slide: wrap(stripCards[0].slide - (-by - k)),
          })),
          ...stripCards,
        ]);
        setSlid((s) => s + by);
        setStill(true);
        timers.current.push(window.setTimeout(() => setSlid(0), 0));
      }

      timers.current.push(window.setTimeout(settle, ms + 20));
    },
    [count, ms, settle, wrap],
  );

  useEffect(() => {
    onIndexChange?.(open);
  }, [open, onIndexChange]);

  /* --- autoplay --------------------------------------------------------- */

  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!autoplay || paused || reduced || count < 2) return;
    const timer = window.setTimeout(() => step(1), interval);
    return () => clearTimeout(timer);
  }, [autoplay, paused, reduced, count, open, interval, step]);

  /* --- keyboard --------------------------------------------------------- */

  const onKeyDown = (event) => {
    const moves = { ArrowRight: 1, ArrowLeft: -1 };
    const by = moves[event.key];
    if (by === undefined) return;
    event.preventDefault();
    step(by);
  };

  if (!count) return null;

  /* --- render ----------------------------------------------------------- */

  const slat = size(slatWidth);
  const shares = hoverGrow && hover >= 0 && hover <= 3 && !reduced ? null : SHARES;

  const shareOf = (col) => {
    if (shares) return SHARES[col];
    return hover === col ? STRETCHED[col] : SQUEEZED[col];
  };

  const widthOf = (col) => {
    if (col < 0 || col > 3) return slat;
    if (col === 0) return `calc(var(--sq-hero) + var(--sq-room) * ${shareOf(0)})`;
    return `calc(var(--sq-room) * ${shareOf(col)})`;
  };

  const vars = {
    "--sq-h": size(height),
    "--sq-gap": size(gap),
    "--sq-slat-gap": size(slatGap),
    "--sq-radius": size(radius),
    "--sq-ms": `${ms}ms`,
    "--sq-ease": "cubic-bezier(0.16, 1, 0.3, 1)",
    "--sq-fill": accent,
    "--sq-on-fill": accentForeground,
    "--sq-hero": "calc(var(--sq-h) * 16 / 9)",
    "--sq-room": `calc(100cqi - var(--sq-hero) - ${slats} * var(--sq-slat-gap) - 3 * var(--sq-gap) - ${slats} * ${slat})`,
  };

  const move = `translateX(calc(${slid} * (${slat} + var(--sq-gap))))`;

  return (
    <div
      className={cn("flex w-full flex-col", className)}
      style={{
        containerType: "inline-size",
        fontFamily: '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        ...vars,
        ...style,
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => {
        setPaused(false);
        setHover(-1);
      }}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      {...props}
    >
      <style>{GEIST}</style>

      {controls && count > 1 && (
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Interactive View
            </span>
            <span className="text-xs font-semibold text-teal-400 bg-teal-950/80 px-2 py-0.5 rounded-full border border-teal-500/30">
              {open + 1} / {count}
            </span>
          </div>
          <div className="flex justify-end gap-2">
            <Arrow back label="Previous" onClick={() => step(-1)} />
            <Arrow label="Next" onClick={() => step(1)} />
          </div>
        </div>
      )}

      <div className="w-full overflow-hidden" style={{ height: "var(--sq-h)" }}>
        <div
          ref={strip}
          role="tablist"
          aria-label={label}
          aria-orientation="horizontal"
          onKeyDown={onKeyDown}
          className="flex h-full w-max"
          style={{
            transform: move,
            transition: still ? "none" : `transform var(--sq-ms) var(--sq-ease)`,
          }}
        >
          {cards.map((card, place) => {
            const col = place + column;
            const slide = slides[card.slide];
            const front = col === 0;

            return (
              <button
                key={card.key}
                type="button"
                role="tab"
                id={`${ids}-tab-${card.key}`}
                aria-selected={front}
                aria-controls={`${ids}-panel`}
                aria-label={slide?.title || ""}
                tabIndex={front ? 0 : -1}
                onMouseMove={() => hoverGrow && setHover(col)}
                onClick={() => col > 0 && step(col)}
                className={cn(
                  "relative isolate h-full shrink-0 cursor-pointer overflow-hidden bg-zinc-900 p-0 shadow-2xl border border-white/10",
                  "outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                  "focus-visible:ring-[var(--sq-fill)] focus-visible:ring-offset-background",
                  panelClassName,
                )}
                style={{
                  width: widthOf(col),
                  marginLeft:
                    place === 0
                      ? 0
                      : col < 4
                      ? "var(--sq-gap)"
                      : "var(--sq-slat-gap)",
                  borderRadius: `min(var(--sq-radius), calc(${widthOf(col)} / 2))`,
                  transitionProperty: "width, margin-left",
                  transitionDuration: still ? "0s" : "var(--sq-ms)",
                  transitionTimingFunction: "var(--sq-ease)",
                }}
              >
                <Picture slide={slide} />

                {slide?.overlay && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end p-4 pt-16 sm:p-6 sm:pt-20"
                    style={{
                      opacity: front ? 1 : 0,
                      transition: `opacity var(--sq-ms) var(--sq-ease)`,
                      backgroundImage:
                        "linear-gradient(to top, rgb(0 0 0 / 0.85), transparent)",
                    }}
                  >
                    {slide.overlay}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div id={`${ids}-panel`} role="tabpanel" aria-live="polite" className="mt-6 grid sm:mt-7">
        {slides.map((slide, i) => {
          const shown = i === open;

          return (
            <div
              key={slide.id ?? i}
              aria-hidden={!shown}
              className={cn(
                "col-start-1 row-start-1 flex flex-col gap-4",
                "sm:flex-row sm:items-center sm:justify-between sm:gap-10",
              )}
              style={{
                opacity: shown ? 1 : 0,
                visibility: shown ? "visible" : "hidden",
                pointerEvents: shown ? "auto" : "none",
                transition: `opacity var(--sq-ms) var(--sq-ease), visibility var(--sq-ms)`,
              }}
            >
              <p className="max-w-[46rem] text-left text-[15px] leading-[1.6] sm:text-[17px]">
                <span className="font-bold text-white">{slide.title}</span>{" "}
                {slide.description && (
                  <span className="text-zinc-400 font-medium">{slide.description}</span>
                )}
              </p>

              {slide.action && <Action slide={slide} shown={shown} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Picture({ slide }) {
  if (!slide) return null;
  const box = {
    width: "var(--sq-hero)",
    minWidth: "100%",
  };

  if (slide.image) {
    return (
      <img
        src={slide.image}
        alt={slide.imageAlt ?? ""}
        draggable={false}
        className="absolute inset-y-0 left-1/2 h-full max-w-none -translate-x-1/2 object-cover"
        style={box}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="absolute inset-y-0 left-1/2 -translate-x-1/2"
      style={{ background: slide.background || "#18181b", ...box }}
    />
  );
}

function Arrow({ back = false, label, onClick }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "grid size-9 cursor-pointer place-items-center rounded-xl",
        "bg-white/10 hover:bg-white/20 text-white border border-white/15",
        "transition-all active:scale-95 outline-none shadow-sm backdrop-blur-md",
        "focus-visible:ring-2 focus-visible:ring-teal-400",
        "focus-visible:ring-offset-2",
      )}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path
          d={
            back
              ? "M9.6 2.6 5.1 7.1h9.1v1.8H5.1l4.5 4.5-1.2 1.2-6-6L1.8 8l.6-.6 6-6 1.2 1.2Z"
              : "M6.4 2.6l4.5 4.5H1.8v1.8h9.1l-4.5 4.5 1.2 1.2 6-6 .6-.6-.6-.6-6-6-1.2 1.2Z"
          }
        />
      </svg>
    </button>
  );
}

function Action({ slide, shown }) {
  const inside = (
    <>
      <span>{slide.action}</span>
      <svg
        width="6"
        height="9"
        viewBox="0 0 6 9"
        fill="none"
        aria-hidden="true"
        className="transition-transform duration-200 group-hover:translate-x-0.5"
      >
        <path
          d="M1.2 1 4.7 4.5 1.2 8"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </>
  );

  const dress = cn(
    "group inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl",
    "bg-teal-500 hover:bg-teal-400 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-zinc-950",
    "transition-all active:scale-95 shadow-lg shadow-teal-500/25 outline-none",
    "focus-visible:ring-2 focus-visible:ring-teal-400",
    "focus-visible:ring-offset-2",
  );

  if (slide.href) {
    return (
      <a
        href={slide.href}
        target={slide.target}
        rel={slide.target === "_blank" ? "noreferrer" : undefined}
        tabIndex={shown ? 0 : -1}
        onClick={slide.onAction}
        className={dress}
      >
        {inside}
      </a>
    );
  }

  return (
    <button type="button" tabIndex={shown ? 0 : -1} onClick={slide.onAction} className={dress}>
      {inside}
    </button>
  );
}

export default SqueezeCarousel;
