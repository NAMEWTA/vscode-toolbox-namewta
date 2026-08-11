import type { JSX } from 'react';

export function GitReviewIconButton({
  label,
  icon,
  onClick,
  danger = false,
}: {
  readonly label: string;
  readonly icon: JSX.Element;
  readonly onClick: () => void;
  readonly danger?: boolean;
}): JSX.Element {
  return (
    <button
      className={`icon-button${danger ? ' icon-button--danger' : ''}`}
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}
