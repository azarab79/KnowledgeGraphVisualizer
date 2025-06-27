import { useState, useEffect, useCallback } from 'react';
import settingsService from '../services/settingsService';

/**
 * React hook for using the settings service
 * Provides reactive access to settings with automatic updates
 */
export const useSettings = () => {
  const [settings, setSettings] = useState(() => {
    try {
      return settingsService.getAll();
    } catch (error) {
      console.warn('Settings service not ready, using empty settings:', error);
      return {};
    }
  });
  
  const [isReady, setIsReady] = useState(() => settingsService.isReady());

  useEffect(() => {
    // Subscribe to settings changes
    const unsubscribe = settingsService.subscribe((event, data) => {
      if (event === 'initialized') {
        setIsReady(true);
        setSettings(settingsService.getAll());
      } else if (event === 'changed' || event === 'updated' || event === 'reset' || event === 'imported') {
        // Only update if settings actually changed
        setSettings(prevSettings => {
          const newSettings = settingsService.getAll();
          // Deep comparison to prevent unnecessary updates
          if (JSON.stringify(prevSettings) !== JSON.stringify(newSettings)) {
            return { ...newSettings };
          }
          return prevSettings;
        });
      }
    });

    return unsubscribe;
  }, []); // Empty dependency array - only run once

  // Get function - access nested settings values
  const get = useCallback((path) => {
    try {
      if (!path) return settings;
      
      const keys = path.split('.');
      let result = settings;
      
      for (const key of keys) {
        if (result && typeof result === 'object' && key in result) {
          result = result[key];
        } else {
          return undefined;
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error getting setting:', error);
      return undefined;
    }
  }, [settings]);

  // Set function - update specific setting
  const set = useCallback((path, value) => {
    try {
      settingsService.set(path, value);
    } catch (error) {
      console.error('Error setting value:', error);
    }
  }, []);

  // Update function - update multiple settings
  const update = useCallback((newSettings) => {
    try {
      settingsService.update(newSettings);
    } catch (error) {
      console.error('Error updating settings:', error);
    }
  }, []);

  return { settings, get, set, update, isReady };
};

export default useSettings; 