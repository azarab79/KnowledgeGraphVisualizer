# 360T Knowledge Graph - Monitoring Guide

This guide summarizes monitoring of the 360T Knowledge Graph.

## What is Monitored

- **Neo4j**: Connectivity, transactions, counts, slow queries, memory.
- **API**: Availability, response times, error rates.
- **System**: CPU, memory, disk, network.

## Running Monitoring

- Run `npm run monitor-system` to generate health reports.
- Schedule via cron for regular checks.
- Configurable via `.env` and config files.

## Reports & Logs

- Health report: `reports/health-report.json`
- Performance logs: `logs/performance.log`
- Dashboard: `dashboard/monitoring.html`

## Alerts

- Alerts on thresholds for latency, errors, resource usage.
- Configurable alert levels and channels (email, Slack, webhook).

## Troubleshooting

- Check Neo4j and API status.
- Review logs and reports.
- Adjust thresholds as needed.

## Best Practices

- Monitor frequently in production.
- Set up alerts for critical issues.
- Archive old logs and reports.
- Secure monitoring data.

## Support

- Documentation: Contact docs team
- Technical Support: kg-support@360t.com
- Monitoring Enhancements: kg-monitoring@360t.com
