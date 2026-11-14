import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "@/components/ui/icons";
import { useTranslation } from "react-i18next";

export interface DropdownOption {
  value: string;
  label: React.ReactNode;
  description?: string;
  disabled?: boolean;
}

interface DropdownProps {
  options: DropdownOption[];
  className?: string;
  menuClassName?: string;
  selectedValue: string | null;
  onSelect: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onOpen?: () => void;
  /** Where the menu opens: below the button (default), or above it. */
  placement?: "below" | "above";
  /** Highlight colour for hover and selection. */
  tone?: "brand" | "neutral";
}

export const Dropdown: React.FC<DropdownProps> = ({
  options,
  selectedValue,
  onSelect,
  className = "",
  menuClassName,
  placeholder = "Select an option...",
  disabled = false,
  onOpen,
  placement = "below",
  tone = "brand",
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // The trigger's hover; in the menu, hover is grey so it never looks chosen.
  const hover =
    tone === "neutral" ? "hover:bg-surface-3" : "hover:bg-surface-3";
  const chosen = tone === "neutral" ? "bg-surface-2" : "bg-accent-soft";

  const selectedOption = options.find(
    (option) => option.value === selectedValue,
  );

  const handleSelect = (value: string) => {
    onSelect(value);
    setIsOpen(false);
  };

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) onOpen?.();
    setIsOpen(!isOpen);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || !isOpen || disabled) return;
    event.preventDefault();
    event.stopPropagation();
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div
      className={`relative ${className}`}
      ref={dropdownRef}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        ref={triggerRef}
        className={`h-9 ps-[14px] pe-[12px] text-[13.5px] font-semibold bg-surface-2 rounded-full min-w-[200px] w-full text-start grid grid-cols-[1fr_auto] gap-2 items-center transition-colors duration-200 ${
          disabled ? "opacity-50 cursor-not-allowed" : `${hover} cursor-pointer`
        }`}
        onClick={handleToggle}
        disabled={disabled}
        aria-expanded={isOpen}
      >
        <span className="truncate">{selectedOption?.label || placeholder}</span>
        <ChevronDown
          size={14}
          className={`w-3.5 h-3.5 text-ink-3 transition-transform duration-200 ${isOpen ? "transform rotate-180" : ""}`}
        />
      </button>
      {isOpen && !disabled && (
        <div
          className={`absolute ${placement === "above" ? "bottom-full mb-1" : "top-full mt-1"} bg-surface rounded-[14px] border border-[var(--hairline)] z-50 max-h-60 overflow-y-auto p-1.5 animate-drop ${
            menuClassName ?? "left-0 right-0"
          }`}
        >
          {options.length === 0 ? (
            <div className="px-2 py-1.5 text-sm text-ink-3">
              {t("common.noOptionsFound")}
            </div>
          ) : (
            options.map((option) => {
              const isChosen = selectedValue === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`flex w-full items-center gap-2 rounded-[9px] px-2.5 text-[13.5px] text-start transition-colors duration-150 ${
                    option.description ? "py-2" : "py-1.5"
                  } ${isChosen ? chosen : "hover:bg-wash"} ${
                    option.disabled ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  onClick={() => handleSelect(option.value)}
                  disabled={option.disabled}
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block whitespace-normal break-words ${
                        isChosen ? "font-semibold" : ""
                      }`}
                    >
                      {option.label}
                    </span>
                    {option.description && (
                      <span className="mt-0.5 block whitespace-normal text-xs font-normal leading-snug text-ink-3">
                        {option.description}
                      </span>
                    )}
                  </span>
                  {isChosen && (
                    <Check size={16} className="shrink-0 text-accent" />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
