"use client";

import { Button, Select } from "flowbite-react";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi";
import { usePagination } from "./context/DataTableContext";

export function DataTablePagination() {
  const {
    page,
    per_page,
    total,
    nextPage,
    prevPage,
    goToPage,
    setPerPage,
    hasNext,
    hasPrev,
  } = usePagination();

  const totalPages = Math.ceil(total / per_page);
  const startItem = (page - 1) * per_page + 1;
  const endItem = Math.min(page * per_page, total);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxPagesToShow = 7;

    if (totalPages <= maxPagesToShow) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show first, last, and pages around current
      if (page <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      } else if (page >= totalPages - 2) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push("...");
        for (let i = page - 1; i <= page + 1; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <div className="flex flex-col items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 sm:flex-row">
      {/* Results Info */}
      <div className="text-sm text-gray-700 dark:text-gray-300">
        Showing <span className="font-semibold">{startItem}</span> to{" "}
        <span className="font-semibold">{endItem}</span> of{" "}
        <span className="font-semibold">{total}</span> results
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center gap-2">
        {/* Previous Button */}
        <Button
          size="sm"
          color="light"
          onClick={prevPage}
          disabled={!hasPrev}
          className="px-2"
          aria-label="Go to previous page"
        >
          <HiChevronLeft className="h-5 w-5" />
        </Button>

        {/* Page Numbers */}
        <div className="flex items-center gap-1">
          {getPageNumbers().map((pageNum, index) =>
            pageNum === "..." ? (
              <span
                key={`ellipsis-${index}`}
                className="px-2 text-gray-500"
              >
                ...
              </span>
            ) : (
              <Button
                key={pageNum}
                size="sm"
                color={page === pageNum ? "blue" : "light"}
                onClick={() => goToPage(pageNum as number)}
                className="min-w-[2.5rem]"
              >
                {pageNum}
              </Button>
            )
          )}
        </div>

        {/* Next Button */}
        <Button
          size="sm"
          color="light"
          onClick={nextPage}
          disabled={!hasNext}
          className="px-2"
          aria-label="Go to next page"
        >
          <HiChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Per Page Selector */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="per-page"
          className="text-sm text-gray-700 dark:text-gray-300"
        >
          Per page:
        </label>
        <Select
          id="per-page"
          value={per_page}
          onChange={(e) => setPerPage(Number(e.target.value))}
          sizing="sm"
        >
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </Select>
      </div>
    </div>
  );
}
