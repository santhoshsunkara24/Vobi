import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "primary-soft"
    | "secondary"
    | "outline"
    | "warning"
    | "danger"
    | "danger-ghost"
    | "ghost";
  size?: "sm" | "md" | "lg";
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className = "",
  variant = "primary",
  size = "md",
  ...props
}) => {
  const baseClasses =
    "inline-flex items-center justify-center gap-1.5 font-semibold rounded-full border whitespace-nowrap select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 transition-[background-color,border-color,color,filter,transform] duration-150 ease-glide active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer";

  const variantClasses = {
    // Ink: the one primary action on a screen.
    primary: "text-white bg-ink border-transparent hover:brightness-[1.15]",
    "primary-soft":
      "text-accent-text bg-accent-soft border-transparent hover:bg-sky-100",
    secondary: "text-text bg-surface-2 border-transparent hover:bg-surface-3",
    // For screens where secondary's grey fill reads as disabled (onboarding)
    outline: "text-text bg-surface border-line hover:bg-surface-2",
    // For buttons sitting on warning surfaces like SecureInputWarning
    warning: "text-text bg-surface border-transparent hover:bg-warning-wash",
    danger: "text-white bg-error border-transparent hover:brightness-110",
    "danger-ghost":
      "text-error border-transparent hover:bg-error-wash focus:bg-error-wash",
    ghost: "text-ink-2 border-transparent hover:text-text hover:bg-surface-3",
  };

  const sizeClasses = {
    sm: "h-7 px-3 text-[12.5px]",
    md: "h-[34px] px-[14px] text-[13.5px]",
    lg: "h-[42px] px-5 text-[14.5px]",
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
