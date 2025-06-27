#!/usr/bin/env node
/**
 * Manual Hidden Links retrain script
 * ---------------------------------
 * Usage:
 *   node scripts/train_hidden_links.js [--topN 50] [--threshold 0.4]
 *
 * The script simply calls the /api/analysis/hidden-links endpoint with the
 * provided parameters which triggers GraphRepository.predictLinks().
 * Because the repository is set to reuse models for 7 days, passing the
 * `--force` flag will add ?force=true causing the API to drop the cached model.
 */

const axios = require('axios');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

(async () => {
  const argv = yargs(hideBin(process.argv))
    .option('topN', { type: 'number', default: 50, describe: 'Number of edges to predict' })
    .option('threshold', { type: 'number', default: 0.4, describe: 'Probability threshold' })
    .option('force', { type: 'boolean', default: false, describe: 'Force model retrain (ignore cache)' })
    .help()
    .argv;

  const apiBase = process.env.API_URL || 'http://localhost:3002/api';

  try {
    const { data } = await axios.get(`${apiBase}/analysis/hidden-links`, {
      params: {
        topN: argv.topN,
        threshold: argv.threshold,
        force: argv.force ? 'true' : undefined
      }
    });

    console.log(`Received ${data.predictions.length} predictions:`);
    data.predictions.slice(0, 10).forEach((p, idx) => {
      console.log(`#${idx + 1}: (${p.source}) -> (${p.target}) = ${p.probability.toFixed(3)}`);
    });
  } catch (err) {
    console.error('Hidden-links request failed:', err.message);
    process.exit(1);
  }
})(); 