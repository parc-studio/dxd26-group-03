import { useCallback, type AnimationEvent } from 'react'
import './AppointmentToast.css'

interface AppointmentToastProps {
  exiting?: boolean
  onClose: () => void
  onExited: () => void
}

export function AppointmentToast({
  exiting = false,
  onClose,
  onExited,
}: AppointmentToastProps) {
  const handleAnimationEnd = useCallback(
    (event: AnimationEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return
      if (!exiting) return
      onExited()
    },
    [exiting, onExited],
  )

  return (
    <div
      className={`appointment-toast${exiting ? ' is-leaving' : ''}`}
      role="status"
      aria-live="polite"
      onAnimationEnd={handleAnimationEnd}
    >
      <button
        type="button"
        className="appointment-toast__close"
        aria-label="Dismiss"
        onClick={onClose}
        disabled={exiting}
      >
        <span aria-hidden="true">×</span>
      </button>
      <p className="appointment-toast__eyebrow">Combination not available?</p>
      <p className="appointment-toast__title">
        Book an appointment
        <span className="appointment-toast__underline" aria-hidden="true" />
      </p>
    </div>
  )
}
