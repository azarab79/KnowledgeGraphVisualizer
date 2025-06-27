/**
 * Comprehensive Settings Service for Knowledge Graph Visualizer
 * Handles persistence of all user preferences including colors, icons, shapes, sizes, layout, etc.
 */

// Default settings configuration
const DEFAULT_SETTINGS = {
  version: '1.0.0',
  
  // Node appearance settings
  nodeColors: {
    'Module': '#4f46e5',      // deep indigo
    'Product': '#059669',     // deep emerald
    'Workflow': '#d97706',    // deep amber
    'UI_Area': '#7c3aed',     // deep violet
    'ConfigurationItem': '#db2777', // deep pink
    'TestCase': '#dc2626',    // deep red
    'Default': '#4b5563',     // deep gray
  },
  
  nodeSizes: {
    'Module': 20,
    'Product': 20,
    'Workflow': 20,
    'UI_Area': 20,
    'ConfigurationItem': 20,
    'TestCase': 20,
    'Default': 20,
  },
  
  nodeShapes: {
    'Module': 'square',
    'Product': 'triangle',
    'Workflow': 'diamond',
    'UI_Area': 'circle',
    'ConfigurationItem': 'star',
    'TestCase': 'wye',
    'Default': 'circle',
  },
  
  // Relationship appearance settings
  relationshipColors: {
    'USES': '#00973A',          // 360T green
    'CONTAINS': '#ec4899',      // pink
    'NAVIGATES_TO': '#8b5cf6',  // purple
    'VALIDATES': '#f59e0b',     // amber
    'REQUIRES': '#ef4444',      // red
    'CONFIGURES_IN': '#06b6d4', // cyan
    'DISPLAYS': '#f97316',      // orange
    'Default': '#64748b',       // slate
  },
  
  relationshipLineStyles: {
    'USES': 'solid',
    'CONTAINS': 'solid',
    'NAVIGATES_TO': 'solid',
    'VALIDATES': 'dashed',
    'REQUIRES': 'dotted',
    'CONFIGURES_IN': 'solid',
    'DISPLAYS': 'solid',
    'Default': 'solid',
  },
  
  // UI preferences
  ui: {
    showLegend: true,
    legendPosition: 'right', // 'left', 'right', 'top', 'bottom'
    showTooltips: true,
    showNodeLabels: true,
    showRelationshipLabels: false,
    theme: 'light', // 'light', 'dark'
    compactMode: false,
  },
  
  // Graph layout settings
  layout: {
    physics: {
      enabled: true,
      strength: -300,
      centralGravity: 0.3,
      springLength: 95,
      springConstant: 0.04,
      damping: 0.09,
    },
    zoom: {
      min: 0.1,
      max: 3.0,
      default: 1.0,
      current: 1.0,
    },
    center: {
      x: 0,
      y: 0,
    },
  },
  
  // Search and filter preferences
  search: {
    history: [],
    maxHistoryItems: 50,
    caseSensitive: false,
    useRegex: false,
    highlightResults: true,
  },
  
  // Performance settings
  performance: {
    maxNodes: 1000,
    maxRelationships: 2000,
    enableClustering: true,
    clusterThreshold: 100,
    animationDuration: 300,
  },
  
  // Export/Import settings
  export: {
    includeLayout: true,
    includeColors: true,
    includeFilters: false,
    format: 'json', // 'json', 'csv', 'graphml'
  },
};

// Storage keys
const STORAGE_KEYS = {
  MAIN_SETTINGS: 'kg-visualizer-settings',
  BACKUP_SETTINGS: 'kg-visualizer-settings-backup',
  LEGACY_NODE_CONFIG: 'knowledge-graph-node-config', // For migration
  LEGACY_SHOW_LEGEND: 'showLegend', // For migration
  LEGACY_NODE_COLORS: 'nodeColors', // For migration
  LEGACY_NODE_SIZES: 'nodeSizes', // For migration
  LEGACY_NODE_SHAPES: 'nodeShapes', // For migration
  LEGACY_RELATIONSHIP_COLORS: 'relationshipColors', // For migration
  LEGACY_RELATIONSHIP_LINE_STYLES: 'relationshipLineStyles', // For migration
};

