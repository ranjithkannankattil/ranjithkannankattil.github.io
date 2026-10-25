import UIKit
import AVFoundation
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Play as a music app: keeps going with the screen locked or the app in the
        // background, ignores the silent switch, and shows Now Playing controls.
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, policy: .longFormAudio)
        } catch {
            try? AVAudioSession.sharedInstance().setCategory(.playback)
        }
        // Calls, Siri, alarms: tell the Radio page when they start and end, so the station
        // pauses for the call and comes back on when iOS says it may resume.
        NotificationCenter.default.addObserver(self, selector: #selector(audioInterrupted(_:)),
            name: AVAudioSession.interruptionNotification, object: AVAudioSession.sharedInstance())
        return true
    }

    @objc private func audioInterrupted(_ note: Notification) {
        guard let info = note.userInfo,
              let raw = info[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
        switch type {
        case .began:
            sendToPage("radio:interruption-began")
        case .ended:
            let opts = AVAudioSession.InterruptionOptions(rawValue: info[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0)
            guard opts.contains(.shouldResume) else { return }   // e.g. another music app took over
            // Give the call's audio a moment to let go, then take the session back and resume.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
                try? AVAudioSession.sharedInstance().setActive(true)
                self.sendToPage("radio:interruption-ended")
            }
        @unknown default:
            break
        }
    }

    private func sendToPage(_ event: String) {
        DispatchQueue.main.async {
            for scene in UIApplication.shared.connectedScenes {
                guard let ws = scene as? UIWindowScene else { continue }
                for w in ws.windows {
                    (w.rootViewController as? CAPBridgeViewController)?.bridge?.triggerWindowJSEvent(eventName: event)
                }
            }
        }
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}
