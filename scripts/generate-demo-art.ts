/**
 * Draws the placeholder illustrations used by demo listings and the hero.
 *
 *   public/demo/apartment-01..08.svg, house-01..03.svg, land-01..03.svg, commercial-01..03.svg
 *   public/skyline.svg
 *
 * They are original drawings made by this script, so there is no photo
 * licence to worry about while the site runs on demo data. Real listings use
 * real photos uploaded by their owners.
 *
 * Run with `npm run demo:art`. Output is deterministic: same script, same files.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const outDir = resolve(__dirname, "../public/demo");
mkdirSync(outDir, { recursive: true });

type Rng = () => number;

function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (rng: Rng, min: number, max: number) => min + rng() * (max - min);
const whole = (rng: Rng, min: number, max: number) => Math.floor(between(rng, min, max + 1));
const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)];
const n = (value: number) => Number(value.toFixed(1));

const rect = (x: number, y: number, w: number, h: number, fill: string, extra = "") =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}"${extra ? ` ${extra}` : ""}/>`;
const circle = (cx: number, cy: number, r: number, fill: string, extra = "") =>
  `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${fill}"${extra ? ` ${extra}` : ""}/>`;

const W = 800;
const H = 600;
const GROUND = 500;

interface Sky {
  top: string;
  bottom: string;
  haze: string;
  /** Windows glow when the light is low. */
  lit: boolean;
}

const SKIES: Sky[] = [
  { top: "#bcd6f8", bottom: "#eaf2ff", haze: "#c7d6ee", lit: false },
  { top: "#a9c8f2", bottom: "#e3eeff", haze: "#b9cbe8", lit: false },
  { top: "#f7c9b6", bottom: "#f5e6f3", haze: "#dcc3d6", lit: true },
  { top: "#8d93e6", bottom: "#dadcfb", haze: "#a9adde", lit: true },
];

interface Wall {
  body: string;
  shade: string;
  trim: string;
}

const WALLS: Wall[] = [
  { body: "#f3ede4", shade: "#e2d9cc", trim: "#b9ac98" },
  { body: "#e8d7c1", shade: "#d6c2a8", trim: "#a98f6f" },
  { body: "#c9704b", shade: "#b55f3d", trim: "#8d4529" },
  { body: "#dfe5f0", shade: "#cbd3e2", trim: "#8f9bb5" },
  { body: "#f0e2b4", shade: "#e0cf99", trim: "#b09a57" },
  { body: "#c3d6ca", shade: "#aec6b7", trim: "#7d9c89" },
];

const GLASS = ["#46528f", "#55639f", "#3d477f"];
const GLOW = ["#ffd98a", "#ffc46b", "#ffe6ae"];
const LEAF = ["#4f9a6c", "#3f8a5c", "#63ab7b"];

function svgOpen(sky: Sky, id: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${sky.top}"/><stop offset="1" stop-color="${sky.bottom}"/>` +
    `</linearGradient></defs>` +
    rect(0, 0, W, H, `url(#${id})`)
  );
}

function distantBlocks(rng: Rng, sky: Sky): string {
  let out = "";
  let x = -20;
  while (x < W) {
    const w = between(rng, 60, 130);
    const h = between(rng, 90, 260);
    out += rect(x, GROUND - h, w, h, sky.haze, 'opacity="0.75"');
    x += w + between(rng, -10, 26);
  }
  return out;
}

function street(): string {
  let out = rect(0, GROUND, W, H - GROUND, "#d3d7ea") + rect(0, 548, W, 52, "#aab0cf");
  for (let x = 20; x < W; x += 110) out += rect(x, 571, 56, 5, "#eef0fa");
  return out;
}

function tree(rng: Rng, x: number, baseY: number, size: number, flowering = false): string {
  const colours = flowering ? ["#e2472b", "#f0694a", "#d3381c"] : LEAF;
  let out = rect(x - size * 0.07, baseY - size * 0.9, size * 0.14, size * 0.9, "#5b4636");
  const blobs: Array<[number, number, number]> = [
    [0, -1.0, 0.42],
    [-0.3, -0.82, 0.34],
    [0.32, -0.86, 0.36],
    [0.02, -1.3, 0.32],
  ];
  blobs.forEach(([dx, dy, r], index) => {
    out += circle(x + dx * size, baseY + dy * size, r * size, colours[index % colours.length]);
  });
  if (flowering) {
    for (let i = 0; i < 9; i += 1) {
      out += circle(x + between(rng, -0.5, 0.55) * size, baseY - between(rng, 0.7, 1.5) * size, size * 0.05, "#ff9a7a");
    }
  }
  return out;
}

