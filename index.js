#!/usr/bin/env node
const airport = require('airport-wrapper')
const colors = require('colors')
const exec = require('child_process').execSync
const program = require('vorpal')()

const cf = (action) => exec(`sudo brew services ${action} cloudflared || true`)
const dns = (servers) => exec(`networksetup -setdnsservers Wi-Fi ${(servers || ['empty']).join(' ')}`)
const info = () => exec('networksetup -getairportnetwork en0')
const on = () => exec('networksetup -setairportpower en0 on')
const off = () => exec('networksetup -setairportpower en0 off')
const pass = (ssid) => exec(`security find-generic-password -ga "${ssid}" -w || true`)
const ssid = () => exec(`airport -I | awk '/ SSID/ {print substr($0, index($0, $2))}'`)

program
  .command('connect <network> [password]')
  .description('Connect to a Wi-Fi network')
  .alias('c')
  .action(({network, password=''}) => exec(`networksetup -setairportnetwork en0 "${network}" "${password || pass(network)}"`))

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
  .action(() => console.log(pass(ssid())))

program
  .command('list')
  .description('List available Wi-Fi networks')
  .alias('ls')
  .action((network, password) => {
    airport.scan((err, networks) => {
      const length = networks.reduce((a, b) => a.ssid.length > b.ssid.length ? a : b).ssid.length

      const sort = (a, b) => {
        if (a.rssi.indexOf(' ') !== -1) return -1
        if (b.rssi.indexOf(' ') !== -1) return 1
        if (a.rssi == b.rssi) return a.ssid == b.ssid ? 0 : a.ssid < b.ssid ? -1 : 1
        return parseInt(a.rssi) < parseInt(b.rssi) ? 1 : -1
      }

      const ssids = networks.sort(sort).map((network) => {
        const ssid = network.ssid.padEnd(length)

        switch (true) {
          case (network.rssi.indexOf(' ') !== -1): return ssid.cyan  // Hotspot?
          case (network.rssi > -30): return `${ssid} ▁▂▃▄▅▆▇█`.green // Amazing
          case (network.rssi > -67): return `${ssid} ▁▂▃▄▅▆`.green   // Very Good
          case (network.rssi > -70): return `${ssid} ▁▂▃▄`.yellow    // Okay
          case (network.rssi > -80): return `${ssid} ▁▂`.red         // Not Good
          case (network.rssi > -90): return `${ssid} ▁`.red          // Unusable
          default: return ssid.red                                   // Forget it
        }
      })
      console.log(ssids.join('\n'))
    })
  })

program
  .command('dns [servers...]')
  .description('Set DNS server')
  .action(({servers}) => dns(servers))

program
  .command('cloudflared on')
  .description('Turn Cloudflared on')
  .alias('cf on')
  .action(() => cf('start') && dns(['127.0.0.1']))

program
  .command('cloudflared off')
  .description('Turn Cloudflared off')
  .alias('cf off')
  .action(() => cf('stop') && dns(['empty']))

program
  .command('cloudflared restart')
  .description('Turn Cloudflared off and on again')
  .alias('cf r')
  .action(() => cf('restart') && dns(['127.0.0.1']))

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

if (process.argv.length === 2) process.argv.push('info')

program.parse(process.argv)
