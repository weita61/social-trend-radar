import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = fileURLToPath(new URL('../../apps/web/', import.meta.url));

export function serveStatic(pathname: string): Response | null {
  const target = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = resolve(WEB_ROOT, target);
  if (!filePath.startsWith(WEB_ROOT) || !existsSync(filePath)) return null;

  try {
    const content = readFileSync(filePath);
    const ext = target.split('.').pop() ?? '';
    const contentTypeMap: Record<string, string> = {
      html: 'text/html; charset=utf-8',
      css: 'text/css; charset=utf-8',
      js: 'application/javascript; charset=utf-8',
      json: 'application/json; charset=utf-8',
      svg: 'image/svg+xml',
      png: 'image/png',
      ico: 'image/x-icon',
    };
    const contentType = contentTypeMap[ext] ?? 'application/octet-stream';
    return new Response(content, {
      status: 200,
      headers: { 'content-type': contentType, 'cache-control': 'no-cache' },
    });
  } catch {
    return null;
  }
}
