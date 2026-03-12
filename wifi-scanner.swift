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
        // Only wait for auth dialog on request-permission; all other commands use current status immediately
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
            if let ssid = CWWiFiClient.shared().interface()?.ssid() {
                print(ssid)
            }
            fflush(stdout)
            exit(0)
        case "scan":
            guard ok else { fputs("error: Location permission denied — run `wifi setup`\n", stderr); exit(1) }
            guard let iface = CWWiFiClient.shared().interface() else { exit(1) }
            let current = iface.ssid() ?? ""
            var seen = Set<String>()
            var nets: [CWNetwork] = []
            if let fresh = try? iface.scanForNetworks(withSSID: nil) { nets += fresh }
            if let cached = iface.cachedScanResults() { nets += cached }
            let networks = nets.compactMap { n -> [String: Any]? in
                guard let ssid = n.ssid, !ssid.isEmpty, seen.insert(ssid).inserted else { return nil }
                let security: String
                let wpa3 = n.supportsSecurity(.wpa3Personal) || n.supportsSecurity(.wpa3Enterprise)
                let wpa2 = n.supportsSecurity(.wpa2Personal) || n.supportsSecurity(.wpa2Enterprise)
                let wpa  = n.supportsSecurity(.wpaPersonal)  || n.supportsSecurity(.wpaEnterprise)
                if wpa3 && wpa2 {
                    security = "WPA2/3"
                } else if wpa3 {
                    security = "WPA3"
                } else if wpa2 {
                    security = "WPA2"
                } else if wpa {
                    security = "WPA"
                } else if n.supportsSecurity(.dynamicWEP) {
                    security = "WEP"
                } else {
                    security = ""
                }
                var entry: [String: Any] = ["ssid": ssid, "rssi": n.rssiValue, "security": security]
                if let ch = n.wlanChannel {
                    switch ch.channelBand {
                    case .band2GHz: entry["band"] = "2.4"
                    case .band5GHz: entry["band"] = "5"
                    case .band6GHz: entry["band"] = "6"
                    default: break
                    }
                }
                return entry
            }.sorted { ($0["rssi"] as! Int) > ($1["rssi"] as! Int) }
            let result: [String: Any] = ["current": current, "networks": networks]
            if let json = try? JSONSerialization.data(withJSONObject: result) {
                print(String(data: json, encoding: .utf8)!)
            }
            fflush(stdout)
            exit(0)
        default: // request-permission
            if ok {
                print("granted")
                fflush(stdout)
                exit(0)
            }
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
