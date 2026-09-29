import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  variant?: ButtonVariant;
  /** Renders as a block-level button that fills the available width. */
  full?: boolean;
  icon?: ReactNode;
  type?: 'button' | 'submit';
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'cc-btn-primary',
  secondary: 'cc-btn-secondary',
  danger: 'cc-btn-danger',
  ghost: 'cc-btn-ghost',
};

/** The chunky pill button from the design system. */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', full = false, icon, className = '', children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`cc-btn ${VARIANT_CLASS[variant]} ${full ? 'w-full' : ''} ${className}`.trim()}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});

export default Button;
