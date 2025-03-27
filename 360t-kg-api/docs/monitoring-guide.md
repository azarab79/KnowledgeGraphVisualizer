# 360T Knowledge Graph - Monitoring Guide

This guide provides comprehensive instructions for monitoring the health and performance of the 360T Knowledge Graph system.

## Overview

The 360T Knowledge Graph monitoring system provides tools for tracking the health of the Neo4j database, API performance, and system resources. Regular monitoring ensures optimal performance and helps identify issues before they impact users.

## Monitoring Components

The monitoring system tracks the following components:

1. **Neo4j Database**
   - Database connectivity
   - Transaction statistics
   - Node and relationship counts
   - Slow query detection
   - Memory usage

2. **API System**
   - Endpoint availability
   - Response times
   - Error rates
   - Request volume

3. **System Resources**
   - CPU utilization
   - Memory usage
   - Disk space
   - Network activity

## Running the Monitoring Script

### Basic Usage

To run the monitoring script:

```bash
npm run monitor-system
```

This executes the script at `360t-kg-api/scripts/monitorSystem.js`, which performs all monitoring checks and generates a comprehensive health report.

### Scheduling Regular Monitoring

For production environments, schedule the monitoring script to run at regular intervals:

```bash
# Example crontab entry for running every 15 minutes
*/15 * * * * cd /path/to/360t-kg-api && npm run monitor-system
```

### Configuration Options

The monitoring script uses environment variables for configuration:

```
# Neo4j Database Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password

# API Configuration
API_BASE_URL=http://localhost:3000
API_TIMEOUT=5000

# Monitoring Configuration
MONITORING_LOG_DIR=logs
MONITORING_REPORT_DIR=reports
MONITORING_ALERT_THRESHOLD=high
```

You can modify these in your `.env` file or set them directly in your environment.

## Monitoring Reports

### Health Report

The monitoring script generates a comprehensive health report at `360t-kg-api/reports/health-report.json`. This report includes:

```json
{
  "timestamp": "2023-05-15T14:30:00.000Z",
  "systemStatus": "healthy",
  "components": {
    "database": {
      "status": "healthy",
      "connectivity": true,
      "responseTime": 45,
      "activeTransactions": 3,
      "nodeCount": 1245,
      "relationshipCount": 3456,
      "slowQueries": [],
      "memoryUsage": {
        "heapUsed": "256MB",
        "heapTotal": "1024MB",
        "heapPercentage": 25
      }
    },
    "api": {
      "status": "healthy",
      "endpoints": {
        "/api/modules": {
          "status": 200,
          "responseTime": 120
        },
        "/api/products": {
          "status": 200,
          "responseTime": 85
        },
        // Other endpoints...
      },
      "errorRate": 0,
      "averageResponseTime": 95
    },
    "system": {
      "status": "healthy",
      "cpu": {
        "load": 25,
        "threshold": 80
      },
      "memory": {
        "used": "4.2GB",
        "total": "16GB",
        "percentage": 26.25
      },
      "disk": {
        "used": "45GB",
        "total": "100GB",
        "percentage": 45
      }
    }
  },
  "alerts": []
}
```

### Performance Logs

The script also maintains detailed performance logs at `360t-kg-api/logs/performance.log`.

Example log entries:

```
[2023-05-15T14:30:00.000Z] INFO: Database connectivity check: Success
[2023-05-15T14:30:00.123Z] INFO: Node count: 1245
[2023-05-15T14:30:00.234Z] INFO: Relationship count: 3456
[2023-05-15T14:30:00.345Z] INFO: API endpoint /api/modules: 200 OK (120ms)
[2023-05-15T14:30:00.456Z] INFO: System CPU load: 25%
[2023-05-15T14:30:00.567Z] INFO: System memory usage: 26.25%
[2023-05-15T14:30:00.678Z] INFO: Health report generated successfully
```

## Interpreting Monitoring Results

### Status Levels

The monitoring system uses the following status levels:

- **Healthy**: All systems functioning normally
- **Warning**: Some metrics approaching thresholds, but system is operational
- **Critical**: One or more components have exceeded critical thresholds

### Key Metrics to Watch

#### Database Metrics

1. **Connection Time**: Should be under 100ms
   - Warning: >100ms
   - Critical: >500ms or connection failure

2. **Active Transactions**: Depends on your workload
   - Warning: >50 concurrent transactions
   - Critical: >100 concurrent transactions

3. **Node Count Growth**: Track growth over time
   - Warning: >10% growth in 24 hours
   - Critical: >25% growth in 24 hours

4. **Slow Queries**: Queries taking more than 1000ms
   - Warning: 1-5 slow queries
   - Critical: >5 slow queries

5. **Memory Usage**: Neo4j heap usage
   - Warning: >70% of allocated heap
   - Critical: >90% of allocated heap

#### API Metrics

1. **Response Time**: Average across all endpoints
   - Good: <100ms
   - Warning: 100-500ms
   - Critical: >500ms

2. **Error Rate**: Percentage of requests resulting in errors
   - Good: <1%
   - Warning: 1-5%
   - Critical: >5%

3. **Request Volume**: Number of requests per minute
   - Monitor for unexpected spikes or drops

#### System Metrics

1. **CPU Load**: Average system CPU usage
   - Good: <50%
   - Warning: 50-80%
   - Critical: >80%

2. **Memory Usage**: System memory consumption
   - Good: <70%
   - Warning: 70-90%
   - Critical: >90%

