#!/usr/bin/env node
const colors = require('colors')
const path = require('path')
const readline = require('readline')
const select = require('@inquirer/select').default
const { execSync } = require('child_process')
const { program, Help } = require('commander')

const { name, version } = require('./package.json')
const exec = (cmd) => execSync(cmd).toString().trim()
const iface = exec("networksetup -listallhardwareports | awk '/Wi-Fi/{getline; print $2}'") || 'en0'
const scanner = path.join(__dirname, 'build/wifi-scanner.app/Contents/MacOS/wifi-scanner')
const scannerReady = () => { try { exec(`test -x "${scanner}"`); return true } catch { return false } }
const connect = (network, password) => exec(`networksetup -setairportnetwork ${iface} "${network}"${password ? ` "${password}"` : ''}`)
const currentNetwork = () => { try { return execSync(`"${scanner}" current`, { timeout: 5000 }).toString().trim() } catch { return '' } }
const findPassword = (ssid) => exec(`security find-generic-password -ga "${ssid}" -w || true`)
const getDnsServers = () => console.log(`Current DNS Servers: ${exec('networksetup -getdnsservers Wi-Fi').split('\n').join(' ')}`)
const setDnsServers = (servers) => {
  exec(`networksetup -setdnsservers Wi-Fi ${servers.join(' ')}`)
  console.log(`Configured DNS Servers: ${exec('networksetup -getdnsservers Wi-Fi').split('\n').join(' ')}`)
}
const getNetworks = () => {
  if (!scannerReady()) { console.log('Run `wifi setup` first to enable scanning.'); return null }
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
  const label = renderNetwork(networks)
  console.log(networks.map(n => label(n) + (n.ssid === current ? ' ◀'.green : '')).join('\n'))
}
const on = () => exec(`networksetup -setairportpower ${iface} on`) || true
const off = () => exec(`networksetup -setairportpower ${iface} off`) || true
const renderNetwork = (networks) => {
  const max = networks.reduce((a, b) => a.ssid.length > b.ssid.length ? a : b).ssid.length
  const pad = (ssid) => ssid.padEnd(max)
  return ({ ssid, rssi }) => {
    switch (true) {
      case (rssi > -30): return `${pad(ssid)} ▁▂▃▄▅▆▇█`.green
      case (rssi > -67): return `${pad(ssid)} ▁▂▃▄▅▆  `.green
      case (rssi > -70): return `${pad(ssid)} ▁▂▃▄    `.yellow
      case (rssi > -80): return `${pad(ssid)} ▁▂      `.red
      case (rssi > -90): return `${pad(ssid)} ▁       `.red
      default:           return `${pad(ssid)}         `.red
    }
  }
}
const selectNetwork = () => {
  const result = getNetworks()
  if (!result) return
  const { networks, current } = result
  if (networks.length === 0) { console.log('No networks found'); return }
  const label = renderNetwork(networks)
  const ac = new AbortController()
  readline.emitKeypressEvents(process.stdin)
  if (process.stdin.isTTY) process.stdin.setRawMode(true)
  process.stdin.once('keypress', (_, key) => { if (key.name === 'escape') ac.abort() })
  select({
    message: 'Select a network to connect',
    default: current,
    pageSize: networks.length,
    choices: networks.map(n => ({ name: label(n), value: n.ssid })),
  }, { signal: ac.signal }).then(ssid => {
    process.stdout.write('\n')
    if (ssid === current) { console.log('Already connected.'); return }
    connect(ssid)
    console.log(`Connected to ${ssid}`)
  }).catch(() => {})
}
const setup = () => {
  try { exec('xcode-select -p') } catch {
    console.log('Installing Xcode Command Line Tools...')
    exec('xcode-select --install')
    console.log('Re-run `wifi setup` once installation is complete.')
    return
  }
  console.log('Building wifi-scanner...')
  exec(`"${path.join(__dirname, 'build-scanner')}"`)
  execSync(`"${scanner}" request-permission`, { stdio: 'inherit' })
}

program
  .name('wifi')
  .addHelpCommand(false)
  .configureHelp({
    formatHelp: (cmd, helper) => {
      if (cmd.parent) return new Help().formatHelp(cmd, helper)
      const cmds = helper.visibleCommands(cmd).sort((a, b) => a.name().localeCompare(b.name()))
      const termWidth = cmds.reduce((max, c) => Math.max(max, colors.strip(helper.subcommandTerm(c)).length), 0)
      const cmdLines = cmds.map(c => {
        const term = helper.subcommandTerm(c)
        const gap = ' '.repeat(termWidth - colors.strip(term).length + 2)
        return `  ${term}${gap}${helper.subcommandDescription(c).white}`
      }).join('\n')
      return [
        `${name.white} ${('v' + version).green}`,
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
      const args = cmd.registeredArguments.map(a => a.required ? `<${a.name()}>` : `[${a.name()}]`).join(' ')
      const cmdName = alias ? `${cmd.name().green} ${('(' + alias + ')').grey}` : cmd.name().green
      return args ? `${cmdName} ${args.cyan}` : cmdName
    },
  })

program
  .command('list')
  .alias('ls')
  .description('List nearby Wi-Fi networks')
  .action(listNetworks)

program
  .command('connect [network] [password]')
  .alias('c')
  .description('Connect to a Wi-Fi network')
  .action((network, password) => network ? connect(network, password) : selectNetwork())

program
  .command('disconnect')
  .alias('dc')
  .description('Disconnect from current Wi-Fi network')
  .action(off)

program
  .command('info')
  .alias('i')
  .description('Display current Wi-Fi network')
  .action(() => { const n = currentNetwork(); console.log(n || 'Not connected') })

program
  .command('password')
  .alias('p')
  .description('Display current Wi-Fi network password')
  .action(() => console.log(findPassword(currentNetwork())))

program
  .command('on')
  .description('Turn Wi-Fi on')
  .action(on)

program
  .command('off')
  .description('Turn Wi-Fi off')
  .action(off)

program
  .command('restart')
  .alias('r')
  .description('Turn Wi-Fi off and on again')
  .action(() => off() && on())

program
  .command('dns [servers...]')
  .description('Display or set DNS servers (--reset for defaults)')
  .option('-r, --reset', 'Reset to network defaults')
  .action((servers, opts) => {
    if (opts.reset) return setDnsServers(['empty'])
    if (!servers.length) return getDnsServers()
    setDnsServers(servers)
  })

program
  .command('setup')
  .description('Grant location permission for Wi-Fi scanning')
  .action(setup)

program.parse(process.argv)
