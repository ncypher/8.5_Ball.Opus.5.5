// The 8.5 Ball itself: a lacquered shell with a window, indigo fluid inside,
// and a twenty-sided die that tumbles and then turns one face to the glass.
import * as THREE from 'three';

const WIN = 0.72;            // half-angle of the window, radians
const DIE_R = 0.56;          // die circumradius
const DIE_Z = 0.13;          // die sits forward, pressed toward the glass
const TUMBLE = 1.15;         // seconds of chaos
const SETTLE = 1.0;          // seconds to float a face up to the window
const FACE_FONT = '"Newsreader", Georgia, serif';

const ease = t => 1 - Math.pow(1 - t, 3);
const easeBack = t => { const c = 1.25; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

// A spherical cap whose UVs are a flat projection, so a printed disc reads undistorted.
function planarCap(radius, angle, towardBack) {
  const geo = new THREE.SphereGeometry(radius, 64, 24, 0, Math.PI * 2, 0, angle);
  geo.rotateX(towardBack ? -Math.PI / 2 : Math.PI / 2);
  const s = Math.sin(angle) * radius;
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    uv.setXY(i, 0.5 + (towardBack ? -x : x) / (2 * s), 0.5 + y / (2 * s));
  }
  return geo;
}

function badgeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(200, 180, 20, 256, 256, 300);
  grad.addColorStop(0, '#fbfaff');
  grad.addColorStop(1, '#cfcbe8');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  g.fillStyle = '#0e1030';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `600 236px ${FACE_FONT}`;
  g.fillText('8.5', 256, 270);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// A dark studio: black walls, a big softbox up-left, a cool strip light behind-right.
// This is what makes the shell read as black lacquer instead of chrome.
function studio() {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({ color: 0x05050d, side: THREE.BackSide })));
  const box = (w, h, color, pos, look) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(...look);
    env.add(m);
  };
  box(5, 3.2, new THREE.Color(1, 1, 1).multiplyScalar(5), [-4, 5, 5], [0, 0, 0]);
  box(1.2, 7, new THREE.Color(0.55, 0.6, 1).multiplyScalar(3), [6, 0.5, -3], [0, 0, 0]);
  box(6, 0.8, new THREE.Color(0.35, 0.38, 1).multiplyScalar(1.2), [0, -6, 2], [0, 0, 0]);
  return env;
}

