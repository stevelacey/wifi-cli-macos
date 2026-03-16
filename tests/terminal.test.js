import colors from "colors"
import { describe, expect, it, vi } from "vitest"

vi.mock("qrcode-terminal", () => ({
  default: {
    generate: vi.fn((_uri, _opts, cb) => cb("MOCK_QR_OUTPUT")),
  },
}))

import qrcode from "qrcode-terminal"
import { formatBars, formatHelp, formatLabel, formatNetwork, formatQr, print, subcommandTerm, table, withDefault, write } from "../terminal.js"

const strip = colors.strip.bind(colors)

Object.defineProperty(process.stdout, "isTTY", {
  get: () => false,
  configurable: true,
})

describe("formatHelp", () => {
  const makeCmd = ({ name, usage = "", description = "", parent = null, alias } = {}) => ({
    parent,
    name: () => name,
    usage: () => usage,
    description: () => description,
    alias: () => alias,
    registeredArguments: [],
  })

  const makeHelper = ({ opts = [], cmds = [] } = {}) => ({
    visibleOptions: () => opts,
    visibleCommands: () => cmds,
    subcommandTerm: (c) => c.name(),
    subcommandDescription: (c) => c.description(),
  })

  it("renders subcommand help with description", () => {
    const cmd = makeCmd({
      name: "connect",
      usage: "[network]",
      description: "Connect to a network",
      parent: {},
    })
    const helper = makeHelper({
      opts: [{ flags: "--verbose", description: "Verbose output" }],
    })
    const result = strip(formatHelp(cmd, helper))
    expect(result).toContain("wifi connect")
    expect(result).toContain("Connect to a network")
    expect(result).toContain("--verbose")
  })

  it("renders subcommand help without description", () => {
    const cmd = makeCmd({
      name: "restart",
      usage: "",
      description: "",
      parent: {},
    })
    const helper = makeHelper({
      opts: [{ flags: "--help", description: "Show help" }],
    })
    const result = strip(formatHelp(cmd, helper))
    expect(result).toContain("wifi restart")
    expect(result).not.toContain("undefined")
  })

  it("renders root help with commands sorted alphabetically", () => {
    const cmds = [makeCmd({ name: "list", description: "List networks" }), makeCmd({ name: "connect", description: "Connect" })]
    const helper = makeHelper({ cmds })
    const result = strip(formatHelp(makeCmd({ name: "wifi" }), helper))
    expect(result.indexOf("connect")).toBeLessThan(result.indexOf("list"))
    expect(result).toContain("connect")
    expect(result).toContain("list")
  })
})

describe("formatLabel", () => {
  it("converts camelCase to Title Case", () => {
    expect(formatLabel("ipAddress")).toBe("Ip address")
    expect(formatLabel("dnsServers")).toBe("Dns servers")
    expect(formatLabel("isDhcp")).toBe("Is dhcp")
  })

  it("handles single lowercase word", () => {
    expect(formatLabel("router")).toBe("Router")
  })

  it("uppercases short keys (≤3 chars)", () => {
    expect(formatLabel("ip")).toBe("IP")
    expect(formatLabel("dns")).toBe("DNS")
    expect(formatLabel("mac")).toBe("MAC")
  })
})

describe("print", () => {
  it("calls console.log", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {})
    print("hello", 42)
    expect(spy).toHaveBeenCalledWith("hello", 42)
  })
})

describe("formatBars", () => {
  const cases = [
    { rssi: -50, bars: 7, color: "green" },
    { rssi: -57, bars: 6, color: "green" },
    { rssi: -62, bars: 5, color: "green" },
    { rssi: -68, bars: 4, color: "yellow" },
    { rssi: -71, bars: 3, color: "red" },
    { rssi: -77, bars: 2, color: "red" },
    { rssi: -85, bars: 1, color: "red" },
    { rssi: -95, bars: 0, color: "red" },
  ]

  for (const { rssi, bars, color } of cases) {
    it(`rssi ${rssi} → ${bars} bars, ${color}`, () => {
      const result = formatBars(rssi)
      expect(result.color).toBe(color)
      expect(strip(result.signal).replace(/\s/g, "").length).toBe(bars)
    })
  }

  it("returns colored signal in TTY mode", () => {
    colors.enabled = true
    vi.spyOn(process.stdout, "isTTY", "get").mockReturnValue(true)
    const { signal } = formatBars(-50)
    expect(signal).not.toBe(strip(signal))
    colors.enabled = false
  })
})

describe("formatNetwork", () => {
  const networks = [
    { ssid: "HomeNet", rssi: -50, security: "WPA2", band: "5 GHz" },
    { ssid: "LongerNetworkName", rssi: -75, security: "WPA2", band: "2.4 GHz" },
  ]

  it("handles missing band and security", () => {
    const nets = [{ ssid: "Open", rssi: -60, security: "", band: "" }]
    const result = strip(formatNetwork(nets[0], nets))
    expect(result).toContain("Open")
  })

  it("includes band and security in output", () => {
    const result = strip(formatNetwork(networks[0], networks))
    expect(result).toContain("5 GHz")
    expect(result).toContain("WPA2")
  })

  it("includes ssid in output", () => {
    expect(strip(formatNetwork(networks[0], networks))).toContain("HomeNet")
  })

  it("pads ssid to max length across networks", () => {
    const maxLen = "LongerNetworkName".length
    expect(strip(formatNetwork(networks[0], networks)).startsWith("HomeNet".padEnd(maxLen))).toBe(true)
    expect(strip(formatNetwork(networks[1], networks)).startsWith("LongerNetworkName")).toBe(true)
  })

  it("selects max ssid length when first network is longer", () => {
    const reversed = [networks[1], networks[0]]
    const result = strip(formatNetwork(networks[0], reversed))
    expect(result.startsWith("HomeNet".padEnd("LongerNetworkName".length))).toBe(true)
  })
})

