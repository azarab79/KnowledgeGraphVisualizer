const client = require('prom-client');

// Create and register default metrics
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Histogram for Hidden Links latency (ms)
const hiddenLinksHistogram = new client.Histogram({
  name: 'hidden_links_latency_ms',
  help: 'Hidden Links GDS pipeline execution time in milliseconds',
  buckets: [50, 100, 250, 500, 1000, 2000, 5000, 10000]
});
register.registerMetric(hiddenLinksHistogram);

module.exports = {
  register,
  hiddenLinksHistogram
}; 