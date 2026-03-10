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
        if s == .notDetermined { lm.requestWhenInUseAuthorization() }
        else { run(s) }
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
        case "scan":
            guard ok else { fputs("error: Location permission denied — run `wifi setup`\n", stderr); break }
            if let iface = CWWiFiClient.shared().interface(),
               let nets = try? iface.scanForNetworks(withSSID: nil) {
                var seen = Set<String>()
                let results = nets.compactMap { n -> [String: Any]? in
                    guard let ssid = n.ssid, !ssid.isEmpty, seen.insert(ssid).inserted else { return nil }
                    return ["ssid": ssid, "rssi": n.rssiValue]
                }.sorted { ($0["rssi"] as! Int) > ($1["rssi"] as! Int) }
                if let json = try? JSONSerialization.data(withJSONObject: results) {
                    print(String(data: json, encoding: .utf8)!)
                }
            }
        default: // request-permission
            let a = NSAlert()
            a.messageText = "Allow Location Access"
            a.informativeText = "wifi-cli needs Location Services to read Wi-Fi network names.\n\nWhen prompted, click Allow. If no prompt appears, enable wifi-scanner in:\nSystem Settings → Privacy & Security → Location Services"
            a.addButton(withTitle: "OK")
            a.runModal()
            DispatchQueue.main.asyncAfter(deadline: .now() + 10) { NSApp.terminate(nil) }
            return
        }
        NSApp.terminate(nil)
    }
}

let app = NSApplication.shared
let delegate = App()
app.delegate = delegate
app.setActivationPolicy(.prohibited)
app.run()
