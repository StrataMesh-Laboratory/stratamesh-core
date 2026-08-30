import SwiftUI
import UIKit

/// Indexed Edge on iPhone/iPad. Primary job = this device. Residual C_mesh = f(1-U).
struct ContentView: View {
    @AppStorage("edge.node") private var nodeId = ""
    @AppStorage("edge.token") private var token = ""
    @State private var otp = ""
    @State private var challenge: String = ""
    @State private var masked = ""
    @State private var msg = ""
    @State private var result: EdgeUsage.Result?
    @State private var scenePhase: ScenePhase = .active

    var body: some View {
        NavigationStack {
            ZStack {
                Color(red: 10/255, green: 10/255, blue: 11/255).ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        Text("STRATAMESH LAB")
                            .font(.caption).tracking(1.4)
                            .foregroundStyle(Color(red: 196/255, green: 165/255, blue: 116/255))
                        Text("Edge Node").font(.title2.weight(.semibold))
                        Text("Intelligentia · Vigilantia · Veritas")
                            .font(.footnote).foregroundStyle(.secondary)
                        Text("C_mesh = f(1−U) · residual · session expected · not a Fog · not mainnet")
                            .font(.caption).foregroundStyle(.secondary)
                        if token.isEmpty {
                            wizard
                        } else {
                            dash
                        }
                    }
                    .padding()
                }
            }
            .navigationBarHidden(true)
        }
        .onAppear { pulse() }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.didBecomeActiveNotification)) { _ in pulse() }
    }

    var wizard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Registered EDGE node id, then the 6-digit code mailed to the operator.")
                .font(.footnote).foregroundStyle(.secondary)
            TextField("EDGE-NODE-…", text: $nodeId)
                .textInputAutocapitalization(.characters)
                .padding(10).background(Color(white: 0.08))
            if !challenge.isEmpty {
                Text("Code sent to \(masked)").font(.caption)
                TextField("000000", text: $otp).keyboardType(.numberPad)
                    .padding(10).background(Color(white: 0.08))
            }
            Button(challenge.isEmpty ? "Request 2FA" : "Verify") { Task { await connect() } }
                .buttonStyle(.bordered)
            Text(msg).font(.caption).foregroundStyle(.red)
        }
        .padding().overlay(Rectangle().stroke(Color(white: 0.12)))
    }

    var dash: some View {
        VStack(alignment: .leading, spacing: 8) {
            row("node", nodeId)
            row("C_mesh", String(format: "%.3f", result?.C_mesh ?? 0))
            row("U", String(format: "%.3f", result?.U ?? 0))
            row("why", result?.why ?? "—")
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    Rectangle().fill(Color(white: 0.12)).frame(height: 8)
                    Rectangle()
                        .fill(Color(red: 196/255, green: 165/255, blue: 116/255))
                        .frame(width: g.size.width * CGFloat(min(1, result?.C_mesh ?? 0)), height: 8)
                }
            }.frame(height: 8)
            Text("Thermal, Low Power and battery <20% clamp C_mesh to 0. Background duty 0.25.")
                .font(.caption).foregroundStyle(.secondary)
            HStack {
                Button("Pulse") { pulse() }
                Button("Sign out") { token = ""; challenge = "" }
            }.buttonStyle(.bordered)
            Text(msg).font(.caption).foregroundStyle(.secondary)
        }
        .padding().overlay(Rectangle().stroke(Color(white: 0.12)))
    }

    func row(_ k: String, _ v: String) -> some View {
        HStack { Text(k).foregroundStyle(.secondary); Spacer(); Text(v) }.font(.callout)
    }

    func sample() -> EdgeUsage.Sample {
        UIDevice.current.isBatteryMonitoringEnabled = true
        let batt = Double(UIDevice.current.batteryLevel >= 0 ? UIDevice.current.batteryLevel : 1)
        let thermal: String
        switch ProcessInfo.processInfo.thermalState {
        case .fair: thermal = "fair"
        case .serious: thermal = "serious"
        case .critical: thermal = "critical"
        default: thermal = "nominal"
        }
        return EdgeUsage.Sample(
            cpu: 0.12,
            battery: batt,
            thermal: thermal,
            net: 0.08,
            foreground: true,
            lowPower: ProcessInfo.processInfo.isLowPowerModeEnabled,
            constrainedNetwork: false
        )
    }

    func pulse() {
        let r = EdgeUsage.compute(sample())
        result = r
        guard !token.isEmpty else { return }
        Task { await heartbeat(r) }
    }

    func connect() async {
        let id = nodeId.trimmingCharacters(in: .whitespaces).uppercased()
        nodeId = id
        do {
            if challenge.isEmpty {
                let ch = try await post("https://calhegasmorais.pt/api/auth/fog/bootstrap/challenge", ["node_id": id, "lang": "en"])
                guard (ch["success"] as? Bool) == true else { msg = "\(ch["error"] ?? "unknown node")"; return }
                challenge = ch["challenge"] as? String ?? ""
                masked = ch["operator_masked"] as? String ?? ""
                msg = "Enter the code mailed to \(masked)."
            } else {
                let vr = try await post("https://calhegasmorais.pt/api/auth/fog/bootstrap/verify", [
                    "node_id": id, "challenge": challenge, "code": otp, "lang": "en"
                ])
                guard (vr["success"] as? Bool) == true, let tok = vr["bootstrap_token"] as? String else {
                    msg = "\(vr["error"] ?? "bad code")"; return
                }
                token = tok
                msg = "connected"
                pulse()
            }
        } catch { msg = error.localizedDescription }
    }

    func heartbeat(_ r: EdgeUsage.Result) async {
        do {
            let body: [String: Any] = [
                "node_id": nodeId,
                "continuity": "session",
                "parent_fog": "FOG-NODE-PT-CM-001",
                "substrate": "ios-native",
                "usage": ["C_mesh": r.C_mesh, "U": r.U, "why": r.why, "duty": r.duty, "foreground": true]
            ]
            let res = try await post("https://api-edge.calhegasmorais.pt/v1/edge/heartbeat", body, token: token)
            msg = (res["ok"] as? Bool) == true ? "heartbeat ok" : "\(res["error"] ?? "fail")"
        } catch { msg = error.localizedDescription }
    }

    func post(_ url: String, _ body: [String: Any], token: String? = nil) async throws -> [String: Any] {
        var req = URLRequest(url: URL(string: url)!)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, _) = try await URLSession.shared.data(for: req)
        return (try JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
    }
}
