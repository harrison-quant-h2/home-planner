// Listing evidence is separate from architecture. A photo never supplies a dimension.
export const MAX_REFERENCE_BYTES = 2_000_000;
const id = (v) => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(v);
const short = (v, max) => typeof v === 'string' && v.length <= max;
export function publicImageUrl(value) {
  try {
    const u = new URL(value);
    const host = u.hostname.toLowerCase();
    return (
      typeof value === 'string' &&
      value.length <= 2048 &&
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      (!u.port || u.port === '443') &&
      host.includes('.') &&
      !host.endsWith('.local') &&
      !host.endsWith('.localhost') &&
      !host.endsWith('.internal') &&
      !host.endsWith('.test') &&
      !/^[\d.]+$/.test(host) &&
      !host.includes(':')
    );
  } catch {
    return false;
  }
}
export function validateReferences(value, project) {
  const fail = (message) => {
    throw new Error(message);
  };
  const s = value?.source;
  if (
    !s ||
    s.provider !== 'zillow' ||
    !short(s.title, 200) ||
    !s.title ||
    !publicImageUrl(s.listingUrl) ||
    !short(s.attribution, 1000) ||
    !s.attribution ||
    !short(s.retrievedAt, 40) ||
    !Number.isFinite(Date.parse(s.retrievedAt))
  )
    fail(
      'Listing references need a title, HTTPS source link, attribution, and retrieval date.',
    );
  if (
    !Array.isArray(value.images) ||
    value.images.length > 60 ||
    !value.images.every(
      (p) =>
        p &&
        id(p.id) &&
        publicImageUrl(p.url) &&
        short(p.caption, 300) &&
        ['photo', 'floor-plan'].includes(p.kind) &&
        (p.roomId === undefined ||
          (id(p.roomId) &&
            (!project || project.rooms.some((r) => r.id === p.roomId)))),
    ) ||
    new Set(value.images.map((p) => p.id)).size !== value.images.length
  )
    fail(
      'Use up to 60 uniquely identified HTTPS photos or floor-plan images with valid room links.',
    );
  if (!Array.isArray(value.bindings) || value.bindings.length > 100)
    fail('Use at most 100 window photo links.');
  const windows = new Set();
  for (const b of value.bindings) {
    const image = value.images.find((p) => p.id === b?.imageId);
    const key = `${b?.wallIndex}:${b?.openingIndex}`;
    if (
      !image ||
      image.kind !== 'photo' ||
      !Number.isInteger(b.wallIndex) ||
      b.wallIndex < 0 ||
      b.wallIndex >= 200 ||
      !Number.isInteger(b.openingIndex) ||
      b.openingIndex < 0 ||
      b.openingIndex >= 16 ||
      ![-1, 1].includes(b.side) ||
      typeof b.flipX !== 'boolean' ||
      windows.has(key) ||
      (project &&
        project.walls[b.wallIndex]?.openings[b.openingIndex]?.kind !== 'window')
    )
      fail(
        'Each photo link must target a different existing window, with a valid side and mirror setting.',
      );
    windows.add(key);
  }
  // Keep only supported fields. Tool output, instructions, and credentials are never persisted.
  return {
    source: {
      provider: 'zillow',
      title: s.title,
      listingUrl: s.listingUrl,
      attribution: s.attribution,
      retrievedAt: s.retrievedAt,
    },
    images: value.images.map((p) => ({
      id: p.id,
      url: p.url,
      caption: p.caption,
      kind: p.kind,
      ...(p.roomId ? { roomId: p.roomId } : {}),
    })),
    bindings: value.bindings.map((b) => ({
      imageId: b.imageId,
      wallIndex: b.wallIndex,
      openingIndex: b.openingIndex,
      side: b.side,
      flipX: b.flipX,
    })),
  };
}

export function windowTargets(project) {
  return project.walls.flatMap((w, wallIndex) =>
    w.openings.flatMap((o, openingIndex) => {
      if (o.kind !== 'window') return [];
      const angle = Math.atan2(w.b[1] - w.a[1], w.b[0] - w.a[0]);
      return [
        {
          wallIndex,
          openingIndex,
          key: `${wallIndex}:${openingIndex}`,
          label: `${w.name || `Wall ${wallIndex + 1}`} · window ${openingIndex + 1} · ${o.width}′ × ${o.height}′`,
          x: w.a[0] + Math.cos(angle) * o.at,
          z: w.a[1] + Math.sin(angle) * o.at,
          y: o.sill + o.height / 2,
          angle,
          width: o.width,
          height: o.height,
          thickness: w.thickness,
        },
      ];
    }),
  );
}

export function attachListing(project, packet) {
  // Importing a new listing intentionally clears old links; indices from another home are unsafe.
  const references = validateReferences({ ...packet, bindings: [] });
  references.images = references.images.map(({ roomId, ...p }) =>
    project.rooms.some((r) => r.id === roomId) ? { ...p, roomId } : p,
  );
  return { ...structuredClone(project), references };
}

export function linkWindow(project, imageId, target, side = 1, flipX = false) {
  const p = structuredClone(project);
  p.references.bindings = p.references.bindings.filter(
    (b) =>
      b.wallIndex !== target.wallIndex ||
      b.openingIndex !== target.openingIndex,
  );
  p.references.bindings.push({
    imageId,
    wallIndex: target.wallIndex,
    openingIndex: target.openingIndex,
    side,
    flipX,
  });
  p.references = validateReferences(p.references, p);
  return p;
}
