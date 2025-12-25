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
  const variantClass = {
    primary: cn(
      color
        ? `text-${color} bg-${color} border border-[1px] border-brand-700 hover:bg-${color} hover:text-${color} disabled:bg-gray-400`
        : "text-white bg-brand-700 hover:bg-brand-800 hover:text-white disabled:bg-gray-400"
    ),

    secondary: cn(
      "bg-white border border-[1px] border-brand-700 hover:bg-gray-100 disabled:text-gray-400! disabled:border-gray-400!",
      color ? `text-${color} border-${color}` : "text-brand-700"
    ),

    ghost: cn(
      "bg-white border border-[1px] border-light-700 hover:bg-gray-100",
      color ? `text-${color}` : "text-brand-700"
    ),

    danger: cn(
      "text-white bg-red-600 hover:bg-red-700 border border-red-600 hover:border-red-700 disabled:bg-gray-400"
    ),
  };

  const buttonClass = checked
    ? "border-green-500 text-green-500"
    : "border-brand-700 text-brand-700";

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
