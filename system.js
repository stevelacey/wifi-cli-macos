import { run, tryRun } from './support.js'

export const device = (() => {
  return run("networksetup -listallhardwareports | awk '/Wi-Fi/{getline; print $2}'") || 'en0'
})()

export const hardwareMac = (() => {
  const raw = tryRun('networksetup -listallhardwareports')
  const match = raw.match(/Wi-Fi\nDevice: \S+\nEthernet Address: ([0-9a-f:]+)/i)
  return match?.[1] ?? tryRun(`ifconfig ${device} | awk '/ether/{print $2}'`)
})()
