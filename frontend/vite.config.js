import { readFileSync, mkdirSync, openSync, closeSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export const FRONTEND_DIR = dirname(fileURLToPath(import.meta.url))
export const TEST_DIR = fileURLToPath(new URL('../test', import.meta.url)).replace(/\\/g, '/') + '/'
export const CONFIG_PATH = resolve(FRONTEND_DIR, '../config/frontend.json')

export function loadFrontendConfig(configPath = CONFIG_PATH) {
  let contents
  try {
    contents = readFileSync(configPath, 'utf8')
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error(`Không thể đọc file cấu hình tại ${configPath}: ${error.message}`, { cause: error })
    try {
      mkdirSync(dirname(configPath), { recursive: true })
      closeSync(openSync(configPath, 'wx'))
    } catch (createError) {
      if (createError.code !== 'EEXIST') throw new Error(`Không thể tạo file cấu hình tại ${configPath}: ${createError.message}`, { cause: createError })
      return loadFrontendConfig(configPath)
    }
    throw new Error(`Đã tạo file cấu hình trống tại ${configPath}. Hãy bổ sung nội dung JSON hợp lệ trước khi chạy lại.`)
  }
  if (!contents.trim()) throw new Error(`File cấu hình đang trống: ${configPath}. Hãy bổ sung nội dung JSON hợp lệ trước khi chạy lại.`)

  let config
  try {
    config = JSON.parse(contents)
  } catch (error) {
    throw new Error(`File cấu hình JSON không hợp lệ tại ${configPath}: ${error.message}`, { cause: error })
  }
  const invalid = (field, expected) => { throw new Error(`Cấu hình không hợp lệ tại ${configPath}: ${field} ${expected}.`) }
  if (config === null || typeof config !== 'object' || Array.isArray(config)) invalid('root', 'phải là object')
  const proxy = config.devServer?.apiProxy
  if (proxy === null || typeof proxy !== 'object' || Array.isArray(proxy)) invalid('devServer.apiProxy', 'phải là object')
  if (typeof proxy.path !== 'string' || !/^\/(?!\/)[^\s]*$/.test(proxy.path)) invalid('devServer.apiProxy.path', 'phải là đường dẫn proxy bắt đầu bằng /, không chứa khoảng trắng')
  if (typeof proxy.target !== 'string' || !proxy.target.trim()) invalid('devServer.apiProxy.target', 'phải là URL HTTP/HTTPS hợp lệ')
  let url
  try {
    url = new URL(proxy.target)
  } catch {
    invalid('devServer.apiProxy.target', 'phải là URL HTTP/HTTPS hợp lệ')
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) invalid('devServer.apiProxy.target', 'phải là URL HTTP/HTTPS hợp lệ')
  if (typeof proxy.changeOrigin !== 'boolean') invalid('devServer.apiProxy.changeOrigin', 'phải là boolean')
  return config
}

export function createViteConfig(configPath = CONFIG_PATH) {
  const { path, target, changeOrigin } = loadFrontendConfig(configPath).devServer.apiProxy
  return defineConfig({
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'vju-test-deps-resolution',
        enforce: 'pre',
        // Bo test o <repo>/test/ nam ngoai frontend/ nen node_modules walk
        // di len tu file test khong bao gio cham toi frontend/node_modules.
        // Moi import tu file trong test/ duoc resolve lai nhu the xuat phat
        // tu frontend/package.json.
        resolveId(source, importer) {
          if (!importer) return null
          const cleanImporter = importer.split('?')[0].replace(/\\/g, '/')
          if (!cleanImporter.startsWith(TEST_DIR)) return null
          return this.resolve(source, resolve(FRONTEND_DIR, 'package.json'), { skipSelf: true })
        },
      },
    ],
    resolve: {
      // Alias "@" giong reference (BE_Enrollment) de cac component port sang giu
      // nguyen duong dan import "@/components/ui/...".
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      // Cho phep serve file ngoai root (../test/**) - can thiet vi bo test
      // da gom ve <repo>/test/; neu khong Vite chan loai /@fs/.../test/*.jsx.
      fs: { allow: ['..'] },
      proxy: {
        [path]: { target, changeOrigin },
      },
    },
    // Cau hinh Vitest - doc chung tu file nay (thay vi tach vitest.config.js
    // rieng) de khong bi lech alias "@" voi Vite luc build/dev.
    test: {
      environment: 'jsdom',
      setupFiles: ['../test/setup.js'],
      globals: true,
      // File test da gom ve <repo>/test/ (nam ngoai root cua Vite) nen phai
      // chi ro include; alias "@" van tro dung toi frontend/src.
      include: ['../test/**/*.test.{js,jsx,ts,tsx}'],
    },
  })
}

export default defineConfig(() => createViteConfig())
