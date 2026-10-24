import AVFoundation
import ExpoModulesCore
import Speech
import UIKit

// Speech transcription is separate from Foundation Models and works without Apple Intelligence.
public class PostSpeechModule: Module {
  @MainActor private var capture: PostSpeechCapture?
  @MainActor private var pendingID: String?
  @MainActor private var cancelledIDs: [String] = []
  private var backgroundObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("NCCUPostSpeech")
    Events("text", "end", "error")
    AsyncFunction("start") { [weak self] (id: String, promise: Promise) in
      Task { @MainActor [weak self] in
        guard let self else { promise.reject("post_speech_failed", "post_speech_failed"); return }
        guard !self.cancelledIDs.contains(id), UIApplication.shared.applicationState == .active else {
          promise.reject("post_speech_cancelled", "post_speech_cancelled"); return
        }
        guard self.pendingID == nil, self.capture == nil else {
          promise.reject("post_speech_busy", "post_speech_busy"); return
        }
        self.pendingID = id
        let authorized = await withCheckedContinuation { continuation in
          SFSpeechRecognizer.requestAuthorization { continuation.resume(returning: $0 == .authorized) }
        }
        guard self.pendingID == id else { promise.reject("post_speech_cancelled", "post_speech_cancelled"); return }
        guard authorized else {
          self.pendingID = nil
          promise.reject("post_speech_permission_denied", "post_speech_permission_denied"); return
        }
        let microphone = await withCheckedContinuation { continuation in
          AVAudioSession.sharedInstance().requestRecordPermission { continuation.resume(returning: $0) }
        }
        guard self.pendingID == id else { promise.reject("post_speech_cancelled", "post_speech_cancelled"); return }
        guard UIApplication.shared.applicationState != .background else {
          self.pendingID = nil
          promise.reject("post_speech_cancelled", "post_speech_cancelled"); return
        }
        guard microphone else {
          self.pendingID = nil
          promise.reject("post_speech_permission_denied", "post_speech_permission_denied"); return
        }
        do {
          let capture = PostSpeechCapture(id: id) { [weak self] event, data in
            self?.sendEvent(event, data)
            if event != "text" { self?.capture = nil; self?.pendingID = nil }
          }
          self.capture = capture
          try capture.start()
          promise.resolve(nil)
        } catch {
          self.capture?.cancel(); self.capture = nil; self.pendingID = nil
          promise.reject("post_speech_failed", "post_speech_failed")
        }
      }
    }
    Function("stop") { [weak self] (id: String) in
      Task { @MainActor in if self?.capture?.id == id { self?.capture?.stop() } }
    }
    Function("cancel") { [weak self] (id: String) in
      Task { @MainActor in
        self?.cancelledIDs.append(id)
        if let count = self?.cancelledIDs.count, count > 32 { self?.cancelledIDs.removeFirst(count - 32) }
        if self?.pendingID == id { self?.pendingID = nil }
        if self?.capture?.id == id { self?.capture?.cancel(); self?.capture = nil }
      }
    }
    OnCreate { [weak self] in
      self?.backgroundObserver = NotificationCenter.default.addObserver(
        forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main
      ) { [weak self] _ in
        Task { @MainActor in
          self?.pendingID = nil
          self?.capture?.fail("post_speech_interrupted"); self?.capture = nil
        }
      }
    }
    OnDestroy { [weak self] in
      if let observer = self?.backgroundObserver { NotificationCenter.default.removeObserver(observer) }
      Task { @MainActor [weak self] in
        self?.pendingID = nil; self?.capture?.cancel(); self?.capture = nil
      }
    }
  }
}

@MainActor
private final class PostSpeechCapture {
  let id: String
  private let engine = AVAudioEngine()
  private let request = SFSpeechAudioBufferRecognitionRequest()
  private var task: SFSpeechRecognitionTask?
  private var timer: Timer?
  private var finishTimer: Timer?
  private var text = ""
  private var active = true
  private var tapped = false
  private var stopping = false
  private let emit: (String, [String: String]) -> Void

  init(id: String, emit: @escaping (String, [String: String]) -> Void) {
    self.id = id; self.emit = emit
  }

  func start() throws {
    guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "zh-TW")), recognizer.isAvailable else {
      throw NSError(domain: "post_speech_unavailable", code: 1)
    }
    let session = AVAudioSession.sharedInstance()
    try session.setCategory(.record, mode: .measurement, options: .duckOthers)
    try session.setActive(true, options: .notifyOthersOnDeactivation)
    request.shouldReportPartialResults = true
    if recognizer.supportsOnDeviceRecognition { request.requiresOnDeviceRecognition = true }
    let input = engine.inputNode
    let format = input.outputFormat(forBus: 0)
    guard format.sampleRate > 0, format.channelCount > 0 else {
      throw NSError(domain: "post_speech_unavailable", code: 2)
    }
    input.installTap(onBus: 0, bufferSize: 1024, format: format) { [request] buffer, _ in
      request.append(buffer)
    }
    tapped = true
    task = recognizer.recognitionTask(with: request) { [weak self] result, error in
      let transcript = result?.bestTranscription.formattedString
      let final = result?.isFinal == true
      Task { @MainActor [weak self] in
        guard let self, self.active else { return }
        if let transcript {
          self.text = String(transcript.prefix(4000))
          self.emit("text", ["id": self.id, "text": self.text])
        }
        if final { self.finish() }
        else if error != nil {
          if self.stopping && !self.text.isEmpty { self.finish() }
          else { self.fail("post_speech_failed") }
        } else if self.text.count >= 4000 { self.stop() }
      }
    }
    engine.prepare()
    try engine.start()
    timer = Timer.scheduledTimer(withTimeInterval: 60, repeats: false) { [weak self] _ in
      Task { @MainActor in self?.stop() }
    }
  }
  func stop() {
    guard active, !stopping else { return }
    stopping = true; stopAudio(); request.endAudio()
    finishTimer = Timer.scheduledTimer(withTimeInterval: 3, repeats: false) { [weak self] _ in
      Task { @MainActor in self?.finish() }
    }
  }
  func cancel() { active = false; cleanup() }
  func fail(_ code: String) {
    guard active else { return }
    active = false; cleanup(); emit("error", ["id": id, "code": code])
  }
  private func finish() {
    guard active else { return }
    active = false; cleanup(); emit("end", ["id": id, "text": text])
  }
  private func stopAudio() {
    engine.stop()
    if tapped { engine.inputNode.removeTap(onBus: 0); tapped = false }
  }
  private func cleanup() {
    timer?.invalidate(); finishTimer?.invalidate()
    stopAudio(); request.endAudio(); task?.cancel(); task = nil
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  }
}
