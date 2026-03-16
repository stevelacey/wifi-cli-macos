import { vi, describe, it, expect } from 'vitest'

vi.mock('child_process', () => {
  const execSync = vi.fn(() => Buffer.from('  output  '))
  const exec = vi.fn()
  const spawn = vi.fn()
  const spawnSync = vi.fn()
  return { default: { execSync, exec, spawn, spawnSync } }
})

import child_process from 'child_process'
import { basePath, exec, execSync, randomMac, run, spawn, spawnSync, tryRun, waitFor } from '../support.js'


describe('basePath', () => {
  it('joins multiple segments', () => {
    expect(basePath('a', 'b', 'c')).toMatch(/a\/b\/c$/)
  })

  it('resolves relative to the project root', () => {
    expect(basePath('package.json')).toMatch(/wifi-cli-macos\/package\.json$/)
  })

  it('returns a path ending with the given segment', () => {
    expect(basePath('foo/bar')).toMatch(/foo\/bar$/)
  })
})

describe('randomMac', () => {
  it('returns a valid MAC address format', () => {
    expect(randomMac()).toMatch(/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/)
  })

  it('sets locally-administered unicast bit', () => {
    for (let i = 0; i < 20; i++) {
      const firstByte = parseInt(randomMac().split(':')[0], 16)
      expect(firstByte & 0x02).toBe(0x02)
      expect(firstByte & 0x01).toBe(0x00)
    }
  })
})

describe('re-exports', () => {
  it('exports exec from child_process', () => {
    expect(exec).toBe(child_process.exec)
  })

  it('exports execSync from child_process', () => {
    expect(execSync).toBe(child_process.execSync)
  })

  it('exports spawn from child_process', () => {
    expect(spawn).toBe(child_process.spawn)
  })

  it('exports spawnSync from child_process', () => {
    expect(spawnSync).toBe(child_process.spawnSync)
  })
})

describe('run', () => {
  it('calls execSync and trims output', () => {
    child_process.execSync.mockReturnValueOnce(Buffer.from('  hello world  '))
    expect(run('some-cmd')).toBe('hello world')
    expect(child_process.execSync).toHaveBeenCalledWith('some-cmd')
  })
})

describe('tryRun', () => {
  it('passes stdio options to suppress stderr', () => {
    child_process.execSync.mockReturnValueOnce(Buffer.from('ok'))
    tryRun('some-cmd')
    expect(child_process.execSync).toHaveBeenCalledWith('some-cmd', { stdio: ['pipe', 'pipe', 'pipe'] })
  })

  it('returns empty string on error', () => {
    child_process.execSync.mockImplementationOnce(() => { throw new Error('fail') })
    expect(tryRun('some-cmd')).toBe('')
  })

  it('returns trimmed output on success', () => {
    child_process.execSync.mockReturnValueOnce(Buffer.from('  result  '))
    expect(tryRun('some-cmd')).toBe('result')
  })
})

describe('waitFor', () => {
  it('polls until fn returns truthy', async () => {
    const fn = vi.fn().mockReturnValueOnce(null).mockReturnValueOnce(null).mockReturnValue('found')
    expect(await waitFor(fn, { interval: 10, timeout: 500 })).toBe('found')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('resolves after timeout with final fn result', async () => {
    const fn = vi.fn().mockReturnValue(null)
    expect(await waitFor(fn, { interval: 10, timeout: 30 })).toBeNull()
  })

  it('resolves immediately when fn returns truthy on first call', async () => {
    const fn = vi.fn().mockReturnValue('value')
    expect(await waitFor(fn)).toBe('value')
  })
})
