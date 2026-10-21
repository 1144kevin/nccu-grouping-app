import XCTest

final class AppleIntakeUITests: XCTestCase {
  override func setUpWithError() throws { continueAfterFailure = false }

  @MainActor
  private func openTrial() -> XCUIApplication {
    let app = XCUIApplication(bundleIdentifier: "com.nccugrouping.nccuGrouping")
    app.launch()
    XCTAssertTrue(app.staticTexts["政缺一咖 · 本機需求訪談"].waitForExistence(timeout: 15))
    return app
  }

  @MainActor
  private func reveal(_ element: XCUIElement, in app: XCUIApplication) {
    for _ in 0..<18 {
      if element.isHittable { return }
      let scroll = app.scrollViews.allElementsBoundByIndex.max { $0.frame.height < $1.frame.height }!
      if element.exists && element.frame.midY < app.frame.midY { scroll.swipeDown() }
      else { scroll.swipeUp() }
    }
    XCTAssertTrue(element.isHittable, "Target control must be visible: \(element.label)")
  }

  @MainActor
  private func field(_ label: String, in app: XCUIApplication) -> XCUIElement {
    return app.descendants(matching: .any).matching(NSPredicate(
      format: "label == %@ AND (elementType == %d OR elementType == %d)",
      label, XCUIElement.ElementType.textView.rawValue, XCUIElement.ElementType.textField.rawValue
    )).firstMatch
  }

  @MainActor
  private func replace(_ label: String, with text: String, in app: XCUIApplication) {
    let input = field(label, in: app)
    reveal(input, in: app)
    input.tap()
    let previous = input.value as? String ?? ""
    if !previous.isEmpty {
      input.typeText(String(repeating: XCUIKeyboardKey.rightArrow.rawValue, count: previous.utf16.count))
      for _ in previous { input.typeText(XCUIKeyboardKey.delete.rawValue) }
    }
    for character in text { input.typeText(String(character)) }
    XCTAssertTrue(input.waitForExistence(timeout: 2))
    XCTAssertEqual(input.value as? String, text, "Fixture must be entered exactly before continuing")
    let caption = app.staticTexts[label]
    if caption.exists && caption.isHittable { caption.tap() }
  }

  @MainActor
  private func press(_ label: String, in app: XCUIApplication) {
    let button = app.buttons[label]
    reveal(button, in: app)
    XCTAssertTrue(button.isEnabled)
    button.tap()
  }

  @MainActor
  func testRealAppleInterviewAndReviewedTitlePreserveManualFields() throws {
    let app = openTrial()
    XCTAssertTrue(app.staticTexts["Apple 裝置端 AI 已就緒"].waitForExistence(timeout: 10))
    replace("跟分身說需求或補充資訊", with: "想喝熱湯，預算120元，不方便取餐", in: app)
    press("讓 Apple 分身整理", in: app)
    XCTAssertTrue(app.staticTexts["待核對摘要"].waitForExistence(timeout: 65))
    let first = app.descendants(matching: .any).matching(identifier: "apple-intake-summary").firstMatch.label
    XCTAssertFalse(first.isEmpty)
    XCTAssertNotEqual(first, "apple-intake-summary")
    replace("跟分身說需求或補充資訊", with: "更正，預算80元，我仍然不方便取餐", in: app)
    press("補充並重新整理", in: app)
    XCTAssertTrue(app.staticTexts["第2輪 · 你：更正，預算80元，我仍然不方便取餐"].waitForExistence(timeout: 65))
    let second = app.descendants(matching: .any).matching(identifier: "apple-intake-summary").firstMatch.label
    XCTAssertFalse(second.isEmpty)
    XCTAssertNotEqual(second, "apple-intake-summary")
    let response = XCTAttachment(string: "Synthetic fixture only\nFirst: \(first)\nCorrection: \(second)")
    response.name = "Apple interview synthetic responses"
    response.lifetime = .keepAlways
    add(response)
    replace("每人預算上限（整數，留白未知）", with: "80", in: app)
    replace("已知每人費用（整數，留白未知）", with: "60", in: app)
    replace("從服務時間幾分鐘後開始", with: "45", in: app)
    replace("核對後的需求標題", with: "Soup, budget 80, no pickup", in: app)
    press("將摘要放入需求標題，再手動核對", in: app)
    XCTAssertEqual(field("我的需求或計畫（只有自己可見）", in: app).value as? String, "Soup, budget 80, no pickup")
    XCTAssertEqual(field("每人預算上限（整數，留白未知）", in: app).value as? String, "80")
    XCTAssertEqual(field("已知每人費用（整數，留白未知）", in: app).value as? String, "60")
    XCTAssertEqual(field("從服務時間幾分鐘後開始", in: app).value as? String, "45")
    XCTAssertFalse(app.buttons["確認需求並交給分身"].exists)
  }

  @MainActor
  func testManualInputWorksWithoutCallingAI() throws {
    let app = openTrial()
    replace("我的需求或計畫（只有自己可見）", with: "Manual soup request", in: app)
    replace("每人預算上限（整數，留白未知）", with: "90", in: app)
    XCTAssertEqual(field("我的需求或計畫（只有自己可見）", in: app).value as? String, "Manual soup request")
    XCTAssertEqual(field("每人預算上限（整數，留白未知）", in: app).value as? String, "90")
    XCTAssertFalse(app.staticTexts["待核對摘要"].exists)
    XCTAssertFalse(app.buttons["確認需求並交給分身"].exists)
  }
}
