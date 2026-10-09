// Original Unity clip curves and 2D hierarchy; data is extracted from the APK.
// Canvas affine matrices use [a, b, c, d, e, f] and Unity coordinates (Y up).
const EPSILON = 1e-9;
const IDENTITY = [1, 0, 0, 1, 0, 0];

export function multiply(a, b) {
  return [
    a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

export function inverse(m) {
  const det = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(det) < 1e-12) return null;
  return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det,
    (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
}

export function transformPoint(m, p) {
  return [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
}

const radians = degrees => degrees * Math.PI / 180;
const degrees = radians => radians * 180 / Math.PI;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mod = (v, divisor) => ((v % divisor) + divisor) % divisor;

export function evaluateCurve(curve, time) {
  if (typeof curve === 'number') return curve;
  const keys = curve?.keys;
  if (!keys?.length) return 0;
  let lo = 0;
  let hi = keys.length;
  while (lo < hi) {
    const middle = (lo + hi) >>> 1;
    if (keys[middle][0] <= time) lo = middle + 1;
    else hi = middle;
  }
  const k = keys[Math.max(0, lo - 1)];
  const dt = Math.max(0, time - k[0]);
  if (curve.dense && lo < keys.length) {
    const next = keys[lo];
    const w = clamp(dt / (next[0] - k[0]), 0, 1);
    return k[4] + (next[4] - k[4]) * w;
  }
  return ((k[1] * dt + k[2]) * dt + k[3]) * dt + k[4];
}

export function clipTime(clip, time, loop = clip.loop) {
  if (!clip.duration) return clip.start || 0;
  return (clip.start || 0) + (loop ? mod(time, clip.duration) : clamp(time, 0, clip.duration));
}

export function sampleClip(clip, time, loop = clip.loop) {
  const t = clipTime(clip, time, loop);
  return clip.bindings.map(binding => ({
    binding,
    value: binding.curveIndices.map(i => evaluateCurve(clip.curves[i], t)),
  }));
}

let crcTable;
export function stringToHash(value) {
  if (!crcTable) {
    crcTable = Array.from({length: 256}, (_, n) => {
      let crc = n;
      for (let k = 0; k < 8; k++) crc = crc & 1 ? 0xEDB88320 ^ (crc >>> 1) : crc >>> 1;
      return crc >>> 0;
    });
  }
  let crc = 0xFFFFFFFF;
  for (const byte of new TextEncoder().encode(value)) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Native-order use: read getCurrentState(), run script Update, advance(dt),
 * read getCurrentState() again, then run script LateUpdate.
 * `time` is unbounded state seconds; `.normalizedTime` includes loop count.
 * During a timed transition the current state remains the source, as in Unity.
 */
export class OriginalAnimator {
  constructor(data, controllerName) {
    this.data = data;
    this.controllerName = controllerName;
    this.controller = data.controllers[controllerName];
    if (!this.controller) throw new Error(`Unknown original animator: ${controllerName}`);
    this.machine = this.controller.stateMachines[0];
    this.params = Object.fromEntries(this.controller.parameters.map(p => [p.name, p.default]));
    this.stateIndex = this.machine.defaultState;
    this.time = 0;
    this.speed = 1;
    this.enabled = true;
    this.transition = null;
    this._justEntered = true;
    this.time = this._definition().cycleOffset * this.length;
  }

  _definition(index = this.stateIndex) { return this.machine.states[index]; }
  _clip(index = this.stateIndex) {
    const motion = this._definition(index).motions.find(m => m.clip);
    return motion ? this.data.clips[motion.clip] : null;
  }
  _length(index = this.stateIndex) { return this._clip(index)?.duration || 1; }
  get state() { return this._definition().name; }
  get fullPath() { return this._definition().fullPath || `Base Layer.${this.state}`; }
  get length() { return this._length(); }
  get normalizedTime() { return this.time / this.length; }
  get currentClip() { return this._clip(); }

  setBool(name, value) { this.params[name] = Boolean(value); return this; }
  getBool(name) { return Boolean(this.params[name]); }
  setFloat(name, value) { this.params[name] = Number(value); return this; }
  getFloat(name) { return Number(this.params[name] || 0); }
  setInteger(name, value) { this.params[name] = Math.trunc(value); return this; }
  setTrigger(name) { this.params[name] = true; return this; }
  resetTrigger(name) { this.params[name] = false; return this; }

  play(name, normalizedTime = 0) {
    const index = typeof name === 'number' ? name : this.machine.states.findIndex(s => s.name === name || s.fullPath === name);
    if (index < 0 || index >= this.machine.states.length) throw new Error(`Unknown animator state: ${name}`);
    this.stateIndex = index;
    this.time = normalizedTime * this.length;
    this.transition = null;
    this._justEntered = true;
    return this;
  }
  setState(name, normalizedTime = 0) { return this.play(name, normalizedTime); }
  isInTransition() { return Boolean(this.transition); }

  _info(index, time) {
    const state = this._definition(index);
    const fullPath = state.fullPath || `Base Layer.${state.name}`;
    const info = {
      name: state.name, state: state.name, fullPath, index,
      time, normalizedTime: time / this._length(index), length: this._length(index),
      speed: state.speed, speedMultiplier: this.speed, loop: state.loop,
      shortNameHash: state.hash, fullPathHash: stringToHash(fullPath),
      isInTransition: Boolean(this.transition),
      IsName: name => state.name === name || fullPath === name,
      isName: name => state.name === name || fullPath === name,
    };
    return info;
  }
  getCurrentState() { return this._info(this.stateIndex, this.time); }
  getCurrentAnimatorStateInfo() { return this.getCurrentState(); }
  getNextState() {
    return this.transition ? this._info(this.transition.destinationIndex, this.transition.destinationTime) : null;
  }
  getNextAnimatorStateInfo() { return this.getNextState(); }

  _conditions(transition) {
    return transition.conditions.every(condition => {
      const value = this.params[condition.parameter];
      switch (condition.mode) {
        case 1: return Boolean(value);
        case 2: return !value;
        case 3: return Number(value) > condition.threshold;
        case 4: return Number(value) < condition.threshold;
        case 6: return Number(value) === condition.threshold;
        case 7: return Number(value) !== condition.threshold;
        default: return false;
      }
    });
  }

  _nextTransition(remaining) {
    const state = this._definition();
    const rate = this.speed * state.speed;
    const normalized = this.normalizedTime;
    let best = null;
    for (const tr of state.transitions) {
      if (!this._conditions(tr) || tr.destination >= this.machine.states.length) continue;
      let wait = 0;
      if (tr.hasExitTime) {
        if (rate <= 0) continue;
        let target = tr.exitTime;
        if (state.loop && target < 1) {
          // Loop exit windows only open on the crossing, not the entire rest
          // of a cycle. A new bool after a crossing waits for the next cycle.
          const cycle = Math.max(0, Math.floor(normalized - target + EPSILON) + 1);
          target += cycle;
          if (this._justEntered && Math.abs(normalized - tr.exitTime) < EPSILON) target = normalized;
        } else if (target < normalized - EPSILON || (!this._justEntered && Math.abs(target - normalized) < EPSILON)) {
          continue;
        }
        wait = Math.max(0, (target - normalized) * this.length / rate);
      }
      if (wait > remaining + EPSILON) continue;
      if (!best || wait < best.wait - EPSILON) best = {transition: tr, wait};
    }
    return best;
  }

  _beginTransition(tr, events) {
    const from = this.getCurrentState();
    const destination = this._definition(tr.destination);
    const duration = tr.fixedDuration ? tr.duration : tr.duration * this.length;
    const destinationTime = (tr.offset + destination.cycleOffset) * this._length(tr.destination);
    events.push({from: from.name, to: destination.name, sourceTime: from.time,
      sourceNormalizedTime: from.normalizedTime, destinationTime, duration});
    // Trigger parameters are consumed by the transition that uses them.
    for (const condition of tr.conditions) {
      if (this.controller.parameters.find(p => p.name === condition.parameter)?.type === 'trigger') {
        this.params[condition.parameter] = false;
      }
    }
    if (duration <= EPSILON) {
      this.stateIndex = tr.destination;
      this.time = destinationTime;
      this._justEntered = true;
      return;
    }
    this.transition = {sourceIndex: this.stateIndex, destinationIndex: tr.destination,
      destinationTime, duration, elapsed: 0, sourceTime: this.time};
  }

  advance(dt) {
    const previous = this.getCurrentState();
    const events = [];
    if (!this.enabled || !(dt > 0)) return {previous, current: previous, transitions: events};
    let remaining = dt;
    let guard = 0;
    while (remaining > EPSILON && guard++ < 128) {
      if (this.transition) {
        const tr = this.transition;
        const speed = Math.max(0, this.speed);
        const wait = speed > EPSILON ? (tr.duration - tr.elapsed) / speed : Infinity;
        const span = Math.min(remaining, wait);
        this.time += span * this.speed * this._definition().speed;
        tr.sourceTime = this.time;
        tr.destinationTime += span * this.speed * this._definition(tr.destinationIndex).speed;
        tr.elapsed += span * speed;
        remaining -= span;
        this._justEntered = false;
        if (tr.elapsed >= tr.duration - EPSILON) {
          this.stateIndex = tr.destinationIndex;
          this.time = tr.destinationTime;
          this.transition = null;
          this._justEntered = false;
          this.time += remaining * this.speed * this._definition().speed;
          remaining = 0;
        }
        continue;
      }
      const next = this._nextTransition(remaining);
      const span = next ? next.wait : remaining;
      this.time += span * this.speed * this._definition().speed;
      remaining -= span;
      if (span > EPSILON) this._justEntered = false;
      if (!next) break;
      this._beginTransition(next.transition, events);
      if(!this.transition){this.time += remaining * this.speed * this._definition().speed;remaining=0;}
    }
    if (guard >= 128 && remaining > EPSILON) this.time += remaining * this.speed * this._definition().speed;
    return {previous, current: this.getCurrentState(), transitions: events};
  }

  sample() {
    const sample = (index, time) => {
      const clip = this._clip(index);
      return clip ? sampleClip(clip, time, this._definition(index).loop) : [];
    };
    const current = sample(this.stateIndex, this.time);
    if (!this.transition) return {current, next: [], weight: 0};
    return {current, next: sample(this.transition.destinationIndex, this.transition.destinationTime),
      weight: clamp(this.transition.elapsed / this.transition.duration, 0, 1)};
  }
}

function localMatrix(node) {
  const angle = 2 * Math.atan2(node.rotation[2], node.rotation[3]);
  const c = Math.cos(angle), s = Math.sin(angle);
  return [c * node.scale[0], s * node.scale[0], -s * node.scale[1], c * node.scale[1],
    node.position[0], node.position[1]];
}

function interpolate(a, b, weight, property) {
  if (property === 'rotation') {
    const sign = a.reduce((sum, v, i) => sum + v * b[i], 0) < 0 ? -1 : 1;
    const q = a.map((v, i) => v + (b[i] * sign - v) * weight);
    const length = Math.hypot(...q) || 1;
    return q.map(v => v / length);
  }
  return a.map((v, i) => v + (b[i] - v) * weight);
}

export class SceneGraph {
  constructor(data, graphName) {
    this.data = data;
    this.name = graphName;
    this.definition = data.graphs[graphName];
    if (!this.definition) throw new Error(`Unknown original scene graph: ${graphName}`);
    this.nodes = new Map(this.definition.nodes.map(n => [n.id, structuredClone(n)]));
    this.baseNodes = new Map(this.definition.nodes.map(n => [n.id, structuredClone(n)]));
    this.root = [...this.nodes.values()].find(n => n.parent == null);
    this.animators = new Map();
    this.animatorBindings = new Map();
    this.boundProperties = new Map();
    for (const definition of this.definition.animators) {
      const animator = new OriginalAnimator(data, definition.controller);
      animator.enabled = this.nodes.get(definition.node).animator.enabled;
      this.animators.set(definition.node, animator);
      this.animatorBindings.set(definition.node, definition.paths);
      this.boundProperties.set(definition.node, this._boundProperties(animator, definition.paths));
    }
  }

  node(idOrName) {
    if (idOrName && typeof idOrName === 'object') return idOrName;
    const id = String(idOrName ?? this.root.id);
    return this.nodes.get(id) || [...this.nodes.values()].find(n => n.name === id || n.path === id) || null;
  }
  find(name) { return this.node(name); }
  animator(idOrName) { const node = this.node(idOrName); return node ? this.animators.get(node.id) : null; }
  getLocalPosition(id) { return [...this.node(id).position]; }
  getLocalScale(id) { return [...this.node(id).scale]; }
  getLocalRotation(id) { return [...this.node(id).rotation]; }
  getLocalAngle(id) { const q = this.node(id).rotation; return degrees(2 * Math.atan2(q[2], q[3])); }
  setLocalPosition(id, position) { this.node(id).position = [position[0], position[1], position[2] ?? 0]; return this; }
  setLocalScale(id, scale) { this.node(id).scale = [scale[0], scale[1], scale[2] ?? 1]; return this; }
  setLocalRotation(id, rotation) { this.node(id).rotation = [...rotation]; return this; }
  setLocalAngle(id, angle) {
    const half = radians(angle) / 2;
    this.node(id).rotation = [0, 0, Math.sin(half), Math.cos(half)];
    return this;
  }

  worldMatrix(id = this.root.id) {
    const node = this.node(id);
    const local = localMatrix(node);
    return node.parent == null ? local : multiply(this.worldMatrix(node.parent), local);
  }
  worldPosition(id = this.root.id) {
    const node = this.node(id), m = this.worldMatrix(node.id);
    let z = node.position[2];
    if (node.parent != null) z = this.worldPosition(node.parent)[2] + z * this.worldScale(node.parent)[2];
    return [m[4], m[5], z];
  }
  worldAngle(id = this.root.id) {
    const node = this.node(id);
    return this.getLocalAngle(node.id) + (node.parent == null ? 0 : this.worldAngle(node.parent));
  }
  worldScale(id = this.root.id) {
    const node = this.node(id), m = this.worldMatrix(node.id);
    let z = node.scale[2];
    if (node.parent != null) z *= this.worldScale(node.parent)[2];
    return [Math.hypot(m[0], m[1]), Math.hypot(m[2], m[3]), z];
  }
  setWorldPosition(id, position) {
    const node = this.node(id);
    if (node.parent == null) return this.setLocalPosition(node.id, position);
    const inverted = inverse(this.worldMatrix(node.parent));
    if (!inverted) throw new Error(`Cannot set world position below zero scale: ${node.path}`);
    const p = transformPoint(inverted, position);
    const parentZ = this.worldPosition(node.parent)[2], parentScaleZ = this.worldScale(node.parent)[2];
    return this.setLocalPosition(node.id, [p[0], p[1], parentScaleZ ? ((position[2] ?? 0) - parentZ) / parentScaleZ : 0]);
  }
  setWorldAngle(id, angle) {
    const node = this.node(id);
    return this.setLocalAngle(node.id, angle - (node.parent == null ? 0 : this.worldAngle(node.parent)));
  }
  setWorldScale(id, scale) {
    const node = this.node(id);
    const parent = node.parent == null ? [1, 1, 1] : this.worldScale(node.parent);
    return this.setLocalScale(node.id, scale.map((v, i) => parent[i] ? v / parent[i] : 0));
  }
  translate(id, delta, localSpace = true) {
    const node = this.node(id), p = this.worldPosition(node.id);
    const angle = localSpace ? radians(this.worldAngle(node.id)) : 0;
    const c = Math.cos(angle), s = Math.sin(angle);
    return this.setWorldPosition(node.id, [p[0] + c * delta[0] - s * delta[1],
      p[1] + s * delta[0] + c * delta[1], p[2] + (delta[2] || 0)]);
  }
  rotate(id, angle) { return this.setLocalAngle(id, this.getLocalAngle(id) + angle); }

  _boundProperties(animator, paths) {
    const map = new Map();
    for (const state of animator.machine.states) {
      for (const motion of state.motions) {
        const clip = this.data.clips[motion.clip];
        if (!clip) continue;
        for (const binding of clip.bindings) {
          const id = paths[String(binding.pathHash)];
          if (id && binding.typeID === 4) map.set(`${id}:${binding.property}`, {id, property: binding.property});
        }
      }
    }
    return map;
  }

  applyAnimations() {
    for (const [rootId, animator] of this.animators) {
      // Disabled Unity Animator does not overwrite its last pose.
      if (!animator.enabled) continue;
      const paths = this.animatorBindings.get(rootId);
      const bound = this.boundProperties.get(rootId);
      const defaults = new Map();
      for (const [key, {id, property}] of bound) {
        const node = this.nodes.get(id), base = this.baseNodes.get(id);
        if (!node || !base || !['position', 'rotation', 'scale', 'euler'].includes(property)) continue;
        const value = property === 'euler' ? [0, 0, this.getLocalAngle(id)] : [...base[property]];
        defaults.set(key, value);
        if (animator._definition().writeDefaultValues && property !== 'euler') node[property] = [...base[property]];
      }
      const pose = animator.sample();
      const boundPose = samples => {
        const values = new Map();
        for (const {binding, value} of samples) {
          const id = paths[String(binding.pathHash)];
          if (id && binding.typeID === 4 && !binding.isPPtrCurve) {
            values.set(`${id}:${binding.property}`, {id, property: binding.property, value});
          }
        }
        return values;
      };
      const current = boundPose(pose.current), next = boundPose(pose.next);
      const keys = new Set([...current.keys(), ...next.keys()]);
      for (const key of keys) {
        const a = current.get(key), b = next.get(key);
        const entry = b || a, node = this.nodes.get(entry.id);
        if (!node) continue;
        let value = (a || b).value;
        if (pose.weight > 0) {
          const av = a?.value || defaults.get(key) || b.value;
          const bv = b?.value || defaults.get(key) || a.value;
          value = interpolate(av, bv, pose.weight, entry.property);
        }
        if (entry.property === 'euler') this.setLocalAngle(node.id, value[2]);
        else node[entry.property] = [...value];
      }
    }
    return this;
  }

  advance(dt) {
    const changes = new Map();
    for (const [id, animator] of this.animators) changes.set(id, animator.advance(dt));
    this.applyAnimations();
    return changes;
  }

  _active(node) {
    return node.active && (node.parent == null || this._active(this.nodes.get(node.parent)));
  }

  draw(ctx, imageCache, project = IDENTITY) {
    const drawable = [...this.nodes.values()].filter(n => n.sprite?.enabled && this._active(n));
    drawable.sort((a, b) => a.sprite.order - b.sprite.order);
    ctx.save();
    for (const node of drawable) {
      const sprite = this.data.sprites[node.sprite.key];
      const image = imageCache instanceof Map ? (imageCache.get(sprite.image) || imageCache.get(node.sprite.key))
        : (imageCache[sprite.image] || imageCache[node.sprite.key]);
      if (!image || ('complete' in image && !image.complete)) continue;
      const ppu = sprite.pixelsToUnits;
      const w = sprite.rectSize[0], h = sprite.rectSize[1];
      let m = multiply(project, this.worldMatrix(node.id));
      if (node.sprite.flipX || node.sprite.flipY) {
        m = multiply(m, [node.sprite.flipX ? -1 : 1, 0, 0, node.sprite.flipY ? -1 : 1, 0, 0]);
      }
      m = multiply(m, [1 / ppu, 0, 0, -1 / ppu, -sprite.pivot[0] * w / ppu, (1 - sprite.pivot[1]) * h / ppu]);
      ctx.setTransform(...m);
      ctx.globalAlpha = node.sprite.color[3];
      ctx.drawImage(image, 0, 0, w, h);
    }
    ctx.restore();
  }
}

export const OriginalSceneGraph = SceneGraph;

export async function loadOriginalImages(data, baseURL = './') {
  const cache = new Map();
  await Promise.all(Object.entries(data.sprites).map(async ([key, sprite]) => {
    const image = new Image();
    image.src = new URL(sprite.image, new URL(baseURL, globalThis.location?.href || 'http://localhost/')).href;
    await image.decode();
    cache.set(key, image);
    cache.set(sprite.image, image);
  }));
  return cache;
}
