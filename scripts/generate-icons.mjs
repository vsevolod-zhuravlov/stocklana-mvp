/**
 * Renders the PWA icon set from public/icon.svg.
 * Run with `npm run icons` after editing the source SVG.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const source = await readFile(path.join(root, "public/icon.svg"));
const outDir = path.join(root, "public/icons");

await mkdir(outDir, { recursive: true });

const render = (size) => sharp(source, { density: 384 }).resize(size, size).png().toBuffer();

for (const size of [192, 512]) {
  await writeFile(path.join(outDir, `icon-${size}.png`), await render(size));
}

await writeFile(path.join(root, "public/apple-touch-icon.png"), await render(180));

// Maskable icons are cropped to a circle by the launcher, so the artwork is
// inset to keep it inside the 80% safe zone.
const inner = await render(410);
await writeFile(
  path.join(outDir, "maskable-512.png"),
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: "#0a0e17" },
  })
    .composite([{ input: inner, top: 51, left: 51 }])
    .png()
    .toBuffer(),
);

console.log("Icons written to public/icons");
