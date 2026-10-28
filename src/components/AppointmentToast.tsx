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
      <p className="appointment-toast__message">book an appointment</p>
      <button
        type="button"
        className="appointment-toast__close"
        aria-label="Dismiss"
        onClick={onClose}
      >
        ×
      </button>
    </div>
  )
}
