// Checks that every preset playlist still exists, using the public oEmbed
// endpoints of Spotify and YouTube. No API key needed.
//   node scripts/verify-playlists.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'features', 'music', 'playlists.ts'), 'utf8');
const spotifyIds = [...source.matchAll(/spotify\('([A-Za-z0-9]+)'/g)].map((m) => m[1]);
const youtubeIds = [...source.matchAll(/youtube\('([A-Za-z0-9_-]+)'/g)].map((m) => m[1]);

const checks = [
  ...spotifyIds.map((id) => ({
    id,
    url: `https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/playlist/${id}`)}`,
  })),
  ...youtubeIds.map((id) => ({
    id,
    url: `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/playlist?list=${id}`)}`,
  })),
];

let failed = 0;
for (const { id, url } of checks) {
  try {
    const response = await fetch(url);
    const title = response.ok ? (await response.json()).title : '';
    console.log(`${response.ok ? 'OK  ' : 'FAIL'} ${response.status} ${id} ${title}`);
    if (!response.ok) failed++;
  } catch (error) {
    console.log(`FAIL ${id} ${String(error).slice(0, 80)}`);
    failed++;
  }
}
console.log(`\n${checks.length - failed}/${checks.length} presets resolve`);
process.exit(failed > 0 ? 1 : 0);
