#!/usr/bin/env node
import 'colors'
import { connect, current, disconnect, ensure, forget, scan } from './scanner.js'
import { dnsPresets, name, version } from './settings.js'
import { execSync } from './support.js'
import { formatHelp, formatLabel, print, renderBars, renderNetwork, renderQr, subcommandTerm, table, withDefault } from './renderers.js'
import { getDhcpDns, getDhcpRouter, getDns, getIp, getMac, getRouter, hardwareMac, iface, isDhcp, isPrivateRelay, off, on, randomMac, restart, setDns, setIp, setMac, setRouter } from './network.js'
import { intro, isCancel, password, select, spinner } from '@clack/prompts'
import { program } from 'commander'

const connectNetwork = (ssid, pass, { message, retry, withGuide = true } = {}) => new Promise((resolve) => {
  const s = spinner({ withGuide })
  s.start(message || `Connecting to ${ssid}`)
  const attempt = () => {
    connect(ssid, pass).on('close', (code) => {
      if (code === 0) { s.stop(`Connected to ${ssid}`); resolve() }
      else if (retry) setTimeout(attempt, 2000)
      else { s.stop(`Failed to connect to ${ssid}`); resolve() }
    })
  }
  attempt()
})

const currentNetwork = () => { if (!ensure()) return ''; return current() }

const disconnectNetwork = () => { if (ensure()) disconnect() }

const findPassword = (ssid) => { try { return execSync(`security find-generic-password -ga "${ssid}" -w 2>/dev/null`).toString().trim() } catch { return '' } }

const forgetNetwork = (ssid) => { if (ensure()) forget(ssid) }

const getDnsServers = () => {
  const custom = getDns()
  const dhcp = getDhcpDns()
  const entries = Object.entries(dnsPresets)
  const maxLen = Math.max(...entries.map(([k]) => k.length))
  const presetLines = entries
    .map(([k, v]) => `  ${(k + ':').padEnd(maxLen + 1).green}  ${v.join(' ').white}`)
    .join('\n')
  print([
    table({ current: custom || dhcp, default: dhcp }),
    `${'Presets:'.yellow}\n${presetLines}`,
  ].join('\n'))
}

const getNetworks = () => {
  if (!ensure()) return
  return new Promise((resolve) => {
    scan((err, stdout) => {
      if (err) { resolve(null); return }
      const raw = JSON.parse(stdout.trim())
      const networks = (raw.networks || []).sort((a, b) => b.rssi - a.rssi)
      const current = raw.current || currentNetwork()
      const seen = new Set(networks.map(n => n.ssid))
      for (const h of (raw.hotspots || [])) {
        if (!seen.has(h.ssid)) networks.push({ ...h, band: 'BLE', security: 'WPA2/3', hotspot: true })
      }
      networks.sort((a, b) => b.rssi - a.rssi)
      resolve({ networks, current })
    })
  })
}

const listNetworks = async () => {
  const result = await getNetworks()
  if (!result) return
  const { networks, current } = result
  if (networks.length === 0) { print('No networks found'); return }
  print(networks.map(n => renderNetwork(n, networks) + (n.ssid === current ? ' ◀'.green : '')).join('\n'))
}

const selectNetwork = async (prefetched) => {
  const result = prefetched || await getNetworks()
  if (!result) return
  const { networks, current } = result
  if (networks.length === 0) { print('No networks found'); return }
  intro(name)
  const ssid = await select({
    message: 'Select a network to join',
    initialValue: current,
    maxItems: networks.length,
    options: networks.map(n => ({ label: '\x1b[0m' + renderNetwork(n, networks), value: n.ssid })),
  })
  if (isCancel(ssid) || ssid === current) return
  const network = networks.find(n => n.ssid === ssid)
  let pass = ''
  if (network && network.security) {
    const input = await password({ message: 'Password (leave blank to use keychain)' })
    if (isCancel(input)) return
    if (input) {
      pass = input
    } else {
      pass = findPassword(ssid)
      if (pass) process.stdout.write(`\x1b[1A\x1b[2K\r│  ${'▪'.repeat(pass.length)}\n`.grey)
    }
  }
  if (network && network.hotspot) {
    await connectNetwork(ssid, pass, { message: `Enable Personal Hotspot on your iPhone`, retry: true })
  } else {
    await connectNetwork(ssid, pass)
  }
}

const setDnsServers = (servers) => {
  setDns(servers)
  print(getDns())
}

program
  .name('wifi')
  .addHelpCommand(false)
  .configureHelp({ formatHelp, subcommandTerm })
  .version(version, '-v, --version')