function plant(rng: Rng, x: number, y: number): string {
  const colour = pick(rng, LEAF);
  return circle(x, y - 6, 7, colour) + circle(x + 7, y - 4, 5, colour) + rect(x - 5, y - 2, 14, 6, "#b56a4a");
}

function glass(rng: Rng, sky: Sky): string {
  return sky.lit && rng() < 0.45 ? pick(rng, GLOW) : pick(rng, GLASS);
}

function waterTank(x: number, roofY: number): string {
  return (
    rect(x + 4, roofY - 16, 4, 16, "#3b3f66") +
    rect(x + 28, roofY - 16, 4, 16, "#3b3f66") +
    rect(x, roofY - 44, 36, 30, "#262a52", 'rx="5"') +
    rect(x, roofY - 44, 36, 6, "#343970", 'rx="3"')
  );
}

interface TowerOptions {
  x: number;
  width: number;
  floors: number;
  bays: number;
  floorHeight: number;
  wall: Wall;
  sky: Sky;
}

/** A Dhaka-style apartment block: balconies with plants, a stair core, a tank on the roof. */
function apartmentBlock(rng: Rng, options: TowerOptions): string {
  const { x, width, floors, bays, floorHeight, wall, sky } = options;
  const groundFloor = 62;
  const height = floors * floorHeight + groundFloor;
  const top = GROUND - height;
  const coreWidth = 44;
  const coreOnLeft = rng() < 0.5;
  const bayArea = width - coreWidth;
  const bayX = coreOnLeft ? x + coreWidth : x;
  const bayWidth = bayArea / bays;
  const balconyBays = new Set<number>();
  for (let bay = 0; bay < bays; bay += 1) if (rng() < 0.55) balconyBays.add(bay);
  if (balconyBays.size === 0) balconyBays.add(0);

  let out = rect(x, top, width, height, wall.body);

  // Stair core with a strip of landing windows.
  const coreX = coreOnLeft ? x : x + width - coreWidth;
  out += rect(coreX, top - 18, coreWidth, height + 18, wall.shade);
  for (let floor = 0; floor < floors; floor += 1) {
    out += rect(coreX + 15, top + floor * floorHeight + 12, 14, floorHeight - 22, glass(rng, sky), 'rx="2"');
  }

  for (let floor = 0; floor < floors; floor += 1) {
    const y = top + floor * floorHeight;
    out += rect(x, y + floorHeight - 3, width, 3, wall.shade);
    for (let bay = 0; bay < bays; bay += 1) {
      const bx = bayX + bay * bayWidth;
      if (balconyBays.has(bay)) {
        out += rect(bx + 8, y + 8, bayWidth - 16, floorHeight - 12, glass(rng, sky), 'rx="2"');
        out += rect(bx + bayWidth / 2 - 1.5, y + 8, 3, floorHeight - 12, wall.trim);
        out += rect(bx + 3, y + floorHeight - 19, bayWidth - 6, 16, wall.shade, 'rx="2"');
        out += rect(bx + 1, y + floorHeight - 4, bayWidth - 2, 5, wall.trim, 'rx="1"');
        if (rng() < 0.5) out += plant(rng, bx + between(rng, 12, bayWidth - 22), y + floorHeight - 20);
      } else {
        const ww = bayWidth - 26;
        out += rect(bx + 13, y + 6, ww, 4, wall.trim);
        out += rect(bx + 13, y + 11, ww, floorHeight - 24, glass(rng, sky), 'rx="2"');
        out += rect(bx + 13 + ww / 2 - 1, y + 11, 2, floorHeight - 24, wall.body);
        if (rng() < 0.18) out += rect(bx + 15, y + floorHeight - 12, 20, 9, "#c5c9d8", 'rx="2"');
      }
    }
  }

  // Ground floor: open car park behind pillars, and the gate.
  const gy = GROUND - groundFloor;
  out += rect(x, gy, width, groundFloor, wall.shade);
  out += rect(x + 10, gy + 10, width - 20, groundFloor - 10, "#3a3f63");
  for (let px = x + 10; px < x + width - 10; px += 52) out += rect(px, gy + 10, 12, groundFloor - 10, wall.body);
  out += rect(x + width / 2 - 26, gy + 16, 52, groundFloor - 16, "#262a52", 'rx="3"');

  // Roof.
  out += rect(x - 4, top - 8, width + 8, 10, wall.trim, 'rx="2"');
  out += waterTank(coreOnLeft ? x + width - 60 : x + 24, top - 8);
  if (rng() < 0.6) out += plant(rng, x + width / 2, top - 6) + plant(rng, x + width / 2 + 22, top - 6);

  // Soft shadow down one side gives the block some depth.
  out += rect(x + width * 0.72, top, width * 0.28, height, "#15173d", 'opacity="0.06"');
  return out;
}

