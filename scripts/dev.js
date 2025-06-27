#!/usr/bin/env node

/**
 * dev.js
 * Task Master CLI - AI-driven development task management
 *
 * This is the refactored entry point that uses the modular architecture.
 * It imports functionality from the modules directory and provides a CLI.
 */

// Add at the very beginning of the file
if (process.env.DEBUG === '1') {
	console.error('DEBUG - dev.js received args:', process.argv.slice(2));
}

import { exec, execSync } from 'child_process';
import chalk from 'chalk';

console.log(chalk.cyan('Starting development environment...'));

// --- Kill lingering dev servers on common ports to avoid EADDRINUSE ---
const portsToClear = [3002, 5177, 5178, 5179, 5180, 5181, 5182];
console.log(chalk.gray(`Attempting to clear ports: ${portsToClear.join(', ')}...`));

portsToClear.forEach(port => {
  try {
    // Use a more forceful and direct kill command for each port.
    // The `|| true` prevents the command from failing if no process is found.
    execSync(`kill -9 $(lsof -ti tcp:${port}) || true`);
    console.log(chalk.gray(`  ✓ Port ${port} cleared.`));
  } catch (e) {
    // Even with `|| true`, catch any other potential errors, but don't stop the script.
    console.log(chalk.yellow(`  ! Could not clear port ${port}. It may have already been free.`));
  }
});


const servers = [
  {
    name: 'UI Server',
    command: 'npm run dev',
    cwd: './360t-kg-ui',
    color: 'blue',
  },
  {
    name: 'API Server',
    command: 'npm run dev',
    cwd: './360t-kg-api',
    color: 'magenta',
  },
];

servers.forEach(server => {
  const child = exec(server.command, { cwd: server.cwd });

  child.stdout.on('data', data => {
    process.stdout.write(chalk[server.color](`[${server.name}] `) + data.toString());
  });

  child.stderr.on('data', data => {
    process.stderr.write(chalk.red(`[${server.name} ERROR] `) + data.toString());
  });

  child.on('close', code => {
    console.log(chalk.yellow(`[${server.name}] exited with code ${code}`));
  });
}); 