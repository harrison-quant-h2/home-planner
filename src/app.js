import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { CATALOG } from './catalog.js';
import { makeFurniture, disposeGroup, label } from './furniture.js';
import { buildHouse, projectBounds } from './architecture.js';
import {
  assessItem,
  furnitureFootprint,
  furnitureOutline,
  footprint,
  insidePolygon,
  overlap,
} from './geometry.js';
import {
  validItems,
  validateProject,
  readProjectFile,
  validView,
} from './validation.js';
import {
  createSnapshot,
  saveSnapshot,
  restoreSnapshot,
  layoutChanged,
  storageKey,
  History,
} from './state.js';

const $ = (id) => document.getElementById(id),
  canvas = $('scene'),
  viewport = $('viewport');
const demo = validateProject(
  await (
    await fetch(`${import.meta.env.BASE_URL}examples/courtyard.json`)
  ).json(),
);
let project = structuredClone(demo),
  checkpoint = null,
  saving = false,
  storageWarning = false;
function readStorage(key) {
  try {
    const text = localStorage.getItem(key);
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}
try {
  const active = readStorage('home-planner:active');
  if (active) project = validateProject(active);
} catch {
  storageWarning = true;
}
let key = storageKey(project),
  starter = loadStarter(project),
  history = new History(),
  mode = 'dollhouse',
  activeRoom = project.rooms[0].id;
let selected = null,
  pointer = null,
  drag = null,
  walkAngle = 0,
  walkPitch = 0,
  toastTimer;
const keys = new Set(),
  meshes = new Map();
const renderer = new T.WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.localClippingEnabled = true;
const scene = new T.Scene();
scene.background = new T.Color('#e8e9e2');
const pmrem = new T.PMREMGenerator(renderer),
  environment = new RoomEnvironment(),
  env = pmrem.fromScene(environment, 0.04);
scene.environment = env.texture;
scene.environmentIntensity = 0.3;
environment.dispose();
pmrem.dispose();
const camera3D = new T.PerspectiveCamera(39, 1, 0.05, 1000),
  cameraPlan = new T.OrthographicCamera(-30, 30, 20, -20, 0.1, 1000);
let camera = camera3D,
  controls = new OrbitControls(camera, canvas);
const hemi = new T.HemisphereLight('#f9f6ec', '#889180', 2),
  sun = new T.DirectionalLight('#fff1da', 3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.normalBias = 0.035;
sun.shadow.bias = -0.00008;
scene.add(hemi, sun, sun.target);
let house, bounds;
const clipping = new T.Plane(new T.Vector3(0, -1, 0), 3.8);
const furniture = new T.Group(),
  selection = new T.Group();
scene.add(selection);
function installHouse() {
  if (house) {
    house.root.remove(furniture);
    for (const group of [house.root, house.labels, house.caps]) {
      scene.remove(group);
      disposeGroup(group);
    }
  }
  bounds = projectBounds(project);
  house = buildHouse(project);
  scene.add(house.root, house.labels, house.caps);
  house.root.add(furniture);
  house.architecture.traverse((o) => {
    if (o.isMesh) {
      o.material = o.material.clone();
      o.material.clippingPlanes = [clipping];
      o.material.clipShadows = true;
    }
  });
  const span = Math.max(bounds.w, bounds.d);
  sun.position.set(bounds.x - span * 0.4, span, bounds.z - span * 0.7);
  sun.target.position.set(bounds.x, 0, bounds.z);
  Object.assign(sun.shadow.camera, {
    left: -span,
    right: span,
    top: span,
    bottom: -span,
    near: 0.5,
    far: span * 4,
  });
  sun.shadow.camera.updateProjectionMatrix();
  $('project-name').textContent = project.name;
  $('project-origin').textContent =
    project.id === demo.id
      ? 'Fictional demonstration home.'
      : 'Custom project · stored in this browser';
  $('plan-dimensions').textContent =
    `${bounds.w.toFixed(1)}′ × ${bounds.d.toFixed(1)}′ overall · ${project.ceilingHeight}′ ceiling`;
  $('assumptions').replaceChildren();
  for (const note of project.notes ?? []) {
    const li = document.createElement('li');
    li.textContent = note;
    $('assumptions').append(li);
  }
  for (const id of ['room-list', 'room-pills']) {
    $(id).replaceChildren();
    for (const r of project.rooms) {
      const b = document.createElement('button');
      b.textContent = r.name;
      b.onclick = () => goRoom(r.id);
      $(id).append(b);
    }
  }
}
function toast(text) {
  $('toast').textContent = text;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($('toast').hidden = true), 5000);
}
function loadStarter(project) {
  const stored = readStorage(storageKey(project) + ':starter');
  const items = validItems(stored) ? stored : project.items;
  return structuredClone(items);
}
function saveStarter() {
  try {
    localStorage.setItem(key + ':starter', JSON.stringify(starter));
  } catch {
    storageWarning = true;
  }
}
function savedStatus() {
  const changed = layoutChanged(project, checkpoint);
  $('saved').textContent = storageWarning
    ? 'Browser storage unavailable'
    : checkpoint
      ? changed
        ? 'Unsaved layout changes'
        : 'Matches saved layout'
      : 'No saved checkpoint';
  $('reset-layout').disabled = !checkpoint || saving;
  $('save-layout').disabled = saving;
  $('undo').disabled = !history.past.length;
  $('redo').disabled = !history.future.length;
}
function captureView() {
  return {
    mode,
    activeRoom,
    position: camera.position.toArray(),
    target: controls.target.toArray(),
    zoom: camera.zoom,
    walkAngle,
    walkPitch,
  };
}
function autosave() {
  try {
    localStorage.setItem(
      key + ':draft',
      JSON.stringify(createSnapshot(project, captureView())),
    );
    localStorage.setItem('home-planner:active', JSON.stringify(project));
    storageWarning = false;
  } catch {
    storageWarning = true;
  }
  savedStatus();
}
function readCheckpoint() {
  checkpoint = null;
  try {
    const saved = readStorage(key + ':checkpoint');
    if (saved && storageKey(restoreSnapshot(saved).project) === key)
      checkpoint = saved;
  } catch {
    storageWarning = true;
  }
}
function renderFurniture() {
  disposeGroup(furniture);
  furniture.clear();
  meshes.clear();
  for (const item of project.items) {
    const m = makeFurniture(item);
    meshes.set(item.id, m);
    furniture.add(m);
  }
  refreshList();
  autosave();
  drawSelection();
}
function refreshList() {
  const select = $('furniture-list');
  select.replaceChildren(new Option('Choose furniture…', ''));
  for (const i of project.items) select.add(new Option(i.name, i.id));
  select.value = selected ?? '';
  $('item-count').textContent = String(project.items.length);
}
function remember() {
  history.push(project.items);
}
function changeItem(next) {
  if (!validItems([next])) {
    toast('That combination of dimensions is not valid.');
    choose(selected);
    return false;
  }
  remember();
  project.items = project.items.map((i) => (i.id === next.id ? next : i));
  renderFurniture();
  choose(next.id);
  return true;
}
function choose(id) {
  selected = id;
  const item = project.items.find((i) => i.id === id);
  $('selection-panel').hidden = !item;
  $('furniture-list').value = id ?? '';
  if (item) {
    $('selected-name').textContent = item.name;
    for (const field of [
      'name',
      'w',
      'd',
      'h',
      'rot',
      'x',
      'z',
      'color',
      'openDepth',
      'mountHeight',
      'extension',
      'swivel',
      'seatDepth',
      'rearClearance',
    ])
      if (item[field] !== undefined)
        $('item-' + field).value = ['x', 'z'].includes(field)
          ? item[field].toFixed(3)
          : item[field];
    const expands = ['murphy', 'recliner'].includes(item.type);
    $('murphy-controls').hidden = !expands;
    $('depth-label').textContent = expands ? 'Closed depth · in' : 'Depth · in';
    $('rotation-label').textContent =
      item.type === 'tv' ? 'Mount direction · °' : 'Rotation · °';
    for (const type of ['tv', 'sectional', 'recliner'])
      $(type + '-controls').hidden = item.type !== type;
    $('desk-controls').hidden = item.type !== 'desk' || !item.tvMonitorIn;
    $('headboard-controls').hidden = item.type !== 'murphy';
    if (expands)
      $('toggle-selected-bed').textContent = item.open
        ? 'Close ' + (item.type === 'recliner' ? 'recliner' : 'bed')
        : 'Open ' + (item.type === 'recliner' ? 'recliner' : 'bed');
    if (item.type === 'sectional') $('item-returnSide').value = item.returnSide;
    if (item.type === 'desk' && item.tvMonitorIn) {
      $('item-monitorLayout').value = item.monitorLayout;
      $('item-tvMonitorIn').value = item.tvMonitorIn;
      $('aim-screen').textContent =
        item.tvMonitorMode === 'guest'
          ? 'Aim screen for work'
          : 'Aim screen for guest';
    }
    $('item-headboardConcept').checked = !!item.headboardConcept;
  }
  drawSelection();
}
function drawSelection() {
  disposeGroup(selection);
  selection.clear();
  const i = project.items.find((i) => i.id === selected);
  if (!i) return;
  const warnings = assessItem(i, project.items, project),
    p = furnitureOutline(i),
    color = warnings.length ? '#be8950' : '#547e64';
  function outline(points, dashed = false) {
    const geometry = new T.BufferGeometry().setFromPoints(
      [...points, points[0]].map(([x, z]) => new T.Vector3(x, 0.12, z)),
    );
    const material = dashed
      ? new T.LineDashedMaterial({
          color: '#79937d',
          dashSize: 0.25,
          gapSize: 0.16,
          depthTest: false,
        })
      : new T.LineBasicMaterial({ color, depthTest: false });
    const line = new T.Line(geometry, material);
    if (dashed) line.computeLineDistances();
    line.renderOrder = 30;
    selection.add(line);
  }
  outline(p);
  if (['murphy', 'recliner'].includes(i.type) && !i.open)
    outline(footprint(furnitureFootprint(i, true)), true);
  const depth = furnitureFootprint(i).d * 12;
  label(
    selection,
    `${i.w}″ × ${depth.toFixed(1)}″`,
    i.x,
    0.5,
    i.z + i.d / 24 + 0.5,
    0.9,
  );
  $('item-size').textContent = `${i.w}″ × ${depth.toFixed(1)}″`;
  $('fit-status').className = warnings.length ? 'warning' : '';
  $('fit-status').textContent = warnings.length
    ? warnings.join(' · ')
    : 'No modeled overlap. Verify real access and clearance.';
}
$('furniture-list').onchange = () => choose($('furniture-list').value || null);
for (const field of [
  'name',
  'w',
  'd',
  'h',
  'rot',
  'x',
  'z',
  'color',
  'openDepth',
  'mountHeight',
  'extension',
  'swivel',
  'seatDepth',
  'rearClearance',
])
  $('item-' + field).addEventListener('change', () => {
    const item = project.items.find((i) => i.id === selected);
    if (!item) return;
    const input = $('item-' + field),
      value = ['name', 'color'].includes(field)
        ? input.value.trim()
        : Number(input.value);
    if (input.value.trim() === '') {
      choose(selected);
      return;
    }
    changeItem({ ...item, [field]: value });
  });
for (const field of ['returnSide', 'monitorLayout', 'tvMonitorIn'])
  $('item-' + field).onchange = () => {
    const i = project.items.find((i) => i.id === selected);
    if (i)
      changeItem({
        ...i,
        [field]:
          field === 'tvMonitorIn'
            ? Number($('item-' + field).value)
            : $('item-' + field).value,
      });
  };
$('aim-screen').onclick = () => {
  const i = project.items.find((i) => i.id === selected);
  if (i)
    changeItem({
      ...i,
      tvMonitorMode: i.tvMonitorMode === 'guest' ? 'work' : 'guest',
    });
};
$('item-headboardConcept').onchange = () => {
  const i = project.items.find((i) => i.id === selected);
  if (!i) return;
  const next = { ...i };
  if ($('item-headboardConcept').checked)
    Object.assign(next, {
      headboardConcept: true,
      headEnd: 'positive',
      headboardRaised: next.open,
    });
  else {
    delete next.headboardConcept;
    delete next.headEnd;
    delete next.headboardRaised;
  }
  changeItem(next);
};
$('toggle-selected-bed').onclick = () => {
  const i = project.items.find((i) => i.id === selected);
  if (!i) return;
  const next = { ...i, open: !i.open };
  if (i.workDepth) next.officeMode = next.open ? 'guest' : 'work';
  if (i.headboardConcept) next.headboardRaised = next.open;
  changeItem(next);
  toast('Endpoint changed · check overlaps and the real opening path.');
};
$('rotate').onclick = () => {
  const i = project.items.find((i) => i.id === selected);
  if (i) changeItem({ ...i, rot: (i.rot + 90) % 360 });
};
$('duplicate').onclick = () => {
  const i = project.items.find((i) => i.id === selected);
  if (!i || project.items.length >= 250) return;
  const next = {
    ...i,
    id: crypto.randomUUID(),
    name: (i.name + ' copy').slice(0, 100),
    x: i.x + 1,
    z: i.z + 1,
  };
  if (!validItems([next])) return;
  remember();
  project.items.push(next);
  renderFurniture();
  choose(next.id);
};
$('delete').onclick = () => {
  if (!selected) return;
  remember();
  project.items = project.items.filter((i) => i.id !== selected);
  choose(null);
  renderFurniture();
};
$('deselect').onclick = () => choose(null);
for (const action of ['undo', 'redo'])
  $(action).onclick = () => {
    const restored = history[action](project.items);
    if (restored) {
      project.items = restored;
      choose(null);
      renderFurniture();
      toast(
        action === 'undo' ? 'Previous layout restored' : 'Change reapplied',
      );
    }
  };
$('empty').onclick = () => {
  remember();
  project.items = [];
  choose(null);
  renderFurniture();
  toast('Empty home · Undo restores your furniture');
};
$('starter').onclick = () => {
  remember();
  project.items = structuredClone(starter);
  choose(null);
  renderFurniture();
};

function resize() {
  const w = viewport.clientWidth,
    h = viewport.clientHeight;
  if (!w || !h || !bounds) return;
  renderer.setSize(w, h, false);
  camera3D.aspect = w / h;
  camera3D.updateProjectionMatrix();
  const span = Math.max(bounds.w / 2 + 3, ((bounds.d / 2 + 3) * w) / h);
  cameraPlan.left = -span;
  cameraPlan.right = span;
  cameraPlan.top = (span * h) / w;
  cameraPlan.bottom = (-span * h) / w;
  cameraPlan.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewport);
function setView(next) {
  mode = next;
  choose(null);
  camera = mode === 'plan' ? cameraPlan : camera3D;
  controls.dispose();
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 2;
  controls.maxDistance = 600;
  controls.enabled = mode !== 'walk';
  controls.enableRotate = mode !== 'plan';
  if (mode === 'plan') controls.mouseButtons.LEFT = T.MOUSE.PAN;
  camera.up.set(0, mode === 'plan' ? 0 : 1, mode === 'plan' ? -1 : 0);
  camera.zoom = 1;
  camera3D.fov = mode === 'walk' ? 65 : 39;
  controls.target.set(bounds.x, 0, bounds.z);
  house.ceiling.visible = mode === 'walk';
  house.labels.visible = mode !== 'walk' && $('labels').checked;
  clipping.constant =
    mode === 'walk' ? project.ceilingHeight + 1 : mode === 'plan' ? 1.2 : 3.8;
  house.caps.visible = mode !== 'walk';
  house.capWalls(clipping.constant);
  if (mode === 'plan') {
    camera.position.set(bounds.x, 200, bounds.z);
    camera.lookAt(controls.target);
  } else if (mode === 'dollhouse') {
    const span = Math.max(bounds.w, bounds.d),
      aspect = viewport.clientWidth / viewport.clientHeight,
      zoomOut = Math.max(1, 1.3 / aspect);
    camera.position.set(
      bounds.x + span * 0.55 * zoomOut,
      span * 1.05 * zoomOut,
      bounds.z + span * 1.15 * zoomOut,
    );
    camera.lookAt(controls.target);
  } else goRoom(activeRoom, false);
  document.querySelectorAll('[data-view]').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === mode);
    b.setAttribute('aria-pressed', String(b.dataset.view === mode));
  });
  if (mode !== 'walk')
    $('view-title').textContent =
      mode === 'plan' ? 'The floor plan' : 'The whole home';
  $('view-subtitle').textContent =
    mode === 'walk'
      ? 'Eye-level study · illustrative materials'
      : 'Illustrative furnishings · real proportions';
  $('interaction-hint').textContent =
    mode === 'walk'
      ? 'Drag to look · W A S D to walk · Esc returns home'
      : 'Drag furniture to place · drag empty space to navigate';
  resize();
  if (mode !== 'walk') controls.update();
}
function goRoom(id, switchView = true) {
  activeRoom = id;
  if (mode !== 'walk' && switchView) {
    setView('walk');
    return;
  }
  const r = project.rooms.find((r) => r.id === id) ?? project.rooms[0];
  camera3D.position.fromArray(r.eye);
  const direction = new T.Vector3(...r.target)
    .sub(camera3D.position)
    .normalize();
  walkAngle = Math.atan2(-direction.x, -direction.z);
  walkPitch = Math.asin(direction.y);
  look();
  $('view-title').textContent = r.name;
}
function look() {
  camera3D.rotation.order = 'YXZ';
  camera3D.rotation.set(walkPitch, walkAngle, 0);
}
function restoreView(view) {
  if (!validView(view)) return;
  activeRoom = project.rooms.some((r) => r.id === view.activeRoom)
    ? view.activeRoom
    : project.rooms[0].id;
  setView(view.mode);
  camera.position.fromArray(view.position);
  controls.target.fromArray(view.target);
  camera.zoom = view.zoom;
  camera.updateProjectionMatrix();
  walkAngle = view.walkAngle;
  walkPitch = view.walkPitch;
  if (mode === 'walk') look();
  else {
    camera.lookAt(controls.target);
    controls.update();
  }
}
for (const b of document.querySelectorAll('[data-view]'))
  b.onclick = () => setView(b.dataset.view);
