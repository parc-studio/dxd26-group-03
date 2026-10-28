import './AppointmentToast.css'

interface AppointmentToastProps {
  onClose: () => void
}

export function AppointmentToast({ onClose }: AppointmentToastProps) {
  return (
    <div
      className="appointment-toast"
      role="status"
      aria-live="polite"
    >
      <button
        type="button"
        className="appointment-toast__close"
        aria-label="Dismiss"
        onClick={onClose}
      >
        <span aria-hidden="true">×</span>
      </button>
      <p className="appointment-toast__eyebrow">Combination not available?</p>
      <p className="appointment-toast__title">Book an appointment</p>
    </div>
  )
}
