/**
 * Rendering flavor for class diagrams.
 * - 'UML' (default) — standard UML class notation
 * - 'ER' — Chen-style entity-relationship flavor (rendering-only; no metamodel change)
 */
export type ClassNotation = 'UML' | 'ER';

/**
 * Use-case modeling perspectives that can be toggled on/off in settings.
 * Each perspective bundles a set of diagram types and generators; a diagram
 * or generator is visible whenever at least one enabled perspective lists
 * it (perspectives may share diagrams — e.g. ClassDiagram appears in data
 * modeling, database, web applications, and state machines).
 */
export type ModelingPerspective =
  | 'dataModeling'
  | 'database'
  | 'webApplication'
  | 'agent'
  | 'stateMachine'
  | 'userModeling'
  | 'quantum'
  | 'neuralNetwork';

export const MODELING_PERSPECTIVES: ModelingPerspective[] = [
  'dataModeling',
  'database',
  'webApplication',
  'agent',
  'stateMachine',
  'userModeling',
  'quantum',
  'neuralNetwork',
];

export type EnabledPerspectives = Record<ModelingPerspective, boolean>;

/**
 * Interface for application settings
 */
export interface IApplicationSettings {
  /** Whether to show instantiated class objects in object diagram preview */
  showInstancedObjects: boolean;
  /** Whether to show class icons in the diagram */
  showIconView: boolean;
  /** Whether to show association names in the diagram */
  showAssociationNames: boolean;
  /** Whether to use the right-side properties panel instead of the floating popover */
  usePropertiesPanel: boolean;
  /** Rendering flavor for class diagrams */
  classNotation: ClassNotation;
  /** Which modeling perspectives are enabled (visible in the workspace) */
  enabledPerspectives: EnabledPerspectives;
  /** Other settings can be added here */
  // theme: 'light' | 'dark';
  // autoSave: boolean;
}

const DEFAULT_ENABLED_PERSPECTIVES: EnabledPerspectives = {
  dataModeling: true,
  database: true,
  webApplication: true,
  agent: true,
  stateMachine: true,
  userModeling: true,
  quantum: true,
  neuralNetwork: true,
};

/**
 * Default settings configuration
 */
export const DEFAULT_SETTINGS: IApplicationSettings = {
  showInstancedObjects: true, // Default to true to show instances
  showIconView: false, // Default to false to hide class icons
  showAssociationNames: false, // Default to false to hide association names
  usePropertiesPanel: true, // Default to true to use the right-side properties panel
  classNotation: 'UML', // Default to UML notation for class diagrams
  enabledPerspectives: { ...DEFAULT_ENABLED_PERSPECTIVES },
};

/**
 * Settings service interface
 */
export interface ISettingsService {
  /**
   * Get current settings
   */
  getSettings(): IApplicationSettings;
  
  /**
   * Update specific setting
   */
  updateSetting<K extends keyof IApplicationSettings>(
    key: K, 
    value: IApplicationSettings[K]
  ): void;
  
  /**
   * Reset to default settings
   */
  resetToDefaults(): void;
  
  /**
   * Subscribe to settings changes
   */
  onSettingsChange(callback: (settings: IApplicationSettings) => void): () => void;
}

/**
 * Implementation of the settings service for standalone version
 */
export class SettingsService implements ISettingsService {
  private settings: IApplicationSettings;
  private readonly STORAGE_KEY = 'besser-standalone-settings';
  private listeners: Array<(settings: IApplicationSettings) => void> = [];

  constructor() {
    this.settings = this.loadSettings();
  }

  /**
   * Load settings from localStorage with fallback to defaults
   */
  private loadSettings(): IApplicationSettings {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsedSettings = JSON.parse(stored);
        // Only carry through known perspective keys — drops any legacy keys
        // from previous shapes of this setting.
        const storedPerspectives = parsedSettings?.enabledPerspectives ?? {};
        const enabledPerspectives = { ...DEFAULT_ENABLED_PERSPECTIVES };
        for (const key of MODELING_PERSPECTIVES) {
          if (typeof storedPerspectives[key] === 'boolean') {
            enabledPerspectives[key] = storedPerspectives[key];
          }
        }
        return {
          ...DEFAULT_SETTINGS,
          ...parsedSettings,
          enabledPerspectives,
        };
      }
    } catch (error) {
      console.warn('Failed to load settings from localStorage:', error);
    }
    return { ...DEFAULT_SETTINGS };
  }

  /**
   * Save settings to localStorage
   */
  private saveSettings(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.settings));
    } catch (error) {
      console.warn('Failed to save settings to localStorage:', error);
    }
  }

  /**
   * Notify all listeners of settings changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(callback => {
      try {
        callback({ ...this.settings });
      } catch (error) {
        console.error('Error in settings change listener:', error);
      }
    });
  }

  /**
   * Get current settings (returns a copy to prevent external mutations)
   */
  getSettings(): IApplicationSettings {
    return { ...this.settings };
  }

  /**
   * Update a specific setting
   */
  updateSetting<K extends keyof IApplicationSettings>(
    key: K, 
    value: IApplicationSettings[K]
  ): void {
    if (this.settings[key] !== value) {
      this.settings[key] = value;
      this.saveSettings();
      this.notifyListeners();
    }
  }

  /**
   * Reset all settings to their default values
   */
  resetToDefaults(): void {
    this.settings = { ...DEFAULT_SETTINGS };
    this.saveSettings();
    this.notifyListeners();
  }

  /**
   * Subscribe to settings changes
   * Returns an unsubscribe function
   */
  onSettingsChange(callback: (settings: IApplicationSettings) => void): () => void {
    this.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Get a specific setting value
   */
  getSetting<K extends keyof IApplicationSettings>(key: K): IApplicationSettings[K] {
    return this.settings[key];
  }

  /**
   * Check if instances should be shown in object preview
   */
  shouldShowInstancedObjects(): boolean {
    return this.settings.showInstancedObjects;
  }

  /**
   * Check if icons should be shown in the diagram
   */
  shouldShowIconView(): boolean {
    return this.settings.showIconView;
  }

  /**
   * Check if association names should be shown in the diagram
   */
  shouldShowAssociationNames(): boolean {
    return this.settings.showAssociationNames;
  }

  /**
   * Check if the right-side properties panel should be used instead of the floating popover
   */
  shouldUsePropertiesPanel(): boolean {
    return this.settings.usePropertiesPanel;
  }

  /**
   * Get the current class-diagram rendering notation
   */
  getClassNotation(): ClassNotation {
    return this.settings.classNotation;
  }

  /**
   * Get the map of enabled modeling perspectives.
   * ClassDiagram is always implicitly enabled and is not part of this map.
   */
  getEnabledPerspectives(): EnabledPerspectives {
    return { ...this.settings.enabledPerspectives };
  }

  /**
   * Whether a given modeling perspective is enabled.
   * The data-modeling perspective is always considered enabled and is not
   * tracked here.
   */
  isPerspectiveEnabled(perspective: ModelingPerspective): boolean {
    return this.settings.enabledPerspectives[perspective] !== false;
  }

  /**
   * Toggle a single modeling perspective. Persists and notifies listeners.
   */
  setPerspectiveEnabled(perspective: ModelingPerspective, enabled: boolean): void {
    const next = { ...this.settings.enabledPerspectives, [perspective]: enabled };
    this.updateSetting('enabledPerspectives', next);
  }
}

/**
 * Singleton instance of the settings service
 */
export const settingsService = new SettingsService();
