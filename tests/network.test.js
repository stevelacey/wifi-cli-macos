import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../support.js", () => ({
  run: vi.fn(() => "en0"),
  tryRun: vi.fn(() => ""),
  waitFor: vi.fn(async (fn) => fn()),
}))

vi.mock("../system.js", () => ({
  device: "en0",
  hardwareMac: "aa:bb:cc:dd:ee:ff",
}))

vi.mock("../wifi.js", () => ({
  restart: vi.fn(),
}))

import { getDhcpDns, getDhcpRouter, getDns, getIp, getMac, getRouter, isDhcp, setDns, setIp, setMac, setRouter } from "../network.js"
import { run, tryRun, waitFor } from "../support.js"

beforeEach(() => {
  run.mockReturnValue("")
  tryRun.mockReturnValue("")
})

describe("getDhcpDns", () => {
  it("calls ipconfig with device", () => {
    getDhcpDns()
    expect(tryRun).toHaveBeenCalledWith(`ipconfig getpacket en0`)
  })

  it("parses DNS from ipconfig getpacket output", () => {
    tryRun.mockReturnValue("domain_name_server (ip_mult): { 1.1.1.1, 1.0.0.1 }")
    expect(getDhcpDns()).toBe("1.1.1.1 1.0.0.1")
  })

  it("returns empty string when no DNS in output", () => {
    tryRun.mockReturnValue("some other output")
    expect(getDhcpDns()).toBe("")
  })
})

describe("getDhcpRouter", () => {
  it("parses router from ipconfig getpacket output", () => {
    tryRun.mockReturnValue("router (ip_mult): { 192.168.1.1 }")
    expect(getDhcpRouter()).toBe("192.168.1.1")
  })

  it("returns empty string when no router in output", () => {
    expect(getDhcpRouter()).toBe("")
  })
})

describe("getDns", () => {
  it("calls networksetup -getdnsservers", () => {
    getDns()
    expect(tryRun).toHaveBeenCalledWith("networksetup -getdnsservers Wi-Fi")
  })

  it("returns empty string when no custom DNS set", () => {
    tryRun.mockReturnValue("There aren't any DNS Servers set on Wi-Fi.")
    expect(getDns()).toBe("")
  })

  it("returns space-joined DNS servers", () => {
    tryRun.mockReturnValue("1.1.1.1\n1.0.0.1")
    expect(getDns()).toBe("1.1.1.1 1.0.0.1")
  })
})

describe("getIp", () => {
  it("calls tryRun with ipconfig getifaddr", () => {
    tryRun.mockReturnValue("192.168.1.100")
    expect(getIp()).toBe("192.168.1.100")
    expect(tryRun).toHaveBeenCalledWith(`ipconfig getifaddr en0`)
  })
})

describe("getMac", () => {
  it("calls tryRun with ifconfig ether", () => {
    tryRun.mockReturnValue("aa:bb:cc:dd:ee:ff")
    expect(getMac()).toBe("aa:bb:cc:dd:ee:ff")
    expect(tryRun).toHaveBeenCalledWith(`ifconfig en0 | awk '/ether/{print $2}'`)
  })
})

describe("getRouter", () => {
  it("falls back to getDhcpRouter as last resort", () => {
    tryRun.mockReturnValueOnce("")
    tryRun.mockReturnValueOnce("")
    tryRun.mockReturnValueOnce("router (ip): { 192.168.1.1 }")
    expect(getRouter()).toBe("192.168.1.1")
  })

  it("falls back to networksetup -getinfo", () => {
    tryRun.mockReturnValueOnce("")
    tryRun.mockReturnValueOnce("192.168.1.1")
    expect(getRouter()).toBe("192.168.1.1")
  })

  it("returns route command result when available", () => {
    tryRun.mockReturnValueOnce("192.168.1.1")
    expect(getRouter()).toBe("192.168.1.1")
    expect(tryRun).toHaveBeenCalledWith("route -n get default | awk '/gateway/{print $2}'")
  })
})

