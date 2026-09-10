import * as T from 'three';
import { windowTargets } from './references.js';

// Separate, disposable photo planes; never part of wall/collision geometry or GLB exports.
export class ReferenceViews {
  constructor(scene, report) {
    this.group = new T.Group();
    this.group.name = 'Illustrative window photos';
    scene.add(this.group);
    this.report = report;
    this.generation = 0;
    this.signature = '';
  }
  clear() {
    this.generation++;
    for (const m of this.group.children) {
      m.geometry.dispose();
      m.material.map?.dispose();
      m.material.dispose();
    }
    this.group.clear();
  }
  update(project, enabled, mode) {
    this.group.visible = mode !== 'plan';
    const signature = JSON.stringify([
      enabled,
      project.walls,
      project.references,
    ]);
    if (signature === this.signature) return;
    this.signature = signature;
    this.clear();
    if (!enabled || !project.references) return;
    const generation = this.generation;
    const targets = windowTargets(project);
    for (const binding of project.references.bindings) {
      const target = targets.find(
        (t) =>
          t.wallIndex === binding.wallIndex &&
          t.openingIndex === binding.openingIndex,
      );
      const photo = project.references.images.find(
        (p) => p.id === binding.imageId,
      );
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.referrerPolicy = 'no-referrer';
      image.onload = () => {
        if (generation !== this.generation) return;
        // Crop to the opening's aspect ratio instead of stretching the scene.
        const canvas = document.createElement('canvas');
        const aspect = target.width / target.height;
        canvas.width = Math.round(1024 * Math.min(1, aspect));
        canvas.height = Math.round(1024 / Math.max(1, aspect));
        const ctx = canvas.getContext('2d');
        const scale = Math.max(
          canvas.width / image.width,
          canvas.height / image.height,
        );
        const w = image.width * scale,
          h = image.height * scale;
        if (binding.flipX) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(
          image,
          (canvas.width - w) / 2,
          (canvas.height - h) / 2,
          w,
          h,
        );
        const texture = new T.CanvasTexture(canvas);
        texture.colorSpace = T.SRGBColorSpace;
        const mesh = new T.Mesh(
          new T.PlaneGeometry(target.width, target.height),
          new T.MeshBasicMaterial({ map: texture, toneMapped: false }),
        );
        mesh.name = 'Window photo · ' + photo.caption;
        mesh.rotation.y = -target.angle + (binding.side === -1 ? Math.PI : 0);
        // Behind the frame and mullion, just inside the existing glass surface.
        const offset = binding.side * 0.02;
        mesh.position.set(
          target.x - Math.sin(target.angle) * offset,
          target.y,
          target.z + Math.cos(target.angle) * offset,
        );
        this.group.add(mesh);
        this.report(
          `${this.group.children.length} window photo${this.group.children.length === 1 ? '' : 's'} loaded · illustrative view`,
        );
      };
      image.onerror = () => {
        if (generation === this.generation)
          this.report(
            'A window photo could not load. The provider may block 3D use (CORS) or the URL may have expired. The link is retained.',
          );
      };
      image.src = photo.url;
    }
  }
}
