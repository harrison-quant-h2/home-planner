import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import {
  mcpConfig,
  lookupProperty,
  zillowBridge,
} from '../server/zillow-mcp.js';
import { listing } from './listing-helpers.js';

async function serve(handler) {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}
async function close(server) {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
test('config does not assume an endpoint; rejects insecure URLs and inline credentials', () => {
  assert.throws(() => mcpConfig({}));
  for (const url of [
    'http://remote.example.org/mcp',
    'https://token@remote.example.org/mcp',
    'https://remote.example.org/mcp?key=secret',
  ])
    assert.throws(() =>
      mcpConfig({ ZILLOW_MCP_URL: url, ZILLOW_MCP_TOOL: 'property' }),
    );
  assert.equal(
    mcpConfig({
      ZILLOW_MCP_URL: 'https://provider.example.org/mcp',
      ZILLOW_MCP_TOOL: 'property',
    }).queryField,
    'query',
  );
});
test('real SDK handshake, paginated discovery, configured tool call and result normalization', async () => {
  const methods = [],
    calls = [];
  const { server, url } = await serve(async (req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405).end();
      return;
    }
    let body = '';
    for await (const part of req) body += part;
    const m = JSON.parse(body);
    methods.push(m.method);
    assert.equal(req.headers.authorization, 'Bearer test-only-token');
    if (m.id === undefined) {
      res.writeHead(202).end();
      return;
    }
    let result;
    if (m.method === 'initialize')
      result = {
        protocolVersion: '2025-11-25',
        serverInfo: { name: 'fictional-provider', version: '1' },
        capabilities: { tools: {} },
      };
    else if (m.method === 'tools/list')
      result = m.params?.cursor
        ? {
            tools: [
              {
                name: 'read_property',
                inputSchema: {
                  type: 'object',
                  properties: { address: { type: 'string' } },
                  required: ['address'],
                },
                annotations: { readOnlyHint: true },
              },
            ],
          }
        : { tools: [], nextCursor: 'next' };
    else if (m.method === 'tools/call') {
      calls.push(m.params);
      result = { content: [{ type: 'text', text: JSON.stringify(listing()) }] };
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ jsonrpc: '2.0', id: m.id, result }));
  });
  try {
    const config = mcpConfig({
      ZILLOW_MCP_URL: url + '/mcp',
      ZILLOW_MCP_TOOL: 'read_property',
      ZILLOW_MCP_QUERY_FIELD: 'address',
      ZILLOW_MCP_TOKEN: 'test-only-token',
    });
    const result = await lookupProperty(config, '  Fictional Courtyard  ');
    assert.equal(result.images.length, 2);
    assert.deepEqual(
      methods.filter((m) => m !== 'notifications/initialized'),
      ['initialize', 'tools/list', 'tools/list', 'tools/call'],
    );
    assert.deepEqual(calls[0].arguments, { address: 'Fictional Courtyard' });
    assert.equal(calls[0].name, 'read_property');
  } finally {
    await close(server);
  }
});
test('bridge is opt-in, blocks foreign origins and arbitrary RPC arguments, and redacts upstream failures', async () => {
  let calls = 0;
  const middleware = zillowBridge({
    enabled: true,
    env: {
      ZILLOW_MCP_URL: 'https://provider.example.org/mcp',
      ZILLOW_MCP_TOOL: 'property',
    },
    lookup: async () => {
      calls++;
      throw new Error('Authorization: secret-token');
    },
  });
  const { server, url } = await serve((req, res) =>
    middleware(req, res, () => res.writeHead(404).end()),
  );
  const request = (body, origin = url) =>
    fetch(url + '/api/zillow/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify(body),
    });
  try {
    assert.equal(
      (await request({ query: 'Example' }, 'https://foreign.example.org'))
        .status,
      403,
    );
    assert.equal(
      (await request({ query: 'Example', url: 'https://evil.example.org' }))
        .status,
      400,
    );
    assert.equal(calls, 0);
    const failure = await request({ query: 'Example' });
    assert.equal(failure.status, 502);
    assert.ok(!(await failure.text()).includes('secret-token'));
    assert.equal(calls, 1);
    const status = await fetch(url + '/api/zillow/status');
    assert.deepEqual(await status.json(), {
      configured: true,
      tool: 'property',
    });
  } finally {
    await close(server);
  }
  const disabled = await serve((req, res) =>
    zillowBridge()(req, res, () => res.end()),
  );
  try {
    const response = await fetch(disabled.url + '/api/zillow/lookup', {
      method: 'POST',
      headers: { Origin: disabled.url, 'Content-Type': 'application/json' },
      body: '{"query":"Example"}',
    });
    assert.equal(response.status, 503);
  } finally {
    await close(disabled.server);
  }
});
test('SDK network requests disable redirects to prevent bearer token forwarding', async () => {
  let called = false;
  await assert.rejects(() =>
    lookupProperty(
      mcpConfig({
        ZILLOW_MCP_URL: 'https://provider.example.org/mcp',
        ZILLOW_MCP_TOOL: 'property',
      }),
      'Example',
      {
        fetchImpl: async (_url, init) => {
          called = true;
          assert.equal(init.redirect, 'error');
          throw new Error('blocked redirect');
        },
      },
    ),
  );
  assert.equal(called, true);
});
