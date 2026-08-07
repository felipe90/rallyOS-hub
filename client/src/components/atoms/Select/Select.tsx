import type { SelectProps } from './Select.types';

/**
 * Select Atom — native dropdown with the project's shared input styling.
 *
 * Wraps a native <select> so the visual language matches the Input atom
 * (surface-low, rounded, focus ring). The onChange callback receives the raw
 * string value (not the event) for ergonomic use in controlled forms.
 *
 * No-Line Rule compliant: same ghost-border style as Input.
 */
export function Select({
  label,
  error,
  hint,
  options,
  onChange,
  className = '',
  ...props
}: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="font-body text-sm font-medium text-text">
          {label}
        </label>
      )}
      <select
        className={`
          w-full px-4 py-3 rounded-[--radius-md]
          font-body text-base
          bg-surface-low text-text-h
          transition-all duration-200
          hover:bg-surface-high
          focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-surface
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? 'ring-2 ring-red-500/50' : ''}
          ${className}
        `}
        onChange={(e) => onChange?.(e.target.value)}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {(error || hint) && (
        <span className={`text-sm ${error ? 'text-red-500' : 'text-text/70'}`}>
          {error || hint}
        </span>
      )}
    </div>
  );
}
