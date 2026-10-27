// Bundles the game into one self-contained HTML file (no network needed at runtime)
// and copies it into the Flutter app's assets.
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const out = await esbuild.build({
  entryPoints: [path.join(here, 'src/main.js')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2019'],
  write: false,
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const template = fs.readFileSync(path.join(here, 'src/index.html'), 'utf8');
const html = template.replace('/*GAME_JS*/', () => js);

// Artifact version: the host adds its own doctype/head/body wrapper.
fs.mkdirSync(path.join(here, 'dist'), { recursive: true });
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<meta[^>]*>\s*/g, '');
const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
fs.writeFileSync(path.join(here, 'dist/artifact.html'), head.trim() + '\n' + body.trim() + '\n');

for (const dest of ['dist/index.html', '../app/assets/game/index.html', '../vercel_site/index.html']) {
  const file = path.join(here, dest);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  console.log(`wrote ${path.relative(path.join(here, '..'), file)} (${(html.length / 1024).toFixed(0)} KB)`);
}