program
  .command('connect [network] [password]')
  .alias('c')
  .summary('Connect to a Wi-Fi network')
  .action(async (network, pass) => {
    if (!network) return selectNetwork()
    const result = await getNetworks()
    const isHotspot = result?.networks.find(n => n.ssid === network)?.hotspot
    await connectNetwork(network, pass || findPassword(network), { message: isHotspot ? `Enable Personal Hotspot on your iPhone` : undefined, retry: isHotspot, withGuide: false })
  })

program
  .command('disconnect')
  .alias('dc')
  .summary('Disconnect from current Wi-Fi network')
  .action(disconnectNetwork)

program
  .command('dns [servers...]')
  .summary('Display or set DNS servers')
  .description((() => {
    const entries = Object.entries(dnsPresets)
    const maxLen = Math.max(...entries.map(([k]) => k.length))
    const lines = entries.map(([k, v]) => `  ${(k + ':').padEnd(maxLen + 1).green}  ${v.join(' ').white}`).join('\n')
    return `Display or set DNS servers\n\n${'Presets:'.yellow}\n${lines}`
  })())
  .action((servers) => {
    if (!servers.length) return getDnsServers()
    if (servers.length === 1 && dnsPresets[servers[0]]) return setDnsServers(dnsPresets[servers[0]])
    setDnsServers(servers)
  })

program
  .command('forget [network]')
  .alias('f')
  .summary('Forget a Wi-Fi network')
  .action((network) => {
    const ssid = network || currentNetwork()
    if (!ssid) { print('Not connected'); return }
    forgetNetwork(ssid)
  })

program
  .command('info')
  .alias('i')
  .summary('Display current Wi-Fi connection details')
  .action(() => {
    const network = currentNetwork()
    if (!network) { print('Not connected'); return }
    const dhcp = getDhcpDns()
    const dns = getDns()
    const ip = getIp()
    const mac = getMac()
    const router = getRouter()
    print(table({
      network,
      ip: ip && (ip + (isDhcp() ? ' (dhcp)' : ' (manual)').grey),
      router,
      dns: withDefault(dns || dhcp, dhcp),
      mac: withDefault(mac, hardwareMac),
    }))
  })

program
  .command('ip [address]')
  .summary('Display or set IP address')
  .action(async (address) => {
    if (!address) return print(getIp())
    print(await setIp(address))
  })

program
  .command('list')
  .alias('ls')
  .summary('List nearby Wi-Fi networks')
  .action(listNetworks)

program
  .command('mac [address]')
  .summary('Display or set MAC address')
  .action((address) => {
    if (!address) return print(table({ current: getMac(), default: hardwareMac }))
    if (isPrivateRelay()) { print('Disable Private Relay before changing MAC address'); return }
    print(setMac(address))
  })

program
  .command('on')
  .summary('Turn Wi-Fi on')
  .action(on)

program
  .command('off')
  .summary('Turn Wi-Fi off')
  .action(off)

program
  .command('password')
  .alias('p')
  .summary('Display current Wi-Fi network password')
  .action(() => print(findPassword(currentNetwork())))

program
  .command('qr')
  .summary('Display a QR code to join the network')
  .action(() => {
    const ssid = currentNetwork()
    if (!ssid) { print('Not connected'); return }
    const pass = findPassword(ssid)
    print(`${'Network:'.yellow} ${ssid}`)
    if (pass) print(`${'Password:'.yellow} ${pass}`)
    print(renderQr(ssid, pass))
  })

program
  .command('reset [target]')
  .summary('Reset DNS, IP, MAC, router to defaults')
  .action(async (target) => {
    print(table({
      ip: target === 'ip' || !target ? await setIp('auto') : null,
      dns: target === 'dns' || !target ? setDns(['empty']) || getDhcpDns() : null,
      router: target === 'router' || !target ? await setRouter(getDhcpRouter()) : null,
      mac: target === 'mac' || !target ? setMac('auto') : null,
    }))
  })

program
  .command('restart')
  .alias('r')
  .summary('Turn Wi-Fi off and on again')
  .action(restart)

program
  .command('router [address]')
  .summary('Display or set router address')
  .action(async (address) => {
    if (!address) return print(getRouter())
    print(await setRouter(address))
  })

program
  .command('spoof')
  .summary('Randomize MAC address')
  .action(() => {
    if (isPrivateRelay()) { print('Disable Private Relay before spoofing MAC address'); return }
    print(setMac(randomMac()))
  })

program.parse(process.argv)
