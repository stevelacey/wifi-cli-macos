#!/usr/bin/env node
const path = require('path')
const colors = require('colors')
const { execSync } = require('child_process')
const { program, Help } = require('commander')
const select = require('@inquirer/select').default

const { name, version } = require('./package.json')
const exec = (cmd) => execSync(cmd).toString().trim()
const iface = exec("networksetup -listallhardwareports | awk '/Wi-Fi/{getline; print $2}'") || 'en0'
const connect = (network, password) => exec(`networksetup -setairportnetwork ${iface} "${network}"${password ? ` "${password}"` : ''}`)
const currentNetwork = () => {
  try {
    exec('sudo ipconfig setverbose 1')
    const output = exec(`ipconfig getsummary ${iface}`)
    exec('sudo ipconfig setverbose 0')
    const match = output.match(/^\s+SSID : (.+)$/m)
    return match ? match[1].trim() : ''
  } catch (e) {
    return ''
  }
}
const findPassword = (ssid) => exec(`security find-generic-password -ga "${ssid}" -w || true`)
const getDnsServers = () => console.log(`Current DNS Servers: ${exec('networksetup -getdnsservers Wi-Fi').split('\n').join(' ')}`)
const setDnsServers = (servers) => {
  exec(`networksetup -setdnsservers Wi-Fi ${servers.join(' ')}`)
  console.log(`Configured DNS Servers: ${exec('networksetup -getdnsservers Wi-Fi').split('\n').join(' ')}`)
}
const listNetworks = () => {
  if (!scannerReady()) { console.log('Run `wifi setup` first to enable scanning.'); return }
  if (exec(`"${scanner}" check`) !== 'granted') { console.log('Location permission required. Run `wifi setup` to grant it.'); return }
  const networks = scanNetworks()
  if (networks.length === 0) { console.log('No networks found'); return }
  const current = currentNetwork()
  const max = networks.reduce((a, b) => a.ssid.length > b.ssid.length ? a : b).ssid.length
  const pad = (ssid) => ssid.padEnd(max)
  const label = ({ ssid, rssi }) => {
    switch (true) {
      case (rssi > -30): return `${pad(ssid)} ▁▂▃▄▅▆▇█`.green // Amazing
      case (rssi > -67): return `${pad(ssid)} ▁▂▃▄▅▆`.green   // Very Good
      case (rssi > -70): return `${pad(ssid)} ▁▂▃▄`.yellow    // Okay
      case (rssi > -80): return `${pad(ssid)} ▁▂`.red         // Not Good
      case (rssi > -90): return `${pad(ssid)} ▁`.red          // Unusable
      default: return ssid.red                                // Forget it
    }
  }
  select({
    message: 'Select a network',
    default: current,
    pageSize: networks.length,
    choices: networks.map(n => ({ name: label(n), value: n.ssid })),
  }).then(ssid => {
    if (ssid === current) { console.log('Already connected.'); return }
    connect(ssid)
    console.log(`Connected to ${ssid}`)
  }).catch(() => {})
}
const on = () => exec(`networksetup -setairportpower ${iface} on`) || true
const off = () => exec(`networksetup -setairportpower ${iface} off`) || true
const scanner = path.join(__dirname, 'build/wifi-scanner.app/Contents/MacOS/wifi-scanner')
const scannerReady = () => { try { exec(`test -x "${scanner}"`); return true } catch { return false } }
const scanNetworks = () => JSON.parse(exec(`"${scanner}" scan`)).sort((a, b) => b.rssi - a.rssi)
const setup = () => {
  if (!scannerReady()) {
    try { exec('xcode-select -p') } catch {
      console.log('Installing Xcode Command Line Tools...')
      exec('xcode-select --install')
      console.log('Re-run `wifi setup` once installation is complete.')
      return
    }
    console.log('Building wifi-scanner...')
    exec(`"${path.join(__dirname, 'build-scanner')}"`)
  }
  exec(`open -a "${path.join(__dirname, 'build/wifi-scanner.app')}" --args request-permission`)
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
  .action((network, password) => network ? connect(network, password) : listNetworks())

program
  .command('disconnect')
  .alias('dc')
  .description('Disconnect from current Wi-Fi network')
  .action(off)

program
  .command('info')
  .alias('i')
  .description('Display current Wi-Fi network')
  .action(() => console.log(`Current Wi-Fi Network: ${currentNetwork()}`))

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
