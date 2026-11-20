import { useEffect, useState } from 'react';
import { getLabEnabled, peekLabEnabled } from '../services/labConfig';

/** Whether this instance is a BESSER Lab: false until the server config says otherwise. */
export function useLabMode(): boolean {
  const [enabled, setEnabled] = useState(peekLabEnabled);
  useEffect(() => {
    let cancelled = false;
    void getLabEnabled().then((value) => {
      if (!cancelled) setEnabled(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return enabled;
}
