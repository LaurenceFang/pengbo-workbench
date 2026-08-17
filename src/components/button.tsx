import { forwardRef, type ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "ghost" | "text";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "ghost", className, type = "button", ...props },
  ref,
) {
  const variantClassName = `${variant}-button`;

  return <button ref={ref} {...props} className={className ? `${variantClassName} ${className}` : variantClassName} type={type} />;
});

Button.displayName = "Button";
