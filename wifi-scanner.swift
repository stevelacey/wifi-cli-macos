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
                return ["ssid": ssid, "rssi": n.rssiValue]
            }.sorted { ($0["rssi"] as! Int) > ($1["rssi"] as! Int) }
            let result: [String: Any] = ["current": current, "networks": networks]
            if let json = try? JSONSerialization.data(withJSONObject: result) {
                print(String(data: json, encoding: .utf8)!)
            }
            fflush(stdout)
            exit(0)
        default: // request-permission
            app.setActivationPolicy(.regular)
            NSApp.activate(ignoringOtherApps: true)
            let a = NSAlert()
            a.messageText = "Allow Location Access"
            a.informativeText = ok
                ? "Location access is already granted. wifi-cli is ready to use."
                : "wifi-cli needs Location Services to read Wi-Fi network names.\n\nWhen prompted, click Allow. If no prompt appears, enable wifi-scanner in:\nSystem Settings → Privacy & Security → Location Services"
            a.addButton(withTitle: "OK")
            a.runModal()
            exit(0)
        }
    }
}

let app = NSApplication.shared
let delegate = App()
app.delegate = delegate
app.setActivationPolicy(.prohibited)
app.run()
