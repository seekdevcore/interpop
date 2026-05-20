import type { ReactNode } from 'react';
import './Badge.css';

interface BadgeProps {
  children: ReactNode;
  variant?: 'primary' | 'subtle';
  /** Editorial accent — drives the per-category color via `data-category`. */
  category?: string;
}

export function Badge({ children, variant = 'primary', category }: BadgeProps) {
  return (
    <span className={`badge badge--${variant}`} data-category={category}>
      {children}
    </span>
  );
}
