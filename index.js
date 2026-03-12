#!/usr/bin/env node
const name = 'Wi-Fi CLI MacOS'
const colors = require('colors')
const path = require('path')
const { execSync, spawnSync } = require('child_process')
const { intro, isCancel, select, password: promptPassword } = require('@clack/prompts')
const { program } = require('commander')
const { version } = require('./package.json')
const title = `${name.white} ${('v' + version).green}`
const bars = '▁▂▃▄▅▆▇'
const exec = (cmd) => execSync(cmd).toString().trim()
const iface = exec("networksetup -listallhardwareports | awk '/Wi-Fi/{getline; print $2}'") || 'en0'
const scanner = path.join(__dirname, 'build/wifi-scanner.app/Contents/MacOS/wifi-scanner')
const scannerReady = () => { try { exec(`test -x "${scanner}"`); return true } catch { return false } }
const connect = (network, password) => spawnSync('networksetup', ['-setairportnetwork', iface, network, password].filter(Boolean), { stdio: 'inherit' })
const currentNetwork = () => { if (!ensureScanner()) return ''; try { return execSync(`"${scanner}" current`, { timeout: 5000 }).toString().trim() } catch { return '' } }
const findPassword = (ssid) => { try { return execSync(`security find-generic-password -ga "${ssid}" -w 2>/dev/null`).toString().trim() } catch { return '' } }
const disconnect = () => {
  const n = currentNetwork()
  if (!n) return
  spawnSync('networksetup', ['-removepreferredwirelessnetwork', iface, n], { stdio: 'inherit' })
  restart()
}
const dnsPresets = {
  cloudflare: ['1.1.1.1', '1.0.0.1'],
  google: ['8.8.8.8', '8.8.4.4'],
  opendns: ['208.67.222.222', '208.67.220.220'],
  quad9: ['9.9.9.9', '149.112.112.112'],
}
const dnsPresetsDescription = (() => {
  const entries = Object.entries(dnsPresets)
  const maxLen = Math.max(...entries.map(([k]) => k.length))
  const lines = entries.map(([k, v]) => `  ${(k + ':').padEnd(maxLen + 1).green}  ${v.join(' ').white}`).join('\n')
  return `Display or set DNS servers\n\n${'Presets:'.yellow}\n${lines}`
})()
const getDnsServers = () => {
  const raw = exec('networksetup -getdnsservers Wi-Fi')
  const current = raw.startsWith("There aren't") ? 'auto' : raw.split('\n').join(' ')
  const entries = Object.entries(dnsPresets)
  const maxLen = Math.max(...entries.map(([k]) => k.length))
  const presetLines = entries
    .map(([k, v]) => `  ${(k + ':').padEnd(maxLen + 1).green}  ${v.join(' ').white}`)
    .join('\n')
  console.log(`${'Current:'.yellow} ${current.white}\n\n${'Presets:'.yellow}\n${presetLines}`)
}
const setDnsServers = (servers) => {
  exec(`networksetup -setdnsservers Wi-Fi ${servers.join(' ')}`)
  console.log(exec('networksetup -getdnsservers Wi-Fi').split('\n').join(' '))
}
const ensureScanner = () => {
  if (!scannerReady()) {
    try { exec('xcode-select -p') } catch {
      console.error('Xcode Command Line Tools required. Install with: xcode-select --install')
      return false
    }
    exec(`"${path.join(__dirname, 'build-scanner')}"`)
  }
  const granted = (() => { try { return execSync(`"${scanner}" check`, { timeout: 5000 }).toString().trim() === 'granted' } catch { return false } })()
  if (!granted) {
    try { execSync(`"${scanner}" request-permission`, { timeout: 30000 }) } catch {
      console.error('Location permission denied. Enable wifi-scanner in System Settings → Privacy & Security → Location Services')
      return false
    }
  }
  return true
}
const getNetworks = () => {
  if (!ensureScanner()) return null
  const raw = JSON.parse(execSync(`"${scanner}" scan`, { timeout: 15000 }).toString().trim())
  const networks = (raw.networks || []).sort((a, b) => b.rssi - a.rssi)
  const current = raw.current || currentNetwork()
  return { networks, current }
}
const listNetworks = () => {
  const result = getNetworks()
  if (!result) return
  const { networks, current } = result
  if (networks.length === 0) { console.log('No networks found'); return }
  const label = renderNetworks(networks)
  console.log(networks.map(n => label(n) + (n.ssid === current ? ' ◀'.green : '')).join('\n'))
}
const on = () => exec(`networksetup -setairportpower ${iface} on`) || true
const off = () => exec(`networksetup -setairportpower ${iface} off`) || true
const restart = () => off() && on()
const renderSignal = (rssi) => {
  const n = rssi > -30 ? 7 : rssi > -67 ? 6 : rssi > -70 ? 4 : rssi > -80 ? 2 : rssi > -90 ? 1 : 0
  const color = rssi > -67 ? 'green' : rssi > -70 ? 'yellow' : 'red'
  const filled = bars.slice(0, n)
  const empty = bars.slice(n)
  return { signal: process.stdout.isTTY ? filled[color] + empty.dim.grey : filled.padEnd(bars.length), color }
}
const renderNetworks = (networks) => {
  const max = networks.reduce((a, b) => a.ssid.length > b.ssid.length ? a : b).ssid.length
  return ({ ssid, rssi, security, band }) => {
    const { signal, color } = renderSignal(rssi)
    const details = `${(band || '').padEnd(9)} ${(security || '').padEnd(6)}`
    return `${ssid.padEnd(max)[color]}  ${signal}  ${details.grey}`
  }
}
const selectNetwork = async () => {
  const result = getNetworks()
  if (!result) return
  const { networks, current } = result
  if (networks.length === 0) { console.log('No networks found'); return }
  const label = renderNetworks(networks)
  intro(title)
  const ssid = await select({
    message: 'Select a network to join',
    initialValue: current,
    maxItems: networks.length,
    options: networks.map(n => ({ label: '\x1b[0m' + label(n), value: n.ssid })),
  })
  if (isCancel(ssid) || ssid === current) return
  const network = networks.find(n => n.ssid === ssid)
  let password = ''
  if (network && network.security) {
    const input = await promptPassword({ message: 'Password (leave blank to use keychain)' })
    if (isCancel(input)) return
    if (input) {
      password = input
    } else {
      password = findPassword(ssid)
      if (password) process.stdout.write(`\x1b[1A\x1b[2K\r│  ${'▪'.repeat(password.length)}\n`.grey)
    }
  }
  connect(ssid, password)
}

