import React from "react";
import SelectComponent from "react-select";
import CreatableSelect from "react-select/creatable";
import { components as selectParts } from "react-select";
import type { DropdownIndicatorProps } from "react-select";
import { ChevronDown } from "./icons";
import type {
  ActionMeta,
  Props as ReactSelectProps,
  SingleValue,
  StylesConfig,
} from "react-select";

export type SelectOption = {
  value: string;
  label: string;
  isDisabled?: boolean;
};

type BaseProps = {
  value: string | null;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  isClearable?: boolean;
  onChange: (value: string | null, action: ActionMeta<SelectOption>) => void;
  onBlur?: () => void;
  className?: string;
  formatCreateLabel?: (input: string) => string;
};

type CreatableProps = {
  isCreatable: true;
  onCreateOption: (value: string) => void;
};

type NonCreatableProps = {
  isCreatable?: false;
  onCreateOption?: never;
};

export type SelectProps = BaseProps & (CreatableProps | NonCreatableProps);

const baseBackground = "var(--surface-2)";
const hoverBackground = "var(--surface-3)";
const focusBackground = "var(--accent-soft)";

const selectStyles: StylesConfig<SelectOption, false> = {
  control: (base, state) => ({
    ...base,
    minHeight: 36,
    borderRadius: 999,
    border: 0,
    boxShadow: state.isFocused ? "0 0 0 1.5px var(--sky-300)" : "none",
    backgroundColor: state.isFocused ? focusBackground : baseBackground,
    fontSize: "13.5px",
    fontWeight: 600,
    color: "var(--color-text)",
    transition: "background-color 200ms ease, box-shadow 200ms ease",
    ":hover": {
      backgroundColor: state.isFocused ? focusBackground : hoverBackground,
    },
  }),
  valueContainer: (base) => ({
    ...base,
    paddingInline: 14,
    paddingBlock: 2,
  }),
  input: (base) => ({
    ...base,
    color: "var(--color-text)",
  }),
  singleValue: (base) => ({
    ...base,
    color: "var(--color-text)",
  }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: "var(--color-ink-3)",
    ":hover": {
      color: "var(--color-text)",
    },
  }),
  clearIndicator: (base) => ({
    ...base,
    color: "var(--color-ink-3)",
    ":hover": {
      color: "var(--color-text)",
    },
  }),
  indicatorSeparator: () => ({ display: "none" }),
  menu: (provided) => ({
    ...provided,
    zIndex: 30,
    backgroundColor: "var(--surface)",
    color: "var(--color-text)",
    borderRadius: 14,
    overflow: "hidden",
    border: "1px solid var(--hairline)",
    boxShadow: "none",
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? focusBackground
      : state.isFocused
        ? "var(--surface-2)"
        : "transparent",
    fontSize: "13.5px",
    fontWeight: state.isSelected ? 600 : 500,
    color: "var(--color-text)",
    cursor: state.isDisabled ? "not-allowed" : base.cursor,
    opacity: state.isDisabled ? 0.5 : 1,
  }),
  placeholder: (base) => ({
    ...base,
    color: "var(--color-ink-3)",
  }),
};

// Bicon's chevron in place of react-select's own.
const DropdownIndicator = (
  props: DropdownIndicatorProps<SelectOption, false>,
) => (
  <selectParts.DropdownIndicator {...props}>
    <ChevronDown size={14} />
  </selectParts.DropdownIndicator>
);

export const Select: React.FC<SelectProps> = React.memo(
  ({
    value,
    options,
    placeholder,
    disabled,
    isLoading,
    isClearable = true,
    onChange,
    onBlur,
    className = "",
    isCreatable,
    formatCreateLabel,
    onCreateOption,
  }) => {
    const selectValue = React.useMemo(() => {
      if (!value) return null;
      const existing = options.find((option) => option.value === value);
      if (existing) return existing;
      return { value, label: value, isDisabled: false };
    }, [value, options]);

    const handleChange = (
      option: SingleValue<SelectOption>,
      action: ActionMeta<SelectOption>,
    ) => {
      onChange(option?.value ?? null, action);
    };

    const sharedProps: Partial<ReactSelectProps<SelectOption, false>> = {
      className,
      classNamePrefix: "app-select",
      value: selectValue,
      options,
      onChange: handleChange,
      placeholder,
      isDisabled: disabled,
      isLoading,
      onBlur,
      isClearable,
      styles: selectStyles,
      components: { DropdownIndicator },
    };

    if (isCreatable) {
      return (
        <CreatableSelect<SelectOption, false>
          {...sharedProps}
          onCreateOption={onCreateOption}
          formatCreateLabel={formatCreateLabel}
        />
      );
    }

    return <SelectComponent<SelectOption, false> {...sharedProps} />;
  },
);

Select.displayName = "Select";
