import {
  normalizeListingResult,
  applyListingLayout,
} from './listing-import.js';
import {
  attachListing,
  linkWindow,
  windowTargets,
  MAX_REFERENCE_BYTES,
} from './references.js';

const $ = (id) => document.getElementById(id);
const element = (tag, text, className) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
};
export function createReferencePanel({
  getProject,
  commit,
  openLayout,
  refreshViews,
}) {
  let staged = null,
    selected = null,
    enabled = false,
    signature = '',
    revision = 0;
  let lookupController;
  const report = (text) => {
    $('reference-status').textContent = text;
  };
  const stage = (data) => {
    staged = normalizeListingResult(data);
    $('listing-preview').hidden = false;
    $('listing-preview-title').textContent = staged.source.title;
    $('listing-preview-summary').textContent =
      `${staged.images.filter((i) => i.kind === 'photo').length} photos · ${staged.images.filter((i) => i.kind === 'floor-plan').length} floor-plan images · ${staged.layout ? `${staged.layout.confidence} model layout supplied` : 'No measured model layout supplied'}`;
    const link = $('listing-preview-source');
    link.href = staged.source.listingUrl;
    $('listing-preview-attribution').textContent = staged.source.attribution;
    $('apply-listing-layout').hidden = !staged.layout;
    $('apply-listing-layout').textContent = staged.layout
      ? `Open supplied ${staged.layout.confidence} layout`
      : '';
    $('listing-layout-basis').textContent =
      staged.layout?.basis ??
      'Images can guide a model; room dimensions and window locations still need verification.';
    report('Listing ready to review. The current project has not changed.');
  };
  $('import-listing').onclick = () => $('listing-file').click();
  $('listing-file').onchange = async () => {
    const version = ++revision;
    lookupController?.abort();
    staged = null;
    $('listing-preview').hidden = true;
    try {
      const file = $('listing-file').files[0];
      if (!file) return;
      if (file.size > MAX_REFERENCE_BYTES)
        throw new Error('Listing files must be smaller than 2 MB.');
      const text = await file.text();
      if (version === revision) stage(JSON.parse(text));
    } catch (error) {
      report('Could not import: ' + error.message);
    } finally {
      $('listing-file').value = '';
    }
  };
  $('lookup-listing').onclick = async () => {
    const query = $('listing-query').value.trim();
    if (!query) {
      report('Enter a property address first.');
      return;
    }
    const version = ++revision;
    lookupController?.abort();
    lookupController = new AbortController();
    staged = null;
    $('listing-preview').hidden = true;
    $('lookup-listing').disabled = true;
    report('Connecting to your configured MCP server…');
    try {
      const response = await fetch(
        `${import.meta.env.BASE_URL}api/zillow/lookup`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
          signal: AbortSignal.any([
            lookupController.signal,
            AbortSignal.timeout(45000),
          ]),
        },
      );
      if (!response.headers.get('content-type')?.includes('application/json'))
        throw new Error(
          'Direct lookup needs the local MCP bridge. Run pnpm dev:zillow after configuring .env.local, or import an agent listing packet.',
        );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The MCP lookup failed.');
      if (version === revision) stage(data);
    } catch (error) {
      if (version === revision)
        report(
          error.name === 'TimeoutError'
            ? 'The lookup timed out. Your project is unchanged.'
            : error.message,
        );
    } finally {
      $('lookup-listing').disabled = false;
    }
  };
  $('attach-listing').onclick = () => {
    if (!staged) return;
    enabled = false;
    selected = null;
    commit(attachListing(getProject(), staged));
    report(
      'Listing references attached. Existing furniture and dimensions are preserved. Undo reverses this import.',
    );
  };
  $('apply-listing-layout').onclick = () => {
    if (!staged?.layout) return;
    enabled = false;
    selected = null;
    openLayout(applyListingLayout(staged));
    report(
      'Supplied layout opened as a project. Verify its measurement basis before planning a purchase.',
    );
  };
  $('load-reference-images').onclick = () => {
    enabled = !enabled;
    signature = '';
    render();
    refreshViews();
    report(
      enabled
        ? 'Loading listing images from their source hosts for this session.'
        : 'Remote images hidden for this session. Photo links remain saved.',
    );
  };
  $('clear-references').onclick = () => {
    const next = structuredClone(getProject());
    delete next.references;
    enabled = false;
    selected = null;
    commit(next);
    report('Listing references removed. Undo restores them.');
  };
  $('reference-room').onchange = () => {
    if (!selected) return;
    const next = structuredClone(getProject());
    const photo = next.references.images.find((p) => p.id === selected);
    delete photo.roomId;
    if ($('reference-room').value) photo.roomId = $('reference-room').value;
    commit(next);
  };
  $('link-window').onclick = () => {
    const target = windowTargets(getProject()).find(
      (t) => t.key === $('reference-window').value,
    );
    if (!selected || !target) return;
    try {
      commit(
        linkWindow(
          getProject(),
          selected,
          target,
          Number($('reference-side').value),
          $('reference-mirror').checked,
        ),
      );
      report(
        'Photo linked to ' +
          target.label +
          '. Use Walk through to inspect the view.',
      );
    } catch (error) {
      report(error.message);
    }
  };
  function renderEditor() {
    const project = getProject(),
      references = project.references;
    const photo = references?.images.find((p) => p.id === selected);
    $('reference-editor').hidden = !photo;
    if (!photo) return;
    $('reference-photo-title').textContent = photo.caption || photo.id;
    const preview = $('reference-photo-preview');
    preview.replaceChildren();
    if (enabled) {
      const img = element('img');
      img.alt = photo.caption;
      img.referrerPolicy = 'no-referrer';
      img.src = photo.url;
      img.onerror = () =>
        report('Photo unavailable or expired. Its source link is retained.');
      preview.append(img);
    }
    const source = $('reference-photo-source');
    source.href = photo.url;
    const rooms = $('reference-room');
    rooms.replaceChildren(new Option('Unassigned', ''));
    for (const r of project.rooms) rooms.add(new Option(r.name, r.id));
    rooms.value = photo.roomId ?? '';
    $('window-link-controls').hidden = photo.kind !== 'photo';
    const windows = $('reference-window');
    const previous = windows.value;
    windows.replaceChildren();
    const targets = windowTargets(project);
    for (const t of targets) windows.add(new Option(t.label, t.key));
    const binding =
      references.bindings.find(
        (b) =>
          b.imageId === selected &&
          `${b.wallIndex}:${b.openingIndex}` === previous,
      ) ?? references.bindings.find((b) => b.imageId === selected);
    windows.value = binding
      ? `${binding.wallIndex}:${binding.openingIndex}`
      : (targets.find((t) => t.key === previous)?.key ?? targets[0]?.key ?? '');
    $('reference-side').value = String(binding?.side ?? 1);
    $('reference-mirror').checked = binding?.flipX ?? false;
    $('link-window').disabled = !targets.length;
  }
  function render() {
    const project = getProject();
    const nextSignature = JSON.stringify([
      project.id,
      project.references,
      project.walls,
      project.rooms,
      enabled,
    ]);
    if (nextSignature === signature) return;
    signature = nextSignature;
    const r = project.references;
    $('attached-references').hidden = !r;
    $('reference-empty').hidden = !!r;
    $('reference-gallery').replaceChildren();
    $('window-links').replaceChildren();
    if (!r) {
      $('reference-editor').hidden = true;
      return;
    }
    $('reference-listing-title').textContent = r.source.title;
    $('reference-listing-link').href = r.source.listingUrl;
    $('reference-attribution').textContent =
      `${r.source.attribution} Retrieved ${new Date(r.source.retrievedAt).toLocaleDateString()}.`;
    $('load-reference-images').textContent = enabled
      ? 'Hide remote images'
      : 'Load listing images';
    for (const p of r.images) {
      const button = element('button');
      button.className = 'reference-card';
      button.setAttribute(
        'aria-label',
        'Select reference ' + (p.caption || p.id),
      );
      button.setAttribute('aria-pressed', String(p.id === selected));
      if (enabled) {
        const img = element('img');
        img.alt = '';
        img.loading = 'lazy';
        img.referrerPolicy = 'no-referrer';
        img.src = p.url;
        button.append(img);
      }
      button.append(
        element('strong', p.caption || p.id),
        element(
          'small',
          `${p.kind === 'floor-plan' ? 'Floor plan · reference only' : 'Photo'}${p.roomId ? ' · ' + project.rooms.find((r) => r.id === p.roomId).name : ''}`,
        ),
      );
      button.onclick = () => {
        selected = p.id;
        signature = '';
        render();
      };
      $('reference-gallery').append(button);
    }
    if (!r.images.length)
      $('reference-gallery').append(
        element(
          'p',
          'This result contains no photo or floor-plan image URLs.',
          'small',
        ),
      );
    const targets = windowTargets(project);
    for (const b of r.bindings) {
      const row = element('div', undefined, 'reference-link-row');
      const target = targets.find(
        (t) => t.wallIndex === b.wallIndex && t.openingIndex === b.openingIndex,
      );
      row.append(element('span', target.label));
      const remove = element('button', 'Unlink');
      remove.setAttribute('aria-label', 'Unlink ' + target.label);
      remove.onclick = () => {
        const next = structuredClone(getProject());
        next.references.bindings = next.references.bindings.filter(
          (link) =>
            link.wallIndex !== b.wallIndex ||
            link.openingIndex !== b.openingIndex,
        );
        commit(next);
      };
      row.append(remove);
      $('window-links').append(row);
    }
    renderEditor();
  }
  return {
    render,
    report,
    get enabled() {
      return enabled;
    },
    reset() {
      revision++;
      lookupController?.abort();
      enabled = false;
      selected = null;
      staged = null;
      $('listing-preview').hidden = true;
      render();
    },
  };
}
