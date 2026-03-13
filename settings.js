import pkg from './package.json' with { type: 'json' }

export const name = `${'Wi-Fi CLI MacOS'.white} ${('v' + pkg.version).green}`

export const dnsPresets = {
  cloudflare: ['1.1.1.1', '1.0.0.1'],
  google: ['8.8.8.8', '8.8.4.4'],
  opendns: ['208.67.222.222', '208.67.220.220'],
  quad9: ['9.9.9.9', '149.112.112.112'],
}

export const version = pkg.version
