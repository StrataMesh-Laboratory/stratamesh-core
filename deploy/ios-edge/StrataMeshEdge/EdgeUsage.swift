import Foundation

/// C_mesh = f(1-U). Residual Edge contribution. Not a Fog. Lab, not mainnet.
struct EdgeUsage {
    static let version = "0.3.1"
    static let batteryFloor = 0.20
    static let dutyForeground = 1.0
    static let dutyBackground = 0.25

    struct Sample {
        var cpu: Double
        var battery: Double
        var thermal: String
        var net: Double
        var foreground: Bool
        var lowPower: Bool
        var constrainedNetwork: Bool
    }

    struct Result {
        var C_mesh: Double
        var U: Double
        var residual: Double
        var duty: Double
        var why: String
        var blocked: Bool
    }

    static func thermalScore(_ name: String) -> Double {
        switch name.lowercased() {
        case "fair": return 0.33
        case "serious": return 0.72
        case "critical": return 1.0
        default: return 0.0
        }
    }

    static func compute(_ s: Sample, cap: Double = 1.0) -> Result {
        let battStress = 1.0 - min(1, max(0, s.battery))
        let u = min(1, max(0,
            0.35 * min(1, max(0, s.cpu))
            + 0.25 * battStress
            + 0.15 * thermalScore(s.thermal)
            + 0.15 * min(1, max(0, s.net))
            + 0.10 * (s.foreground ? 0.0 : 1.0)
        ))
        let blocked = s.battery < batteryFloor
            || s.lowPower
            || s.thermal == "serious" || s.thermal == "critical"
            || s.constrainedNetwork
        let residual = max(0, 1 - u)
        let duty = s.foreground ? dutyForeground : dutyBackground
        if blocked {
            return Result(C_mesh: 0, U: u, residual: residual, duty: duty, why: "safety_clamp", blocked: true)
        }
        return Result(C_mesh: residual * duty * cap, U: u, residual: residual, duty: duty, why: "residual", blocked: false)
    }
}
