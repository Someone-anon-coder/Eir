import type { ReactNode } from "react";

interface ModalProps {
  testId: string;
  titleId: string;
  title: string;
  children: ReactNode;
}

export function Modal({ testId, titleId, title, children }: ModalProps) {
  return (
    <div className="modal-overlay">
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid={testId}
      >
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </div>
  );
}
