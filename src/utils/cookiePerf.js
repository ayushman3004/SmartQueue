import { useState, useEffect, useCallback } from 'react';

const COOKIE_NAME = 'serveq_perf_mode';
const COOKIE_MAX_AGE = 31536000; // 1 year

/**
 * Read cookie by name from document.cookie
 */
export function getCookie(name) {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

/**
 * Set a persistent cookie with SameSite=Lax
 */
export function setCookie(name, value, maxAge = COOKIE_MAX_AGE) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

/**
 * Device capability & platform detection
 */
export function detectDeviceCapabilities() {
  if (typeof window === 'undefined') {
    return { isAndroid: false, isWindows: false, isMobile: false, isLowPower: false, recommendedMode: 'high' };
  }

  const ua = navigator.userAgent || '';
  const isAndroid = /Android/i.test(ua);
  const isWindows = /Windows/i.test(ua);
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) || (window.innerWidth < 768);
  const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

  // Check CPU cores and device memory if available in Chrome/Edge
  const lowCores = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4;
  const lowMemory = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory < 4;
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // On Android, Windows laptops with integrated GPUs, or mobile touch devices,
  // heavy video seeking and 3D compositing cause severe jank.
  const isLowPower = isAndroid || isMobile || lowCores || lowMemory || prefersReduced || (isWindows && hasTouch);

  return {
    isAndroid,
    isWindows,
    isMobile,
    hasTouch,
    isLowPower,
    recommendedMode: isLowPower ? 'optimized' : 'high'
  };
}

/**
 * Get active performance mode from cookie, falling back to auto-detection
 */
export function getInitialPerfMode() {
  const cookieVal = getCookie(COOKIE_NAME);
  if (cookieVal === 'optimized' || cookieVal === 'high') {
    return cookieVal;
  }
  const { recommendedMode } = detectDeviceCapabilities();
  // Automatically write cookie so the preference persists
  setCookie(COOKIE_NAME, recommendedMode);
  return recommendedMode;
}

/**
 * React hook to read and switch performance mode across the app
 */
export function usePerfMode() {
  const [mode, setModeState] = useState(() => getInitialPerfMode());
  const [deviceInfo, setDeviceInfo] = useState(() => detectDeviceCapabilities());

  useEffect(() => {
    setDeviceInfo(detectDeviceCapabilities());
  }, []);

  const setMode = useCallback((newMode) => {
    const val = newMode === 'optimized' ? 'optimized' : 'high';
    setModeState(val);
    setCookie(COOKIE_NAME, val);
  }, []);

  return {
    mode,
    setMode,
    isOptimized: mode === 'optimized',
    isAndroid: deviceInfo.isAndroid,
    isWindows: deviceInfo.isWindows,
    isMobile: deviceInfo.isMobile,
    isLowPower: deviceInfo.isLowPower
  };
}
