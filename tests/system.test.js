import { vi, describe, it, expect } from 'vitest'

vi.mock('../support.js', () => ({
  run: vi.fn(() => 'en0'),
  tryRun: vi.fn(() => ''),
}))

import { run, tryRun } from '../support.js'
import { device, hardwareMac } from '../system.js'

describe('device', () => {
  it('returns the detected interface', () => {
    expect(device).toBe('en0')
  })

  it('falls back to en0 when interface detection fails', async () => {
    vi.resetModules()
    vi.doMock('../support.js', () => ({
      run: vi.fn(() => ''),
      tryRun: vi.fn(() => ''),
    }))
    const { device } = await import('../system.js')
    expect(device).toBe('en0')
  })
})

describe('hardwareMac', () => {
  it('parses MAC from networksetup output', () => {
    expect(hardwareMac).toBe('')
  })

  it('falls back to ifconfig when MAC not in networksetup output', async () => {
    vi.resetModules()
    vi.doMock('../support.js', () => ({
      run: vi.fn(() => 'en0'),
      tryRun: vi.fn((cmd) => cmd.includes('ifconfig') ? 'aa:bb:cc:dd:ee:ff' : ''),
    }))
    const { hardwareMac } = await import('../system.js')
    expect(hardwareMac).toBe('aa:bb:cc:dd:ee:ff')
  })

  it('parses MAC from networksetup output', async () => {
    vi.resetModules()
    vi.doMock('../support.js', () => ({
      run: vi.fn(() => 'en0'),
      tryRun: vi.fn(() => 'Wi-Fi\nDevice: en0\nEthernet Address: aa:bb:cc:dd:ee:ff'),
    }))
    const { hardwareMac } = await import('../system.js')
    expect(hardwareMac).toBe('aa:bb:cc:dd:ee:ff')
  })
})
