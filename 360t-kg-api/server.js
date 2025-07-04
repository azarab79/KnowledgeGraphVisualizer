require('dotenv').config();

const express = require('express');
const cors = require('cors');
const neo4j = require('neo4j-driver');
const morgan = require('morgan');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');
const { register: metricsRegister } = require('./utils/metrics');

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3002;

// Middleware
app.use(morgan('combined'));
app.use(cors());
app.use(express.json());

// Serve documentation files
app.get('/api/docs/:filename', (req, res) => {
    let { filename } = req.params;
    
    // Add .md extension if not present
    if (!filename.endsWith('.md')) {
        filename = `${filename}.md`;
    }
    
    const filePath = path.join(__dirname, 'docs', filename);
    
    // Security check to prevent directory traversal
    if (!filePath.startsWith(path.join(__dirname, 'docs'))) {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            res.set('Content-Type', 'text/markdown');
            res.send(content);
        } else {
            res.status(404).json({ 
                error: 'Documentation file not found',
                requestedPath: filename,
                availableFiles: fs.readdirSync(path.join(__dirname, 'docs'))
                    .filter(file => file.endsWith('.md'))
            });
        }
    } catch (error) {
        console.error('Error serving documentation:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Neo4j connection with retry logic
const initNeo4j = async (retries = 5, delay = 2000) => {
    for (let i = 0; i < retries; i++) {
        try {
            const driver = neo4j.driver(
                process.env.NEO4J_URI || 'neo4j://localhost:7687',
                neo4j.auth.basic(
                    process.env.NEO4J_USERNAME || 'neo4j',
                    process.env.NEO4J_PASSWORD
                )
            );
            await driver.verifyConnectivity();
            return driver;
        } catch (error) {
            console.error(`Failed to connect to Neo4j (attempt ${i + 1}/${retries}):`, error.message);
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw new Error('Failed to connect to Neo4j after multiple attempts');
            }
        }
    }
};

let driver;

// Initialize Neo4j connection
initNeo4j()
    .then(d => { 
        driver = d;
        
        // Create repository instance
        const GraphRepository = require('./src/repositories/GraphRepository');
        const graphRepo = new GraphRepository(driver, process.env.NEO4J_DATABASE || 'neo4j');
        
        // Import route modules with repository
        const graphRoutes = require('./routes/graph')(driver);
        const analysisRoutes = require('./routes/analysis')(graphRepo);
        const settingsRoutes = require('./routes/settings')(driver);
        const chatRoutes = require('./routes/chatRoutes')(driver);
        
        // API endpoints
        app.get('/api/health', (req, res) => {
            res.json({ status: 'ok', timestamp: new Date().toISOString() });
        });

        // Get metadata about node labels and relationship types
        app.get('/api/metadata', async (req, res, next) => {
            const session = driver.session();
            try {
                // Get node labels and counts
                const nodeLabelsResult = await session.run(`
                    MATCH (n)
                    WITH labels(n)[0] AS label, count(n) AS count
                    RETURN label, count
                    ORDER BY label
                `);
                
                // Get relationship types and counts
                const relationshipTypesResult = await session.run(`
                    MATCH ()-[r]->()
                    WITH type(r) AS relType, count(r) AS count
                    RETURN relType, count
                    ORDER BY relType
                `);
                
                const nodeLabels = nodeLabelsResult.records.map(record => ({
                    label: record.get('label'),
                    count: record.get('count').toNumber()
                }));
                
                const relationshipTypes = relationshipTypesResult.records.map(record => ({
                    type: record.get('relType'),
                    count: record.get('count').toNumber()
                }));
                
                res.json({
                    nodeLabels,
                    relationshipTypes
                });
            } catch (error) {
                next(error);
            } finally {
                await session.close();
            }
        });
        
        // --- Metrics endpoint (Prometheus-compatible) ---
        app.get('/metrics', async (req, res) => {
            res.set('Content-Type', metricsRegister.contentType);
            res.end(await metricsRegister.metrics());
        });
        
        // Use routes
        app.use('/api/graph', graphRoutes);
        app.use('/api/analysis', analysisRoutes);
        app.use('/api/settings', settingsRoutes);
        app.use('/api/chat', chatRoutes);
        
        // Static files
        app.use(express.static(path.join(__dirname, 'public')));
        
        // Error handling middleware
        app.use((req, res, next) => {
            const error = new Error('Not Found');
            error.status = 404;
            next(error);
        });

        app.use((err, req, res, next) => {
            console.error(err.stack);
            const status = err.status || 500;
            const message = err.message || 'Internal Server Error';
            
            // Don't expose stack traces in production
            const error = process.env.NODE_ENV === 'production' 
                ? { message } 
                : { message, stack: err.stack };
            
            res.status(status).json({ error });
        });
        
        // Start the server after Neo4j connection is established
        startServer();
    })
    .catch(error => {
        console.error('Failed to initialize Neo4j:', error);
        process.exit(1);
    });

// Function to start the server
const startServer = () => {
    server = app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
};

// Graceful shutdown
const shutdown = async () => {
    console.log('Shutting down gracefully...');
    try {
        if (driver) {
            await driver.close();
            console.log('Neo4j connection closed');
        }
        if (server) {
            server.close(() => {
                console.log('HTTP server closed');
                releaseLock();
                process.exit(0);
            });
        } else {
            releaseLock();
            process.exit(0);
        }
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

let server;  // Define server variable outside for use in shutdown

// --- Single-instance lock (prevents EADDRINUSE restart loop) ---
const LOCK_FILE = path.join(__dirname, '.api.pid');

function acquireLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const existingPid = parseInt(fs.readFileSync(LOCK_FILE, 'utf8'), 10);
      if (existingPid && !Number.isNaN(existingPid)) {
        try {
          // Signal 0 just checks if the process exists
          process.kill(existingPid, 0);
          console.error(`Another API instance is already running (PID ${existingPid}). Exiting.`);
          process.exit(1);
        } catch (_) {
          // Stale PID file – process not running
          fs.unlinkSync(LOCK_FILE);
        }
      }
    }
    fs.writeFileSync(LOCK_FILE, process.pid.toString());
  } catch (err) {
    console.error('Failed to create lock file:', err);
    process.exit(1);
  }
}

function releaseLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      fs.unlinkSync(LOCK_FILE);
    }
  } catch (err) {
    console.warn('Failed to remove lock file:', err);
  }
}

acquireLock();
process.once('exit', releaseLock);

// Export for testing
module.exports = { app, driver }; 