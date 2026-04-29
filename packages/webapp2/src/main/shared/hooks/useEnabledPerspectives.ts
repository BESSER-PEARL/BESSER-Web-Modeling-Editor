import { useEffect, useState } from 'react';
import { settingsService, EnabledPerspectives } from '@besser/wme';

/**
 * Subscribe to the global modeling-perspective toggles. The returned map
 * lists which use-case perspectives are enabled (web application, agent,
 * state machine, user modeling, quantum). The data-modeling perspective
 * (Class + Object diagrams plus database, OOP, and schema generators) is
 * always enabled and is not part of this map.
 *
 * Use the helpers in `shared/perspectives.ts` (`isDiagramVisible`,
 * `isGeneratorVisible`) to translate this map into actual UI visibility.
 */
export function useEnabledPerspectives(): EnabledPerspectives {
  const [perspectives, setPerspectives] = useState<EnabledPerspectives>(() => settingsService.getEnabledPerspectives());

  useEffect(() => {
    const unsubscribe = settingsService.onSettingsChange((settings) => {
      setPerspectives({ ...settings.enabledPerspectives });
    });
    return unsubscribe;
  }, []);

  return perspectives;
}
