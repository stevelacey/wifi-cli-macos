import { basePath, exec, execSync, run, spawn, spawnSync } from './support.js'

const bin = basePath('build/wifi-scanner.app/Contents/MacOS/wifi-scanner')

export const ensure = () => {
  const ready = (() => { try { run(`test -x "${bin}"`); return true } catch { return false } })()
  if (!ready) {
    try { run('xcode-select -p') } catch {
      console.error('Xcode Command Line Tools required. Install with: xcode-select --install')
      return false
    }
    run(`"${basePath('build-scanner')}"`)
  }
  const granted = (() => { try { return execSync(`"${bin}" check`, { timeout: 5000 }).toString().trim() === 'granted' } catch { return false } })()
  if (!granted) {
    try { execSync(`"${bin}" request-permission`, { timeout: 30000 }) } catch {
      console.error('Location permission denied. Enable wifi-scanner in System Settings → Privacy & Security → Location Services')
      return false
    }
  }
  return true
}

export const connect = (ssid, password) => spawn(bin, ['connect', ssid, password].filter(Boolean), { stdio: 'pipe' })

export const current = () => { try { return execSync(`"${bin}" current`, { timeout: 5000 }).toString().trim() } catch { return '' } }

export const disconnect = () => spawnSync(bin, ['disconnect'], { stdio: 'pipe' })

export const forget = (ssid) => spawnSync(bin, ['forget', ssid], { stdio: 'pipe' })

export const scan = (cb) => exec(`"${bin}" scan`, { timeout: 15000 }, cb)