class SettingsService {
  constructor() {
    this.settings = { ...DEFAULT_SETTINGS };
    this.listeners = new Set();
    this.isInitialized = false;
    
    // Bind methods
    this.get = this.get.bind(this);
    this.set = this.set.bind(this);
    this.reset = this.reset.bind(this);
    this.export = this.export.bind(this);
    this.import = this.import.bind(this);
    this.subscribe = this.subscribe.bind(this);
    this.unsubscribe = this.unsubscribe.bind(this);
  }
  
  /**
   * Initialize the settings service
   * Loads settings from localStorage and performs migration if needed
   */
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Try to load existing settings
      const savedSettings = this.loadFromStorage();
      
      if (savedSettings) {
        // Merge with defaults to ensure all properties exist
        this.settings = this.mergeSettings(DEFAULT_SETTINGS, savedSettings);
        console.log('Settings loaded from storage:', this.settings);
      } else {
        // Check for legacy settings and migrate
        const migratedSettings = this.migrateLegacySettings();
        if (migratedSettings) {
          this.settings = this.mergeSettings(DEFAULT_SETTINGS, migratedSettings);
          console.log('Legacy settings migrated:', this.settings);
          // Save migrated settings
          this.saveToStorage();
        } else {
          // Use defaults
          console.log('Using default settings');
          this.saveToStorage();
        }
      }
      
