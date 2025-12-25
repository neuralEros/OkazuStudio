from playwright.sync_api import sync_playwright
import os
import time

def debug_reset():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))

        url = "file://" + os.path.abspath("index.html")
        page.goto(url)
        time.sleep(1)

        # 1. Select Orange, set Hue to 50
        print("--- SETUP: Orange Hue -> 50 ---")
        page.evaluate("document.getElementById('band-orange').click()")
        page.fill("#tune-hue", "50")
        page.evaluate("document.getElementById('tune-hue').dispatchEvent(new Event('input'))")

        val = page.evaluate("document.getElementById('tune-hue').value")
        print(f"VAL BEFORE RESET: {val}")

        # 2. Click Reset Band
        print("--- CLICKING RESET BAND ---")
        page.evaluate("document.getElementById('resetBandBtn').click()")
        time.sleep(0.5)

        val_after = page.evaluate("document.getElementById('tune-hue').value")
        print(f"VAL AFTER RESET: {val_after}")

        if val_after != "0":
            print("FAILED: Reset didn't work")
        else:
            print("PASSED: Reset worked")

        browser.close()

if __name__ == "__main__":
    debug_reset()
