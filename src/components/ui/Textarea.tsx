import React from "react";

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: "default" | "compact";
}

export const Textarea: React.FC<TextareaProps> = ({
  className = "",
  variant = "default",
  ...props
}) => {
  const baseClasses =
    "text-[13.5px] leading-[1.5] bg-surface-2 rounded-[14px] text-start transition-[background-color,box-shadow] duration-200 hover:bg-surface-3 focus:outline-none focus:bg-surface focus:shadow-[0_0_0_3px_var(--accent-soft),0_0_0_1.5px_var(--sky-300)] placeholder:text-ink-3 resize-y";

  const variantClasses = {
    default: "px-[14px] py-[10px] min-h-[100px]",
    compact: "px-3 py-2 min-h-[80px]",
  };

  return (
    <textarea
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
};
