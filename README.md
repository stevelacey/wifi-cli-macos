# Wi-Fi CLI MacOS

Wi-Fi CLI MacOS is a command line utility for managing network connections on MacOS

```
wifi connect (c) <network> [password]  Connect to a Wi-Fi network
wifi disconnect (dc)                   Disconnect from current Wi-Fi network
wifi info (i)                          Display current Wi-Fi network
wifi password (p)                      Display current Wi-Fi network password
wifi list (ls)                         List nearby Wi-Fi networks
wifi dns [servers...]                  Set DNS servers
wifi on                                Turn Wi-Fi on
wifi off                               Turn Wi-Fi off
wifi restart (r)                       Turn Wi-Fi off and on again
wifi setup                             Grant location permission for Wi-Fi scanning
```

## Installation

```sh
npm install -g wifi-cli-macos
```

After installing, run `wifi setup` once to grant the Location Services permission that macOS 14+ requires to read Wi-Fi network names.

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