function boundaryWall(x: number, width: number, gateAt: number): string {
  let out = rect(x, GROUND - 26, width, 26, "#e9e4dc") + rect(x, GROUND - 30, width, 5, "#b9ac98");
  out += rect(gateAt, GROUND - 40, 64, 40, "#30355f", 'rx="3"');
  for (let bar = gateAt + 8; bar < gateAt + 60; bar += 10) out += rect(bar, GROUND - 36, 2, 34, "#6f76ad");
  return out;
}

function apartmentScene(seed: number): string {
  const rng = createRng(seed);
  const sky = SKIES[seed % SKIES.length];
  const wall = WALLS[seed % WALLS.length];
  const width = between(rng, 330, 420);
  const x = (W - width) / 2 + between(rng, -40, 40);

  let out = svgOpen(sky, `s${seed}`) + distantBlocks(rng, sky);

  // Neighbours on both sides, cropped by the frame.
  const neighbourWall = WALLS[(seed + 3) % WALLS.length];
  out += apartmentBlock(rng, { x: -70, width: 210, floors: whole(rng, 4, 6), bays: 2, floorHeight: 46, wall: neighbourWall, sky });
  out += apartmentBlock(rng, { x: 650, width: 220, floors: whole(rng, 3, 5), bays: 2, floorHeight: 48, wall: WALLS[(seed + 1) % WALLS.length], sky });
  out += rect(0, 0, W, GROUND, sky.bottom, 'opacity="0.22"');

  out += street();
  out += apartmentBlock(rng, { x, width, floors: whole(rng, 6, 8), bays: whole(rng, 3, 4), floorHeight: 48, wall, sky });
  out += boundaryWall(x - 30, width + 60, x + width / 2 - 32);
  out += tree(rng, x - 62, GROUND + 6, between(rng, 86, 110), seed % 4 === 1);
  out += tree(rng, x + width + 70, GROUND + 6, between(rng, 70, 96));
  return `${out}</svg>`;
}

function houseScene(seed: number): string {
  const rng = createRng(seed * 31);
  const sky = SKIES[(seed + 1) % SKIES.length];
  const wall = WALLS[(seed * 2 + 1) % WALLS.length];
  const floors = whole(rng, 2, 3);
  const floorHeight = 84;
  const width = 430;
  const x = 185;
  const top = GROUND - floors * floorHeight;

  let out = svgOpen(sky, `h${seed}`) + distantBlocks(rng, sky) + rect(0, 0, W, GROUND, sky.bottom, 'opacity="0.3"');
  out += rect(0, GROUND, W, H - GROUND, "#c9dcb4") + rect(0, 556, W, 44, "#aab0cf");
  out += tree(rng, 96, GROUND + 4, 130) + tree(rng, 712, GROUND + 4, 118, seed % 2 === 0);

  out += rect(x, top, width, floors * floorHeight, wall.body);
  out += rect(x + width * 0.62, top, width * 0.38, floors * floorHeight, wall.shade);

  for (let floor = 0; floor < floors; floor += 1) {
    const y = top + floor * floorHeight;
    // Veranda across the left part of each floor.
    out += rect(x - 14, y + floorHeight - 8, width * 0.64 + 14, 8, wall.trim, 'rx="2"');
    out += rect(x - 10, y + floorHeight - 34, width * 0.64 + 6, 26, wall.shade, 'opacity="0.9" rx="2"');
    for (let column = 0; column < 4; column += 1) {
      out += rect(x + column * ((width * 0.62) / 3) - 4, y + 4, 8, floorHeight - 8, wall.trim);
    }
    out += rect(x + 30, y + 18, 70, floorHeight - 26, glass(rng, sky), 'rx="3"');
    out += rect(x + 140, y + 18, 90, floorHeight - 52, glass(rng, sky), 'rx="3"');
    out += rect(x + width * 0.62 + 34, y + 20, 96, floorHeight - 44, glass(rng, sky), 'rx="3"');
    out += rect(x + width * 0.62 + 81, y + 20, 3, floorHeight - 44, wall.body);
    if (rng() < 0.7) out += plant(rng, x + between(rng, 110, 220), y + floorHeight - 34);
  }

  out += rect(x - 22, top - 16, width + 44, 18, wall.trim, 'rx="3"');
  out += waterTank(x + width - 86, top - 16);
  out += rect(x + 30, GROUND - 76, 70, 76, "#3a2f2a", 'rx="3"');
  out += boundaryWall(60, 680, 520);
  for (let bush = 0; bush < 5; bush += 1) out += circle(250 + bush * 46, GROUND - 4, 16, pick(rng, LEAF));
  return `${out}</svg>`;
}

