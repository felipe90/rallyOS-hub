#!/usr/bin/env node

/**
 * recover-admin-pin.js — CLI recovery for club admin PIN
 *
 * Reads data/club-config.json and prints the admin PIN to stdout.
 * Requires Mini PC console access. No email/SMS/web recovery.
 *
 * Usage:
 *   node scripts/recover-admin-pin.js
 *
 * Exit codes:
 *   0 — PIN printed successfully
 *   1 — Club not configured
 *   2 — Config file not found or unreadable
 */

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.resolve(__dirname, '..', 'data', 'club-config.json');

function main() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.log('Club not configured');
    process.exit(1);
  }

  let raw;
  try {
    raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
  } catch {
    console.log('Club not configured');
    process.exit(1);
  }

  if (!raw || raw.trim().length === 0) {
    console.log('Club not configured');
    process.exit(1);
  }

  let config;
  try {
    config = JSON.parse(raw);
  } catch {
    console.log('Club not configured');
    process.exit(1);
  }

  if (!config.configured) {
    console.log('Club not configured');
    process.exit(1);
  }

  if (!config.adminPin) {
    console.log('Club not configured');
    process.exit(1);
  }

  // Print the admin PIN to stdout
  console.log(config.adminPin);
  process.exit(0);
}

main();
