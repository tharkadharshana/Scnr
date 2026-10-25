import React from 'react';
import type { LucideIcon } from 'lucide-react';

/** Icon-only button. `label` is required: it is both the accessible name and the hover tooltip. */
export default function IconButton({ icon: Icon, label, danger, ...rest }: { icon: LucideIcon; label: string; danger?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...rest} className={`btn btn-ghost btn-icon-sm${rest.className ? ` ${rest.className}` : ''}`} style={danger ? { color: 'var(--coral)', ...rest.style } : rest.style} aria-label={label} title={label}>
      <Icon size={16} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}
