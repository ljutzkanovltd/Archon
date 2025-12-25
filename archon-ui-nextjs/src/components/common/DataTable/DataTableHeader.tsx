"use client";

import { Button } from "flowbite-react";
import { useDataTableContext } from "./context/DataTableContext";

export function DataTableHeader() {
  const { tableButtons } = useDataTableContext();

  if (!tableButtons || tableButtons.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-wrap gap-2">
        {tableButtons.map((button, index) => (
          <Button
            key={index}
            onClick={button.onClick}
            color={
              button.variant === "primary"
                ? "blue"
                : button.variant === "danger"
                  ? "failure"
                  : "light"
            }
            disabled={button.disabled}
            size="sm"
          >
            {button.icon && <button.icon className="mr-2 h-4 w-4" />}
            {button.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
