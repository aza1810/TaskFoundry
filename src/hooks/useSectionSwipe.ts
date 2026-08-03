import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react'

const SWIPE_MIN_PX = 64
const SWIPE_RATIO = 1.35

type SwipeHandlers = {
  onPointerDown: (e: ReactPointerEvent) => void
  onPointerUp: (e: ReactPointerEvent) => void
  onPointerCancel: (e: ReactPointerEvent) => void
}

/**
 * Horizontal swipe → section change.
 * dir 1 = swipe left (next tab), dir -1 = swipe right (previous tab).
 * Ignores mostly-vertical gestures so sheet scrolling still works.
 */
export function useSectionSwipe(
  enabled: boolean,
  onSwipe: (dir: -1 | 1) => void,
  ignoreSelector = '',
): SwipeHandlers {
  const start = useRef<{ x: number; y: number; id: number } | null>(null)

  const clear = useCallback(() => {
    start.current = null
  }, [])

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (!enabled) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      if (ignoreSelector) {
        const t = e.target
        if (t instanceof Element && t.closest(ignoreSelector)) return
      }
      start.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
    },
    [enabled, ignoreSelector],
  )

  const onPointerUp = useCallback(
    (e: ReactPointerEvent) => {
      const s = start.current
      start.current = null
      if (!enabled || !s || s.id !== e.pointerId) return
      const dx = e.clientX - s.x
      const dy = e.clientY - s.y
      if (Math.abs(dx) < SWIPE_MIN_PX) return
      if (Math.abs(dx) < Math.abs(dy) * SWIPE_RATIO) return
      onSwipe(dx < 0 ? 1 : -1)
    },
    [enabled, onSwipe],
  )

  const onPointerCancel = useCallback(
    (e: ReactPointerEvent) => {
      if (start.current?.id === e.pointerId) clear()
    },
    [clear],
  )

  return { onPointerDown, onPointerUp, onPointerCancel }
}
