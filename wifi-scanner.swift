import Cocoa
import CoreWLAN
import CoreLocation
import CoreBluetooth
import SecurityFoundation

class App: NSObject, NSApplicationDelegate, CLLocationManagerDelegate, CBCentralManagerDelegate {
    let lm = CLLocationManager()
    let cmd = CommandLine.arguments.dropFirst().first ?? "scan"
    var done = false
    var central: CBCentralManager?
    var hotspots: [String: Int] = [:]

    func applicationDidFinishLaunching(_ n: Notification) {
        lm.delegate = self
        let s = lm.authorizationStatus
        if s == .notDetermined && cmd == "request-permission" {
            lm.requestWhenInUseAuthorization()
        } else {
            run(s)
        }
    }

    func locationManagerDidChangeAuthorization(_ m: CLLocationManager) {
        guard !done else { return }
        run(m.authorizationStatus)
    }

    func run(_ s: CLAuthorizationStatus) {
        done = true
        let ok = s == .authorized || s == .authorizedAlways
        switch cmd {

        case "check":
            print(ok ? "granted" : "denied")
            fflush(stdout)
            exit(0)

        case "current":
            guard ok else { exit(1) }
            if let ssid = CWWiFiClient.shared().interface()?.ssid() { print(ssid) }
            fflush(stdout)
            exit(0)

        case "connect":
            guard ok else { fputs("error: Location permission denied\n", stderr); exit(1) }
            guard let iface = CWWiFiClient.shared().interface() else { exit(1) }
            let args = CommandLine.arguments
            guard args.count >= 3 else { exit(1) }
            let ssid = args[2]
            let password: String? = args.count >= 4 ? args[3] : nil
            var network: CWNetwork?
            if let fresh = try? iface.scanForNetworks(withSSID: nil) { network = fresh.first { $0.ssid == ssid } }
            if network == nil, let cached = iface.cachedScanResults() { network = cached.first { $0.ssid == ssid } }
            guard let net = network else { exit(1) }
            do { try iface.associate(to: net, password: password); fflush(stdout); exit(0) }
            catch { exit(1) }

        case "disconnect":
            guard let iface = CWWiFiClient.shared().interface() else { exit(1) }
            iface.disassociate()
            fflush(stdout); exit(0)

        case "forget":
            let args = CommandLine.arguments
            guard args.count >= 3 else { fputs("error: No SSID provided\n", stderr); exit(1) }
            let ssid = args[2]
            guard let iface = CWWiFiClient.shared().interface() else { exit(1) }
            if iface.ssid() == ssid { iface.disassociate() }
            guard let config = iface.configuration() else { exit(1) }
            let mutableConfig = CWMutableConfiguration(configuration: config)
            let profiles = (mutableConfig.networkProfiles.array as! [CWNetworkProfile]).filter { $0.ssid != ssid }
            mutableConfig.networkProfiles = NSOrderedSet(array: profiles)
            do { try iface.commitConfiguration(mutableConfig, authorization: SFAuthorization()); fflush(stdout); exit(0) }
            catch { fputs("error: \(error.localizedDescription)\n", stderr); exit(1) }

        case "scan":
            guard ok else { fputs("error: Location permission denied\n", stderr); exit(1) }
            guard let iface = CWWiFiClient.shared().interface() else { exit(1) }
            let current = iface.ssid() ?? ""
            var nets: [CWNetwork] = []
            if let fresh = try? iface.scanForNetworks(withSSID: nil) { nets += fresh }
            if let cached = iface.cachedScanResults() { nets += cached }
            struct NetInfo { var rssi: Int; var security: String; var bands: [String] = [] }
            var bySSID: [String: NetInfo] = [:]
            for n in nets {
                guard let ssid = n.ssid, !ssid.isEmpty else { continue }
                let wpa3 = n.supportsSecurity(.wpa3Personal) || n.supportsSecurity(.wpa3Enterprise)
                let wpa2 = n.supportsSecurity(.wpa2Personal) || n.supportsSecurity(.wpa2Enterprise)
                let wpa  = n.supportsSecurity(.wpaPersonal)  || n.supportsSecurity(.wpaEnterprise)
                let security: String
                if wpa3 && wpa2 { security = "WPA2/3" }
                else if wpa3    { security = "WPA3" }
                else if wpa2    { security = "WPA2" }
                else if wpa     { security = "WPA" }
                else if n.supportsSecurity(.dynamicWEP) { security = "WEP" }
                else            { security = "" }
                let band: String?
                if let ch = n.wlanChannel {
                    switch ch.channelBand {
                    case .band2GHz: band = "2.4"
                    case .band5GHz: band = "5"
                    case .band6GHz: band = "6"
                    default: band = nil
                    }
                } else { band = nil }
                if var existing = bySSID[ssid] {
                    if n.rssiValue > existing.rssi { existing.rssi = n.rssiValue }
                    if let b = band, !existing.bands.contains(b) { existing.bands.append(b) }
                    bySSID[ssid] = existing
                } else {
                    bySSID[ssid] = NetInfo(rssi: n.rssiValue, security: security, bands: band.map { [$0] } ?? [])
                }
            }
            let networks = bySSID.map { ssid, info -> [String: Any] in
                let bandStr = info.bands.sorted().joined(separator: "/")
                var entry: [String: Any] = ["ssid": ssid, "rssi": info.rssi, "security": info.security]
                if !bandStr.isEmpty { entry["band"] = bandStr + "GHz" }
                return entry
            }.sorted { ($0["rssi"] as! Int) > ($1["rssi"] as! Int) }
            central = CBCentralManager(delegate: self, queue: nil)
            DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                let hotspotList = self.hotspots
                    .sorted { $0.value > $1.value }
                    .map { ["ssid": $0.key, "rssi": $0.value] as [String: Any] }
                if let json = try? JSONSerialization.data(withJSONObject: ["current": current, "networks": networks, "hotspots": hotspotList]) {
                    print(String(data: json, encoding: .utf8)!)
                }
                fflush(stdout)
                exit(0)
            }

        default: // request-permission
            if ok { print("granted"); fflush(stdout); exit(0) }
            fputs("denied: enable wifi-scanner in System Settings → Privacy & Security → Location Services\n", stderr)
            exit(1)
        }
    }

    func centralManagerDidUpdateState(_ c: CBCentralManager) {
        guard c.state == .poweredOn else { return }
        c.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey: true])
    }

    func centralManager(_ c: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String: Any], rssi RSSI: NSNumber) {
        guard let name = peripheral.name, !name.isEmpty,
              let mfr = advertisementData[CBAdvertisementDataManufacturerDataKey] as? Data,
              mfr.count >= 3, mfr[0] == 0x4C, mfr[1] == 0x00 else { return }
        let type = mfr[2]
        guard type == 0x0E || type == 0x10 else { return }
        hotspots[name] = max(hotspots[name] ?? Int.min, RSSI.intValue)
    }
}

let app = NSApplication.shared
let delegate = App()
app.delegate = delegate
app.setActivationPolicy(.prohibited)
app.run()