3. **Disk Usage**: Storage utilization
   - Good: <70%
   - Warning: 70-90%
   - Critical: >90%

## Monitoring Dashboard

For a visual representation of monitoring data:

1. Run the monitoring script to generate health reports
2. Open the monitoring dashboard at `360t-kg-api/dashboard/monitoring.html`

The dashboard provides:

- Real-time metrics display
- Historical trends (if multiple reports are available)
- Alert visualization
- Component status overview

## Alerts and Notifications

### Alert Levels

The monitoring system defines three alert levels:

1. **Info**: Informational messages, no action required
2. **Warning**: Potential issues that should be investigated
3. **Critical**: Urgent issues requiring immediate attention

### Alert Configuration

Configure alerting thresholds in `360t-kg-api/config/monitoring.json`:

```json
{
  "alerts": {
    "database": {
      "connectionTime": {
        "warning": 100,
        "critical": 500
      },
      "activeTransactions": {
        "warning": 50,
        "critical": 100
      },
      "memoryUsage": {
        "warning": 70,
        "critical": 90
      }
    },
    "api": {
      "responseTime": {
        "warning": 100,
        "critical": 500
      },
      "errorRate": {
        "warning": 1,
        "critical": 5
      }
    },
    "system": {
      "cpu": {
        "warning": 50,
        "critical": 80
      },
      "memory": {
        "warning": 70,
        "critical": 90
      },
      "disk": {
        "warning": 70,
        "critical": 90
      }
    }
  }
}
```

### Notification Methods

The monitoring system can be configured to send alerts through various channels:

1. **Email Notifications**
   - Configure SMTP settings in `.env`
   - Set recipient addresses in configuration

2. **Slack Integration**
   - Configure webhook URL in configuration
   - Customize message format

3. **Custom Webhook**
   - Configure endpoint URL in configuration
   - Customize payload format

## Troubleshooting Common Issues

### Database Connectivity Issues

If the monitoring script reports database connectivity problems:

1. Verify Neo4j is running:
   ```bash
   systemctl status neo4j
   ```

2. Check network connectivity:
   ```bash
   telnet localhost 7687
   ```

3. Verify credentials in `.env` file

### High Memory Usage

If Neo4j shows high memory usage:

1. Check heap size configuration in `neo4j.conf`
2. Look for memory leaks in long-running queries
3. Consider increasing memory allocation if workload requires it

### Slow API Response

If API response times are high:

1. Check for slow database queries in Neo4j logs
2. Monitor system resources during API requests
3. Consider query optimization or caching strategies

### Disk Space Issues

If disk usage is approaching capacity:

1. Clean up old logs and reports:
   ```bash
   find /path/to/360t-kg-api/logs -type f -name "*.log" -mtime +30 -delete
   ```

2. Check database growth:
   ```bash
   du -sh /var/lib/neo4j/data/
   ```

3. Consider database cleanup or archiving strategies

## Advanced Monitoring

### Custom Monitoring Checks

To add custom monitoring checks:

1. Open `360t-kg-api/scripts/monitorSystem.js`
2. Add a new monitoring function:

```javascript
async function monitorCustomComponent() {
  console.log('Checking custom component...');
  
  try {
    // Implement your custom check here
    const checkResult = await performCustomCheck();
    
    return {
      status: checkResult.status,
      metric1: checkResult.value1,
      metric2: checkResult.value2
    };
  } catch (error) {
    console.error('Error monitoring custom component:', error);
    return {
      status: 'critical',
      error: error.message
    };
  }
}

// Add the new function to the main monitoring function
async function runMonitoring() {
  // Existing code...
  
  const customResults = await monitorCustomComponent();
  report.components.custom = customResults;
  
  // Existing code...
}
```

### Monitoring Plugins

The monitoring system supports plugins for extending functionality:

1. Create a new file in `360t-kg-api/scripts/monitoring-plugins/`
2. Export monitoring functions:

```javascript
// 360t-kg-api/scripts/monitoring-plugins/custom-plugin.js
module.exports = {
  name: 'Custom Plugin',
  
  check: async function() {
    // Implement your check
    return {
      status: 'healthy',
      metrics: {
        // Your metrics
      }
    };
  }
};
```

3. Register the plugin in `monitorSystem.js`:

```javascript
// Load plugins
const plugins = [
  require('./monitoring-plugins/custom-plugin')
  // Other plugins...
];

// In runMonitoring function
for (const plugin of plugins) {
  console.log(`Running plugin: ${plugin.name}`);
  const pluginResults = await plugin.check();
  report.components[plugin.name.toLowerCase().replace(' ', '_')] = pluginResults;
}
```

## Best Practices

### Monitoring Frequency

- **Development**: Run monitoring hourly or on-demand
- **Production**: Run monitoring every 5-15 minutes
- **Critical systems**: Consider real-time monitoring

### Data Retention

- Keep detailed logs for 7-30 days
- Archive summarized reports for longer periods
- Implement log rotation to manage disk space

### Performance Impact

- Schedule intensive checks during off-peak hours
- Use sampling for high-volume metrics
- Limit the scope of monitoring in high-load situations

### Security Considerations

- Use separate monitoring credentials with limited permissions
- Secure monitoring logs and reports
- Use encryption for transmitted monitoring data

## Support

For technical support and questions about monitoring:

- **Documentation Updates**: Submit updates to the documentation team
- **Technical Support**: Contact the Knowledge Graph support team at kg-support@360t.com
- **Monitoring Enhancements**: For feature requests, email kg-monitoring@360t.com 