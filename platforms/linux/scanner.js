import { exec, run, spawn, spawnSync, tryRun } from '../../support.js'

const wifiIface = () => tryRun("nmcli -t -f DEVICE,TYPE device status | grep ':wifi' | cut -d: -f1 | head -1") || 'wlan0'

export const ensure = () => {
  try { run('nmcli -v'); return true } catch {
    console.error('nmcli not found. Install NetworkManager: sudo apt install network-manager')
    return false
  }
}

export const connect = (ssid, password) =>
  spawn('nmcli', ['device', 'wifi', 'connect', ssid, ...(password ? ['password', password] : [])], { stdio: 'pipe' })

export const current = () => {
  const output = tryRun('nmcli --escape no -t -f ACTIVE,SSID dev wifi')
  for (const line of output.split('\n')) {
    if (line.startsWith('yes:')) return line.slice(4)
  }
  return ''
}

export const disconnect = () => spawnSync('nmcli', ['device', 'disconnect', wifiIface()], { stdio: 'pipe' })

export const forget = (ssid) => spawnSync('nmcli', ['connection', 'delete', ssid], { stdio: 'pipe' })

const parseNetworks = (stdout) => {
  const bySSID = new Map()
  for (const block of stdout.trim().split(/\n\n+/)) {
    const fields = {}
    for (const line of block.split('\n')) {
      const i = line.indexOf(':')
      if (i > 0) fields[line.slice(0, i).trim()] = line.slice(i + 1).trim()
    }
    const ssid = fields['SSID'] || ''
    if (!ssid) continue
    const signal = parseInt(fields['SIGNAL'] || '0', 10)
    const rssi = Math.round((signal / 2) - 100)
    const freqMhz = parseInt(fields['FREQ'] || '0', 10)
    const band = freqMhz >= 6000 ? '6 GHz' : freqMhz >= 5000 ? '5 GHz' : '2.4 GHz'
    const security = fields['SECURITY'] || ''
    if (!bySSID.has(ssid) || signal > (bySSID.get(ssid)._signal || 0)) {
      bySSID.set(ssid, { ssid, rssi, security, band, _signal: signal })
    }
  }
  return [...bySSID.values()].map(({ _signal, ...n }) => n)
}

export const scan = (cb) => {
  exec('nmcli -m multiline -f IN-USE,SSID,SIGNAL,SECURITY,CHAN,FREQ device wifi list --rescan yes', { timeout: 15000 }, (err, stdout) => {
    if (err) { cb(err, null); return }
    cb(null, JSON.stringify({ current: current(), networks: parseNetworks(stdout || ''), hotspots: [] }))
  })
}
