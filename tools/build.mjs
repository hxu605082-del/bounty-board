// 构建：src/parser.js + src/content.core.js → extension/content.js
// 同时产出火狐版（background 用 scripts 而不是 service_worker）
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.dirname(here);
const ext = path.join(repo, 'extension');
const dist = path.join(repo, 'dist', 'firefox');

const EXT_FILES = [
  'content.js',
  'background.js',
  'popup.html',
  'popup.js',
  'board.html',
  'board.js',
  'board.css'
];

// 1) 合并内容脚本
const parser = await readFile(path.join(repo, 'src', 'parser.js'), 'utf8');
const core = await readFile(path.join(repo, 'src', 'content.core.js'), 'utf8');
const banner = '// 自动生成，勿直接改：源文件是 src/parser.js + src/content.core.js\n';
await writeFile(
  path.join(ext, 'content.js'),
  banner + parser.trim() + '\n\n' + core.trim() + '\n',
  'utf8'
);

// 2) 火狐版
const manifest = JSON.parse(await readFile(path.join(ext, 'manifest.json'), 'utf8'));
manifest.background = { scripts: ['background.js'] };
manifest.browser_specific_settings = {
  gecko: { id: 'bounty-board@local.demo', strict_min_version: '128.0' }
};

await mkdir(dist, { recursive: true });
for (const file of EXT_FILES) {
  await copyFile(path.join(ext, file), path.join(dist, file));
}
await writeFile(path.join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

console.log('built: extension/content.js  +  dist/firefox');
