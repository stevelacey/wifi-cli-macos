import Cocoa
import CoreWLAN
import CoreLocation

class App: NSObject, NSApplicationDelegate, CLLocationManagerDelegate {
    let lm = CLLocationManager()
    let cmd = CommandLine.arguments.dropFirst().first ?? "scan"
    var done = false

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
            if let json = try? JSONSerialization.data(withJSONObject: ["current": current, "networks": networks]) {
                print(String(data: json, encoding: .utf8)!)
            }
            fflush(stdout)
            exit(0)
        default: // request-permission
            if ok { print("granted"); fflush(stdout); exit(0) }
            fputs("denied: enable wifi-scanner in System Settings → Privacy & Security → Location Services\n", stderr)
            exit(1)
        }
    }
}

let app = NSApplication.shared
let delegate = App()
app.delegate = delegate
app.setActivationPolicy(.prohibited)
app.run()
