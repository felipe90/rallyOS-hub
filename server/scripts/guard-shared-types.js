#!/usr/bin/env node
/**
 * Type Duplication Guard
 *
 * Scans server/src/ for type/interface definitions that also exist in shared/types.ts.
 * Fails with exit code 1 if duplicates are found.
 *
 * Usage: node scripts/guard-shared-types.js
 * Or:    npm run guard:types
 */

const fs = require('fs');
const path = require('path');

const SHARED_TYPES_PATH = path.join(__dirname, '../../shared/types.ts');
const SERVER_SRC_PATH = path.join(__dirname, '../src');
const CLIENT_LOCAL_TYPES_PATH = path.join(__dirname, '../../client/src/shared/types.ts');

// Extract exported type/interface names from a file
function extractExportedTypes(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const types = new Set();

  // Match: export interface Foo, export type Foo, export class Foo
  const regex = /export\s+(interface|type|class)\s+(\w+)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    types.add(match[2]);
  }

  return types;
}

// Recursively find all .ts files in a directory
function findTsFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      findTsFiles(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

function main() {
  const sharedTypes = extractExportedTypes(SHARED_TYPES_PATH);
  const serverFiles = findTsFiles(SERVER_SRC_PATH);

  const duplicates = [];

  for (const file of serverFiles) {
    // Skip server/src/types.ts — it's allowed to re-export from shared
    if (file.endsWith('src/types.ts')) continue;

    const fileTypes = extractExportedTypes(file);
    for (const type of fileTypes) {
      if (sharedTypes.has(type)) {
        duplicates.push({ type, file: path.relative(SERVER_SRC_PATH, file) });
      }
    }
  }

  if (duplicates.length > 0) {
    console.error('\n❌ Type Duplication Guard FAILED\n');
    console.error('The following types are defined in both shared/types.ts and server/src/:\n');
    for (const dup of duplicates) {
      console.error(`  - ${dup.type} (redefined in ${dup.file})`);
    }
    console.error('\nRule: If a type crosses the wire (client ↔ server), it MUST live in shared/types.ts only.');
    console.error('      server/src/types.ts is ONLY for server-internal types (e.g., Table with callbacks).\n');
    process.exit(1);
  }

  // Check for forbidden client local copy
  if (fs.existsSync(CLIENT_LOCAL_TYPES_PATH)) {
    console.error('\n❌ Type Duplication Guard FAILED\n');
    console.error(`Found forbidden local copy: client/src/shared/types.ts`);
    console.error('\nRule: The client MUST import shared types from @shared/types (workspace root).');
    console.error('      Never create client/src/shared/types.ts — it duplicates shared/types.ts and causes drift.\n');
    process.exit(1);
  }

  console.log('✅ Type Duplication Guard passed — no shared types duplicated in server/src/ or client/src/');
}

main();
