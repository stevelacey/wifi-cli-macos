# Wi-Fi CLI MacOS

Wi-Fi CLI MacOS is a command line utility for managing network connections on MacOS

```
wifi connect (c) <network> [password]  Connect to a Wi-Fi network
wifi disconnect (dc)                   Disconnect from current Wi-Fi network
wifi info (i)                          Display current Wi-Fi network
wifi password (p)                      Display current Wi-Fi network password
wifi list (ls)                         List available Wi-Fi networks
wifi cloudflared on (cf on)            Turn Cloudflared on and set DNS to localhost
wifi cloudflared off (cf off)          Turn Cloudflared off reset DNS to network defaults
wifi cloudflared restart (cf r)        Turn Cloudflared off and on again and set DNS to localhost
wifi dns [servers...]                  Set DNS servers
wifi on                                Turn Wi-Fi on
wifi off                               Turn Wi-Fi off
wifi restart (r)                       Turn Wi-Fi off and on again
```

## Installation

```sh
npm install -g wifi-cli-macos
```

## Basic usage

```sh
wifi ls
Network 1 ▁▂▃▄▅▆
Network 2 ▁▂▃▄▅
Network 3 ▁▂▃
Network 4 ▁▂
Network 5 ▁▂
Network 6 ▁
```

```sh
wifi c "Network 1" changeme
```

```sh
wifi i
Current Wi-Fi Network: Network 1
```

### Configure DNS servers

```sh
wifi dns
Current DNS Servers: There aren't any DNS Servers set on Wi-Fi.
```

```sh
wifi dns 1.1.1.1 8.8.8.8
Configured DNS Servers: 1.1.1.1 8.8.8.8
```

```sh
wifi dns -
Configured DNS Servers: There aren't any DNS Servers set on Wi-Fi.
```

### Turn Wi-Fi off and on again

```sh
wifi r
```

## Advanced usage

WiFi CLI MacOS also supplies commands for enabling and disabling [Argo Tunnel (cloudflared)](https://developers.cloudflare.com/argo-tunnel/)

Argo Tunnel is a Cloudflare tool which (amongst other things) can be used to proxy DNS over SSL:

```sh
brew install cloudflare/cloudflare/cloudflared
```

WiFi CLI MacOS makes enabling/disabling Argo Tunnel a little easier, the
`wifi cf on/off/r` commands start/stop/restart
[the homebrew service](https://github.com/cloudflare/homebrew-cloudflare/pull/3)
and toggle your DNS servers between localhost and network defaults
