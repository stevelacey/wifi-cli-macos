import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../support.js", () => ({
  basePath: vi.fn((...args) => `/mock/${args.join("/")}`),
  exec: vi.fn(),
  execSync: vi.fn(() => Buffer.from("granted")),
  run: vi.fn(() => ""),
  spawn: vi.fn(() => ({ pid: 123 })),
  spawnSync: vi.fn(() => ({ status: 0 })),
}))

import { check, connect, current, disconnect, forget, scan } from "../scanner.js"
import { basePath, exec, execSync, run, spawn, spawnSync } from "../support.js"

const BIN = "/mock/build/wifi-scanner.app/Contents/MacOS/wifi-scanner"

beforeEach(() => {
  basePath.mockImplementation((...args) => `/mock/${args.join("/")}`)
  execSync.mockReturnValue(Buffer.from("granted"))
  run.mockReturnValue("")
})

describe("connect", () => {
  it("omits falsy password", () => {
    connect("Net", null)
    expect(spawn).toHaveBeenCalledWith(BIN, ["connect", "Net"], {
      stdio: "pipe",
    })
  })

  it("omits password when not provided", () => {
    connect("OpenNetwork")
    expect(spawn).toHaveBeenCalledWith(BIN, ["connect", "OpenNetwork"], {
      stdio: "pipe",
    })
  })

  it("spawns with connect command and ssid+password", () => {
    connect("MyNetwork", "secret")
    expect(spawn).toHaveBeenCalledWith(BIN, ["connect", "MyNetwork", "secret"], {
      stdio: "pipe",
    })
  })
})

describe("current", () => {
  it("returns empty string on error", () => {
    execSync.mockImplementation(() => {
      throw new Error("fail")
    })
    expect(current()).toBe("")
  })

  it("returns trimmed SSID from execSync", () => {
    execSync.mockReturnValue(Buffer.from("  MyNetwork  "))
    expect(current()).toBe("MyNetwork")
    expect(execSync).toHaveBeenCalledWith(`"${BIN}" current`, {
      timeout: 5000,
    })
  })
})

describe("disconnect", () => {
  it("calls spawnSync with disconnect command", () => {
    disconnect()
    expect(spawnSync).toHaveBeenCalledWith(BIN, ["disconnect"], {
      stdio: "pipe",
    })
  })
})

describe("check", () => {
  it("builds scanner when binary missing but xcode present", () => {
    run.mockImplementationOnce(() => {
      throw new Error("not executable")
    })
    run.mockReturnValue("")
    execSync.mockReturnValue(Buffer.from("granted"))
    check()
    expect(run).toHaveBeenCalledWith(expect.stringContaining("build-scanner"))
  })

  it("returns false when binary not ready and xcode not installed", () => {
    run.mockImplementationOnce(() => {
      throw new Error("not executable")
    })
    run.mockImplementationOnce(() => {
      throw new Error("no xcode")
    })
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(check()).toBe(false)
    spy.mockRestore()
  })

  it("returns false when permission denied and request fails", () => {
    run.mockReturnValue("")
    execSync.mockReturnValueOnce(Buffer.from("denied")).mockImplementationOnce(() => {
      throw new Error("denied")
    })
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(check()).toBe(false)
    spy.mockRestore()
  })

  it("returns false when check command throws", () => {
    run.mockReturnValue("")
    execSync
      .mockImplementationOnce(() => {
        throw new Error("check failed")
      })
      .mockReturnValueOnce(Buffer.from(""))
    expect(check()).toBe(true)
  })

  it("returns true when binary is ready and permission granted", () => {
    expect(check()).toBe(true)
  })

  it("returns true when permission granted after request", () => {
    execSync.mockReturnValueOnce(Buffer.from("denied")).mockReturnValueOnce(Buffer.from(""))
    expect(check()).toBe(true)
  })
})

describe("forget", () => {
  it("calls spawnSync with forget and ssid", () => {
    forget("OldNetwork")
    expect(spawnSync).toHaveBeenCalledWith(BIN, ["forget", "OldNetwork"], {
      stdio: "pipe",
    })
  })
})

describe("scan", () => {
  it("calls exec with scan command and 15s timeout", () => {
    const cb = vi.fn()
    scan(cb)
    expect(exec).toHaveBeenCalledWith(`"${BIN}" scan`, { timeout: 15000 }, cb)
  })
})
