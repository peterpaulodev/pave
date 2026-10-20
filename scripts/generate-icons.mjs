// One-off script to render placeholder app icons from inline SVGs using sharp.
// sharp is not a project dependency; install it temporarily to run this script:
//   pnpm add -D sharp && node scripts/generate-icons.mjs && pnpm remove sharp
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const BRAND = "#2563eb";

// Standard icon: full-bleed rounded square, mark can extend close to the edges.
const regularSvg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="${BRAND}"/>
  <text x="256" y="326" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="280" fill="#ffffff">P</text>
</svg>`;

// Maskable icon: background fills edge-to-edge (no rounding — the OS applies
// its own mask shape), mark kept inside the ~80% safe-zone circle.
const maskableSvg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BRAND}"/>
  <text x="256" y="300" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="180" fill="#ffffff">P</text>
</svg>`;

async function render(svg, size, outPath) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(outPath);
  console.log(`wrote ${outPath}`);
}

await mkdir("public/icons", { recursive: true });

await render(regularSvg(192), 192, "public/icons/icon-192.png");
await render(regularSvg(512), 512, "public/icons/icon-512.png");
await render(maskableSvg(512), 512, "public/icons/icon-512-maskable.png");
await render(regularSvg(180), 180, "app/apple-icon.png");
