import { execSync, run, spawn, tryRun } from "./support.js"
import { device } from "./system.js"

export const findPassword = (ssid) => {
  try {
    return execSync(`security find-generic-password -ga "${ssid}" -w 2>/dev/null`).toString().trim()
  } catch {
    return ""
  }
}

export const getSavedNetworks = () => {
  const raw = tryRun(`networksetup -listpreferredwirelessnetworks ${device}`)
  return raw
    .split("\n")
    .slice(1)
    .map((s) => s.trim())
    .filter(Boolean)
}

export const isPrivateRelay = () => {
  const raw = tryRun("networksetup -getsocksfirewallproxy Wi-Fi")
  return raw.includes("Enabled: Yes") && raw.includes("localhost")
}

export const networkQuality = () => spawn("networkQuality", ["-c"])

export const off = () => run(`networksetup -setairportpower ${device} off`) || true

export const on = () => run(`networksetup -setairportpower ${device} on`) || true

export const restart = () => off() && on()
