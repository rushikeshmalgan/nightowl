import type { Plugin } from 'vite';

/**
 * The page's Content-Security-Policy. Nothing third-party runs except the
 * official YouTube and Spotify players, and only when the reader picks them;
 * no ad, tracking or analytics script can load.
 */
export function buildCsp(opts: { supabaseUrl?: string }): string {
  const connect = ["'self'", 'https://open.spotify.com'];
  if (opts.supabaseUrl) {
    let origin: URL;
    try {
      origin = new URL(opts.supabaseUrl);
    } catch {
      throw new Error('VITE_SUPABASE_URL is not a valid URL');
    }
    connect.push(`https://${origin.host}`, `wss://${origin.host}`);
  }

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    // wasm-unsafe-eval lets pdf.js run its image decoders; it does not allow eval().
    // Spotify runs in its own frame; its scripting API needs eval() and is not used.
    'script-src': ["'self'", "'wasm-unsafe-eval'", 'https://www.youtube.com', 'https://s.ytimg.com'],
    // React sets inline style attributes.
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', 'https://i.ytimg.com', 'https://i.scdn.co', 'https://image-cdn-ak.spotifycdn.com', 'https://image-cdn-fa.spotifycdn.com'],
    'font-src': ["'self'"],
    'media-src': ["'self'", 'blob:', 'https:'],
    'connect-src': connect,
    'frame-src': ['https://www.youtube-nocookie.com', 'https://www.youtube.com', 'https://open.spotify.com'],
    'worker-src': ["'self'", 'blob:'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
  };

  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ');
}

/** Adds the policy to index.html in production builds (the dev server needs inline scripts). */
export function cspPlugin(env: { supabaseUrl?: string }): Plugin {
  const policy = buildCsp(env);
  return {
    name: 'nightowl-csp',
    apply: 'build',
    transformIndexHtml(html: string) {
      return html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`);
    },
  };
}
