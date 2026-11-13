// @vitest-environment node
import { buildCsp, cspPlugin } from './csp';

function directive(policy: string, name: string): string {
  const found = policy.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name} `));
  return found ? found.slice(name.length + 1) : '';
}

describe('buildCsp', () => {
  const policy = buildCsp({});

  it('locks everything down by default', () => {
    expect(directive(policy, 'default-src')).toBe("'self'");
    expect(directive(policy, 'object-src')).toBe("'none'");
    expect(directive(policy, 'base-uri')).toBe("'self'");
  });

  it('allows only our own scripts and the YouTube player API', () => {
    const scripts = directive(policy, 'script-src').split(' ');
    expect(scripts).toEqual(["'self'", "'wasm-unsafe-eval'", 'https://www.youtube.com', 'https://s.ytimg.com']);
    expect(scripts).not.toContain("'unsafe-eval'");
    expect(scripts).not.toContain('*');
    expect(scripts).not.toContain("'unsafe-inline'");
  });

  it('runs no Spotify script: Spotify plays in its own framed player', () => {
    expect(directive(policy, 'script-src')).not.toContain('spotify');
  });

  it('frames only the official players', () => {
    expect(directive(policy, 'frame-src')).toBe('https://www.youtube-nocookie.com https://www.youtube.com https://open.spotify.com');
  });

  it('allows cover art and local images', () => {
    expect(directive(policy, 'img-src').split(' ')).toEqual(expect.arrayContaining(['data:', 'blob:', 'https://i.ytimg.com']));
  });

  it('allows https audio streams and local blobs', () => {
    expect(directive(policy, 'media-src')).toBe("'self' blob: https:");
  });

  it('allows Spotify oEmbed and nothing from Supabase when it is not configured', () => {
    const connect = directive(policy, 'connect-src');
    expect(connect).toContain('https://open.spotify.com');
    expect(connect).not.toContain('supabase');
  });

  it('allows sending feedback through the form service', () => {
    expect(directive(policy, 'connect-src').split(' ')).toContain('https://api.web3forms.com');
  });

  it('adds the Supabase project for presence', () => {
    const connect = directive(buildCsp({ supabaseUrl: 'https://abc.supabase.co' }), 'connect-src').split(' ');
    expect(connect).toEqual(expect.arrayContaining(['https://abc.supabase.co', 'wss://abc.supabase.co']));
  });

  it('refuses an invalid Supabase URL', () => {
    expect(() => buildCsp({ supabaseUrl: 'not a url' })).toThrow('VITE_SUPABASE_URL is not a valid URL');
  });

  it('allows the self-hosted fonts and the PDF worker', () => {
    expect(directive(policy, 'font-src')).toBe("'self'");
    expect(directive(policy, 'worker-src')).toBe("'self' blob:");
    expect(directive(policy, 'style-src')).toBe("'self' 'unsafe-inline'");
  });
});

describe('cspPlugin', () => {
  it('only applies to production builds', () => {
    expect(cspPlugin({}).apply).toBe('build');
  });

  it('adds exactly one CSP meta tag to the page', () => {
    const plugin = cspPlugin({});
    const transform = plugin.transformIndexHtml as (html: string) => string;
    const html = transform('<!doctype html><html><head><meta charset="UTF-8" /></head><body></body></html>');
    expect(html.match(/http-equiv="Content-Security-Policy"/g)).toHaveLength(1);
    expect(html).toContain("default-src 'self'");
  });
});
