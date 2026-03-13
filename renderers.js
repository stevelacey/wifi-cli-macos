import colors from 'colors'
import qrcode from 'qrcode-terminal'

import { name } from './settings.js'

export const formatHelp = (cmd, helper) => {
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
    name,
    '',
    'Usage:'.yellow,
    `  wifi ${'[command]'.white}`,
    '',
    'Commands:'.yellow,
    cmdLines,
    '',
  ].join('\n')
}

export const formatLabel = (k) => {
  if (k.length <= 3) return k.toUpperCase()
  const words = k.replace(/([A-Z])/g, ' $1').toLowerCase().trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export const print = (...args) => console.log(...args.map(a => typeof a === 'string' && !process.stdout.isTTY ? colors.strip(a) : a))

export const renderBars = (rssi) => {
  const bars = '▁▂▃▄▅▆▇'
  const n = rssi > -55 ? 7 : rssi > -60 ? 6 : rssi > -67 ? 5 : rssi > -70 ? 4 : rssi > -75 ? 3 : rssi > -80 ? 2 : rssi > -90 ? 1 : 0
  const color = rssi > -67 ? 'green' : rssi > -70 ? 'yellow' : 'red'
  const filled = bars.slice(0, n)
  const empty = bars.slice(n)
  return { signal: process.stdout.isTTY ? filled[color] + empty.dim.grey : filled.padEnd(bars.length), color }
}

export const renderNetwork = ({ ssid, rssi, security, band }, networks) => {
  const max = networks.reduce((a, b) => a.ssid.length > b.ssid.length ? a : b).ssid.length
  const { signal, color } = renderBars(rssi)
  const details = `${(band || '').padEnd(9)} ${(security || '').padEnd(6)}`
  const result = `${ssid.padEnd(max)[color]}  ${signal}  ${details.grey}`
  return process.stdout.isTTY ? result : colors.strip(result)
}

export const renderQr = (ssid, pass) => {
  const escape = (s) => s.replace(/([\\;,"])/g, '\\$1')
  const uri = pass
    ? `WIFI:T:WPA;S:${escape(ssid)};P:${escape(pass)};;`
    : `WIFI:T:nopass;S:${escape(ssid)};;`
  let code
  qrcode.generate(uri, { small: true }, output => code = output.trim())
  return code
}

export const subcommandTerm = (cmd) => {
  const alias = cmd.alias()
  const args = cmd.registeredArguments.map(a => a.required ? `<${a.name()}${a.variadic ? '...' : ''}>` : `[${a.name()}${a.variadic ? '...' : ''}]`).join(' ')
  const cmdName = alias ? `${cmd.name().green} ${('(' + alias + ')').grey}` : cmd.name().green
  return args ? `${cmdName} ${args.cyan}` : cmdName
}

export const table = (rows) => {
  const entries = Object.entries(rows).filter(([, v]) => v).map(([k, v]) => [formatLabel(k), v])
  const width = Math.max(...entries.map(([k]) => k.length)) + 1
  return entries.map(([k, v]) => `${(k + ':').padEnd(width).yellow}  ${v}`).join('\n')
}

export const withDefault = (value, def) => def && value !== def ? `${value} ${('(default: ' + def + ')').grey}` : value
