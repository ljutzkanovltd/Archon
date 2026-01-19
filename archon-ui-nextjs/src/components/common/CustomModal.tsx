"use client";

import { cn } from "@/lib/utils";
import { FC, PropsWithChildren, useRef } from "react";
import ReactIcons from "../ReactIcons";
import { createPortal } from "react-dom";

type Props = PropsWithChildren<{
  open: boolean;
  close(): void;
  title: string;
  description?: string;
  size?: "NORMAL" | "LARGE" | "FULL" | "MEDIUM";
  headerClassName?: string;
  containerClassName?: string;
}>;

const modalWidth = {
  NORMAL: "max-w-xl",
  LARGE: "max-w-5xl",
  FULL: "max-w-full",
  MEDIUM: "max-w-3xl",
};

const CustomModal: FC<Props> = ({
  children,
  open,
  close,
  title,
  description,
  size = "NORMAL",
  headerClassName,
  containerClassName,
}) => {
  const modalRef = useRef(null);

  if (!open) {
    return <></>;
  }

  // Ensure we're on the client side before using createPortal
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <section className="fixed top-0 h-screen bottom-0 left-0 right-0 z-[100] flex justify-center items-center w-full max-h-screen bg-black/50">
      <div
        className={cn("relative p-4 w-full mx-auto", size && modalWidth[size])}
      >
        <div
          ref={modalRef}
          className="relative bg-white rounded-lg shadow-sm dark:bg-gray-700 max-h-screen flex flex-col"
        >
          {/* Modal Header */}
          <div
            className={cn(
              "flex-shrink-0 flex flex-col justify-between p-4 md:p-5 border-b border-gray-200 dark:border-gray-600 rounded-t",
              headerClassName
            )}
          >
            <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">
              {title}
            </h3>
            {description && (
              <p className="font-light text-gray-500">{description}</p>
            )}
            <button
              type="button"
              className="text-gray-400 absolute right-4 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center dark:hover:bg-gray-600 dark:hover:text-white"
              onClick={close}
            >
              <ReactIcons icon="CLOSE" size={24} />
            </button>
          </div>

          {/* Modal Body */}
          <div
            className={cn(
              "flex gap-8 flex-col flex-1 overflow-auto min-h-0",
              containerClassName
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </section>,
    document.body
  );
};

export default CustomModal;
