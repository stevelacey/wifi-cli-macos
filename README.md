# 🛜 Wi-Fi CLI MacOS

Wi-Fi CLI MacOS is a command line utility for managing network connections on MacOS.

```sh
wifi connect (c) [network] [password]  # Connect to a Wi-Fi network
wifi disconnect (dc)                   # Disconnect from current Wi-Fi network
wifi info (i)                          # Display current Wi-Fi connection details
wifi password (p)                      # Display current Wi-Fi network password
wifi list (ls)                         # List nearby Wi-Fi networks
wifi dns [servers...]                  # Display or set DNS servers (auto to reset)
wifi on                                # Turn Wi-Fi on
wifi off                               # Turn Wi-Fi off
wifi restart (r)                       # Turn Wi-Fi off and on again
```

## Installation

```sh
brew tap stevelacey/tap
brew install wifi-cli
```

Or via npm:

```sh
npm install -g wifi-cli-macos
```

> Xcode Command Line Tools are required. If not installed, you'll be prompted on first use.

## Basic usage

```sh
wifi list
Network 1 ▁▂▃▄▅▆    2.4/5GHz  WPA2
Network 2 ▁▂▃▄▅▆    5GHz      WPA2/3
Network 3 ▁▂▃▄      2.4GHz    WPA2
```

Running `wifi connect` with no arguments opens an interactive network selector:

```sh
◆  Select a network to join
│  ● Network 1 ▁▂▃▄▅▆    2.4/5GHz  WPA2
│  ○ Network 2 ▁▂▃▄▅▆    5GHz      WPA2/3
│  ○ Network 3 ▁▂▃▄      2.4GHz    WPA2
```

Or supply credentials directly:

```sh
wifi connect "Network 1" password
```

### Display connection details

```sh
wifi info
Network  Network 1
IP       192.168.1.100
Router   192.168.1.1
DNS      auto
MAC      a1:b2:c3:d4:e5:f6
```

### Configure DNS servers

```sh
wifi dns
Current: 1.1.1.1 1.0.0.1

Presets:
  cloudflare:  1.1.1.1 1.0.0.1
  google:      8.8.8.8 8.8.4.4
  opendns:     208.67.222.222 208.67.220.220
  quad9:       9.9.9.9 149.112.112.112
```

```sh
wifi dns cloudflare
wifi dns 1.1.1.1 8.8.8.8
wifi dns auto
```

### Restart Wi-Fi

```sh
wifi restart
```