function landScene(seed: number): string {
  const rng = createRng(seed * 97);
  const sky = SKIES[seed % 2];
  const field = pick(rng, ["#b7d39a", "#c4d8a2", "#d9c79c"]);

  let out = svgOpen(sky, `l${seed}`) + distantBlocks(rng, sky) + rect(0, 0, W, 380, sky.bottom, 'opacity="0.45"');

  // Tree line along the horizon.
  for (let x = -10; x < W + 20; x += 38) {
    out += circle(x + between(rng, -6, 6), 368 - between(rng, 0, 16), between(rng, 22, 34), "#6fa584");
  }
  out += rect(0, 372, W, 228, field);

  // The plot, drawn in perspective, with a lighter cleared surface.
  out += `<polygon points="210,395 600,395 730,540 70,540" fill="#ffffff" opacity="0.28"/>`;
  out += `<polygon points="210,395 600,395 730,540 70,540" fill="none" stroke="#ffffff" stroke-width="3" stroke-dasharray="14 9"/>`;

  // Corner pillars, the way plots are marked on site.
  const pillars: Array<[number, number, number]> = [
    [210, 395, 0.7],
    [600, 395, 0.7],
    [730, 540, 1.25],
    [70, 540, 1.25],
  ];
  for (const [px, py, scale] of pillars) {
    out += rect(px - 6 * scale, py - 34 * scale, 12 * scale, 34 * scale, "#f3ede4");
    out += rect(px - 6 * scale, py - 34 * scale, 12 * scale, 9 * scale, "#d3381c");
  }

  for (let tuft = 0; tuft < 16; tuft += 1) {
    out += circle(between(rng, 0, W), between(rng, 400, 536), between(rng, 4, 9), "#8fbd7c", 'opacity="0.7"');
  }
  out += rect(0, 552, W, 48, "#aab0cf");
  for (let x = 20; x < W; x += 110) out += rect(x, 573, 56, 5, "#eef0fa");
  out += tree(rng, pick(rng, [56, 752]), 548, 120, seed % 3 === 0);
  return `${out}</svg>`;
}

function commercialScene(seed: number): string {
  const rng = createRng(seed * 211);
  const sky = SKIES[(seed + 2) % SKIES.length];
  const width = between(rng, 300, 350);
  const x = (W - width) / 2;
  const height = between(rng, 380, 430);
  const top = GROUND - height;
  const panes = ["#5a6fb8", "#6a7fc6", "#4a5ea8", "#7b90d4", "#8aa0de"];

  let out = svgOpen(sky, `c${seed}`) + distantBlocks(rng, sky) + rect(0, 0, W, GROUND, sky.bottom, 'opacity="0.25"');
  out += apartmentBlock(rng, { x: -40, width: 200, floors: 5, bays: 2, floorHeight: 46, wall: WALLS[3], sky });
  out += apartmentBlock(rng, { x: 640, width: 210, floors: 4, bays: 2, floorHeight: 48, wall: WALLS[0], sky });
  out += street();

  // Curtain-wall tower.
  out += rect(x, top, width, height, "#2c3566", 'rx="4"');
  const columns = 9;
  const paneWidth = (width - 20) / columns;
  for (let py = top + 12; py < GROUND - 96; py += 26) {
    for (let column = 0; column < columns; column += 1) {
      const fill = sky.lit && rng() < 0.2 ? pick(rng, GLOW) : pick(rng, panes);
      out += rect(x + 10 + column * paneWidth + 1.5, py, paneWidth - 3, 22, fill);
    }
  }
  out += `<polygon points="${n(x)},${n(top)} ${n(x + width * 0.55)},${n(top)} ${n(x)},${n(top + height * 0.6)}" fill="#ffffff" opacity="0.1"/>`;
  out += rect(x + width - 62, top - 26, 46, 26, "#232a55", 'rx="3"');

  // Podium with shopfronts and awnings.
  out += rect(x - 46, GROUND - 92, width + 92, 92, "#e6e9f5");
  out += rect(x - 50, GROUND - 98, width + 100, 10, "#9aa2c8", 'rx="2"');
  const shops = 4;
  const shopWidth = (width + 76) / shops;
  for (let shop = 0; shop < shops; shop += 1) {
    const sx = x - 38 + shop * shopWidth;
    out += rect(sx + 6, GROUND - 62, shopWidth - 12, 62, "#39406f", 'rx="2"');
    out += rect(sx + 2, GROUND - 76, shopWidth - 4, 16, shop % 2 === 0 ? "#d3381c" : "#2f34a8", 'rx="3"');
  }
  out += tree(rng, x - 96, GROUND + 6, 84) + tree(rng, x + width + 104, GROUND + 6, 78);
  return `${out}</svg>`;
}

