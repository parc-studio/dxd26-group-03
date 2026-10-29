import { useCallback, type AnimationEvent } from "react";
import "./AppointmentToast.css";

interface AppointmentToastProps {
  exiting?: boolean;
  onClose: () => void;
  onExited: () => void;
}

export function AppointmentToast({
  exiting = false,
  onClose,
  onExited,
}: AppointmentToastProps) {
  const handleAnimationEnd = useCallback(
    (event: AnimationEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return;
      if (!exiting) return;
      onExited();
    },
    [exiting, onExited],
  );

  return (
    <div
      className={`appointment-toast${exiting ? " is-leaving" : ""}`}
      role="status"
      aria-live="polite"
      onAnimationEnd={handleAnimationEnd}
    >
      <button
        type="button"
        className="appointment-toast__close"
        aria-label="Close"
        onClick={onClose}
        disabled={exiting}
      >
        {/* same 24px stroke icon as JewelleryReveal's close */}
        <svg
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <p className="appointment-toast__eyebrow">Combination not available</p>
      <p className="appointment-toast__title">Book an appointment?</p>
    </div>
  );
}
