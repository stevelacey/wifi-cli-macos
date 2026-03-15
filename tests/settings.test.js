import { describe, it, expect } from 'vitest'
import colors from 'colors'
import { dnsPresets, name, version } from '../settings.js'
import pkg from '../package.json' with { type: 'json' }

describe('dnsPresets', () => {
  it('all presets have exactly 2 servers', () => {
    for (const servers of Object.values(dnsPresets)) {
      expect(servers).toHaveLength(2)
    }
  })

  it('all servers are valid IP format', () => {
    const ipPattern = /^\d+\.\d+\.\d+\.\d+$/
    for (const servers of Object.values(dnsPresets)) {
      for (const server of servers) {
        expect(server).toMatch(ipPattern)
      }
    }
  })

  it('has cloudflare preset', () => {
    expect(dnsPresets.cloudflare).toEqual(['1.1.1.1', '1.0.0.1'])
  })

  it('has google preset', () => {
    expect(dnsPresets.google).toEqual(['8.8.8.8', '8.8.4.4'])
  })

  it('has opendns preset', () => {
    expect(dnsPresets.opendns).toEqual(['208.67.222.222', '208.67.220.220'])
  })

  it('has quad9 preset', () => {
    expect(dnsPresets.quad9).toEqual(['9.9.9.9', '149.112.112.112'])
  })
})

describe('name', () => {
  it('contains Wi-Fi CLI MacOS', () => {
    expect(colors.strip(name)).toContain('Wi-Fi CLI MacOS')
  })

  it('contains the package version', () => {
    expect(colors.strip(name)).toContain(`v${pkg.version}`)
  })
})

describe('version', () => {
  it('matches package.json version', () => {
    expect(version).toBe(pkg.version)
  })
})