/** Hero illustration: a low evening skyline on the indigo block, with one flame tree. */
function skyline(): string {
  const rng = createRng(2026);
  const width = 720;
  const height = 380;
  const base = height;
  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`;

  const far: Array<[number, number, number]> = [
    [10, 150, 74], [96, 196, 60], [170, 128, 82], [268, 214, 58], [338, 160, 92], [446, 226, 66], [524, 142, 84], [622, 190, 70],
  ];
  for (const [x, h, w] of far) out += rect(x, base - h, w, h, "#22255f");

  const mid: Array<[number, number, number, number]> = [
    [0, 118, 92, 3], [104, 176, 88, 3], [204, 104, 74, 2], [290, 232, 100, 4], [402, 138, 82, 3], [496, 196, 96, 4], [604, 122, 116, 4],
  ];
  mid.forEach(([x, h, w, columns], index) => {
    const top = base - h;
    out += rect(x, top, w, h, index % 2 === 0 ? "#2b2f86" : "#31369a");
    out += rect(x - 2, top - 5, w + 4, 6, "#3d43b4");
    if (index % 2 === 1) {
      out += rect(x + 12, top - 27, 3, 22, "#3d43b4") + rect(x + 29, top - 27, 3, 22, "#3d43b4");
      out += rect(x + 8, top - 45, 28, 20, "#3d43b4", 'rx="4"');
    }
    const gap = (w - 16) / columns;
    for (let wy = top + 14; wy < base - 16; wy += 24) {
      for (let column = 0; column < columns; column += 1) {
        const lit = rng() < 0.3;
        out += rect(x + 8 + column * gap + 3, wy, gap - 6, 13, lit ? pick(rng, GLOW) : "#4a50c2", lit ? 'rx="1"' : 'rx="1" opacity="0.55"');
      }
    }
  });

  // A small mosque among the blocks: dome, finial and one minaret.
  const mosque = "#4a50c2";
  const mx = 222;
  out += rect(mx, base - 42, 66, 42, mosque);
  out += circle(mx + 33, base - 42, 25, mosque) + rect(mx + 31.5, base - 80, 3, 14, mosque);
  out += rect(mx - 16, base - 104, 8, 104, mosque) + circle(mx - 12, base - 105, 6.5, mosque);
  out += rect(mx - 13.5, base - 122, 3, 13, mosque) + rect(mx - 19, base - 70, 14, 4, mosque);

  // Krishnachura in bloom: the one warm note on the block.
  out += rect(452, base - 70, 9, 70, "#1b1d4d");
  const canopy: Array<[number, number, number]> = [[456, 86, 34], [428, 72, 26], [486, 74, 28], [458, 112, 24]];
  canopy.forEach(([cx, up, r], index) => {
    out += circle(cx, base - up, r, index % 2 === 0 ? "#d3381c" : "#e2553a");
  });
  for (let i = 0; i < 12; i += 1) {
    out += circle(between(rng, 420, 496), base - between(rng, 60, 128), 3.2, "#ff9a7a");
  }
  return `${out}</svg>`;
}

const files: Array<[string, string]> = [];
for (let i = 1; i <= 8; i += 1) files.push([`apartment-${String(i).padStart(2, "0")}.svg`, apartmentScene(i)]);
for (let i = 1; i <= 3; i += 1) files.push([`house-${String(i).padStart(2, "0")}.svg`, houseScene(i)]);
for (let i = 1; i <= 3; i += 1) files.push([`land-${String(i).padStart(2, "0")}.svg`, landScene(i)]);
for (let i = 1; i <= 3; i += 1) files.push([`commercial-${String(i).padStart(2, "0")}.svg`, commercialScene(i)]);

let total = 0;
for (const [name, svg] of files) {
  writeFileSync(resolve(outDir, name), svg);
  total += svg.length;
}
const skylineSvg = skyline();
writeFileSync(resolve(outDir, "../skyline.svg"), skylineSvg);

console.log(`${files.length} listing illustrations, ${(total / 1024).toFixed(0)} KB in total`);
console.log(`skyline.svg, ${(skylineSvg.length / 1024).toFixed(1)} KB`);
