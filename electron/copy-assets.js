/**
 * Copy non-TypeScript assets (index.html, renderer.js) from src/ to dist/
 * so they sit alongside the compiled main.js/preload.js and can be loaded
 * via __dirname at runtime.
 */
const fs = require('fs')
const path = require('path')

const srcDir = path.join(__dirname, 'src')
const distDir = path.join(__dirname, 'dist')

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true })
}

const assets = ['index.html', 'renderer.js']

for (const asset of assets) {
  const src = path.join(srcDir, asset)
  const dest = path.join(distDir, asset)
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest)
    console.log(`[copy-assets] ${src} -> ${dest}`)
  } else {
    console.warn(`[copy-assets] Missing: ${src}`)
  }
}

console.log('[copy-assets] Done.')
