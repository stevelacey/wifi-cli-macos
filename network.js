import { device, hardwareMac } from './system.js'
import { execSync, run, spawn, tryRun, waitFor } from './support.js'

export const findPassword = (ssid) => { try { return execSync(`security find-generic-password -ga "${ssid}" -w 2>/dev/null`).toString().trim() } catch { return '' } }

export const getDhcpDns = () => {
  const raw = tryRun(`ipconfig getpacket ${device}`)
  const match = raw.match(/domain_name_server[^:]*:\s*\{([^}]+)\}/)
  return match ? match[1].split(',').map(s => s.trim()).join(' ') : ''
}

export const getDhcpRouter = () => {
  const raw = tryRun(`ipconfig getpacket ${device}`)
  const match = raw.match(/router[^:]*:\s*\{([^}]+)\}/)
  return match ? match[1].split(',').map(s => s.trim())[0] : ''
}

export const getDns = () => {
  const raw = tryRun('networksetup -getdnsservers Wi-Fi')
  return raw.startsWith("There aren't") ? '' : raw.split('\n').join(' ')
}

export const getIp = () => tryRun(`ipconfig getifaddr ${device}`)

export const getMac = () => tryRun(`ifconfig ${device} | awk '/ether/{print $2}'`)

export const getRouter = () => tryRun(`route -n get default | awk '/gateway/{print $2}'`) || tryRun(`networksetup -getinfo Wi-Fi | awk -F': ' '/^Router/{print $2}'`) || getDhcpRouter()

export const getSavedNetworks = () => {
  const raw = tryRun(`networksetup -listpreferredwirelessnetworks ${device}`)
  return raw.split('\n').slice(1).map(s => s.trim()).filter(Boolean)
}

export const isDhcp = () => !tryRun('networksetup -getinfo Wi-Fi').includes('Manual')

export const isPrivateRelay = () => {
  const raw = tryRun('networksetup -getsocksfirewallproxy Wi-Fi')
  return raw.includes('Enabled: Yes') && raw.includes('localhost')
}

export const off = () => run(`networksetup -setairportpower ${device} off`) || true

export const on = () => run(`networksetup -setairportpower ${device} on`) || true

export const networkQuality = () => spawn('networkQuality', ['-c'])

export const restart = () => off() && on()

export const setDns = (servers) => {
  run(`networksetup -setdnsservers Wi-Fi ${servers.join(' ')}`)
  return getDns()
}

export const setIp = async (ip) => {
  if (['auto', 'reset'].includes(ip)) run(`networksetup -setdhcp Wi-Fi`)
  else run(`networksetup -setmanualwithdhcprouter Wi-Fi ${ip}`)
  return waitFor(getIp)
}

export const setMac = (mac) => {
  const target = ['auto', 'reset'].includes(mac) ? hardwareMac : mac
  if (getMac() === target) return getMac()
  restart()
  run(`sudo ifconfig ${device} ether ${target}`)
  return getMac()
}

export const setRouter = async (gateway) => {
  if (!gateway) return null
  const ip = getIp()
  if (ip) run(`networksetup -setmanual Wi-Fi ${ip} 255.255.255.0 ${gateway}`)
  return waitFor(getRouter)
}