describe("isDhcp", () => {
  it("returns false when manual IP configured", () => {
    tryRun.mockReturnValue("Manual\nIP address: 10.0.0.1")
    expect(isDhcp()).toBe(false)
  })

  it("returns true when not manual", () => {
    tryRun.mockReturnValue("IP address: 192.168.1.100\nSubnet mask: 255.255.255.0")
    expect(isDhcp()).toBe(true)
  })
})

describe("setDns", () => {
  it("calls networksetup -setdnsservers with servers joined by space", () => {
    setDns(["1.1.1.1", "1.0.0.1"])
    expect(run).toHaveBeenCalledWith("networksetup -setdnsservers Wi-Fi 1.1.1.1 1.0.0.1")
  })

  it("returns current DNS after setting", () => {
    tryRun.mockReturnValue("8.8.8.8")
    expect(setDns(["8.8.8.8"])).toBe("8.8.8.8")
  })
})

describe("setIp", () => {
  it('calls setdhcp for "auto"', async () => {
    await setIp("auto")
    expect(run).toHaveBeenCalledWith("networksetup -setdhcp Wi-Fi")
  })

  it('calls setdhcp for "reset"', async () => {
    await setIp("reset")
    expect(run).toHaveBeenCalledWith("networksetup -setdhcp Wi-Fi")
  })

  it("calls setmanualwithdhcprouter for an IP address", async () => {
    await setIp("10.0.0.5")
    expect(run).toHaveBeenCalledWith("networksetup -setmanualwithdhcprouter Wi-Fi 10.0.0.5")
  })

  it("waits for IP via waitFor", async () => {
    waitFor.mockResolvedValue("10.0.0.5")
    expect(await setIp("10.0.0.5")).toBe("10.0.0.5")
    expect(waitFor).toHaveBeenCalled()
  })
})

describe("setMac", () => {
  it("applies new MAC when different from current", () => {
    tryRun.mockReturnValueOnce("aa:bb:cc:dd:ee:ff").mockReturnValueOnce("11:22:33:44:55:66")
    setMac("11:22:33:44:55:66")
    expect(run).toHaveBeenCalledWith(`sudo ifconfig en0 ether 11:22:33:44:55:66`)
  })

  it('resolves "auto" to hardwareMac', () => {
    tryRun.mockReturnValue("aa:bb:cc:dd:ee:ff")
    setMac("auto")
    expect(run).not.toHaveBeenCalledWith(expect.stringContaining("ifconfig"))
  })

  it("returns current MAC when already set to target", () => {
    tryRun.mockReturnValue("aa:bb:cc:dd:ee:ff")
    expect(setMac("aa:bb:cc:dd:ee:ff")).toBe("aa:bb:cc:dd:ee:ff")
    expect(run).not.toHaveBeenCalledWith(expect.stringContaining("ifconfig"))
  })
})

describe("setRouter", () => {
  it("calls networksetup -setmanual with current IP and gateway", async () => {
    tryRun.mockReturnValue("192.168.1.50")
    await setRouter("192.168.1.1")
    expect(run).toHaveBeenCalledWith("networksetup -setmanual Wi-Fi 192.168.1.50 255.255.255.0 192.168.1.1")
  })

  it("returns null when no gateway provided", async () => {
    expect(await setRouter(null)).toBeNull()
    expect(await setRouter("")).toBeNull()
  })

  it("skips run when no current IP", async () => {
    await setRouter("192.168.1.1")
    expect(run).not.toHaveBeenCalled()
  })

  it("waits for router via waitFor", async () => {
    tryRun.mockReturnValue("192.168.1.50")
    waitFor.mockResolvedValue("192.168.1.1")
    expect(await setRouter("192.168.1.1")).toBe("192.168.1.1")
  })
})
