import { useState, useCallback } from "react";

export interface BooleanState {
  value: boolean;
  toggle: () => void;
  setTrue: () => void;
  setFalse: () => void;
  setValue: (value: boolean) => void;
}

/**
 * Hook for managing boolean state with helper methods
 * Reduces boilerplate for common boolean operations
 *
 * @param initialValue - Initial boolean value (default: false)
 *
 * @example
 * const modal = useBooleanState(false);
 *
 * return (
 *   <>
 *     <button onClick={modal.setTrue}>Open Modal</button>
 *     {modal.value && (
 *       <Modal onClose={modal.setFalse}>
 *         <button onClick={modal.toggle}>Toggle</button>
 *       </Modal>
 *     )}
 *   </>
 * );
 *
 * @example
 * // Useful for loading states
 * const loading = useBooleanState(false);
 *
 * const fetchData = async () => {
 *   loading.setTrue();
 *   try {
 *     await api.fetchProjects();
 *   } finally {
 *     loading.setFalse();
 *   }
 * };
 */
export function useBooleanState(initialValue: boolean = false): BooleanState {
  const [value, setValue] = useState<boolean>(initialValue);

  const toggle = useCallback(() => {
    setValue((prev) => !prev);
  }, []);

  const setTrue = useCallback(() => {
    setValue(true);
  }, []);

  const setFalse = useCallback(() => {
    setValue(false);
  }, []);

  return {
    value,
    toggle,
    setTrue,
    setFalse,
    setValue,
  };
}

/**
 * Hook for managing multiple boolean flags
 * Useful for managing multiple modals, drawers, or toggles
 *
 * @param initialFlags - Object with initial boolean values
 *
 * @example
 * const flags = useBooleanFlags({
 *   createModal: false,
 *   editModal: false,
 *   deleteModal: false,
 * });
 *
 * return (
 *   <>
 *     <button onClick={() => flags.setTrue('createModal')}>Create</button>
 *     <button onClick={() => flags.setTrue('editModal')}>Edit</button>
 *     <button onClick={() => flags.setTrue('deleteModal')}>Delete</button>
 *
 *     {flags.values.createModal && <CreateModal onClose={() => flags.setFalse('createModal')} />}
 *     {flags.values.editModal && <EditModal onClose={() => flags.setFalse('editModal')} />}
 *     {flags.values.deleteModal && <DeleteModal onClose={() => flags.setFalse('deleteModal')} />}
 *   </>
 * );
 */
export function useBooleanFlags<T extends Record<string, boolean>>(
  initialFlags: T
) {
  const [values, setValues] = useState<T>(initialFlags);

  const toggle = useCallback((key: keyof T) => {
    setValues((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const setTrue = useCallback((key: keyof T) => {
    setValues((prev) => ({
      ...prev,
      [key]: true,
    }));
  }, []);

  const setFalse = useCallback((key: keyof T) => {
    setValues((prev) => ({
      ...prev,
      [key]: false,
    }));
  }, []);

  const setValue = useCallback((key: keyof T, value: boolean) => {
    setValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const reset = useCallback(() => {
    setValues(initialFlags);
  }, [initialFlags]);

  return {
    values,
    toggle,
    setTrue,
    setFalse,
    setValue,
    reset,
  };
}
