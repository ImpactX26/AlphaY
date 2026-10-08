import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'approve';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  children?: ReactNode;
}

export function Button({ variant = 'secondary', size = 'md', loading, icon: Icon, iconRight: IconRight, children, className, disabled, type = 'button', ...rest }: ButtonProps) {
  const iconSize = size === 'sm' ? 15 : 17;
  return (
    <button
      type={type}
      className={clsx('btn', `btn-${variant}`, size === 'sm' && 'btn-sm', size === 'lg' && 'btn-lg', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size={iconSize} /> : Icon ? <Icon size={iconSize} aria-hidden /> : null}
      {children}
      {IconRight && !loading ? <IconRight size={iconSize} aria-hidden /> : null}
    </button>
  );
}

export function IconButton({ label, icon: Icon, className, ...rest }: { label: string; icon: LucideIcon } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={clsx('icon-btn', className)} aria-label={label} title={label} {...rest}>
      <Icon size={19} aria-hidden />
    </button>
  );
}