export function createBall(host, { reducedMotion = false, onTap } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studio(), 0.02).texture;

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  camera.position.set(0, 0, 4.9);

  const ball = new THREE.Group();
  scene.add(ball);

  // Shell: a sphere with its front cap removed.
  const shellGeo = new THREE.SphereGeometry(1, 128, 96, 0, Math.PI * 2, WIN, Math.PI - WIN);
  shellGeo.rotateX(Math.PI / 2);
  ball.add(new THREE.Mesh(shellGeo, new THREE.MeshPhysicalMaterial({
    color: 0x020207, roughness: 0.45, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1,
  })));

  // Liner: the inside of the ball, glowing deepest where you look through the window.
  ball.add(new THREE.Mesh(new THREE.SphereGeometry(0.985, 64, 48), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { a: { value: new THREE.Color(0x03041a) }, b: { value: new THREE.Color(0x141a8a) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 a; uniform vec3 b; varying vec3 vP;
      void main(){
        float t = clamp((0.3 - vP.z) / 1.3, 0.0, 1.0);
        float c = clamp(1.0 - length(vP.xy) * 0.9, 0.0, 1.0);
        gl_FragColor = vec4(mix(a, b, t * t * c * 0.75), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })));

  // Rim around the window.
  const rim = new THREE.Mesh(new THREE.TorusGeometry(Math.sin(WIN), 0.028, 24, 160), new THREE.MeshPhysicalMaterial({
    color: 0x07071a, metalness: 0.5, roughness: 0.28, clearcoat: 1,
  }));
  rim.position.z = Math.cos(WIN);
  ball.add(rim);

  // The badge on the back.
  const badgeMap = badgeTexture();
  const badge = new THREE.Mesh(planarCap(1.003, 0.44, true), new THREE.MeshPhysicalMaterial({
    map: badgeMap, emissive: 0xffffff, emissiveMap: badgeMap, emissiveIntensity: 0.45,
    roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.08,
    polygonOffset: true, polygonOffsetFactor: -2,
  }));
  ball.add(badge);

  // The die.
  const dieGeo = new THREE.IcosahedronGeometry(DIE_R, 0);
  const die = new THREE.Mesh(dieGeo, new THREE.MeshStandardMaterial({
    color: 0x3640f0, roughness: 0.45, metalness: 0.05, emissive: 0x1b23b8, emissiveIntensity: 0.55, envMapIntensity: 0.6, flatShading: true,
  }));
  const holder = new THREE.Group();
  holder.position.z = DIE_Z;
  holder.add(die);
  ball.add(holder);

  // Face 0 is the reading face. Work out its frame so we can turn it to the glass.
  const p = dieGeo.attributes.position;
  const A = new THREE.Vector3().fromBufferAttribute(p, 0);
  const B = new THREE.Vector3().fromBufferAttribute(p, 1);
  const C = new THREE.Vector3().fromBufferAttribute(p, 2);
  const cen = A.clone().add(B).add(C).divideScalar(3);
  const n = B.clone().sub(A).cross(C.clone().sub(A)).normalize();
  if (n.dot(cen) < 0) n.negate();
  const up = A.clone().sub(cen).normalize();
  const right = up.clone().cross(n).normalize();
  const L = A.distanceTo(cen);
  const faceQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, n)).invert();

  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = faceCanvas.height = 512;
  const faceTex = new THREE.CanvasTexture(faceCanvas);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.anisotropy = 8;
  const triGeo = new THREE.BufferGeometry();
  const tri = [], uvs = [];
  for (const v of [A, B, C]) {
    const q = v.clone().sub(cen).multiplyScalar(0.985).add(cen).addScaledVector(n, 0.002);
    tri.push(q.x, q.y, q.z);
    const d = v.clone().sub(cen);
    uvs.push(0.5 + d.dot(right) / (2 * L), 0.5 + d.dot(up) / (2 * L));
  }
  triGeo.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
  triGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  const faceMesh = new THREE.Mesh(triGeo, new THREE.MeshBasicMaterial({
    map: faceTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false,
  }));
  die.add(faceMesh);

  // Canvas coords: apex at (256, 0), base along y = 384, half-width grows linearly.
  const halfWidthAt = y => (y / 384) * 221.7;
  function drawFace(text) {
    const g = faceCanvas.getContext('2d');
    g.clearRect(0, 0, 512, 512);
    const words = text.split(/\s+/).filter(Boolean);
    let chosen = null;
    for (let size = 56; size >= 20; size -= 2) {
      g.font = `italic 500 ${size}px ${FACE_FONT}`;
      const lh = size * 1.08;
      const limit = halfWidthAt(270) * 2 * 0.86;
      const lines = [];
      let line = '';
      for (const w of words) {
        const next = line ? `${line} ${w}` : w;
        if (!line || g.measureText(next).width <= limit) line = next;
        else { lines.push(line); line = w; }
      }
      if (line) lines.push(line);
      const top = 272 - ((lines.length - 1) * lh) / 2;
      const fits = lines.every((l, i) => {
        const y = top + i * lh - size * 0.42;
        return g.measureText(l).width <= halfWidthAt(y) * 2 * 0.9 && top + (lines.length - 1) * lh + size * 0.3 < 372;
      });
      chosen = { size, lines, lh, top };
      if (fits) break;
    }
    g.font = `italic 500 ${chosen.size}px ${FACE_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#eeeaff';
    g.shadowColor = 'rgba(150, 160, 255, 0.9)';
    g.shadowBlur = 14;
    chosen.lines.forEach((l, i) => g.fillText(l, 256, chosen.top + i * chosen.lh));
    faceTex.needsUpdate = true;
  }

  // Bubbles drifting up through the fluid.
  const BUBBLES = 60;
  const bpos = new Float32Array(BUBBLES * 3), bvel = new Float32Array(BUBBLES);
  const seedBubble = (i, anywhere) => {
    const r = 0.85 * Math.sqrt(Math.random()), a = Math.random() * Math.PI * 2;
    const x = Math.cos(a) * r * 0.9, z = Math.sin(a) * r * 0.9 + 0.1;
    const yMax = Math.sqrt(Math.max(0, 0.8 - x * x - z * z));
    bpos[i * 3] = x; bpos[i * 3 + 2] = z;
    bpos[i * 3 + 1] = anywhere ? (Math.random() * 2 - 1) * yMax : -yMax;
    bvel[i] = 0.04 + Math.random() * 0.08;
  };
  for (let i = 0; i < BUBBLES; i++) seedBubble(i, true);
  const bgeo = new THREE.BufferGeometry();
  bgeo.setAttribute('position', new THREE.BufferAttribute(bpos, 3));
  ball.add(new THREE.Points(bgeo, new THREE.PointsMaterial({
    color: 0xb9c0ff, size: 0.014, transparent: true, opacity: 0.45, depthWrite: false,
  })));

  // Light inside the fluid so the reading face is lit from the glass side.
  const inner = new THREE.PointLight(0x7d86ff, 1.6, 3, 2);
  inner.position.set(0.15, 0.35, 0.8);
  ball.add(inner);
  const rimLight = new THREE.DirectionalLight(0x8a90ff, 1.6);
  rimLight.position.set(-3, 2.5, -2);
  scene.add(rimLight);

  // Glass over the window, drawn last.
  const glass = new THREE.Mesh(planarCap(1.0, WIN, false), new THREE.MeshPhysicalMaterial({
    color: 0xa6abff, transparent: true, opacity: 0.08, roughness: 0.02, clearcoat: 1, depthWrite: false, envMapIntensity: 1.2,
  }));
  glass.renderOrder = 2;
  ball.add(glass);

  // ---------- state ----------
  const S = {
    phase: 'idle', t0: 0, pending: null, resolve: null,
    spin: new THREE.Vector3(), from: new THREE.Quaternion(), ballFrom: new THREE.Quaternion(),
    drag: null, vel: { x: 0, y: 0 }, wobble: 0, last: performance.now(),
  };
  die.quaternion.copy(faceQ);
  const tmpQ = new THREE.Quaternion(), axisY = new THREE.Vector3(0, 1, 0), axisX = new THREE.Vector3(1, 0, 0);

  function turn(dx, dy) {
    ball.quaternion.premultiply(tmpQ.setFromAxisAngle(axisY, dx));
    ball.quaternion.premultiply(tmpQ.setFromAxisAngle(axisX, dy));
  }

  function ask(text) {
    return new Promise(resolve => {
      if (S.resolve) S.resolve();
      S.pending = text;
      S.resolve = resolve;
      S.ballFrom.copy(ball.quaternion);
      S.vel.x = S.vel.y = 0;
      if (reducedMotion) {
        drawFace(text);
        ball.quaternion.identity();
        die.quaternion.copy(faceQ);
        S.phase = 'idle';
        setTimeout(() => { S.resolve = null; resolve(); }, 120);
        return;
      }
      S.phase = 'tumble';
      S.t0 = performance.now();
      S.spin.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(9 + Math.random() * 4);
    });
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - S.last) / 1000);
    S.last = now;
    const time = now / 1000;
    const k = (now - S.t0) / 1000;

    if (S.phase === 'tumble') {
      // The ball comes back to face you while the die churns.
      ball.quaternion.slerpQuaternions(S.ballFrom, tmpQ.identity(), ease(Math.min(1, k / 0.8)));
      const decay = 1 - k / TUMBLE;
      ball.position.x = Math.sin(k * 38) * 0.05 * Math.max(0, decay);
      ball.position.y = Math.cos(k * 31) * 0.03 * Math.max(0, decay);
      const w = S.spin.length() * (0.35 + 0.65 * Math.max(0, decay));
      die.quaternion.premultiply(tmpQ.setFromAxisAngle(S.spin.clone().normalize(), w * dt));
      holder.position.set(Math.sin(k * 23) * 0.05 * decay, Math.cos(k * 19) * 0.05 * decay, DIE_Z - 0.12 * Math.sin(Math.min(1, k / TUMBLE) * Math.PI));
      if (k >= TUMBLE) {
        S.phase = 'settle';
        S.t0 = now;
        S.from.copy(die.quaternion);
        drawFace(S.pending);
        ball.position.set(0, 0, 0);
      }
    } else if (S.phase === 'settle') {
      const t = Math.min(1, k / SETTLE);
      die.quaternion.slerpQuaternions(S.from, faceQ, easeBack(t));
      holder.position.set(0, 0, DIE_Z);
      if (t >= 1) {
        S.phase = 'idle';
        S.wobble = 0;
        const r = S.resolve;
        S.resolve = null;
        if (r) r();
      }
    } else {
      // Idle: the die drifts a hair in the fluid; the ball coasts if flung.
      if (!reducedMotion) {
        S.wobble = Math.min(1, S.wobble + dt);
        holder.position.y = Math.sin(time * 0.9) * 0.012 * S.wobble;
        die.quaternion.copy(faceQ).premultiply(tmpQ.setFromAxisAngle(axisY, Math.sin(time * 0.7) * 0.035 * S.wobble));
        if (!S.drag && (Math.abs(S.vel.x) + Math.abs(S.vel.y) > 0.001)) {
          turn(S.vel.x * dt, S.vel.y * dt);
          const d = Math.pow(0.05, dt);
          S.vel.x *= d; S.vel.y *= d;
        }
      }
    }

    if (!reducedMotion) {
      for (let i = 0; i < BUBBLES; i++) {
        bpos[i * 3 + 1] += bvel[i] * dt;
        const x = bpos[i * 3], y = bpos[i * 3 + 1], z = bpos[i * 3 + 2];
        if (x * x + y * y + z * z > 0.8) seedBubble(i, false);
      }
      bgeo.attributes.position.needsUpdate = true;
    }

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  function resize() {
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const half = 1.2 / Math.min(1, camera.aspect);
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(half / camera.position.z));
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host);
  resize();

  // ---------- pointer ----------
  const el = host;
  el.addEventListener('pointerdown', e => {
    if (e.button !== undefined && e.button !== 0) return;
    S.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
    S.vel.x = S.vel.y = 0;
    el.setPointerCapture(e.pointerId);
    el.classList.add('is-dragging');
  });
  el.addEventListener('pointermove', e => {
    const d = S.drag;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    if (!d.moved || S.phase !== 'idle') return;
    const now = performance.now(), dt = Math.max(0.008, (now - d.t) / 1000);
    turn(dx * 0.009, dy * 0.009);
    S.vel.x = THREE.MathUtils.clamp(dx * 0.009 / dt, -9, 9);
    S.vel.y = THREE.MathUtils.clamp(dy * 0.009 / dt, -9, 9);
    d.x = e.clientX; d.y = e.clientY; d.t = now;
  });
  const end = e => {
    const d = S.drag;
    if (!d || d.id !== e.pointerId) return;
    S.drag = null;
    el.classList.remove('is-dragging');
    if (!d.moved && e.type === 'pointerup' && onTap) onTap();
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);

  drawFace('Ask me about the future');
  requestAnimationFrame(t => { S.last = t; frame(t); });

  return {
    ask,
    setFace: drawFace,
    nudge(dx, dy) { if (S.phase === 'idle') { S.vel.x = S.vel.y = 0; turn(dx, dy); } },
    busy: () => S.phase !== 'idle',
  };
}
