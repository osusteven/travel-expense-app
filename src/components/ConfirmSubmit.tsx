"use client";

import { useFormStatus } from "react-dom";

/** Submit button that asks for confirmation first. */
export function ConfirmSubmit({
  message,
  children,
  className = "btn-secondary",
}: {
  message: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
