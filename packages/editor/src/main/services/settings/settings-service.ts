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
  /** Other settings can be added here */
  // theme: 'light' | 'dark';
  // autoSave: boolean;
}

/**
 * Default settings configuration
 */
export const DEFAULT_SETTINGS: IApplicationSettings = {
  showInstancedObjects: true, // Default to true to show instances
  showIconView: false, // Default to false to hide class icons
  showAssociationNames: false, // Default to false to hide association names
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
        // Merge with defaults to ensure all properties exist
        return { ...DEFAULT_SETTINGS, ...parsedSettings };
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
}

/**
 * Singleton instance of the settings service
 */
export const settingsService = new SettingsService();
