import {
  MAX_REFERENCE_BYTES,
  validateReferences,
  publicImageUrl,
  attachListing,
} from './references.js';
import { validateProject } from './validation.js';

export function normalizeListingResult(input, now = new Date().toISOString()) {
  if (
    new TextEncoder().encode(JSON.stringify(input)).byteLength >
    MAX_REFERENCE_BYTES
  )
    throw new Error('Listing responses must be smaller than 2 MB.');
  if (input?.isError || input?.error || input?.error_code)
    throw new Error(
      'The MCP provider could not return this listing. Check its supported listing status and access permissions.',
    );
  let data = input;
  if (input?.structuredContent) data = input.structuredContent;
  else if (Array.isArray(input?.content)) {
    const objects = input.content
      .filter((c) => c.type === 'text')
      .flatMap((c) => {
        try {
          return [JSON.parse(c.text)];
        } catch {
          return [];
        }
      });
    if (objects.length !== 1)
      throw new Error(
        'Expected one JSON property result. Ask your agent to create a Home Planner listing packet.',
      );
    data = objects[0];
  }
  if (data?.error || data?.error_code)
    throw new Error(
      'The MCP provider returned a listing error. No project changes were made.',
    );
  if (data?.format === 'home-planner-listing') {
    if (data.version !== 1)
      throw new Error('Unsupported listing packet version.');
    const packet = {
      format: data.format,
      version: 1,
      ...validateReferences({ ...data, bindings: [] }),
    };
    if (data.layout !== undefined) {
      const layout = data.layout;
      if (
        !['inferred', 'measured'].includes(layout?.confidence) ||
        typeof layout.basis !== 'string' ||
        !layout.basis.trim() ||
        layout.basis.length > 500
      )
        throw new Error(
          'A supplied layout needs measured/inferred provenance and its measurement basis.',
        );
      const project = validateProject(layout.project);
      delete project.references;
      packet.layout = {
        project,
        confidence: layout.confidence,
        basis: layout.basis,
      };
    }
    return packet;
  }
  // Deliberately narrow adapter. Do not crawl arbitrary URLs or guess geometry from sqft.
  const p = data?.property ?? data?.data?.property ?? data?.data ?? data;
  if (!p || Array.isArray(p) || p.results || p.properties || p.listings)
    throw new Error(
      'Choose one property first; search-result lists cannot be imported as a home.',
    );
  const listingUrl = p.listingUrl ?? p.url ?? p.hdpUrl;
  const address =
    typeof p.address === 'string'
      ? p.address
      : [
          p.address?.streetAddress,
          p.address?.city,
          p.address?.state,
          p.address?.zipcode,
        ]
          .filter(Boolean)
          .join(', ');
  if (!address || !publicImageUrl(listingUrl))
    throw new Error(
      'This provider schema needs an adapter. Import a Home Planner listing packet with a title and source URL.',
    );
  const photos = p.photos ?? p.originalPhotos ?? [];
  const plans = p.floorPlans ?? p.floorplans ?? [];
  if (!Array.isArray(photos) || !Array.isArray(plans))
    throw new Error(
      'Photo and floor-plan fields must be arrays. Use a listing packet for this provider.',
    );
  const images = [];
  const seen = new Set();
  for (const [list, kind] of [
    [photos, 'photo'],
    [plans, 'floor-plan'],
  ]) {
    for (const entry of list) {
      const url = typeof entry === 'string' ? entry : entry?.url;
      if (!publicImageUrl(url))
        throw new Error(
          'A listing image has an unsupported URL. Use HTTPS image URLs in a listing packet.',
        );
      if (seen.has(url)) {
        // A floor plan can also appear in a provider's general photo gallery.
        // Its explicit category takes precedence, including the window-texture restriction.
        if (kind === 'floor-plan') {
          const existing = images.find((image) => image.url === url);
          existing.kind = 'floor-plan';
          if (typeof entry?.caption === 'string')
            existing.caption = entry.caption;
        }
        continue;
      }
      seen.add(url);
      images.push({
        id: `image-${images.length + 1}`,
        url,
        kind,
        caption:
          typeof entry?.caption === 'string'
            ? entry.caption
            : `${kind === 'photo' ? 'Listing photo' : 'Floor-plan reference'} ${images.length + 1}`,
      });
    }
  }
  return {
    format: 'home-planner-listing',
    version: 1,
    ...validateReferences({
      source: {
        provider: 'zillow',
        title: address,
        listingUrl,
        retrievedAt: now,
        attribution:
          typeof p.attribution === 'string'
            ? p.attribution
            : 'Source: Zillow listing. See original listing for photographer, broker, and MLS attribution.',
      },
      images,
      bindings: [],
    }),
  };
}

export function applyListingLayout(packet) {
  if (!packet.layout)
    throw new Error(
      'No model layout was supplied. Floor-plan images remain references.',
    );
  const p = validateProject(packet.layout.project);
  const note =
    `Listing layout: ${packet.layout.confidence}. ${packet.layout.basis}`.slice(
      0,
      500,
    );
  p.notes = [...(p.notes ?? []).slice(0, 29), note];
  return validateProject(attachListing(p, packet));
}
