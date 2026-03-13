import { run, tryRun, waitFor } from './support.js'

export const iface = run("networksetup -listallhardwareports | awk '/Wi-Fi/{getline; print $2}'") || 'en0'

export const getDhcpDns = () => {
  const raw = tryRun(`ipconfig getpacket ${iface}`)
  const match = raw.match(/domain_name_server[^:]*:\s*\{([^}]+)\}/)
  return match ? match[1].split(',').map(s => s.trim()).join(' ') : ''
}

export const getDhcpRouter = () => {
  const raw = tryRun(`ipconfig getpacket ${iface}`)
  const match = raw.match(/router[^:]*:\s*\{([^}]+)\}/)
  return match ? match[1].split(',').map(s => s.trim())[0] : ''
}

export const getDns = () => {
  const raw = tryRun('networksetup -getdnsservers Wi-Fi')
  return raw.startsWith("There aren't") ? '' : raw.split('\n').join(' ')
}

export const getIp = () => tryRun(`ipconfig getifaddr ${iface}`)

export const getMac = () => tryRun(`ifconfig ${iface} | awk '/ether/{print $2}'`)

export const getRouter = () => tryRun(`route -n get default | awk '/gateway/{print $2}'`) || tryRun(`networksetup -getinfo Wi-Fi | awk -F': ' '/^Router/{print $2}'`) || getDhcpRouter()

export const hardwareMac = (() => {
  const raw = tryRun('networksetup -listallhardwareports')
  const match = raw.match(/Wi-Fi\nDevice: \S+\nEthernet Address: ([0-9a-f:]+)/i)
  return match?.[1] ?? getMac()
})()

export const isDhcp = () => !tryRun('networksetup -getinfo Wi-Fi').includes('Manual')

export const isPrivateRelay = () => {
  const raw = tryRun('networksetup -getsocksfirewallproxy Wi-Fi')
  return raw.includes('Enabled: Yes') && raw.includes('localhost')
}

export const off = () => run(`networksetup -setairportpower ${iface} off`) || true

export const on = () => run(`networksetup -setairportpower ${iface} on`) || true

export const randomMac = () => {
  const bytes = Array.from({ length: 6 }, () => Math.floor(Math.random() * 256))
  bytes[0] = (bytes[0] & 0xFE) | 0x02 // locally administered, unicast
  return bytes.map(b => b.toString(16).padStart(2, '0')).join(':')
}

export const restart = () => off() && on()

export const setDns = (servers) => { run(`networksetup -setdnsservers Wi-Fi ${servers.join(' ')}`); return getDns() }

export const setIp = async (ip) => {
  if (['auto', 'reset'].includes(ip)) run(`networksetup -setdhcp Wi-Fi`)
  else run(`networksetup -setmanualwithdhcprouter Wi-Fi ${ip}`)
  return waitFor(getIp)
}

export const setMac = (mac) => {
  const target = ['auto', 'reset'].includes(mac) ? hardwareMac : mac
  if (getMac() === target) return getMac()
  restart()
  run(`sudo ifconfig ${iface} ether ${target}`)
  return getMac()
}

export const setRouter = async (gateway) => {
  if (!gateway) return null
  const ip = getIp()
  if (ip) run(`networksetup -setmanual Wi-Fi ${ip} 255.255.255.0 ${gateway}`)
  return waitFor(getRouter)
}