describe("formatQr", () => {
  it("escapes special characters in ssid and password", () => {
    let capturedUri
    qrcode.generate.mockImplementation((uri, _opts, cb) => {
      capturedUri = uri
      cb("QR")
    })
    formatQr("Net;Name", 'pass"word')
    expect(capturedUri).toContain("S:Net\\;Name")
    expect(capturedUri).toContain('P:pass\\"word')
  })

  it("generates nopass URI when no password", () => {
    let capturedUri
    qrcode.generate.mockImplementation((uri, _opts, cb) => {
      capturedUri = uri
      cb("QR")
    })
    formatQr("OpenNet", "")
    expect(capturedUri).toBe("WIFI:T:nopass;S:OpenNet;;")
  })

  it("generates WPA URI for network with password", () => {
    let capturedUri
    qrcode.generate.mockImplementation((uri, _opts, cb) => {
      capturedUri = uri
      cb("QR")
    })
    formatQr("MyNetwork", "mypassword")
    expect(capturedUri).toBe("WIFI:T:WPA;S:MyNetwork;P:mypassword;;")
  })

  it("returns trimmed QR code output", () => {
    qrcode.generate.mockImplementation((_uri, _opts, cb) => cb("  QR_OUTPUT  "))
    expect(formatQr("Net", "pass")).toBe("QR_OUTPUT")
  })
})

describe("subcommandTerm", () => {
  const makeCmd = ({ name, alias, args = [] } = {}) => ({
    name: () => name,
    alias: () => alias,
    registeredArguments: args.map(({ n, required, variadic }) => ({
      name: () => n,
      required,
      variadic: variadic || false,
    })),
  })

  it("appends optional args in square brackets", () => {
    const cmd = makeCmd({
      name: "connect",
      args: [{ n: "network", required: false }],
    })
    expect(strip(subcommandTerm(cmd))).toBe("connect [network]")
  })

  it("appends required args in angle brackets", () => {
    const cmd = makeCmd({
      name: "connect",
      args: [{ n: "network", required: true }],
    })
    expect(strip(subcommandTerm(cmd))).toBe("connect <network>")
  })

  it("appends variadic marker to optional arg", () => {
    const cmd = makeCmd({
      name: "dns",
      args: [{ n: "servers", required: false, variadic: true }],
    })
    expect(strip(subcommandTerm(cmd))).toBe("dns [servers...]")
  })

  it("appends variadic marker to required arg", () => {
    const cmd = makeCmd({
      name: "cmd",
      args: [{ n: "items", required: true, variadic: true }],
    })
    expect(strip(subcommandTerm(cmd))).toBe("cmd <items...>")
  })

  it("includes alias in parens when present", () => {
    const cmd = makeCmd({ name: "list", alias: "ls" })
    expect(strip(subcommandTerm(cmd))).toBe("list (ls)")
  })

  it("returns command name without alias", () => {
    const cmd = makeCmd({ name: "list" })
    expect(strip(subcommandTerm(cmd))).toBe("list")
  })
})

describe("table", () => {
  it("filters out falsy values", () => {
    const result = strip(table({ ip: "10.0.0.1", mac: "", dns: null }))
    expect(result).toContain("IP:")
    expect(result).not.toContain("Mac:")
    expect(result).not.toContain("Dns:")
  })

  it("formats key-value rows", () => {
    const result = strip(table({ ip: "192.168.1.1", dns: "1.1.1.1" }))
    expect(result).toContain("IP:")
    expect(result).toContain("192.168.1.1")
    expect(result).toContain("DNS:")
    expect(result).toContain("1.1.1.1")
  })

  it("pads keys to equal width", () => {
    const result = strip(table({ ip: "a", router: "b" }))
    const lines = result.split("\n")
    const valuePositions = lines.map((l) => (l.indexOf("a") !== -1 ? l.indexOf("a") : l.indexOf("b")))
    expect(new Set(valuePositions).size).toBe(1)
  })
})

describe("withDefault", () => {
  it("appends default hint when value differs", () => {
    const result = strip(withDefault("8.8.8.8", "1.1.1.1"))
    expect(result).toContain("8.8.8.8")
    expect(result).toContain("(default: 1.1.1.1)")
  })

  it("returns plain value when no default given", () => {
    expect(strip(withDefault("8.8.8.8", null))).toBe("8.8.8.8")
    expect(strip(withDefault("8.8.8.8", ""))).toBe("8.8.8.8")
  })

  it("returns plain value when same as default", () => {
    expect(strip(withDefault("1.1.1.1", "1.1.1.1"))).toBe("1.1.1.1")
  })
})

describe("write", () => {
  it("calls process.stdout.write", () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => {})
    write("hello")
    expect(process.stdout.write).toHaveBeenCalledWith("hello")
  })
})
