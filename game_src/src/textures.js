import * as THREE from 'three';

// Procedural textures drawn on canvases, so the game ships without image files.

function canvasTexture(w, h, draw, repeatX = 1, repeatY = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 4;
  return t;
}

export function brickTexture(rx, ry) {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#2a2523';
    ctx.fillRect(0, 0, w, h);
    const bw = 128, bh = 48, gap = 6;
    for (let row = 0; row * bh < h; row++) {
      const off = row % 2 ? bw / 2 : 0;
      for (let x = -bw; x < w + bw; x += bw) {
        const l = 18 + Math.random() * 12;
        ctx.fillStyle = `hsl(${8 + Math.random() * 10}, ${25 + Math.random() * 15}%, ${l}%)`;
        ctx.fillRect(x + off + gap / 2, row * bh + gap / 2, bw - gap, bh - gap);
      }
    }
    // grime
    for (let i = 0; i < 4000; i++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3);
    }
  }, rx, ry);
}

export function concreteTexture(r) {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#4a4a4c';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      const v = 50 + Math.random() * 40;
      ctx.fillStyle = `rgba(${v},${v},${v + 4},0.35)`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 3, 2 + Math.random() * 3);
    }
    ctx.strokeStyle = 'rgba(20,20,20,0.5)';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, w, h);
  }, r, r);
}

export function woodTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#7a5232';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      ctx.fillStyle = `rgba(40,22,10,${Math.random() * 0.25})`;
      ctx.fillRect(0, y + Math.sin(y * 0.15) * 2, w, 1 + Math.random() * 2);
    }
  });
}

export function neonTexture(text) {
  const t = canvasTexture(1024, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.font = 'bold 150px "Arial Black", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff2d6f';
    for (const blur of [60, 30, 12]) {
      ctx.shadowBlur = blur;
      ctx.fillStyle = '#ff2d6f';
      ctx.fillText(text, w / 2, h / 2);
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffd6e4';
    ctx.fillText(text, w / 2, h / 2);
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Plain canvas texture without wrapping, for signs and plates.
function signTexture(w, h, draw) {
  const t = canvasTexture(w, h, draw);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function plateTexture(text) {
  return signTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f7f7f2'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 8; ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = '#111'; ctx.font = 'bold 78px "Arial Narrow", Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 4);
  });
}

// Orange LED destination board, like a city bus.
export function ledBoardTexture(text) {
  return signTexture(1024, 160, (ctx, w, h) => {
    ctx.fillStyle = '#120a04'; ctx.fillRect(0, 0, w, h);
    ctx.font = 'bold 110px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff8c1a'; ctx.shadowBlur = 18;
    ctx.fillStyle = '#ffa63d'; ctx.fillText(text, w / 2, h / 2 + 6);
    // LED dot grid
    ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(0,0,0,0.45)';
    for (let x = 0; x < w; x += 8) ctx.fillRect(x, 0, 2, h);
    for (let y = 0; y < h; y += 8) ctx.fillRect(0, y, w, 2);
  });
}

export function hazardTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f2c230'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#151515';
    for (let i = -2; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64 + 32, 0); ctx.lineTo(i * 64 + 32 + h, h); ctx.lineTo(i * 64 + h, h);
      ctx.fill();
    }
  }, 1, 20);
}

// Tinted glass with a spider-web crack, for vehicle windows that took a hit.
export function crackedGlassTexture() {
  return signTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(150,185,205,0.5)'; ctx.fillRect(0, 0, w, h);
    const cx = w * (0.35 + Math.random() * 0.3), cy = h * (0.35 + Math.random() * 0.3);
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineCap = 'round';
    const spokes = 10 + Math.floor(Math.random() * 5);
    const ends = [];
    for (let i = 0; i < spokes; i++) {
      let a = (i / spokes) * Math.PI * 2 + Math.random() * 0.3, x = cx, y = cy;
      ctx.lineWidth = 1 + Math.random() * 1.5;
      ctx.beginPath(); ctx.moveTo(x, y);
      const pts = [];
      for (let d = 0; d < w; d += 12) { a += (Math.random() - 0.5) * 0.5; x += Math.cos(a) * 12; y += Math.sin(a) * 12; ctx.lineTo(x, y); pts.push([x, y]); }
      ctx.stroke();
      ends.push(pts);
    }
    // concentric rings joining the spokes
    for (const k of [2, 5, 9]) {
      ctx.lineWidth = 1; ctx.beginPath();
      ends.forEach((pts, i) => { const p = pts[Math.min(k, pts.length - 1)]; if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); });
      ctx.closePath(); ctx.stroke();
    }
  });
}

// Woven fabric; `quilt` adds the stitched diamonds of a mattress.
export function fabricTexture(color, quilt = false) {
  const t = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) {
      ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.06})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 1);
    }
    if (quilt) {
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
      for (let k = -w; k < w * 2; k += 64) {
        ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k + h, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(k, h); ctx.lineTo(k + h, 0); ctx.stroke();
      }
    }
  });
  t.repeat.set(quilt ? 3 : 1, quilt ? 2 : 1);
  return t;
}
