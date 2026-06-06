'use strict';

/**
 * Libera el puerto de la API (PORT o 3000) y ejecuta Nest en modo watch.
 * Evita EADDRINUSE al quedar una instancia anterior colgando.
 */
const path = require('path');
const { spawn } = require('child_process');

const killPort = require('kill-port');

const port = Number.parseInt(process.env.PORT || '3000', 10);

const nestCli = path.join(__dirname, '..', 'node_modules', '@nestjs', 'cli', 'bin', 'nest.js');

const nestArgs =
  process.argv.includes('--debug') ? ['start', '--debug', '--watch'] : ['start', '--watch'];

killPort(port)
  .catch(() => {
    /** Puerto libre o sin proceso detectable — seguimos. */
  })
  .finally(() => {
    const child = spawn(process.execPath, [nestCli, ...nestArgs], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      env: process.env,
    });
    child.on('exit', (code, signal) => {
      process.exit(signal ? 1 : code ?? 0);
    });
  });
