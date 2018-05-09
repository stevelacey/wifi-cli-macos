#!/usr/bin/env node
const airport = require('airport-wrapper')
const colors = require('colors')
const exec = require('child_process').execSync
const program = require('vorpal')()

const info = 'networksetup -getairportnetwork en0'
const on = 'networksetup -setairportpower en0 on'
const off = 'networksetup -setairportpower en0 off'

program
  .command('connect <network> [password]')
  .description('Connect to a Wi-Fi network')
  .alias('c')
  .action(function ({network, password=''}) {
    exec('networksetup -setairportnetwork en0 ' + network.replace(' ', '\\ ') + ' ' + password)
  })

program
  .command('disconnect')
  .description('Disconnect from current Wi-Fi network')
  .alias('dc')
  .action(function (network, password) {
    exec('sudo airport -z')
  })

program
  .command('info')
  .description('Display current Wi-Fi network')
  .alias('i')
  .action(function () {
    this.log(exec(info).toString().trim())
  })

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
  .command('on')
  .description('Turn Wi-Fi on')
  .action(() => { exec(on) })

program
  .command('off')
  .description('Turn Wi-Fi off')
  .action(() => { exec(off) })

program
  .command('restart')
  .alias('r')
  .description('Turn Wi-Fi off and on again')
  .action(() => { exec(off) && exec(on) })

if (process.argv.length === 2) process.argv.push('info')

program.parse(process.argv)
