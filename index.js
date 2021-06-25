#!/usr/bin/env node
const _ = require('lodash')
const airport = require('airport-wrapper')
const colors = require('colors')
const execSync = require('child_process').execSync
const program = require('vorpal')()

const cloudflared = (action) => console.log(exec(`sudo brew services ${action} cloudflared || true`)) || true
const currentNetwork = () => exec(`airport -I | awk '/ SSID/ {print substr($0, index($0, $2))}'`)
const exec = (cmd) => execSync(cmd).toString().trim()
const info = () => exec('networksetup -getairportnetwork en0')
const findPassword = (ssid) => exec(`security find-generic-password -ga "${ssid}" -w || true`)
const on = () => exec('networksetup -setairportpower en0 on') || true
const off = () => exec('networksetup -setairportpower en0 off') || true
const getDns = () => console.log(`Current DNS Servers: ${exec('networksetup -getdnsservers Wi-Fi').split('\n').join(' ')}`)
const setDns = (servers) => {
  if (servers.length === 1 && servers[0] === '-') servers = ['empty'] // treat '-' like 'empty'
  exec(`networksetup -setdnsservers Wi-Fi ${(servers).join(' ')}`)
  console.log(`Configured DNS Servers: ${exec('networksetup -getdnsservers Wi-Fi').split('\n').join(' ')}`)
}
const sortNetworks = (a, b) => {
  if (a.rssi.indexOf(' ') !== -1) return -1
  if (b.rssi.indexOf(' ') !== -1) return 1
  if (a.rssi === b.rssi) return a.ssid === b.ssid ? 0 : a.ssid < b.ssid ? -1 : 1
  return parseInt(a.rssi) < parseInt(b.rssi) ? 1 : -1
}

program
  .command('connect <network> [password]')
  .description('Connect to a Wi-Fi network')
  .alias('c')
  .action(({network, password=''}) => {
    if (password === '') password = findPassword(network)
    if (password === '-') password = '' // skip keychain lookup with '-'
    exec(`networksetup -setairportnetwork en0 "${network}" "${password}"`)
  })

program
  .command('disconnect')
  .description('Disconnect from current Wi-Fi network')
  .alias('dc')
  .action(() => exec('sudo airport -z'))

program
  .command('info')
  .description('Display current Wi-Fi network')
  .alias('i')
  .action(() => console.log(info()))

program
  .command('password')
  .description('Display current Wi-Fi network password')
  .alias('p')
  .action(() => console.log(findPassword(currentNetwork())))

program
  .command('list')
  .description('List available Wi-Fi networks')
  .alias('ls')
  .action(() => {
    airport.scan((err, networks) => {
      const max = networks.reduce((a, b) => a.ssid.length > b.ssid.length ? a : b).ssid.length

      const pad = (ssid) => ssid.padEnd(max)

      const ssids = _.uniqBy(networks, 'ssid').sort(sortNetworks).map((network) => {
        switch (true) {
          case (network.rssi.indexOf(' ') !== -1): return network.ssid.cyan       // Hotspot?
          case (network.rssi > -30): return `${pad(network.ssid)} ▁▂▃▄▅▆▇█`.green // Amazing
          case (network.rssi > -67): return `${pad(network.ssid)} ▁▂▃▄▅▆`.green   // Very Good
          case (network.rssi > -70): return `${pad(network.ssid)} ▁▂▃▄`.yellow    // Okay
          case (network.rssi > -80): return `${pad(network.ssid)} ▁▂`.red         // Not Good
          case (network.rssi > -90): return `${pad(network.ssid)} ▁`.red          // Unusable
          default: return network.ssid.red                                        // Forget it
        }
      })
      console.log(ssids.join('\n'))
    })
  })

program
  .command('cloudflared on')
  .description('Turn Cloudflared on and set DNS to localhost')
  .alias('cf on')
  .action(() => cloudflared('start') && setDns(['127.0.0.1']))

program
  .command('cloudflared off')
  .description('Turn Cloudflared off reset DNS to network defaults')
  .alias('cf off')
  .action(() => cloudflared('stop') && setDns(['empty']))

program
  .command('cloudflared restart')
  .description('Turn Cloudflared off and on again and set DNS to localhost')
  .alias('cf restart')
  .alias('cf r')
  .action(() => cloudflared('restart') && setDns(['127.0.0.1']))

program
  .command('dns [servers...]')
  .description('Set DNS servers')
  .action(({servers}) => !servers ? getDns() : setDns(servers))

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

if (process.argv.length === 2) process.argv.push('list')

program.parse(process.argv)
