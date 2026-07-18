import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const vercelMcpSource = fs.readFileSync(path.join(REPO_ROOT, 'api/mcp/[token].ts'), 'utf8');
const expressMcpSource = fs.readFileSync(path.join(REPO_ROOT, 'mcp-poc/src/index.ts'), 'utf8');
const clientMcpSource = fs.readFileSync(path.join(REPO_ROOT, 'src/services/cloud-mcp-sync-service.ts'), 'utf8');

describe('[SECURITY] MCP Connector Token-Invalidierung', () => {
  it('[REGRESSION] sollte Connector-Tokens serverseitig als 64-Hex-Werte validieren', () => {
    for (const source of [vercelMcpSource, expressMcpSource]) {
      expect(source).toMatch(/function isValidAccessToken\(token: string\): boolean/);
      expect(source).toMatch(/\^\[0-9a-f\]\{64\}\$/i);
      expect(source).toMatch(/invalid or missing access token/);
    }
  });

  it('[SECURITY] sollte Snapshots ausschließlich per Token-Hash laden', () => {
    expect(vercelMcpSource).toMatch(/p_token_hash:\s*sha256Hex\(token\)/);
    expect(expressMcpSource).toMatch(/\.eq\('token_hash',\s*sha256Hex\(token\)\)/);
    expect(vercelMcpSource).not.toMatch(/p_token:\s*token/);
    expect(expressMcpSource).not.toMatch(/\.eq\('token_hash',\s*token\)/);
  });

  it('[PRIVACY] sollte Datenbankfehler nicht als Rohmeldung an Connector-Clients zurückgeben', () => {
    expect(vercelMcpSource).toMatch(/throw new Error\('Snapshot lookup failed'\)/);
    expect(vercelMcpSource).toMatch(/rpcError\(id,\s*-32603,\s*'Internal error'\)/);
    expect(expressMcpSource).toMatch(/throw new Error\('Snapshot lookup failed'\)/);
    expect(vercelMcpSource).not.toMatch(/rpcError\(id,\s*-32603,\s*err\.message\)/);
  });

  it('[SECURITY] sollte Opt-out serverseitig über user_id löschen und lokale Connector-Spuren erst nach Erfolg bereinigen', () => {
    const deleteIndex = clientMcpSource.indexOf('.delete().eq(\'user_id\', userId)');
    const errorGuardIndex = clientMcpSource.indexOf("if (error) throw new Error(t('mcpService.disableFailed')");
    const clearIndex = clientMcpSource.indexOf('clearStoredCloudMcpConnector();', errorGuardIndex);

    expect(deleteIndex).toBeGreaterThan(-1);
    expect(errorGuardIndex).toBeGreaterThan(deleteIndex);
    expect(clearIndex).toBeGreaterThan(errorGuardIndex);
  });
});
