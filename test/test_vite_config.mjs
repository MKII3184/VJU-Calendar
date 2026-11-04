import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { CONFIG_PATH, createViteConfig, loadFrontendConfig } from '../frontend/vite.config.js'

const directories = []
const valid = { devServer: { apiProxy: { path: '/api', target: 'http://127.0.0.1:5055', changeOrigin: true } } }

function configFile(contents) {
  const directory = mkdtempSync(join(tmpdir(), 'vju-vite-'))
  directories.push(directory)
  const path = join(directory, 'config', 'frontend.json')
  if (contents !== undefined) {
    mkdirSync(dirname(path))
    writeFileSync(path, contents)
  }
  return path
}

afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }) })

test('path is derived from source rather than working directory', () => {
  const expected = resolve(dirname(fileURLToPath(import.meta.url)), '../config/frontend.json')
  const cwd = process.cwd()
  const directory = mkdtempSync(join(tmpdir(), 'vju-cwd-'))
  try {
    for (const workingDirectory of [directory, dirname(CONFIG_PATH), dirname(fileURLToPath(import.meta.url))]) {
      process.chdir(workingDirectory)
      assert.equal(CONFIG_PATH, expected)
    }
  } finally {
    process.chdir(cwd)
    rmSync(directory, { recursive: true, force: true })
  }
})

test('missing file creates empty config, fails, and keeps existing file', () => {
  const path = configFile()
  assert.throws(() => loadFrontendConfig(path), error => error.message.includes(path) && error.message.includes('Đã tạo'))
  assert.equal(readFileSync(path, 'utf8'), '')
  assert.throws(() => loadFrontendConfig(path), error => error.message.includes(path) && error.message.includes('đang trống'))
})

test('valid values become Vite proxy settings', () => {
  const path = configFile(JSON.stringify(valid))
  assert.deepEqual(createViteConfig(path).server.proxy, { '/api': { target: valid.devServer.apiProxy.target, changeOrigin: true } })
})

for (const [data, field] of [
  [[], 'root'],
  [{}, 'devServer.apiProxy'],
  [{ devServer: { apiProxy: {} } }, 'devServer.apiProxy.path'],
  [{ devServer: { apiProxy: { path: '/api' } } }, 'devServer.apiProxy.target'],
  [{ devServer: { apiProxy: { path: '/api', target: 'http://localhost:5055' } } }, 'devServer.apiProxy.changeOrigin'],
  [{ devServer: { apiProxy: { ...valid.devServer.apiProxy, path: 'api' } } }, 'devServer.apiProxy.path'],
  [{ devServer: { apiProxy: { ...valid.devServer.apiProxy, target: 'ftp://example.com' } } }, 'devServer.apiProxy.target'],
  [{ devServer: { apiProxy: { ...valid.devServer.apiProxy, changeOrigin: 'true' } } }, 'devServer.apiProxy.changeOrigin'],
]) {
  test(`rejects invalid ${field} without changing file`, () => {
    const text = JSON.stringify(data)
    const path = configFile(text)
    assert.throws(() => loadFrontendConfig(path), error => error.message.includes(path) && error.message.includes(field))
    assert.equal(readFileSync(path, 'utf8'), text)
  })
}

test('rejects malformed JSON and filesystem read error with path', () => {
  const path = configFile('{invalid')
  assert.throws(() => loadFrontendConfig(path), error => error.message.includes(path) && error.message.includes('JSON'))
  assert.equal(readFileSync(path, 'utf8'), '{invalid')
  assert.throws(() => loadFrontendConfig(dirname(path)), error => error.message.includes(dirname(path)) && error.message.includes('Không thể đọc'))
})
