import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "compact";
}

export const Input: React.FC<InputProps> = ({
  className = "",
  variant = "default",
  disabled,
  ...props
}) => {
  const baseClasses =
    "text-[13.5px] font-medium bg-surface-2 rounded-full text-start transition-[background-color,box-shadow] duration-200 placeholder:text-ink-3";

  const interactiveClasses = disabled
    ? "opacity-60 cursor-not-allowed"
    : "hover:bg-surface-3 focus:outline-none focus:bg-surface focus:shadow-[0_0_0_3px_var(--accent-soft),0_0_0_1.5px_var(--sky-300)]";

  const variantClasses = {
    default: "h-9 px-[14px]",
    compact: "h-8 px-3",
  } as const;

  return (
    <input
      className={`${baseClasses} ${variantClasses[variant]} ${interactiveClasses} ${className}`}
      disabled={disabled}
      {...props}
    />
  );
};
