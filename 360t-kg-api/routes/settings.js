const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Settings API routes for Knowledge Graph Visualizer
 * Provides server-side persistence for user settings
 */
module.exports = (driver) => {
  const router = express.Router();
  
  // Settings storage directory
  const SETTINGS_DIR = path.join(__dirname, '..', 'data', 'settings');
  
  // Ensure settings directory exists
  const ensureSettingsDir = async () => {
    try {
      await fs.access(SETTINGS_DIR);
    } catch (error) {
      await fs.mkdir(SETTINGS_DIR, { recursive: true });
    }
  };
  
  // Initialize settings directory
  ensureSettingsDir().catch(console.error);
  
  /**
   * Generate a unique settings ID for a user/session
   */
  const generateSettingsId = (userIdentifier = 'anonymous') => {
    const hash = crypto.createHash('sha256');
    hash.update(userIdentifier + Date.now().toString());
    return hash.digest('hex').substring(0, 16);
  };
  
  /**
   * Validate settings object
   */
  const validateSettings = (settings) => {
    if (!settings || typeof settings !== 'object') {
      return false;
    }
    
    // Check for required sections
    const requiredSections = ['nodeColors', 'nodeSizes', 'nodeShapes', 'relationshipColors'];
    for (const section of requiredSections) {
      if (settings[section] && typeof settings[section] !== 'object') {
        return false;
      }
    }
    
    return true;
  };
  
  /**
   * GET /api/settings/:id
   * Retrieve settings by ID
   */
  router.get('/:id', async (req, res, next) => {
    try {
      const { id } = req.params;
      
      // Validate ID format
      if (!/^[a-f0-9]{16}$/.test(id)) {
        return res.status(400).json({ error: 'Invalid settings ID format' });
      }
      
      const settingsPath = path.join(SETTINGS_DIR, `${id}.json`);
      
      try {
        const settingsData = await fs.readFile(settingsPath, 'utf8');
        const settings = JSON.parse(settingsData);
        
        res.json({
          id,
          settings,
          lastModified: settings.lastModified || null,
        });
      } catch (error) {
        if (error.code === 'ENOENT') {
          return res.status(404).json({ error: 'Settings not found' });
        }
        throw error;
      }
      
    } catch (error) {
      next(error);
    }
  });
  
  /**
   * POST /api/settings
   * Create new settings
   */
  router.post('/', async (req, res, next) => {
    try {
      const { settings, userIdentifier } = req.body;
      
      if (!validateSettings(settings)) {
        return res.status(400).json({ error: 'Invalid settings format' });
      }
      
      const id = generateSettingsId(userIdentifier);
      const settingsPath = path.join(SETTINGS_DIR, `${id}.json`);
      
      const settingsWithMetadata = {
        ...settings,
        id,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        userIdentifier: userIdentifier || 'anonymous',
      };
      
      await fs.writeFile(settingsPath, JSON.stringify(settingsWithMetadata, null, 2));
      
      res.status(201).json({
        id,
        message: 'Settings created successfully',
        lastModified: settingsWithMetadata.lastModified,
      });
      
    } catch (error) {
      next(error);
    }
  });
  
  /**
   * PUT /api/settings/:id
   * Update existing settings
   */
  router.put('/:id', async (req, res, next) => {
    try {
      const { id } = req.params;
      const { settings } = req.body;
      
      // Validate ID format
      if (!/^[a-f0-9]{16}$/.test(id)) {
        return res.status(400).json({ error: 'Invalid settings ID format' });
      }
      
      if (!validateSettings(settings)) {
        return res.status(400).json({ error: 'Invalid settings format' });
      }
      
      const settingsPath = path.join(SETTINGS_DIR, `${id}.json`);
      
      // Check if settings exist
      let existingSettings = {};
      try {
        const existingData = await fs.readFile(settingsPath, 'utf8');
        existingSettings = JSON.parse(existingData);
      } catch (error) {
        if (error.code === 'ENOENT') {
          return res.status(404).json({ error: 'Settings not found' });
        }
        throw error;
      }
      
      const updatedSettings = {
        ...existingSettings,
        ...settings,
        id,
        lastModified: new Date().toISOString(),
      };
      
      await fs.writeFile(settingsPath, JSON.stringify(updatedSettings, null, 2));
      
      res.json({
        id,
        message: 'Settings updated successfully',
        lastModified: updatedSettings.lastModified,
      });
      
    } catch (error) {
      next(error);
    }
  });
  
  /**
   * DELETE /api/settings/:id
   * Delete settings
   */
  router.delete('/:id', async (req, res, next) => {
    try {
      const { id } = req.params;
      
      // Validate ID format
      if (!/^[a-f0-9]{16}$/.test(id)) {
        return res.status(400).json({ error: 'Invalid settings ID format' });
      }
      
      const settingsPath = path.join(SETTINGS_DIR, `${id}.json`);
      
      try {
        await fs.unlink(settingsPath);
        res.json({ message: 'Settings deleted successfully' });
      } catch (error) {
        if (error.code === 'ENOENT') {
          return res.status(404).json({ error: 'Settings not found' });
        }
        throw error;
      }
      
    } catch (error) {
      next(error);
    }
  });
  
  /**
   * GET /api/settings
   * List all settings (for admin/debugging purposes)
   */
  router.get('/', async (req, res, next) => {
    try {
      const files = await fs.readdir(SETTINGS_DIR);
      const settingsFiles = files.filter(file => file.endsWith('.json'));
      
      const settingsList = await Promise.all(
        settingsFiles.map(async (file) => {
          try {
            const filePath = path.join(SETTINGS_DIR, file);
            const data = await fs.readFile(filePath, 'utf8');
            const settings = JSON.parse(data);
            
            return {
              id: settings.id || file.replace('.json', ''),
              createdAt: settings.createdAt,
              lastModified: settings.lastModified,
              userIdentifier: settings.userIdentifier || 'unknown',
            };
          } catch (error) {
            console.warn(`Failed to read settings file ${file}:`, error);
            return null;
          }
        })
      );
      
      res.json({
        settings: settingsList.filter(Boolean),
        total: settingsList.filter(Boolean).length,
      });
      
    } catch (error) {
      next(error);
    }
  });
  
  /**
   * POST /api/settings/export/:id
   * Export settings in various formats
   */
  router.post('/export/:id', async (req, res, next) => {
    try {
      const { id } = req.params;
      const { format = 'json', includeMetadata = false } = req.body;
      
      // Validate ID format
      if (!/^[a-f0-9]{16}$/.test(id)) {
        return res.status(400).json({ error: 'Invalid settings ID format' });
      }
      
      const settingsPath = path.join(SETTINGS_DIR, `${id}.json`);
      
      try {
        const settingsData = await fs.readFile(settingsPath, 'utf8');
        const settings = JSON.parse(settingsData);
        
        let exportData;
        let contentType;
        let filename;
        
        switch (format.toLowerCase()) {
          case 'json':
            exportData = includeMetadata ? settings : {
              nodeColors: settings.nodeColors,
              nodeSizes: settings.nodeSizes,
              nodeShapes: settings.nodeShapes,
              relationshipColors: settings.relationshipColors,
              relationshipLineStyles: settings.relationshipLineStyles,
              ui: settings.ui,
              layout: settings.layout,
            };
            contentType = 'application/json';
            filename = `kg-settings-${id}.json`;
            exportData = JSON.stringify(exportData, null, 2);
            break;
            
          default:
            return res.status(400).json({ error: 'Unsupported export format' });
        }
        
        res.set({
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${filename}"`,
        });
        
        res.send(exportData);
        
      } catch (error) {
        if (error.code === 'ENOENT') {
          return res.status(404).json({ error: 'Settings not found' });
        }
        throw error;
      }
      
    } catch (error) {
      next(error);
    }
  });
  
  /**
   * POST /api/settings/import
   * Import settings from uploaded data
   */
  router.post('/import', async (req, res, next) => {
    try {
      const { settings, userIdentifier, overwriteId } = req.body;
      
      if (!validateSettings(settings)) {
        return res.status(400).json({ error: 'Invalid settings format' });
      }
      
      let id;
      let settingsPath;
      
      if (overwriteId) {
        // Validate overwrite ID format
        if (!/^[a-f0-9]{16}$/.test(overwriteId)) {
          return res.status(400).json({ error: 'Invalid overwrite ID format' });
        }
        id = overwriteId;
        settingsPath = path.join(SETTINGS_DIR, `${id}.json`);
      } else {
        // Generate new ID
        id = generateSettingsId(userIdentifier);
        settingsPath = path.join(SETTINGS_DIR, `${id}.json`);
      }
      
      const settingsWithMetadata = {
        ...settings,
        id,
        createdAt: settings.createdAt || new Date().toISOString(),
        lastModified: new Date().toISOString(),
        userIdentifier: userIdentifier || 'anonymous',
        importedAt: new Date().toISOString(),
      };
      
      await fs.writeFile(settingsPath, JSON.stringify(settingsWithMetadata, null, 2));
      
      res.json({
        id,
        message: 'Settings imported successfully',
        lastModified: settingsWithMetadata.lastModified,
      });
      
    } catch (error) {
      next(error);
    }
  });
  
  return router;
}; 