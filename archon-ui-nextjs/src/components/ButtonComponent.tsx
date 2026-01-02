"use client";

import { ButtonProps, ButtonType, ButtonVariant } from "@/lib/types";
import { cn } from "@/lib/utils";
import ReactIcons from "./ReactIcons";

const ButtonComponent = ({
  name,
  icon,
  color,
  variant = ButtonVariant.PRIMARY,
  type = ButtonType.BUTTON,
  className,
  isLoading,
  disabled,
  checkbox,
  iconLeft = true,
  onCheckboxChange = () => {},
  checked,
  iconClassName,
  fullWidth = true,
  ...buttonProps
}: ButtonProps) => {
  // Note: Dynamic colors (color prop) are not supported in Tailwind JIT mode
  // Use className prop to pass custom colors if needed
  const variantClass = {
    primary: cn(
      "text-white bg-brand-700 border border-brand-700",
      "hover:bg-brand-800 hover:border-brand-800",
      "active:bg-brand-900 active:border-brand-900",
      "dark:bg-brand-600 dark:border-brand-600",
      "dark:hover:bg-brand-700 dark:hover:border-brand-700",
      "dark:active:bg-brand-800",
      "disabled:bg-gray-400 disabled:border-gray-400 disabled:text-gray-200",
      "transition-colors"
    ),

    secondary: cn(
      "bg-white border border-brand-700 text-brand-700",
      "hover:bg-gray-100",
      "active:bg-gray-200",
      "dark:bg-gray-800 dark:border-brand-500 dark:text-brand-400",
      "dark:hover:bg-gray-700",
      "dark:active:bg-gray-600",
      "disabled:text-gray-400 disabled:border-gray-400 disabled:bg-gray-50",
      "transition-colors"
    ),

    ghost: cn(
      "bg-white border border-gray-300 text-gray-700",
      "hover:bg-gray-100 hover:border-gray-400",
      "active:bg-gray-200",
      "dark:bg-transparent dark:border-gray-600 dark:text-gray-300",
      "dark:hover:bg-gray-700 dark:hover:border-gray-500",
      "dark:active:bg-gray-600",
      "transition-colors"
    ),

    danger: cn(
      "text-white bg-red-600 border border-red-600",
      "hover:bg-red-700 hover:border-red-700",
      "active:bg-red-800 active:border-red-800",
      "dark:bg-red-700 dark:border-red-700",
      "dark:hover:bg-red-600 dark:hover:border-red-600",
      "dark:active:bg-red-800",
      "disabled:bg-gray-400 disabled:border-gray-400",
      "transition-colors"
    ),
  };

  const buttonClass = checked
    ? "border-green-500 text-green-500 hover:border-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
    : "";

  return (
    <button
      className={cn(
        "button",
        fullWidth && "w-full",
        variantClass[variant],
        className,
        checked && buttonClass,
        !name && "h-10.5 w-fit",
        disabled && " cursor-not-allowed pointer-events-none"
      )}
      type={type ?? ButtonType.BUTTON}
      disabled={disabled || isLoading}
      {...buttonProps}
    >
      {checkbox && !checked && typeof onCheckboxChange === "function" && (
        <input
          type="checkbox"
          className="mr-2 bg-gray-50 rounded-sm"
          checked={checked}
          onChange={onCheckboxChange}
        />
      )}
      {checked && <ReactIcons icon="CHECK" className="text-green-500" />}
      {icon && iconLeft && <ReactIcons icon={icon} className={iconClassName} />}
      {name}
      {icon && !iconLeft && (
        <ReactIcons icon={icon} className={iconClassName} />
      )}
      {isLoading && (
        <ReactIcons
          icon="SPINNER"
          color={
            checkbox || variant !== ButtonVariant.PRIMARY ? "red" : "white"
          }
          className="animate-spin"
        />
      )}
    </button>
  );
};

export default ButtonComponent;
