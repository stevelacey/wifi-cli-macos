import { run, tryRun, waitFor } from '../../support.js'

/* v8 ignore next */
export const iface = tryRun("nmcli -t -f DEVICE,TYPE device status | grep ':wifi' | cut -d: -f1 | head -1") || 'wlan0'

const activeConn = () => {
  const raw = tryRun(`nmcli --escape no -t -f GENERAL.CONNECTION dev show ${iface}`)
  const match = raw.match(/^GENERAL\.CONNECTION:(.+)$/m)
  return match?.[1]?.trim() || ''
}

export const getDhcpDns = () => getDns()

export const getDhcpRouter = () => getRouter()

export const getDns = () => {
  const conn = activeConn()
  if (!conn) return ''
  const raw = tryRun(`nmcli --escape no -t -f IP4.DNS connection show "${conn}"`)
  return raw.split('\n').map(l => l.replace(/^IP4\.DNS\[\d+\]:/, '').trim()).filter(Boolean).join(' ')
}

export const getIp = () => {
  const conn = activeConn()
  if (!conn) return ''
  const raw = tryRun(`nmcli --escape no -t -f IP4.ADDRESS connection show "${conn}"`)
  const match = raw.match(/([0-9.]+)\//)
  return match ? match[1] : ''
}

export const getMac = () => tryRun(`ip link show ${iface} | awk '/link\\/ether/{print $2}'`)

export const getRouter = () => {
  const byRoute = tryRun(`ip route show default dev ${iface} | awk '{print $3}' | head -1`)
  if (byRoute) return byRoute
  const conn = activeConn()
  if (!conn) return ''
  return tryRun(`nmcli --escape no -t -f IP4.GATEWAY connection show "${conn}"`).replace(/^IP4\.GATEWAY:/, '').trim()
}

export const getSavedNetworks = () => {
  const raw = tryRun("nmcli --escape no -t -f NAME,TYPE connection show | grep ':802-11-wireless'")
  return raw.split('\n').map(l => l.replace(/:802-11-wireless.*/, '').trim()).filter(Boolean)
}

export const hardwareMac = (() => {
  const perm = tryRun(`ethtool -P ${iface}`)
  const match = perm.match(/([0-9a-f]{2}(?::[0-9a-f]{2}){5})/i)
  return match?.[1] ?? getMac()
})()

export const isDhcp = () => {
  const conn = activeConn()
  if (!conn) return true
  return tryRun(`nmcli --escape no -t -f ipv4.method connection show "${conn}"`).includes('auto')
}

export const isPrivateRelay = () => false

export const off = () => run('nmcli radio wifi off') || true

export const on = () => run('nmcli radio wifi on') || true

export const randomMac = () => {
  const bytes = Array.from({ length: 6 }, () => Math.floor(Math.random() * 256))
  bytes[0] = (bytes[0] & 0xFE) | 0x02 // locally administered, unicast
  return bytes.map(b => b.toString(16).padStart(2, '0')).join(':')
}

export const restart = () => off() && on()

export const setDns = (servers) => {
  const conn = activeConn()
  if (!conn) return ''
  const val = servers[0] === 'empty' ? '' : servers.join(' ')
  run(`nmcli connection modify "${conn}" ipv4.dns "${val}"`)
  tryRun(`nmcli connection up "${conn}"`)
  return getDns()
}

export const setIp = async (ip) => {
  const conn = activeConn()
  if (!conn) return ''
  if (['auto', 'reset'].includes(ip)) run(`nmcli connection modify "${conn}" ipv4.method auto ipv4.addresses ""`)
  else run(`nmcli connection modify "${conn}" ipv4.method manual ipv4.addresses "${ip}/24"`)
  tryRun(`nmcli connection up "${conn}"`)
  return waitFor(getIp)
}

export const setMac = (mac) => {
  const target = ['auto', 'reset'].includes(mac) ? hardwareMac : mac
  if (getMac() === target) return getMac()
  tryRun(`ip link set ${iface} down`)
  run(`sudo ip link set ${iface} address ${target}`)
  tryRun(`ip link set ${iface} up`)
  return getMac()
}

export const setRouter = async (gateway) => {
  if (!gateway) return null
  const conn = activeConn()
  if (!conn) return null
  const ip = getIp()
  if (ip) run(`nmcli connection modify "${conn}" ipv4.gateway "${gateway}"`)
  tryRun(`nmcli connection up "${conn}"`)
  return waitFor(getRouter)
}
