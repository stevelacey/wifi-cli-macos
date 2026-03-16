import { vi, describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'

const mockActions = {}

vi.mock('commander', () => {
  const makeCmd = (spec) => {
    const name = spec.split(/[\s[<]/)[0]
    const cmd = {
      alias: () => cmd,
      summary: () => cmd,
      description: () => cmd,
      action: (fn) => { mockActions[name] = fn; return cmd },
    }
    return cmd
  }
  const program = {
    name: () => program,
    addHelpCommand: () => program,
    configureHelp: () => program,
    version: () => program,
    command: (spec) => makeCmd(spec),
    parse: () => {},
  }
  return { program }
})

vi.mock('../scanner.js', () => ({
  connect: vi.fn(() => ({ on: vi.fn() })),
  current: vi.fn(() => 'HomeNet'),
  disconnect: vi.fn(),
  check: vi.fn(() => true),
  forget: vi.fn(),
  scan: vi.fn((cb) => cb(null, JSON.stringify({
    networks: [
      { ssid: 'HomeNet', rssi: -50, security: 'WPA2', band: '5 GHz' },
      { ssid: 'WorkNet', rssi: -70, security: 'WPA2', band: '2.4 GHz' },
    ],
    current: 'HomeNet',
    hotspots: [],
  }))),
}))

vi.mock('../system.js', () => ({
  device: 'en0',
  hardwareMac: 'aa:bb:cc:dd:ee:ff',
}))

vi.mock('../network.js', () => ({
  findPassword: vi.fn(() => 'secret-password'),
  getDhcpDns: vi.fn(() => '192.168.1.1'),
  getDhcpRouter: vi.fn(() => '192.168.1.1'),
  getDns: vi.fn(() => '1.1.1.1 1.0.0.1'),
  getIp: vi.fn(() => '10.0.0.5'),
  getMac: vi.fn(() => 'aa:bb:cc:dd:ee:ff'),
  getRouter: vi.fn(() => '192.168.1.1'),
  getSavedNetworks: vi.fn(() => ['HomeNet', 'WorkNet']),
  isDhcp: vi.fn(() => true),
  isPrivateRelay: vi.fn(() => false),
  off: vi.fn(() => true),
  on: vi.fn(() => true),
  restart: vi.fn(),
  setDns: vi.fn(() => '8.8.8.8 8.8.4.4'),
  setIp: vi.fn(async (ip) => ip === 'auto' ? '10.0.0.5' : ip),
  setMac: vi.fn((mac) => mac === 'auto' ? 'aa:bb:cc:dd:ee:ff' : mac),
  networkQuality: vi.fn(() => ({ stdout: { on: vi.fn() }, on: vi.fn() })),
  setRouter: vi.fn(async (r) => r),
}))

vi.mock('../support.js', () => ({
  randomMac: vi.fn(() => '02:ab:cd:ef:01:23'),
}))

vi.mock('../prompts.js', () => ({
  isCancel: vi.fn(() => false),
  multiselect: vi.fn(async () => []),
  password: vi.fn(async () => ''),
  select: vi.fn(async () => null),
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
}))

import * as scanner from '../scanner.js'
import * as network from '../network.js'
import * as prompts from '../prompts.js'
import * as support from '../support.js'

beforeAll(() => import('../index.js'))

beforeEach(() => {
  scanner.check.mockReturnValue(true)
  scanner.current.mockReturnValue('HomeNet')
  scanner.scan.mockImplementation((cb) => cb(null, JSON.stringify({
    networks: [
      { ssid: 'HomeNet', rssi: -50, security: 'WPA2', band: '5 GHz' },
      { ssid: 'WorkNet', rssi: -70, security: 'WPA2', band: '2.4 GHz' },
    ],
    current: 'HomeNet',
    hotspots: [],
  })))
  network.getDhcpDns.mockReturnValue('192.168.1.1')
  network.getDhcpRouter.mockReturnValue('192.168.1.1')
  network.getDns.mockReturnValue('1.1.1.1 1.0.0.1')
  network.getIp.mockReturnValue('10.0.0.5')
  network.getMac.mockReturnValue('aa:bb:cc:dd:ee:ff')
  network.getRouter.mockReturnValue('192.168.1.1')
  network.getSavedNetworks.mockReturnValue(['HomeNet', 'WorkNet'])
  network.isDhcp.mockReturnValue(true)
  network.isPrivateRelay.mockReturnValue(false)
  network.off.mockReturnValue(true)
  network.on.mockReturnValue(true)
  support.randomMac.mockReturnValue('02:ab:cd:ef:01:23')
  network.setDns.mockReturnValue('8.8.8.8 8.8.4.4')
  network.setIp.mockImplementation(async (ip) => ip === 'auto' ? '10.0.0.5' : ip)
  network.setMac.mockImplementation((mac) => mac === 'auto' ? 'aa:bb:cc:dd:ee:ff' : mac)
  network.findPassword.mockReturnValue('secret-password')
  network.networkQuality.mockReturnValue({ stdout: { on: vi.fn() }, on: vi.fn() })
  network.setRouter.mockImplementation(async (r) => r)
  prompts.isCancel.mockReset()
  prompts.isCancel.mockReturnValue(false)
  prompts.multiselect.mockReset()
  prompts.multiselect.mockResolvedValue([])
  prompts.password.mockReset()
  prompts.password.mockResolvedValue('')
  prompts.select.mockReset()
  prompts.select.mockResolvedValue(null)
  prompts.spinner.mockReturnValue({ start: vi.fn(), stop: vi.fn() })
  vi.spyOn(console, 'log').mockImplementation(() => {})
})


const run = async (cmd, ...args) => {
  await mockActions[cmd](...args)
  await new Promise(r => setTimeout(r, 0))
}

const output = () => console.log.mock.calls.map(args => args.join(' ')).join('\n')

describe('connect', () => {
  it('connects to named network on success', async () => {
    scanner.connect.mockReturnValue({ on: (e, cb) => { if (e === 'close') cb(0) } })
    await run('connect', 'WorkNet', 'pass')
    expect(scanner.connect).toHaveBeenCalledWith('WorkNet', 'pass')
  })

  it('stops with failure message when connect fails', async () => {
    scanner.connect.mockReturnValue({ on: (e, cb) => { if (e === 'close') cb(1) } })
    const s = { start: vi.fn(), stop: vi.fn() }
    prompts.spinner.mockReturnValue(s)
    await run('connect', 'WorkNet', 'pass')
    expect(s.stop).toHaveBeenCalledWith(expect.stringContaining('Failed'))
  })

  it('opens interactive selector when no network provided', async () => {
    prompts.select.mockResolvedValueOnce('HomeNet')
    await run('connect', undefined, undefined)
    expect(scanner.scan).toHaveBeenCalled()
  })

  it('prompts for password and connects to selected network', async () => {
    prompts.select.mockResolvedValueOnce('WorkNet')
    prompts.password.mockResolvedValueOnce('mypass')
    scanner.connect.mockReturnValue({ on: (e, cb) => { if (e === 'close') cb(0) } })
    await run('connect', undefined, undefined)
    expect(scanner.connect).toHaveBeenCalledWith('WorkNet', 'mypass')
  })

  it('cancels when password prompt is cancelled', async () => {
    prompts.select.mockResolvedValueOnce('WorkNet')
    prompts.isCancel.mockReturnValueOnce(false).mockReturnValueOnce(true)
    await run('connect', undefined, undefined)
    expect(scanner.connect).not.toHaveBeenCalled()
  })

  it('uses keychain password when password prompt is empty', async () => {
    prompts.select.mockResolvedValueOnce('WorkNet')
    prompts.password.mockResolvedValueOnce('')
    scanner.connect.mockReturnValue({ on: (e, cb) => { if (e === 'close') cb(0) } })
    vi.spyOn(process.stdout, 'write').mockImplementation(() => {})
    await run('connect', undefined, undefined)
    expect(scanner.connect).toHaveBeenCalledWith('WorkNet', 'secret-password')
    expect(process.stdout.write).toHaveBeenCalled()
  })

  it('connects without writing when no keychain password found', async () => {
    prompts.select.mockResolvedValueOnce('WorkNet')
    prompts.password.mockResolvedValueOnce('')
    network.findPassword.mockReturnValueOnce('')
    scanner.connect.mockReturnValue({ on: (e, cb) => { if (e === 'close') cb(0) } })
    vi.spyOn(process.stdout, 'write').mockImplementation(() => {})
    await run('connect', undefined, undefined)
    expect(process.stdout.write).not.toHaveBeenCalled()
  })

  it('does nothing when scan fails with no network', async () => {
    scanner.scan.mockImplementationOnce((cb) => cb(new Error('scan failed'), null))
    await run('connect', undefined, undefined)
    expect(scanner.connect).not.toHaveBeenCalled()
  })

  it('shows no networks found when scan returns empty list', async () => {
    scanner.scan.mockImplementationOnce((cb) => cb(null, JSON.stringify({ networks: [], current: '', hotspots: [] })))
    await run('connect', undefined, undefined)
    expect(output()).toContain('No networks found')
  })

  it('retries connection when retry is enabled', async () => {
    vi.useFakeTimers()
    scanner.scan.mockImplementationOnce((cb) => cb(null, JSON.stringify({
      networks: [{ ssid: 'iPhone', rssi: -60, security: '', band: 'BLE', hotspot: true }],
      current: 'HomeNet',
      hotspots: [],
    })))
    prompts.select.mockResolvedValueOnce('iPhone')
    let callCount = 0
    scanner.connect.mockReturnValue({
      on: (e, cb) => { if (e === 'close') { callCount++; if (callCount === 1) cb(1); else cb(0) } },
    })
    const actionPromise = mockActions['connect'](undefined, undefined)
    await vi.advanceTimersByTimeAsync(2500)
    await actionPromise
    vi.useRealTimers()
    expect(scanner.connect).toHaveBeenCalledTimes(2)
  })

  it('connects as hotspot when selected network is a hotspot', async () => {
    scanner.scan.mockImplementationOnce((cb) => cb(null, JSON.stringify({
      networks: [{ ssid: 'iPhone', rssi: -60, security: '', band: 'BLE', hotspot: true }],
      current: 'HomeNet',
      hotspots: [],
    })))
    prompts.select.mockResolvedValueOnce('iPhone')
    prompts.password.mockResolvedValueOnce('')
    scanner.connect.mockReturnValue({ on: (e, cb) => { if (e === 'close') cb(0) } })
    await run('connect', undefined, undefined)
    expect(scanner.connect).toHaveBeenCalledWith('iPhone', '')
  })

  it('connects as hotspot when network is a hotspot', async () => {
    scanner.scan.mockImplementation((cb) => cb(null, JSON.stringify({
      networks: [],
      current: '',
      hotspots: [{ ssid: 'iPhone', rssi: -60, security: 'WPA2', band: 'BLE' }],
    })))
    scanner.connect.mockReturnValue({ on: (e, cb) => { if (e === 'close') cb(0) } })
    await run('connect', 'iPhone', '')
  })
})

describe('disconnect', () => {
  it('calls disconnect', async () => {
    await run('disconnect')
    expect(scanner.disconnect).toHaveBeenCalled()
  })

  it('does nothing when check fails', async () => {
    scanner.check.mockReturnValue(false)
    await run('disconnect')
    expect(scanner.disconnect).not.toHaveBeenCalled()
  })
})

describe('dns', () => {
  it('displays current DNS and presets', async () => {
    await run('dns', [])
    const out = output()
    expect(out).toContain('1.1.1.1 1.0.0.1')
    expect(out).toContain('cloudflare')
    expect(out).toContain('google')
  })

  it('shows dhcp dns when no custom dns set', async () => {
    network.getDns.mockReturnValue('')
    await run('dns', [])
    expect(output()).toContain('192.168.1.1')
  })

  it('sets DNS via preset name', async () => {
    await run('dns', ['cloudflare'])
    expect(network.setDns).toHaveBeenCalledWith(['1.1.1.1', '1.0.0.1'])
  })

  it('sets DNS with explicit servers', async () => {
    await run('dns', ['8.8.8.8', '8.8.4.4'])
    expect(network.setDns).toHaveBeenCalledWith(['8.8.8.8', '8.8.4.4'])
  })
})

describe('forget', () => {
  it('forgets a specific network', async () => {
    await run('forget', 'HomeNet')
    expect(scanner.forget).toHaveBeenCalledWith('HomeNet')
  })

  it('cancels when multiselect is cancelled', async () => {
    prompts.isCancel.mockReturnValueOnce(true)
    await run('forget', undefined)
    expect(scanner.forget).not.toHaveBeenCalled()
  })

  it('does not forget when check fails', async () => {
    scanner.check.mockReturnValue(false)
    await run('forget', 'HomeNet')
    expect(scanner.forget).not.toHaveBeenCalled()
  })

  it('forgets interactively selected networks', async () => {
    prompts.multiselect.mockResolvedValueOnce(['WorkNet'])
    await run('forget', undefined)
    expect(scanner.forget).toHaveBeenCalledWith('WorkNet')
  })

  it('shows no saved networks when list is empty', async () => {
    network.getSavedNetworks.mockReturnValue([])
    await run('forget', undefined)
    expect(output()).toContain('No saved networks')
  })
})

describe('info', () => {
  it('displays connection details when connected', async () => {
    await run('info')
    const out = output()
    expect(out).toContain('HomeNet')
    expect(out).toContain('10.0.0.5')
    expect(out).toContain('192.168.1.1')
    expect(out).toContain('aa:bb:cc:dd:ee:ff')
  })

  it('shows manual when not dhcp', async () => {
    network.isDhcp.mockReturnValue(false)
    await run('info')
    expect(output()).toContain('manual')
  })

  it('shows not connected when check fails', async () => {
    scanner.check.mockReturnValue(false)
    await run('info')
    expect(output()).toContain('Not connected')
  })

  it('shows not connected when no current network', async () => {
    scanner.current.mockReturnValue('')
    await run('info')
    expect(output()).toContain('Not connected')
  })

  it('omits ip row when no ip', async () => {
    network.getIp.mockReturnValue('')
    network.getDns.mockReturnValue('')
    await run('info')
    expect(output()).not.toContain('IP:')
  })
})

describe('ip', () => {
  it('displays current IP', async () => {
    await run('ip', undefined)
    expect(output()).toContain('10.0.0.5')
  })

  it('sets IP address', async () => {
    await run('ip', '10.0.0.10')
    expect(network.setIp).toHaveBeenCalledWith('10.0.0.10')
  })
})

describe('list', () => {
  it('lists nearby networks', async () => {
    await run('list')
    const out = output()
    expect(out).toContain('HomeNet')
    expect(out).toContain('WorkNet')
  })

  it('marks current network with ◀', async () => {
    await run('list')
    expect(output()).toContain('◀')
  })

  it('produces plain text output in non-TTY mode', async () => {
    await run('list')
    expect(output()).not.toMatch(/\x1b\[/)
  })

  it('does nothing when check fails', async () => {
    scanner.check.mockReturnValue(false)
    await run('list')
    expect(output()).toBe('')
  })

  it('does nothing when scan fails', async () => {
    scanner.scan.mockImplementationOnce((cb) => cb(new Error('scan failed'), null))
    await run('list')
    expect(output()).toBe('')
  })

  it('falls back to currentNetwork when scan returns no current', async () => {
    scanner.scan.mockImplementationOnce((cb) => cb(null, JSON.stringify({ networks: [
      { ssid: 'HomeNet', rssi: -50, security: 'WPA2', band: '5 GHz' },
    ], current: '', hotspots: [] })))
    await run('list')
    expect(output()).toContain('◀')
  })

  it('handles scan result with no networks or hotspots fields', async () => {
    scanner.scan.mockImplementationOnce((cb) => cb(null, JSON.stringify({ current: '' })))
    await run('list')
    expect(output()).toContain('No networks found')
  })

  it('shows no networks message when scan is empty', async () => {
    scanner.scan.mockImplementation((cb) => cb(null, JSON.stringify({ networks: [], current: '', hotspots: [] })))
    await run('list')
    expect(output()).toContain('No networks found')
  })

  it('includes BLE hotspot not already in networks', async () => {
    scanner.scan.mockImplementationOnce((cb) => cb(null, JSON.stringify({
      networks: [{ ssid: 'HomeNet', rssi: -50, security: 'WPA2', band: '5 GHz' }],
      current: 'HomeNet',
      hotspots: [{ ssid: 'iPhone', rssi: -60 }],
    })))
    await run('list')
    expect(output()).toContain('iPhone')
  })

  it('deduplicates BLE hotspot already in networks', async () => {
    scanner.scan.mockImplementationOnce((cb) => cb(null, JSON.stringify({
      networks: [{ ssid: 'iPhone', rssi: -60, security: 'WPA2', band: '5 GHz' }],
      current: '',
      hotspots: [{ ssid: 'iPhone', rssi: -60 }],
    })))
    await run('list')
    expect(output().split('iPhone')).toHaveLength(2)
  })
})

describe('mac', () => {
  it('displays current and hardware MAC', async () => {
    await run('mac', undefined)
    expect(output()).toContain('aa:bb:cc:dd:ee:ff')
  })

  it('rejects MAC change when private relay is on', async () => {
    network.isPrivateRelay.mockReturnValue(true)
    await run('mac', '02:11:22:33:44:55')
    expect(network.setMac).not.toHaveBeenCalled()
    expect(output()).toContain('Disable Private Relay')
  })

  it('sets MAC address', async () => {
    await run('mac', '02:11:22:33:44:55')
    expect(network.setMac).toHaveBeenCalledWith('02:11:22:33:44:55')
  })
})

describe('off', () => {
  it('turns Wi-Fi off', async () => {
    await run('off')
    expect(network.off).toHaveBeenCalled()
  })
})

describe('on', () => {
  it('turns Wi-Fi on', async () => {
    await run('on')
    expect(network.on).toHaveBeenCalled()
  })
})

describe('password', () => {
  it('displays password for given network', async () => {
    await run('password', 'HomeNet')
    expect(output()).toContain('secret-password')
  })

  it('uses current network when no network given', async () => {
    await run('password', undefined)
    expect(scanner.current).toHaveBeenCalled()
    expect(output()).toContain('secret-password')
  })
})

describe('qr', () => {
  it('displays network name and QR code', async () => {
    await run('qr')
    expect(output()).toContain('HomeNet')
  })

  it('shows not connected when no current network', async () => {
    scanner.current.mockReturnValue('')
    await run('qr')
    expect(output()).toContain('Not connected')
  })

  it('omits password line when no password found', async () => {
    network.findPassword.mockReturnValue('')
    await run('qr')
    expect(output()).not.toContain('Password:')
    expect(output()).toContain('HomeNet')
  })
})

describe('reset', () => {
  it('resets all settings', async () => {
    await run('reset', undefined)
    expect(network.setIp).toHaveBeenCalledWith('auto')
    expect(network.setDns).toHaveBeenCalled()
    expect(network.setRouter).toHaveBeenCalled()
    expect(network.setMac).toHaveBeenCalledWith('auto')
  })

  it('falls back to dhcp dns when setDns returns empty', async () => {
    network.setDns.mockReturnValue('')
    await run('reset', 'dns')
    expect(network.getDhcpDns).toHaveBeenCalled()
  })

  it('resets only DNS when target is dns', async () => {
    await run('reset', 'dns')
    expect(network.setDns).toHaveBeenCalled()
    expect(network.setIp).not.toHaveBeenCalled()
  })

  it('resets only IP when target is ip', async () => {
    await run('reset', 'ip')
    expect(network.setIp).toHaveBeenCalledWith('auto')
    expect(network.setMac).not.toHaveBeenCalled()
  })
})

describe('restart', () => {
  it('restarts Wi-Fi', async () => {
    await run('restart')
    expect(network.restart).toHaveBeenCalled()
  })
})

describe('router', () => {
  it('displays current router', async () => {
    await run('router', undefined)
    expect(output()).toContain('192.168.1.1')
  })

  it('sets router address', async () => {
    await run('router', '10.0.0.1')
    expect(network.setRouter).toHaveBeenCalledWith('10.0.0.1')
  })
})

describe('saved', () => {
  it('lists saved networks', async () => {
    await run('saved')
    const out = output()
    expect(out).toContain('HomeNet')
    expect(out).toContain('WorkNet')
  })

  it('marks current network with ◀', async () => {
    await run('saved')
    expect(output()).toContain('◀')
  })

  it('shows no saved networks message when empty', async () => {
    network.getSavedNetworks.mockReturnValue([])
    await run('saved')
    expect(output()).toContain('No saved networks')
  })
})

describe('spoof', () => {
  it('rejects spoofing when private relay is on', async () => {
    network.isPrivateRelay.mockReturnValue(true)
    await run('spoof')
    expect(network.setMac).not.toHaveBeenCalled()
    expect(output()).toContain('Disable Private Relay')
  })

  it('sets a random MAC address', async () => {
    await run('spoof')
    expect(network.setMac).toHaveBeenCalledWith('02:ab:cd:ef:01:23')
  })
})

describe('test', () => {
  it('displays speed result on success', async () => {
    const proc = {
      stdout: { on: vi.fn((e, cb) => { if (e === 'data') cb('{"dl_throughput":100000000,"ul_throughput":50000000,"base_rtt":20}') }) },
      on: vi.fn((e, cb) => { if (e === 'close') cb(0) }),
    }
    network.networkQuality.mockReturnValue(proc)
    await run('test')
    expect(output()).toContain('Mbps')
  })

  it('shows failure when exit code is non-zero', async () => {
    const s = { start: vi.fn(), stop: vi.fn() }
    prompts.spinner.mockReturnValue(s)
    const proc = {
      stdout: { on: vi.fn() },
      on: vi.fn((e, cb) => { if (e === 'close') cb(1) }),
    }
    network.networkQuality.mockReturnValue(proc)
    await run('test')
    expect(s.stop).toHaveBeenCalledWith('Speed test failed')
  })

  it('shows failure when output is not valid JSON', async () => {
    const s = { start: vi.fn(), stop: vi.fn() }
    prompts.spinner.mockReturnValue(s)
    const proc = {
      stdout: { on: vi.fn((e, cb) => { if (e === 'data') cb('not json') }) },
      on: vi.fn((e, cb) => { if (e === 'close') cb(0) }),
    }
    network.networkQuality.mockReturnValue(proc)
    await run('test')
    expect(s.stop).toHaveBeenCalledWith('Speed test failed')
  })

  it('omits latency when base_rtt is absent', async () => {
    const proc = {
      stdout: { on: vi.fn((e, cb) => { if (e === 'data') cb('{"dl_throughput":100000000,"ul_throughput":50000000}') }) },
      on: vi.fn((e, cb) => { if (e === 'close') cb(0) }),
    }
    network.networkQuality.mockReturnValue(proc)
    await run('test')
    expect(output()).not.toContain('ms')
  })
})
