# Wi-Fi CLI MacOS

Wi-Fi CLI MacOS is a command line utility for managing network connections on MacOS

```
wifi connect (c)      Connect to a Wi-Fi network
wifi disconnect (dc)  Disconnect from current Wi-Fi network
wifi info (i)         Display current Wi-Fi network
wifi list (ls)        List available Wi-Fi networks
wifi on               Turn Wi-Fi on
wifi off              Turn Wi-Fi off
wifi restart (r)      Turn Wi-Fi off and on again
```

## Installation

Install it using npm:

```sh
npm install -g wifi-cli
```

## Usage

```sh
wifi c Network\ 1 changeme
```

```sh
wifi i
Current Wi-Fi Network: Network 1
```

```sh
wifi ls
Network 1 ▁▂▃▄▅▆
Network 2 ▁▂▃▄▅▆
Network 3 ▁▂▃▄▅▆
Network 4 ▁▂
Network 5 ▁▂
Network 6 ▁
```
