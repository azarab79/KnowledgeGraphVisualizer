#!/usr/bin/env node

/**
 * Development Environment Validation Script
 * 
 * This script validates that the development environment is properly configured
 * for both existing graph visualization features and new chat functionality.
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

const log = {
    info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
    success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
    warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
    error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
    header: (msg) => console.log(`\n${colors.cyan}${msg}${colors.reset}`)
};

class EnvironmentValidator {
    constructor() {
        this.issues = [];
        this.warnings = [];
        this.projectRoot = process.cwd();
    }

    /**
     * Main validation function
     */
    async validate() {
        log.header('🔍 Validating Development Environment');
        
        await this.checkNodeVersion();
        await this.checkPythonVersion();
        await this.checkDockerAvailability();
        await this.validateDirectoryStructure();
        await this.validateConfigurationFiles();
        await this.checkPortAvailability();
        await this.validateDependencies();
        await this.checkExistingServices();
        
        this.printSummary();
        return this.issues.length === 0;
    }

    /**
     * Check Node.js version
     */
    async checkNodeVersion() {
        log.header('Node.js Version');
        try {
            const { stdout } = await execAsync('node --version');
            const version = stdout.trim();
            const majorVersion = parseInt(version.substring(1).split('.')[0]);
            
            if (majorVersion >= 18) {
                log.success(`Node.js ${version} (✓ >= v18.0.0)`);
            } else {
                this.issues.push(`Node.js version ${version} is too old. Requires >= v18.0.0`);
                log.error(`Node.js ${version} (requires >= v18.0.0)`);
            }
        } catch (error) {
            this.issues.push('Node.js is not installed');
            log.error('Node.js is not installed');
        }
    }

    /**
     * Check Python version
     */
    async checkPythonVersion() {
        log.header('Python Version');
        try {
            const { stdout } = await execAsync('python3 --version');
            const version = stdout.trim();
            const versionMatch = version.match(/Python (\d+)\.(\d+)/);
            
            if (versionMatch) {
                const major = parseInt(versionMatch[1]);
                const minor = parseInt(versionMatch[2]);
                
                if (major === 3 && minor >= 11) {
                    log.success(`${version} (✓ >= 3.11)`);
                } else {
                    this.issues.push(`${version} is too old. Requires >= Python 3.11`);
                    log.error(`${version} (requires >= Python 3.11)`);
                }
            }
        } catch (error) {
            this.issues.push('Python 3 is not installed');
            log.error('Python 3 is not installed');
        }
    }

    /**
     * Check Docker availability
     */
    async checkDockerAvailability() {
        log.header('Docker Availability');
        try {
            await execAsync('docker --version');
            await execAsync('docker-compose --version');
            log.success('Docker and Docker Compose are available');
        } catch (error) {
            this.warnings.push('Docker or Docker Compose not available - local development only');
            log.warning('Docker or Docker Compose not available - local development only');
        }
    }

    /**
     * Validate directory structure
     */
    validateDirectoryStructure() {
        log.header('Directory Structure');
        
        const requiredDirs = [
            '360t-kg-api',
            '360t-kg-ui',
            '.taskmaster'
        ];

        const expectedDirs = [
            'api-contracts',
            'scripts'
        ];

        for (const dir of requiredDirs) {
            const dirPath = path.join(this.projectRoot, dir);
            if (fs.existsSync(dirPath)) {
                log.success(`${dir}/ directory exists`);
            } else {
                this.issues.push(`Missing required directory: ${dir}/`);
                log.error(`Missing required directory: ${dir}/`);
            }
        }

        for (const dir of expectedDirs) {
            const dirPath = path.join(this.projectRoot, dir);
            if (fs.existsSync(dirPath)) {
                log.success(`${dir}/ directory exists`);
            } else {
                this.warnings.push(`Expected directory not found: ${dir}/`);
                log.warning(`Expected directory not found: ${dir}/`);
            }
        }
    }

    /**
     * Validate configuration files
     */
    validateConfigurationFiles() {
        log.header('Configuration Files');
        
        const configFiles = [
            { path: '.env.example', required: true },
            { path: '360t-kg-api/.env.example', required: true },
            { path: '360t-kg-ui/.env', required: true },
            { path: 'docker-compose.yml', required: false },
            { path: 'requirements.txt', required: true },
            { path: 'package.json', required: true },
            { path: '360t-kg-api/package.json', required: true },
            { path: '360t-kg-ui/package.json', required: true }
        ];

        for (const config of configFiles) {
            const filePath = path.join(this.projectRoot, config.path);
            if (fs.existsSync(filePath)) {
                log.success(`${config.path} exists`);
                
                // Validate specific configurations
                if (config.path === '360t-kg-ui/.env') {
                    this.validateUIEnvFile(filePath);
                }
            } else {
                if (config.required) {
                    this.issues.push(`Missing required configuration file: ${config.path}`);
                    log.error(`Missing required configuration file: ${config.path}`);
                } else {
                    this.warnings.push(`Optional configuration file not found: ${config.path}`);
                    log.warning(`Optional configuration file not found: ${config.path}`);
                }
            }
        }
    }

    /**
     * Validate UI environment file for correct API URL
     */
    validateUIEnvFile(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            if (content.includes('VITE_API_URL=http://localhost:3002/api')) {
                log.success('UI environment correctly configured for API port 3002');
            } else {
                this.warnings.push('UI environment may not be correctly configured for API port');
                log.warning('UI environment may not be correctly configured for API port');
            }
        } catch (error) {
            this.warnings.push('Could not validate UI environment file content');
        }
    }

    /**
     * Check port availability
     */
    async checkPortAvailability() {
        log.header('Port Availability');
        
        const ports = [
            { port: 3002, service: 'Node.js API' },
            { port: 5173, service: 'React UI (Vite)' },
            { port: 7474, service: 'Neo4j HTTP' },
            { port: 7687, service: 'Neo4j Bolt' },
            { port: 8000, service: 'Python FastAPI (future)' }
        ];

        for (const { port, service } of ports) {
            try {
                const { stdout } = await execAsync(`lsof -i :${port}`);
                if (stdout.trim()) {
                    this.warnings.push(`Port ${port} (${service}) is currently in use`);
                    log.warning(`Port ${port} (${service}) is currently in use`);
                } else {
                    log.success(`Port ${port} (${service}) is available`);
                }
            } catch (error) {
                // lsof returns non-zero when port is free
                log.success(`Port ${port} (${service}) is available`);
            }
        }
    }

    /**
     * Validate dependencies
     */
    async validateDependencies() {
        log.header('Dependencies');
        
        // Check API dependencies
        await this.checkNpmDependencies('360t-kg-api');
        
        // Check UI dependencies  
        await this.checkNpmDependencies('360t-kg-ui');
        
        // Check Python dependencies
        await this.checkPythonDependencies();
    }

    /**
     * Check npm dependencies for a specific service
     */
    async checkNpmDependencies(serviceDir) {
        const packageJsonPath = path.join(this.projectRoot, serviceDir, 'package.json');
        const nodeModulesPath = path.join(this.projectRoot, serviceDir, 'node_modules');
        
        if (fs.existsSync(packageJsonPath)) {
            if (fs.existsSync(nodeModulesPath)) {
                log.success(`${serviceDir} npm dependencies installed`);
            } else {
                this.warnings.push(`${serviceDir} npm dependencies not installed - run 'npm install'`);
                log.warning(`${serviceDir} npm dependencies not installed - run 'npm install'`);
            }
        }
    }

    /**
     * Check Python dependencies
     */
    async checkPythonDependencies() {
        const venvPath = path.join(this.projectRoot, '.venv');
        
        if (fs.existsSync(venvPath)) {
            log.success('Python virtual environment exists');
            
            try {
                // Check if key packages are installed
                const { stdout } = await execAsync('source .venv/bin/activate && pip list | grep -E "(fastapi|langchain|neo4j)"');
                if (stdout.includes('fastapi') && stdout.includes('langchain') && stdout.includes('neo4j')) {
                    log.success('Key Python dependencies are installed');
                } else {
                    this.warnings.push('Some Python dependencies may be missing');
                    log.warning('Some Python dependencies may be missing');
                }
            } catch (error) {
                this.warnings.push('Could not verify Python dependencies');
                log.warning('Could not verify Python dependencies');
            }
        } else {
            this.warnings.push('Python virtual environment not found - run: python -m venv .venv');
            log.warning('Python virtual environment not found');
        }
    }

    /**
     * Check if existing services are running
     */
    async checkExistingServices() {
        log.header('Service Status');
        
        // Check if API is running
        try {
            const { stdout } = await execAsync('curl -s http://localhost:3002/api/health');
            log.success('Node.js API service is running and responsive');
        } catch (error) {
            log.info('Node.js API service is not currently running');
        }

        // Check if UI is running
        try {
            const { stdout } = await execAsync('curl -s http://localhost:5173');
            log.success('React UI service is running');
        } catch (error) {
            log.info('React UI service is not currently running');
        }

        // Check Neo4j availability
        try {
            const { stdout } = await execAsync('curl -s http://localhost:7474');
            log.success('Neo4j database is accessible');
        } catch (error) {
            log.info('Neo4j database is not currently accessible');
        }
    }

    /**
     * Print validation summary
     */
    printSummary() {
        log.header('Validation Summary');
        
        if (this.issues.length === 0) {
            log.success('✨ Environment validation passed!');
            console.log('\nYour development environment is ready for both existing graph features and new chat functionality.');
        } else {
            log.error(`❌ Found ${this.issues.length} critical issue(s):`);
            this.issues.forEach(issue => console.log(`   • ${issue}`));
        }

        if (this.warnings.length > 0) {
            log.warning(`⚠️ Found ${this.warnings.length} warning(s):`);
            this.warnings.forEach(warning => console.log(`   • ${warning}`));
        }

        console.log('\n📖 For setup instructions, see: DEVELOPMENT.md');
        console.log('🐳 To use Docker: docker-compose up -d');
        console.log('🔧 For local development: see DEVELOPMENT.md "Local Development" section');
    }
}

// Run validation if script is executed directly
if (require.main === module) {
    const validator = new EnvironmentValidator();
    validator.validate().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Validation failed:', error);
        process.exit(1);
    });
}

module.exports = EnvironmentValidator; 