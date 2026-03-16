import child_process from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const basePath = (...segments) => path.join(__dirname, ...segments)

export const exec = child_process.exec

export const execSync = child_process.execSync

export const randomMac = () => {
  const bytes = Array.from({ length: 6 }, () => Math.floor(Math.random() * 256))
  bytes[0] = (bytes[0] & 0xFE) | 0x02 // locally administered, unicast
  return bytes.map(b => b.toString(16).padStart(2, '0')).join(':')
}

export const run = (cmd) => execSync(cmd).toString().trim()

export const spawn = child_process.spawn

export const spawnSync = child_process.spawnSync

export const tryRun = (cmd) => { try { return execSync(cmd, { stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim() } catch { return '' } }

export const waitFor = (fn, { interval = 200, timeout = 5000 } = {}) => new Promise((resolve) => {
  const check = () => { const result = fn(); if (result) return resolve(result) }
  check()
  const poll = setInterval(check, interval)
  setTimeout(() => { clearInterval(poll); resolve(fn()) }, timeout)
})
