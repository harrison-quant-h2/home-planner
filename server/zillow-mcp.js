import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
import { normalizeListingResult } from '../src/listing-import.js';

export function mcpConfig(env) {
  if (!env.ZILLOW_MCP_URL || !env.ZILLOW_MCP_TOOL)
    throw new Error(
      'Set ZILLOW_MCP_URL and ZILLOW_MCP_TOOL in .env.local, then run pnpm dev:zillow. You can also import an agent listing JSON without a server.',
    );
  const url = new URL(env.ZILLOW_MCP_URL);
  if (
    (url.protocol !== 'https:' &&
      !(
        url.protocol === 'http:' &&
        ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
      )) ||
    url.username ||
    url.password ||
    url.hash ||
    url.search
  )
    throw new Error(
      'Use an HTTPS MCP endpoint (HTTP is allowed only for loopback) without inline credentials or query parameters.',
    );
  const tool = env.ZILLOW_MCP_TOOL;
  const queryField = env.ZILLOW_MCP_QUERY_FIELD || 'query';
  if (
    !/^[\w.-]{1,128}$/.test(tool) ||
    !/^[a-zA-Z][\w]{0,63}$/.test(queryField) ||
    ['constructor', 'prototype', '__proto__'].includes(queryField)
  )
    throw new Error('Invalid configured property tool or query field.');
  return { url, tool, queryField, token: env.ZILLOW_MCP_TOKEN || '' };
}

export async function lookupProperty(
  config,
  query,
  { signal = AbortSignal.timeout(40000), fetchImpl = fetch } = {},
) {
  if (typeof query !== 'string' || !query.trim() || query.length > 300)
    throw new Error('Enter a property address of 1–300 characters.');
  const client = new Client(
    { name: 'home-planner', version: '0.1.0' },
    { capabilities: {} },
  );
  const transport = new StreamableHTTPClientTransport(config.url, {
    ...(config.token
      ? { authProvider: { token: async () => config.token } }
      : {}),
    fetch: async (url, init) => {
      // Credentials can reach only the explicitly configured endpoint, never a redirect.
      if (new URL(url).origin !== config.url.origin)
        throw new Error('Unexpected MCP destination.');
      const response = await fetchImpl(url, {
        ...init,
        redirect: 'error',
        signal: AbortSignal.any([
          signal,
          ...(init?.signal ? [init.signal] : []),
        ]),
      });
      if (!response.body) return response;
      let bytes = 0;
      const bounded = response.body.pipeThrough(
        new TransformStream({
          transform(chunk, controller) {
            bytes += chunk.byteLength;
            if (bytes > 8_000_000)
              throw new Error('MCP transport response exceeds 8 MB.');
            controller.enqueue(chunk);
          },
        }),
      );
      return new Response(bounded, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    },
  });
  try {
    await client.connect(transport, { signal, timeout: 15000 });
    let cursor, tool;
    // Bound tool discovery and support paginated providers.
    for (let page = 0; page < 10; page++) {
      const result = await client.listTools(cursor ? { cursor } : undefined, {
        signal,
        timeout: 10000,
      });
      tool = result.tools.find((t) => t.name === config.tool);
      if (tool || !result.nextCursor) break;
      cursor = result.nextCursor;
    }
    if (!tool)
      throw new Error(
        'The configured property tool was not found on this MCP server.',
      );
    if (
      tool.annotations?.destructiveHint === true ||
      tool.annotations?.readOnlyHint === false
    )
      throw new Error(
        'Configure a read-only property lookup tool. Mutation tools are not supported.',
      );
    const schema = tool.inputSchema;
    if (
      schema?.properties?.[config.queryField]?.type !== 'string' ||
      schema.required?.some((key) => key !== config.queryField)
    )
      throw new Error(
        'This tool needs a different input adapter. Use a property tool with one required string address field, or an agent listing packet.',
      );
    const result = await client.callTool(
      { name: config.tool, arguments: { [config.queryField]: query.trim() } },
      { signal, timeout: 25000 },
    );
    return normalizeListingResult(result);
  } finally {
    await client.close();
  }
}

export function zillowBridge({
  enabled = false,
  env = {},
  lookup = lookupProperty,
} = {}) {
  let busy = false;
  return async (req, res, next) => {
    const path = req.url?.split('?')[0];
    if (!path?.startsWith('/api/zillow/')) return next();
    const send = (status, body) => {
      if (res.destroyed) return;
      res.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(JSON.stringify(body));
    };
    const host = req.headers.host;
    if (
      !/^(127\.0\.0\.1|localhost):\d+$/.test(host ?? '') ||
      (req.headers.origin && req.headers.origin !== `http://${host}`)
    )
      return send(403, { error: 'Use the local Home Planner origin.' });
    if (path === '/api/zillow/status' && req.method === 'GET') {
      try {
        if (!enabled)
          throw new Error('Run pnpm dev:zillow to enable direct lookup.');
        const config = mcpConfig(env);
        return send(200, { configured: true, tool: config.tool });
      } catch (error) {
        return send(200, { configured: false, message: error.message });
      }
    }
    if (path !== '/api/zillow/lookup' || req.method !== 'POST')
      return send(404, { error: 'Unknown bridge operation.' });
    if (
      req.headers.origin !== `http://${host}` ||
      req.headers['content-type']?.split(';')[0] !== 'application/json'
    )
      return send(403, {
        error: 'Lookup requires a same-origin JSON request.',
      });
    if (!enabled)
      return send(503, {
        error:
          'Direct lookup is disabled. Configure .env.local and run pnpm dev:zillow, or import an agent listing JSON.',
      });
    if (busy)
      return send(429, {
        error:
          'A listing lookup is already running. Try again when it completes.',
      });
    let config;
    try {
      config = mcpConfig(env);
    } catch (error) {
      return send(503, { error: error.message });
    }
    busy = true;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      if (!req.complete) req.destroy();
    }, 40000);
    const cancel = () => controller.abort();
    res.on('close', cancel);
    try {
      let size = 0,
        body = '';
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 4096)
          return send(413, { error: 'Lookup request is too large.' });
        body += chunk;
      }
      let data;
      try {
        data = JSON.parse(body);
      } catch {
        return send(400, { error: 'Invalid lookup JSON.' });
      }
      if (
        Object.keys(data ?? {}).some((k) => k !== 'query') ||
        typeof data?.query !== 'string' ||
        !data.query.trim() ||
        data.query.length > 300
      )
        return send(400, {
          error: 'Provide only a property query of 1–300 characters.',
        });
      const result = await lookup(config, data.query, {
        signal: controller.signal,
      });
      send(200, result);
    } catch (error) {
      // SDK/provider failures can include request headers or signed URLs; do not forward them.
      const safeMessages = [
        'The configured property tool',
        'Configure a read-only',
        'This tool needs',
        'This provider schema',
        'Listing references need',
        'Use up to 60',
        'A listing image',
        'Photo and floor-plan',
        'Choose one property',
        'The MCP provider',
        'Expected one JSON',
        'Listing responses must',
      ];
      send(502, {
        error: controller.signal.aborted
          ? 'The lookup timed out or was cancelled.'
          : safeMessages.some((prefix) => error.message?.startsWith(prefix))
            ? error.message
            : 'MCP connection failed. Check the endpoint, bearer token, tool configuration, and provider access. No project changes were made.',
      });
    } finally {
      clearTimeout(timer);
      res.off('close', cancel);
      busy = false;
    }
  };
}
