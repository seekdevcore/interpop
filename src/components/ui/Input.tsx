import type { InputHTMLAttributes } from 'react';
import './Input.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  id: string;
}

export function Input({
  label,
  error,
  id,
  className = '',
  ...props
}: InputProps) {
  return (
    <div
      className={`input-field ${error ? 'input-field--error' : ''} ${className}`}
    >
      {label && (
        <label htmlFor={id} className="input-label">
          {label}
        </label>
      )}
      <input id={id} className="input-control" {...props} />
      {error && <span className="input-error">{error}</span>}
    </div>
  );
}