program
  .name('wifi')
  .addHelpCommand(false)
  .configureHelp({
    formatHelp: (cmd, helper) => {
      if (cmd.parent) {
        const opts = helper.visibleOptions(cmd)
        const optLines = opts.map(o => `  ${o.flags.green}  ${o.description.white}`).join('\n')
        const desc = cmd.description()
        return [
          `${'Usage:'.yellow} wifi ${cmd.name()} ${cmd.usage().cyan}`,
          '',
          ...(desc ? [desc.white, ''] : []),
          'Options:'.yellow,
          optLines,
          '',
        ].join('\n')
      }
      const cmds = helper.visibleCommands(cmd).sort((a, b) => a.name().localeCompare(b.name()))
      const termWidth = cmds.reduce((max, c) => Math.max(max, colors.strip(helper.subcommandTerm(c)).length), 0)
      const cmdLines = cmds.map(c => {
        const term = helper.subcommandTerm(c)
        const gap = ' '.repeat(termWidth - colors.strip(term).length + 2)
        return `  ${term}${gap}${helper.subcommandDescription(c).white}`
      }).join('\n')
      return [
        title,
        '',
        'Usage:'.yellow,
        `  wifi ${'[command]'.white}`,
        '',
        'Commands:'.yellow,
        cmdLines,
        '',
      ].join('\n')
    },
    subcommandTerm: (cmd) => {
      const alias = cmd.alias()
      const args = cmd.registeredArguments.map(a => a.required ? `<${a.name()}${a.variadic ? '...' : ''}>` : `[${a.name()}${a.variadic ? '...' : ''}]`).join(' ')
      const cmdName = alias ? `${cmd.name().green} ${('(' + alias + ')').grey}` : cmd.name().green
      return args ? `${cmdName} ${args.cyan}` : cmdName
    },
  })
  .version(version, '-v, --version')

program
  .command('list')
  .alias('ls')
  .summary('List nearby Wi-Fi networks')
  .action(listNetworks)

program
  .command('connect [network] [password]')
  .alias('c')
  .summary('Connect to a Wi-Fi network')
  .action((network, password) => network ? connect(network, password || findPassword(network)) : selectNetwork())

program
  .command('disconnect')
  .alias('dc')
  .summary('Disconnect from current Wi-Fi network')
  .action(disconnect)

program
  .command('info')
  .alias('i')
  .summary('Display current Wi-Fi connection details')
  .action(() => {
    const n = currentNetwork()
    if (!n) { console.log('Not connected'); return }
    const tryExec = (cmd) => { try { return exec(cmd) } catch { return '' } }
    const ip = tryExec(`ipconfig getifaddr ${iface}`)
    const router = tryExec(`route -n get default | awk '/gateway/{print $2}'`)
    const dnsRaw = tryExec(`networksetup -getdnsservers Wi-Fi`)
    const dns = dnsRaw.startsWith("There aren't any DNS Servers") ? 'auto' : dnsRaw.split('\n').join(' ')
    const mac = tryExec(`ifconfig ${iface} | awk '/ether/{print $2}'`)
    const row = (label, value) => value ? `${label.yellow}  ${value}` : ''
    console.log([
      row('Network', n),
      row('IP     ', ip),
      row('Router ', router),
      row('DNS    ', dns),
      row('MAC    ', mac),
    ].filter(Boolean).join('\n'))
  })

program
  .command('password')
  .alias('p')
  .summary('Display current Wi-Fi network password')
  .action(() => console.log(findPassword(currentNetwork())))

program
  .command('on')
  .summary('Turn Wi-Fi on')
  .action(on)

program
  .command('off')
  .summary('Turn Wi-Fi off')
  .action(off)

program
  .command('restart')
  .alias('r')
  .summary('Turn Wi-Fi off and on again')
  .action(restart)

program
  .command('dns [servers...]')
  .summary('Display or set DNS servers (auto to reset)')
  .description(dnsPresetsDescription)
  .action((servers) => {
    if (!servers.length) return getDnsServers()
    if (servers.length === 1 && servers[0] === 'auto') return setDnsServers(['empty'])
    if (servers.length === 1 && dnsPresets[servers[0]]) return setDnsServers(dnsPresets[servers[0]])
    setDnsServers(servers)
  })

program.parse(process.argv)
