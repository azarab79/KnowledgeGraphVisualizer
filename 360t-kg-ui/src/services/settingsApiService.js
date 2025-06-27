/**
 * Settings API Service for Knowledge Graph Visualizer
 * Handles communication with backend settings endpoints
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

/**
 * Settings API client
 */
class SettingsApiService {
  constructor() {
    this.baseUrl = `${API_BASE_URL}/api/settings`;
  }
  
  /**
   * Make HTTP request with error handling
   */
  async makeRequest(url, options = {}) {
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Settings API request failed:', error);
      throw error;
    }
  }
  
  /**
   * Save settings to server
   * @param {Object} settings - Settings object to save
   * @param {string} userIdentifier - Optional user identifier
   * @returns {Promise<Object>} Response with settings ID
   */
  async saveSettings(settings, userIdentifier = null) {
    return this.makeRequest(this.baseUrl, {
      method: 'POST',
      body: JSON.stringify({
        settings,
        userIdentifier,
      }),
    });
  }
  
  /**
   * Load settings from server
   * @param {string} settingsId - Settings ID to load
   * @returns {Promise<Object>} Settings object
   */
  async loadSettings(settingsId) {
    return this.makeRequest(`${this.baseUrl}/${settingsId}`);
  }
  
  /**
   * Update existing settings on server
   * @param {string} settingsId - Settings ID to update
   * @param {Object} settings - Updated settings object
   * @returns {Promise<Object>} Update response
   */
  async updateSettings(settingsId, settings) {
    return this.makeRequest(`${this.baseUrl}/${settingsId}`, {
      method: 'PUT',
      body: JSON.stringify({
        settings,
      }),
    });
  }
  
  /**
   * Delete settings from server
   * @param {string} settingsId - Settings ID to delete
   * @returns {Promise<Object>} Delete response
   */
  async deleteSettings(settingsId) {
    return this.makeRequest(`${this.baseUrl}/${settingsId}`, {
      method: 'DELETE',
    });
  }
  
  /**
   * List all settings (admin function)
   * @returns {Promise<Object>} List of settings
   */
  async listSettings() {
    return this.makeRequest(this.baseUrl);
  }
  
  /**
   * Export settings from server
   * @param {string} settingsId - Settings ID to export
   * @param {string} format - Export format ('json')
   * @param {boolean} includeMetadata - Whether to include metadata
   * @returns {Promise<Blob>} Export data as blob
   */
  async exportSettings(settingsId, format = 'json', includeMetadata = false) {
    const response = await fetch(`${this.baseUrl}/export/${settingsId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        format,
        includeMetadata,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.blob();
  }
  
  /**
   * Import settings to server
   * @param {Object} settings - Settings object to import
   * @param {string} userIdentifier - Optional user identifier
   * @param {string} overwriteId - Optional ID to overwrite
   * @returns {Promise<Object>} Import response
   */
  async importSettings(settings, userIdentifier = null, overwriteId = null) {
    return this.makeRequest(`${this.baseUrl}/import`, {
      method: 'POST',
      body: JSON.stringify({
        settings,
        userIdentifier,
        overwriteId,
      }),
    });
  }
  
  /**
   * Check if server-side persistence is available
   * @returns {Promise<boolean>} True if available
   */
  async isAvailable() {
    try {
      await this.makeRequest(this.baseUrl);
      return true;
    } catch (error) {
      console.warn('Server-side settings persistence not available:', error.message);
      return false;
    }
  }
}

// Create singleton instance
const settingsApiService = new SettingsApiService();

export default settingsApiService;

/**
 * Utility functions for settings synchronization
 */

/**
 * Generate a browser fingerprint for user identification
 */
export const generateBrowserFingerprint = () => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'top';
  ctx.font = '14px Arial';
  ctx.fillText('Browser fingerprint', 2, 2);
  
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    canvas.toDataURL(),
  ].join('|');
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(16);
};

/**
 * Settings synchronization manager
 */
export class SettingsSyncManager {
  constructor(settingsService) {
    this.settingsService = settingsService;
    this.apiService = settingsApiService;
    this.syncEnabled = false;
    this.settingsId = null;
    this.userIdentifier = generateBrowserFingerprint();
    this.lastSyncTime = null;
    this.syncInterval = null;
    
    // Load sync settings from localStorage
    this.loadSyncConfig();
  }
  
  /**
   * Enable automatic synchronization with server
   * @param {number} intervalMs - Sync interval in milliseconds (default: 30 seconds)
   */
  async enableSync(intervalMs = 30000) {
    try {
      // Check if server is available
      const isAvailable = await this.apiService.isAvailable();
      if (!isAvailable) {
        throw new Error('Server-side persistence not available');
      }
      
      this.syncEnabled = true;
      this.saveSyncConfig();
      
      // Initial sync
      await this.syncToServer();
      
      // Set up periodic sync
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
      }
      
      this.syncInterval = setInterval(() => {
        this.syncToServer().catch(error => {
          console.warn('Automatic sync failed:', error);
        });
      }, intervalMs);
      
      console.log('Settings synchronization enabled');
      return true;
      
    } catch (error) {
      console.error('Failed to enable settings sync:', error);
      return false;
    }
  }
  
  /**
   * Disable automatic synchronization
   */
  disableSync() {
    this.syncEnabled = false;
    this.saveSyncConfig();
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    console.log('Settings synchronization disabled');
  }
  
  /**
   * Manually sync settings to server
   */
  async syncToServer() {
    if (!this.syncEnabled) return false;
    
    try {
      const settings = this.settingsService.getAll();
      
      if (this.settingsId) {
        // Update existing settings
        await this.apiService.updateSettings(this.settingsId, settings);
      } else {
        // Create new settings
        const response = await this.apiService.saveSettings(settings, this.userIdentifier);
        this.settingsId = response.id;
        this.saveSyncConfig();
      }
      
      this.lastSyncTime = new Date().toISOString();
      this.saveSyncConfig();
      
      console.log('Settings synced to server successfully');
      return true;
      
    } catch (error) {
      console.error('Failed to sync settings to server:', error);
      return false;
    }
  }
  
  /**
   * Load settings from server
   */
  async syncFromServer(settingsId = null) {
    try {
      const id = settingsId || this.settingsId;
      if (!id) {
        throw new Error('No settings ID available');
      }
      
      const response = await this.apiService.loadSettings(id);
      const success = this.settingsService.import(response.settings);
      
      if (success) {
        this.settingsId = id;
        this.lastSyncTime = new Date().toISOString();
        this.saveSyncConfig();
        console.log('Settings loaded from server successfully');
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error('Failed to load settings from server:', error);
      return false;
    }
  }
  
  /**
   * Get sync status
   */
  getSyncStatus() {
    return {
      enabled: this.syncEnabled,
      settingsId: this.settingsId,
      lastSyncTime: this.lastSyncTime,
      userIdentifier: this.userIdentifier,
    };
  }
  
  /**
   * Load sync configuration from localStorage
   */
  loadSyncConfig() {
    try {
      const config = localStorage.getItem('kg-settings-sync-config');
      if (config) {
        const parsed = JSON.parse(config);
        this.syncEnabled = parsed.syncEnabled || false;
        this.settingsId = parsed.settingsId || null;
        this.lastSyncTime = parsed.lastSyncTime || null;
        this.userIdentifier = parsed.userIdentifier || this.userIdentifier;
      }
    } catch (error) {
      console.warn('Failed to load sync config:', error);
    }
  }
  
  /**
   * Save sync configuration to localStorage
   */
  saveSyncConfig() {
    try {
      const config = {
        syncEnabled: this.syncEnabled,
        settingsId: this.settingsId,
        lastSyncTime: this.lastSyncTime,
        userIdentifier: this.userIdentifier,
      };
      localStorage.setItem('kg-settings-sync-config', JSON.stringify(config));
    } catch (error) {
      console.warn('Failed to save sync config:', error);
    }
  }
} 