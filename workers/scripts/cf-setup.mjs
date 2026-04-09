#!/usr/bin/env node
/**
 * cf-setup.mjs — Cloudflare resource provisioning script
 *
 * Creates KV namespaces, D1 database, and R2 bucket, then patches
 * the wrangler.toml files with the resulting IDs.
 *
 * Prerequisites:
 *   - wrangler installed (npx wrangler or global)
 *   - CF_API_TOKEN and CF_ACCOUNT_ID set in .dev.vars or environment
 *   - Run from the workers/ directory: node scripts/cf-setup.mjs
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const workersDir = resolve(__dirname, '..');

function run(cmd) {
  console.log(`\n$ ${cmd}`);
  try {
    return execSync(cmd, { cwd: workersDir, encoding: 'utf8' }).trim();
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

function patchToml(filePath, placeholder, value) {
  const content = readFileSync(filePath, 'utf8');
  const updated = content.replace(new RegExp(placeholder, 'g'), value);
  writeFileSync(filePath, updated, 'utf8');
  console.log(`  ✓ Patched ${filePath.replace(workersDir, '.')}: ${placeholder} → ${value}`);
}

console.log('🚀 HealthBridge Cloudflare Resources Setup\n');
console.log('This script creates KV namespaces, D1 database, and R2 bucket.');
console.log('Ensure CF_API_TOKEN and CF_ACCOUNT_ID are set in your environment.\n');

// ── KV Namespaces ──────────────────────────────────────────────────
console.log('Creating KV namespaces...');

const sessionsKv = run('npx wrangler kv namespace create SESSIONS_KV');
const sessionsId = sessionsKv.match(/id = "([^"]+)"/)?.[1];
const sessionsKvPreview = run('npx wrangler kv namespace create SESSIONS_KV --preview');
const sessionsPreviewId = sessionsKvPreview.match(/id = "([^"]+)"/)?.[1];

const ratelimitKv = run('npx wrangler kv namespace create RATELIMIT_KV');
const ratelimitId = ratelimitKv.match(/id = "([^"]+)"/)?.[1];
const ratelimitKvPreview = run('npx wrangler kv namespace create RATELIMIT_KV --preview');
const ratelimitPreviewId = ratelimitKvPreview.match(/id = "([^"]+)"/)?.[1];

const nphiesCacheKv = run('npx wrangler kv namespace create NPHIES_CACHE_KV');
const nphiesCacheId = nphiesCacheKv.match(/id = "([^"]+)"/)?.[1];
const nphiesCacheKvPreview = run('npx wrangler kv namespace create NPHIES_CACHE_KV --preview');
const nphiesCachePreviewId = nphiesCacheKvPreview.match(/id = "([^"]+)"/)?.[1];

const edSessionKv = run('npx wrangler kv namespace create ED_SESSION_KV');
const edSessionId = edSessionKv.match(/id = "([^"]+)"/)?.[1];
const edSessionKvPreview = run('npx wrangler kv namespace create ED_SESSION_KV --preview');
const edSessionPreviewId = edSessionKvPreview.match(/id = "([^"]+)"/)?.[1];

const edMetricsKv = run('npx wrangler kv namespace create ED_METRICS_KV');
const edMetricsId = edMetricsKv.match(/id = "([^"]+)"/)?.[1];
const edMetricsKvPreview = run('npx wrangler kv namespace create ED_METRICS_KV --preview');
const edMetricsPreviewId = edMetricsKvPreview.match(/id = "([^"]+)"/)?.[1];

// ── D1 Database ────────────────────────────────────────────────────
console.log('\nCreating D1 database...');
const d1Output = run('npx wrangler d1 create healthbridge-compliance');
const d1Id = d1Output.match(/database_id = "([^"]+)"/)?.[1];

// ── R2 Bucket ──────────────────────────────────────────────────────
console.log('\nCreating R2 bucket...');
run('npx wrangler r2 bucket create healthbridge-documents');
run('npx wrangler r2 bucket create healthbridge-documents-preview');

// ── Patch wrangler.toml files ──────────────────────────────────────
console.log('\nPatching wrangler.toml files with resource IDs...');

const gatewayToml = resolve(workersDir, 'api-gateway/wrangler.toml');
if (sessionsId) patchToml(gatewayToml, 'REPLACE_WITH_SESSIONS_KV_ID', sessionsId);
if (sessionsPreviewId) patchToml(gatewayToml, 'REPLACE_WITH_SESSIONS_KV_PREVIEW_ID', sessionsPreviewId);
if (ratelimitId) patchToml(gatewayToml, 'REPLACE_WITH_RATELIMIT_KV_ID', ratelimitId);
if (ratelimitPreviewId) patchToml(gatewayToml, 'REPLACE_WITH_RATELIMIT_KV_PREVIEW_ID', ratelimitPreviewId);

const nphiesProxyToml = resolve(workersDir, 'nphies-proxy/wrangler.toml');
if (nphiesCacheId) patchToml(nphiesProxyToml, 'REPLACE_WITH_NPHIES_CACHE_KV_ID', nphiesCacheId);
if (nphiesCachePreviewId) patchToml(nphiesProxyToml, 'REPLACE_WITH_NPHIES_CACHE_KV_PREVIEW_ID', nphiesCachePreviewId);

const complianceToml = resolve(workersDir, 'compliance-db/wrangler.toml');
if (d1Id) patchToml(complianceToml, 'REPLACE_WITH_D1_DATABASE_ID', d1Id);

const edFlowToml = resolve(workersDir, 'ed-flow/wrangler.toml');
if (edSessionId) patchToml(edFlowToml, 'REPLACE_WITH_ED_SESSION_KV_ID', edSessionId);
if (edSessionPreviewId) patchToml(edFlowToml, 'REPLACE_WITH_ED_SESSION_KV_PREVIEW_ID', edSessionPreviewId);
if (edMetricsId) patchToml(edFlowToml, 'REPLACE_WITH_ED_METRICS_KV_ID', edMetricsId);
if (edMetricsPreviewId) patchToml(edFlowToml, 'REPLACE_WITH_ED_METRICS_KV_PREVIEW_ID', edMetricsPreviewId);

console.log('\n✅ Cloudflare resources created and wrangler.toml files updated!');
console.log('\nNext steps:');
console.log('  1. Set secrets: npx wrangler secret put JWT_SECRET (in api-gateway/)');
console.log('  2. Run migrations: npm run migrate:local');
console.log('  3. Start local dev: npm run dev:all');
console.log('  4. Deploy: npm run deploy:all\n');
