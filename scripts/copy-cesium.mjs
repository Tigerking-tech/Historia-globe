// Copies CesiumJS static build assets into public/cesium so they can be
// self-hosted (no CDN, works behind the GFW, no webpack bundling headaches).
// Run with: node scripts/copy-cesium.mjs
import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const src = path.join(root, "node_modules", "cesium", "Build", "Cesium");
const dest = path.join(root, "public", "cesium");

await mkdir(dest, { recursive: true });
await cp(src, dest, { recursive: true });
console.log(`Cesium assets copied -> ${path.relative(root, dest)}`);
