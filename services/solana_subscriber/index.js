import { start, shutdown } from './start.js';

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start();
