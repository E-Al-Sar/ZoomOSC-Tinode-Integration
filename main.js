import fs from 'fs';
import ZoomTinodeBridge from './index.js';

// Load configuration
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

// Create and start bridge
const bridge = new ZoomTinodeBridge(config);
bridge.start(); 