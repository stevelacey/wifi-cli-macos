export const {
  getDhcpDns, getDhcpRouter, getDns, getIp, getMac, getRouter, getSavedNetworks,
  hardwareMac, iface, isDhcp, isPrivateRelay, off, on, randomMac,
  restart, setDns, setIp, setMac, setRouter,
} = await import(`./platforms/${process.platform}/network.js`)