      this.isInitialized = true;
      this.notifyListeners('initialized', this.settings);
      
    } catch (error) {
      console.error('Failed to initialize settings:', error);
      // Fall back to defaults
      this.settings = { ...DEFAULT_SETTINGS };
      this.isInitialized = true;
    }
  }
  
  /**
   * Get a setting value by path (e.g., 'nodeColors.Module' or 'ui.showLegend')
   */
  get(path) {
    if (!this.isInitialized) {
      console.warn('Settings service not initialized, returning default value');
    }
    
    return this.getNestedValue(this.settings, path);
  }
  
  /**
   * Set a setting value by path
   */
  set(path, value) {
    if (!this.isInitialized) {
      console.warn('Settings service not initialized');
      return false;
    }
    
    try {
      const oldValue = this.getNestedValue(this.settings, path);
      this.setNestedValue(this.settings, path, value);
      
      // Save to storage
      this.saveToStorage();
      
      // Notify listeners
      this.notifyListeners('changed', { path, oldValue, newValue: value });
      
      console.log(`Setting updated: ${path} = ${JSON.stringify(value)}`);
      return true;
      
    } catch (error) {
      console.error(`Failed to set setting ${path}:`, error);
      return false;
    }
  }
  
  /**
   * Update multiple settings at once
   */
  update(newSettings) {
    const oldSettings = { ...this.settings };
    this.settings = { ...this.settings, ...newSettings };
    
    // Save to localStorage
    this.saveToStorage();
    
    // Only notify if settings actually changed
    if (JSON.stringify(oldSettings) !== JSON.stringify(this.settings)) {
      this.notifyListeners('updated', { changes: newSettings });
    }
  }
  
  /**
   * Reset settings to defaults
   */
  reset(section = null) {
    if (!this.isInitialized) {
      console.warn('Settings service not initialized');
      return false;
    }
    
    try {
      if (section) {
        // Reset specific section
        if (DEFAULT_SETTINGS[section]) {
          this.settings[section] = { ...DEFAULT_SETTINGS[section] };
        }
      } else {
        // Reset all settings
        this.settings = { ...DEFAULT_SETTINGS };
      }
      
      // Save to storage
      this.saveToStorage();
      
      // Notify listeners
      this.notifyListeners('reset', { section });
      
      console.log(`Settings reset${section ? ` (section: ${section})` : ''}`);
      return true;
      
    } catch (error) {
      console.error('Failed to reset settings:', error);
      return false;
    }
  }
  
  /**
   * Export settings as JSON
   */
  export(includeDefaults = false) {
    if (!includeDefaults) {
      // Only export non-default values
      return this.getDifferencesFromDefaults();
    }
    
    return {
      ...this.settings,
      exportedAt: new Date().toISOString(),
      exportedBy: 'kg-visualizer',
    };
  }
  
  /**
   * Import settings from JSON
   */
  import(settingsData) {
    if (!this.isInitialized) {
      console.warn('Settings service not initialized');
      return false;
    }
    
    try {
      // Validate settings data
      if (!this.validateSettings(settingsData)) {
        throw new Error('Invalid settings data');
      }
      
      // Merge with current settings
      this.settings = this.mergeSettings(this.settings, settingsData);
      
      // Save to storage
      this.saveToStorage();
      
      // Notify listeners
      this.notifyListeners('imported', settingsData);
      
      console.log('Settings imported successfully');
      return true;
      
    } catch (error) {
      console.error('Failed to import settings:', error);
      return false;
    }
  }
  
  /**
   * Subscribe to settings changes
   */
  subscribe(listener) {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => this.unsubscribe(listener);
  }
  
  /**
   * Unsubscribe from settings changes
   */
  unsubscribe(listener) {
    this.listeners.delete(listener);
  }
  
  /**
   * Get all settings
   */
  getAll() {
    return { ...this.settings };
  }
  
  /**
   * Check if settings service is initialized
   */
  isReady() {
    return this.isInitialized;
  }
  
  // Private methods
  
  /**
   * Load settings from localStorage
   */
  loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.MAIN_SETTINGS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (this.validateSettings(parsed)) {
          return parsed;
        }
      }
    } catch (error) {
      console.warn('Failed to load settings from storage:', error);
    }
    
    return null;
  }
  
  /**
   * Save settings to localStorage
   */
  saveToStorage() {
    try {
      // Create backup of current settings
      const current = localStorage.getItem(STORAGE_KEYS.MAIN_SETTINGS);
      if (current) {
        localStorage.setItem(STORAGE_KEYS.BACKUP_SETTINGS, current);
      }
      
      // Save new settings
      localStorage.setItem(STORAGE_KEYS.MAIN_SETTINGS, JSON.stringify(this.settings));
      
    } catch (error) {
      console.error('Failed to save settings to storage:', error);
      
      // Try to recover from backup if main save failed
      try {
        const backup = localStorage.getItem(STORAGE_KEYS.BACKUP_SETTINGS);
        if (backup) {
          localStorage.setItem(STORAGE_KEYS.MAIN_SETTINGS, backup);
        }
      } catch (backupError) {
        console.error('Failed to recover from backup:', backupError);
      }
    }
  }
  
  /**
   * Migrate legacy settings from old localStorage keys
   */
  migrateLegacySettings() {
    try {
      const legacySettings = {};
      
      // Migrate legacy node config
      const legacyNodeConfig = localStorage.getItem(STORAGE_KEYS.LEGACY_NODE_CONFIG);
      if (legacyNodeConfig) {
        const parsed = JSON.parse(legacyNodeConfig);
        if (parsed.colors) legacySettings.nodeColors = parsed.colors;
        if (parsed.sizes) legacySettings.nodeSizes = parsed.sizes;
        if (parsed.shapes) legacySettings.nodeShapes = parsed.shapes;
        if (parsed.relationshipColors) legacySettings.relationshipColors = parsed.relationshipColors;
        if (parsed.relationshipLineStyles) legacySettings.relationshipLineStyles = parsed.relationshipLineStyles;
      }
      
      // Migrate individual legacy keys
      const legacyKeys = [
        { key: STORAGE_KEYS.LEGACY_SHOW_LEGEND, path: 'ui.showLegend' },
        { key: STORAGE_KEYS.LEGACY_NODE_COLORS, path: 'nodeColors' },
        { key: STORAGE_KEYS.LEGACY_NODE_SIZES, path: 'nodeSizes' },
        { key: STORAGE_KEYS.LEGACY_NODE_SHAPES, path: 'nodeShapes' },
        { key: STORAGE_KEYS.LEGACY_RELATIONSHIP_COLORS, path: 'relationshipColors' },
        { key: STORAGE_KEYS.LEGACY_RELATIONSHIP_LINE_STYLES, path: 'relationshipLineStyles' },
      ];
      
      for (const { key, path } of legacyKeys) {
        const value = localStorage.getItem(key);
        if (value) {
          try {
            const parsed = JSON.parse(value);
            this.setNestedValue(legacySettings, path, parsed);
          } catch (e) {
            // Handle non-JSON values
            this.setNestedValue(legacySettings, path, value);
          }
        }
      }
      
      // Clean up legacy keys after migration
      if (Object.keys(legacySettings).length > 0) {
        Object.values(STORAGE_KEYS).forEach(key => {
          if (key.startsWith('knowledge-graph-') || 
              ['showLegend', 'nodeColors', 'nodeSizes', 'nodeShapes', 'relationshipColors', 'relationshipLineStyles'].includes(key)) {
            localStorage.removeItem(key);
          }
        });
        
        console.log('Migrated legacy settings:', legacySettings);
        return legacySettings;
      }
      
    } catch (error) {
      console.warn('Failed to migrate legacy settings:', error);
    }
    
    return null;
  }
  
  /**
   * Validate settings object
   */
  validateSettings(settings) {
    if (!settings || typeof settings !== 'object') {
      return false;
    }
    
    // Basic structure validation
    const requiredSections = ['nodeColors', 'nodeSizes', 'nodeShapes', 'relationshipColors'];
    for (const section of requiredSections) {
      if (settings[section] && typeof settings[section] !== 'object') {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Merge settings objects deeply
   */
  mergeSettings(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.mergeSettings(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }
  
  /**
   * Get nested value by path (e.g., 'ui.showLegend')
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }
  
  /**
   * Set nested value by path
   */
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      return current[key];
    }, obj);
    
    target[lastKey] = value;
  }
  
  /**
   * Get differences from default settings
   */
  getDifferencesFromDefaults() {
    const differences = {};
    
    const findDifferences = (current, defaults, path = '') => {
      for (const key in current) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (current[key] && typeof current[key] === 'object' && !Array.isArray(current[key])) {
          if (defaults[key] && typeof defaults[key] === 'object') {
            findDifferences(current[key], defaults[key], currentPath);
          } else {
            this.setNestedValue(differences, currentPath, current[key]);
          }
        } else if (current[key] !== defaults[key]) {
          this.setNestedValue(differences, currentPath, current[key]);
        }
      }
    };
    
    findDifferences(this.settings, DEFAULT_SETTINGS);
    return differences;
  }
  
  /**
   * Notify all listeners of changes
   */
  notifyListeners(event, data) {
    // Add a small delay to prevent rapid successive notifications
    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
    }
    
    this.notificationTimeout = setTimeout(() => {
      this.listeners.forEach(listener => {
        try {
          listener(event, data);
        } catch (error) {
          console.error('Error in settings listener:', error);
        }
      });
      this.notificationTimeout = null;
    }, 0);
  }
}

// Create singleton instance
const settingsService = new SettingsService();

// Auto-initialize when imported
settingsService.initialize().catch(error => {
  console.error('Failed to auto-initialize settings service:', error);
});

export default settingsService;

// Export utilities for direct use
export { DEFAULT_SETTINGS, STORAGE_KEYS };

/**
 * Hook for React components to use settings
 * Note: Import React in the component that uses this hook
 */
export const createUseSettings = (React) => {
  return () => {
    const [settings, setSettings] = React.useState(settingsService.getAll());
    
    React.useEffect(() => {
      const unsubscribe = settingsService.subscribe((event, data) => {
        if (event === 'changed' || event === 'updated' || event === 'reset' || event === 'imported') {
          setSettings(settingsService.getAll());
        }
      });
      
      return unsubscribe;
    }, []);
    
    return {
      settings,
      get: settingsService.get,
      set: settingsService.set,
      update: settingsService.update,
      reset: settingsService.reset,
      export: settingsService.export,
      import: settingsService.import,
      isReady: settingsService.isReady(),
    };
  };
}; 