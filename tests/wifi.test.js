import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../support.js", () => ({
  execSync: vi.fn(() => Buffer.from("secret-password")),
  run: vi.fn(() => "en0"),
  spawn: vi.fn(() => ({ stdout: { on: vi.fn() }, on: vi.fn() })),
  tryRun: vi.fn(() => ""),
}))

vi.mock("../system.js", () => ({
  device: "en0",
}))

import { execSync, run, spawn, tryRun } from "../support.js"
import { findPassword, getSavedNetworks, isPrivateRelay, networkQuality, off, on, restart } from "../wifi.js"

beforeEach(() => {
  run.mockReturnValue("")
  tryRun.mockReturnValue("")
})

describe("findPassword", () => {
  it("returns password when found in keychain", () => {
    expect(findPassword("MyNetwork")).toBe("secret-password")
    expect(execSync).toHaveBeenCalledWith('security find-generic-password -ga "MyNetwork" -w 2>/dev/null')
  })

  it("returns empty string when not found", () => {
    execSync.mockImplementationOnce(() => {
      throw new Error("not found")
    })
    expect(findPassword("MyNetwork")).toBe("")
  })
})

describe("getSavedNetworks", () => {
  it("filters blank lines", () => {
    tryRun.mockReturnValue("Preferred networks on en0:\n\tNet1\n\t\n\tNet2")
    expect(getSavedNetworks()).toEqual(["Net1", "Net2"])
  })

  it("returns empty array when no saved networks", () => {
    tryRun.mockReturnValue("Preferred networks on en0:")
    expect(getSavedNetworks()).toEqual([])
  })

  it("returns list of saved networks", () => {
    tryRun.mockReturnValue("Preferred networks on en0:\n\tHomeNetwork\n\tWorkNetwork")
    expect(getSavedNetworks()).toEqual(["HomeNetwork", "WorkNetwork"])
  })
})

describe("isPrivateRelay", () => {
  it("returns false when disabled", () => {
    tryRun.mockReturnValue("Enabled: No\nServer: localhost")
    expect(isPrivateRelay()).toBe(false)
  })

  it("returns false when no localhost", () => {
    tryRun.mockReturnValue("Enabled: Yes\nServer: proxy.example.com")
    expect(isPrivateRelay()).toBe(false)
  })

  it("returns true when private relay is enabled", () => {
    tryRun.mockReturnValue("Enabled: Yes\nServer: localhost\nPort: 0")
    expect(isPrivateRelay()).toBe(true)
  })
})

describe("networkQuality", () => {
  it("spawns networkQuality with -c flag", () => {
    networkQuality()
    expect(spawn).toHaveBeenCalledWith("networkQuality", ["-c"])
  })

  it("returns the spawned process", () => {
    const proc = { stdout: { on: vi.fn() }, on: vi.fn() }
    spawn.mockReturnValueOnce(proc)
    expect(networkQuality()).toBe(proc)
  })
})

describe("off", () => {
  it("calls networksetup -setairportpower off", () => {
    expect(off()).toBe(true)
    expect(run).toHaveBeenCalledWith(`networksetup -setairportpower en0 off`)
  })
})

describe("on", () => {
  it("calls networksetup -setairportpower on", () => {
    expect(on()).toBe(true)
    expect(run).toHaveBeenCalledWith(`networksetup -setairportpower en0 on`)
  })
})

describe("restart", () => {
  it("calls off then on", () => {
    restart()
    expect(run).toHaveBeenCalledWith(`networksetup -setairportpower en0 off`)
    expect(run).toHaveBeenCalledWith(`networksetup -setairportpower en0 on`)
  })
})
