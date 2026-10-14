import React, { createContext, ReactElement, ReactNode, useContext, useEffect, useState } from 'react';

type Listener<T> = (value: T | null) => void;

interface HostProviderRootProps<T> {
  initialValue: T | null;
  register: (listener: Listener<T>) => void;
  children?: ReactNode;
}

/**
 * A React context whose value the host application sets imperatively through
 * an `ApollonEditor` setter (lineage, element picker, agent-diagram linker).
 * The editor stays storage-agnostic: the host owns project data and the editor
 * only reads the provider from context.
 */
export interface HostProviderContext<T> {
  /** Reads the current host value (null when the host has not set one). */
  useValue: () => T | null;
  /** Provider root that exposes its state setter through `register`. */
  Root: React.FC<HostProviderRootProps<T>>;
}

export function createHostProviderContext<T>(): HostProviderContext<T> {
  const Context = createContext<T | null>(null);

  const Root: React.FC<HostProviderRootProps<T>> = ({ initialValue, register, children }) => {
    const [value, setValue] = useState<T | null>(initialValue);
    useEffect(() => {
      register(setValue);
    }, [register]);
    return <Context.Provider value={value}>{children}</Context.Provider>;
  };

  return { useValue: () => useContext(Context), Root };
}

/**
 * Holds one host value on the `ApollonEditor` instance and forwards updates to
 * the mounted provider root, so a setter call never rebuilds the editor tree.
 */
export class HostProviderSlot<T> {
  private value: T | null = null;
  private listener: Listener<T> | null = null;

  constructor(private readonly context: HostProviderContext<T>) {}

  set(value: T | null): void {
    this.value = value;
    this.listener?.(value);
  }

  /** Wraps `child` in this slot's provider root. Call on every editor (re)mount. */
  wrap(child: ReactElement): ReactElement {
    return React.createElement(this.context.Root, {
      initialValue: this.value,
      // The root registers after its first render; push the latest value then,
      // in case the host set it between creating the element and the mount.
      register: (listener: Listener<T>) => {
        this.listener = listener;
        listener(this.value);
      },
      children: child,
    });
  }
}
