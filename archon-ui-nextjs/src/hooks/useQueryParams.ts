"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";

/**
 * Type-safe URL query parameter schema
 */
export type QueryParamSchema = Record<string, string | number | boolean | string[] | null>;

/**
 * Options for updating query parameters
 */
export interface UpdateQueryParamsOptions {
  /**
   * Whether to replace the current history entry instead of pushing a new one
   * @default true
   */
  replace?: boolean;

  /**
   * Whether to scroll to top after navigation
   * @default false
   */
  scroll?: boolean;
}

/**
 * Serialize a value to a URL query parameter string
 */
function serializeValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    // Arrays: join with comma
    return value.length > 0 ? value.join(",") : null;
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return String(value);
}

/**
 * Deserialize a URL query parameter string to the expected type
 */
function deserializeValue<T>(
  value: string | null,
  defaultValue: T
): T {
  if (value === null || value === undefined) {
    return defaultValue;
  }

  // Array type
  if (Array.isArray(defaultValue)) {
    return (value ? value.split(",").filter(Boolean) : []) as T;
  }

  // Boolean type
  if (typeof defaultValue === "boolean") {
    return (value === "true") as T;
  }

  // Number type
  if (typeof defaultValue === "number") {
    const num = Number(value);
    return (isNaN(num) ? defaultValue : num) as T;
  }

  // String type
  return value as T;
}

/**
 * Hook for reading and writing URL query parameters with type safety
 *
 * @param schema - Default values for query parameters (defines type schema)
 * @param options - Options for URL updates
 *
 * @example
 * ```tsx
 * // Define your filter schema
 * const [params, setParams, updateParam] = useQueryParams({
 *   search: "",
 *   archived: false,
 *   view: "table" as "table" | "grid",
 *   status: [] as string[],
 *   page: 1,
 * });
 *
 * // Read params
 * console.log(params.search); // string
 * console.log(params.archived); // boolean
 * console.log(params.status); // string[]
 *
 * // Update single param (merges with existing)
 * updateParam("search", "test");
 * updateParam("archived", true);
 * updateParam("status", ["todo", "doing"]);
 *
 * // Replace all params
 * setParams({
 *   search: "new search",
 *   archived: false,
 *   view: "grid",
 *   status: [],
 *   page: 1,
 * });
 *
 * // Clear a param (set to default)
 * updateParam("search", "");
 * ```
 */
export function useQueryParams<T extends QueryParamSchema>(
  schema: T,
  options: UpdateQueryParamsOptions = {}
): [
  params: T,
  setParams: (newParams: Partial<T>, updateOptions?: UpdateQueryParamsOptions) => void,
  updateParam: <K extends keyof T>(key: K, value: T[K], updateOptions?: UpdateQueryParamsOptions) => void
] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const defaultOptions: UpdateQueryParamsOptions = {
    replace: true,
    scroll: false,
    ...options,
  };

  /**
   * Parse current URL params into typed object
   */
  const params = useMemo(() => {
    const result = {} as T;

    for (const [key, defaultValue] of Object.entries(schema)) {
      const urlValue = searchParams.get(key);
      result[key as keyof T] = deserializeValue(urlValue, defaultValue);
    }

    return result;
  }, [searchParams, schema]);

  /**
   * Build URLSearchParams from partial params
   */
  const buildSearchParams = useCallback(
    (newParams: Partial<T>) => {
      const urlParams = new URLSearchParams();

      // Merge with current params
      const mergedParams = { ...params, ...newParams };

      // Serialize and add to URLSearchParams
      for (const [key, value] of Object.entries(mergedParams)) {
        const defaultValue = schema[key];

        // Skip if value equals default (clean URLs)
        if (value === defaultValue) {
          continue;
        }

        const serialized = serializeValue(value);
        if (serialized !== null) {
          urlParams.set(key, serialized);
        }
      }

      return urlParams;
    },
    [params, schema]
  );

  /**
   * Set multiple query parameters at once
   */
  const setParams = useCallback(
    (newParams: Partial<T>, updateOptions?: UpdateQueryParamsOptions) => {
      const opts = { ...defaultOptions, ...updateOptions };
      const urlParams = buildSearchParams(newParams);
      const queryString = urlParams.toString();
      const url = queryString ? `${pathname}?${queryString}` : pathname;

      if (opts.replace) {
        router.replace(url, { scroll: opts.scroll });
      } else {
        router.push(url, { scroll: opts.scroll });
      }
    },
    [buildSearchParams, pathname, router, defaultOptions]
  );

  /**
   * Update a single query parameter
   */
  const updateParam = useCallback(
    <K extends keyof T>(key: K, value: T[K], updateOptions?: UpdateQueryParamsOptions) => {
      setParams({ [key]: value } as Partial<T>, updateOptions);
    },
    [setParams]
  );

  return [params, setParams, updateParam];
}

/**
 * Simple hook for managing a single query parameter
 *
 * @example
 * ```tsx
 * const [search, setSearch] = useQueryParam("search", "");
 * const [page, setPage] = useQueryParam("page", 1);
 * const [archived, setArchived] = useQueryParam("archived", false);
 * ```
 */
export function useQueryParam<T extends string | number | boolean | string[]>(
  key: string,
  defaultValue: T,
  options?: UpdateQueryParamsOptions
): [value: T, setValue: (newValue: T) => void] {
  const [params, , updateParam] = useQueryParams(
    { [key]: defaultValue } as QueryParamSchema,
    options
  );

  const value = params[key] as T;
  const setValue = useCallback(
    (newValue: T) => {
      updateParam(key, newValue);
    },
    [updateParam, key]
  );

  return [value, setValue];
}