$('reset-view').onclick = () => setView(mode);
$('labels').onchange = () =>
  (house.labels.visible = mode !== 'walk' && $('labels').checked);
$('lighting').onchange = () => {
  const evening = $('lighting').value === 'evening';
  sun.intensity = evening ? 0.4 : 3;
  sun.color.set(evening ? '#ffb576' : '#fff1da');
  hemi.intensity = evening ? 1 : 2;
  toast('Lighting mood changed · sun direction and glare are illustrative');
};
const raycaster = new T.Raycaster(),
  groundPlane = new T.Plane(new T.Vector3(0, 1, 0), 0);
function ray(event) {
  const r = canvas.getBoundingClientRect();
  raycaster.setFromCamera(
    new T.Vector2(
      ((event.clientX - r.left) / r.width) * 2 - 1,
      (-(event.clientY - r.top) / r.height) * 2 + 1,
    ),
    camera,
  );
  return raycaster;
}
canvas.addEventListener(
  'pointerdown',
  (e) => {
    if (e.button !== 0) return;
    canvas.focus();
    const hit = ray(e)
      .intersectObjects(furniture.children, true)
      .find((h) => h.object.userData.furnitureId);
    pointer = { x: e.clientX, y: e.clientY };
    if (mode === 'walk') {
      drag = { look: true, x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    if (hit) {
      choose(hit.object.userData.furnitureId);
      const p = new T.Vector3();
      if (raycaster.ray.intersectPlane(groundPlane, p)) {
        const i = project.items.find((i) => i.id === selected);
        drag = { id: i.id, dx: i.x - p.x, dz: i.z - p.z, changed: false };
        controls.enabled = false;
        canvas.setPointerCapture(e.pointerId);
      }
    }
  },
  true,
);
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  if (drag.look) {
    walkAngle -= (e.clientX - drag.x) * 0.004;
    walkPitch = Math.max(
      -1.2,
      Math.min(1.2, walkPitch - (e.clientY - drag.y) * 0.004),
    );
    drag.x = e.clientX;
    drag.y = e.clientY;
    look();
    return;
  }
  const p = new T.Vector3();
  if (ray(e).ray.intersectPlane(groundPlane, p)) {
    if (
      !drag.changed &&
      Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y) < 4
    )
      return;
    if (!drag.changed) {
      remember();
      drag.changed = true;
    }
    const i = project.items.find((i) => i.id === drag.id),
      snap = $('snap').checked ? 12 : 120;
    i.x =
      Math.round(Math.max(-190, Math.min(190, p.x + drag.dx)) * snap) / snap;
    i.z =
      Math.round(Math.max(-190, Math.min(190, p.z + drag.dz)) * snap) / snap;
    meshes.get(i.id).position.set(i.x, 0, i.z);
    $('item-x').value = i.x.toFixed(3);
    $('item-z').value = i.z.toFixed(3);
    drawSelection();
  }
});
function endDrag(e) {
  if (drag?.changed) autosave();
  else if (
    !drag &&
    pointer &&
    Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y) < 4
  )
    choose(null);
  drag = null;
  pointer = null;
  controls.enabled = mode !== 'walk';
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
window.addEventListener('keydown', (e) => {
  if (
    ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(e.target.tagName) ||
    $('reference-dialog').open
  )
    return;
  if (e.key === 'Escape') {
    if (mode === 'walk') setView('dollhouse');
    else choose(null);
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    $(e.shiftKey ? 'redo' : 'undo').click();
    return;
  }
  if (['Delete', 'Backspace'].includes(e.key) && selected) {
    e.preventDefault();
    $('delete').click();
  }
  if (e.key.toLowerCase() === 'r' && selected) $('rotate').click();
  if (
    mode === 'walk' &&
    [
      'w',
      'a',
      's',
      'd',
      'arrowup',
      'arrowdown',
      'arrowleft',
      'arrowright',
    ].includes(e.key.toLowerCase())
  ) {
    e.preventDefault();
    keys.add(e.key.toLowerCase());
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());
function walk(dt) {
  if (mode !== 'walk' || !keys.size) return;
  let forward =
      (keys.has('w') || keys.has('arrowup') ? 1 : 0) -
      (keys.has('s') || keys.has('arrowdown') ? 1 : 0),
    side =
      (keys.has('d') || keys.has('arrowright') ? 1 : 0) -
      (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
  const length = Math.hypot(forward, side) || 1;
  forward /= length;
  side /= length;
  const speed = 6 * dt,
    dx = (-Math.sin(walkAngle) * forward + Math.cos(walkAngle) * side) * speed,
    dz = (-Math.cos(walkAngle) * forward - Math.sin(walkAngle) * side) * speed;
  for (const [axis, delta] of [
    ['x', dx],
    ['z', dz],
  ]) {
    const next = {
      x: camera3D.position.x,
      z: camera3D.position.z,
      w: 1,
      d: 1,
      rot: 0,
    };
    next[axis] += delta;
    if (
      insidePolygon(next, project.footprint) &&
      !house.blockers.some((b) => b.low < 6 && b.high > 0 && overlap(next, b))
    )
      camera3D.position[axis] += delta;
  }
}

function download(name, blob) {
  const url = URL.createObjectURL(blob),
    link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
$('save-layout').onclick = async () => {
  if (saving) return;
  saving = true;
  savedStatus();
  try {
    checkpoint = await saveSnapshot(
      createSnapshot(project, captureView()),
      (snapshot) =>
        localStorage.setItem(key + ':checkpoint', JSON.stringify(snapshot)),
    );
    storageWarning = false;
    toast('Checkpoint saved · Reset returns to this layout and view');
  } catch {
    storageWarning = true;
    toast(
      'Checkpoint could not be saved. Previous checkpoint retained; download JSON for a backup.',
    );
  } finally {
    saving = false;
    savedStatus();
  }
};
$('reset-layout').onclick = () => {
  if (!checkpoint || saving) return;
  const restored = restoreSnapshot(checkpoint);
  remember();
  project.items = restored.project.items;
  choose(null);
  renderFurniture();
  restoreView(restored.view);
  toast('Saved layout and view restored · Undo recovers your changes');
};
window.addEventListener('storage', (e) => {
  if (e.key === key + ':checkpoint') {
    readCheckpoint();
    savedStatus();
  }
});
$('download-project').onclick = () => {
  download(
    project.id + '.json',
    new Blob(
      [JSON.stringify(createSnapshot(project, captureView()), null, 2)],
      { type: 'application/json' },
    ),
  );
  toast('Project JSON prepared for download');
};
function openProject(next, view = null) {
  autosave();
  project = validateProject(next);
  key = storageKey(project);
  starter = structuredClone(project.items);
  saveStarter();
  history = new History();
  activeRoom = project.rooms[0].id;
  choose(null);
  readCheckpoint();
  installHouse();
  setView('dollhouse');
  renderFurniture();
  restoreView(view);
  toast('Opened ' + project.name);
}
$('open-project').onclick = () => $('import-file').click();
$('demo-project').onclick = () => openProject(demo);
$('import-file').onchange = async () => {
  try {
    const file = $('import-file').files[0];
    if (!file) return;
    if (file.size > 2_000_000)
      throw new Error('Projects must be smaller than 2 MB.');
    const next = readProjectFile(JSON.parse(await file.text()));
    openProject(next.project, next.view);
  } catch (error) {
    toast('Could not open project: ' + error.message);
  } finally {
    $('import-file').value = '';
  }
};
$('snapshot').onclick = async () => {
  choose(null);
  renderer.render(scene, camera);
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  );
  if (blob) {
    download(project.id + '.png', blob);
    toast('Image prepared for download');
  } else toast('Image could not be created');
};
$('export-model').onclick = async () => {
  const button = $('export-model');
  button.disabled = true;
  button.textContent = 'Exporting…';
  let clone;
  try {
    clone = house.root.clone(true);
    clone.scale.setScalar(0.3048);
    clone.traverse((o) => {
      o.visible = true;
      if (o.isMesh) {
        o.material = o.material.clone();
        o.material.clippingPlanes = [];
      }
    });
    clone.userData = {
      units: 'meters',
      project: project.name,
      notes: project.notes ?? [],
    };
    const buffer = await new GLTFExporter().parseAsync(clone, {
      binary: true,
      onlyVisible: true,
      maxTextureSize: 1024,
    });
    download(
      project.id + '.glb',
      new Blob([buffer], { type: 'model/gltf-binary' }),
    );
    toast('3D model prepared · meters · ceiling included');
  } catch (error) {
    toast('Export failed: ' + error.message);
  } finally {
    if (clone)
      clone.traverse((o) => {
        if (o.isMesh) o.material.dispose();
      });
    button.disabled = false;
    button.textContent = 'Export 3D';
  }
};
for (const button of document.querySelectorAll('[data-tab]'))
  button.onclick = () => {
    for (const b of document.querySelectorAll('[data-tab]')) {
      const active = b === button;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
      $(b.dataset.tab + '-panel').hidden = !active;
    }
  };
$('help').onclick = () => $('reference-dialog').showModal();
$('close-dialog').onclick = () => $('reference-dialog').close();
// Render thumbnails once with shared lighting, then release their temporary geometry.
const thumbs = new T.WebGLRenderer({ alpha: true, antialias: true });
thumbs.setSize(240, 150);
thumbs.toneMapping = T.ACESFilmicToneMapping;
const thumbScene = new T.Scene();
thumbScene.environment = env.texture;
thumbScene.add(new T.HemisphereLight('#fff8ee', '#777d70', 2));
const light = new T.DirectionalLight('#fff5e5', 3);
light.position.set(3, 8, 5);
thumbScene.add(light);
const thumbCamera = new T.PerspectiveCamera(35, 1.6, 0.05, 200);
for (const template of CATALOG) {
  const model = makeFurniture({
    ...template,
    id: 'thumbnail',
    x: 0,
    z: 0,
    rot: 0,
  });
  thumbScene.add(model);
  const box = new T.Box3().setFromObject(model),
    center = box.getCenter(new T.Vector3()),
    size = box.getSize(new T.Vector3()),
    distance = Math.max(size.x, size.y, size.z) * 1.9;
  thumbCamera.position
    .copy(center)
    .add(new T.Vector3(distance * 0.65, distance * 0.6, distance * 0.9));
  thumbCamera.lookAt(center);
  thumbs.render(thumbScene, thumbCamera);
  const b = document.createElement('button'),
    img = document.createElement('img'),
    title = document.createElement('strong'),
    dimensions = document.createElement('small');
  img.src = thumbs.domElement.toDataURL();
  img.alt = '';
  img.className = 'thumb';
  title.textContent = template.name;
  dimensions.textContent = `${template.w} × ${template.d} × ${template.h} in`;
  b.append(img, title, dimensions);
  b.setAttribute('aria-label', 'Add ' + template.name);
  b.onclick = () => {
    if (project.items.length >= 250) {
      toast('Maximum of 250 pieces reached');
      return;
    }
    remember();
    const room =
        project.rooms.find((r) => r.id === activeRoom) ?? project.rooms[0],
      item = {
        ...template,
        id: crypto.randomUUID(),
        x: room.x,
        z: room.z,
        rot: 0,
      };
    project.items.push(item);
    if (mode === 'walk') setView('plan');
    renderFurniture();
    choose(item.id);
    toast('Added ' + item.name);
  };
  $('catalog').append(b);
  thumbScene.remove(model);
  disposeGroup(model);
}
thumbs.dispose();
readCheckpoint();
saveStarter();
installHouse();
setView('dollhouse');
let draftView;
try {
  const draft = readStorage(key + ':draft');
  if (draft) {
    const restored = restoreSnapshot(draft);
    if (storageKey(restored.project) === key) {
      project.items = restored.project.items;
      draftView = restored.view;
    }
  }
} catch {
  storageWarning = true;
}
renderFurniture();
restoreView(draftView);
$('loading').hidden = true;
canvas.dataset.ready = 'true';
let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  walk(dt);
  if (mode !== 'walk') controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  toast('Graphics context lost. Reload to restore your browser draft.');
});
