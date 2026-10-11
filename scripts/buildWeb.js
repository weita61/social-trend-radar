import { cpSync, mkdirSync, existsSync } from 'node:fs';

mkdirSync('public', { recursive: true });

if (existsSync('apps/web/index.html')) {
  cpSync('apps/web/index.html', 'public/index.html');
  cpSync('apps/web/style.css', 'public/style.css');
  cpSync('apps/web/app.js', 'public/app.js');
  console.log('✓ Successfully copied apps/web assets to public/');
} else {
  console.warn('apps/web assets not found, skipping copy');
}
