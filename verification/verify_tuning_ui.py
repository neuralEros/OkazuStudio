from playwright.sync_api import sync_playwright, expect
import os
import time

def test_tuning_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        url = "file://" + os.path.abspath("index.html")
        page.goto(url)

        # Open Color Tuning Drawer (middle drawer)
        # Note: In the actual UI, drawers are hover-activated or similar.
        # But we can access the inputs directly usually, unless they are hidden/disabled.
        # They are just in a div.

        # 1. Test Band Switching
        # Set Red Hue to 50
        page.fill("#tune-hue", "50")
        page.evaluate("document.getElementById('tune-hue').dispatchEvent(new Event('input'))")

        # Verify Red Hue is 50
        val = page.input_value("#tune-hue")
        if val != "50":
            print(f"FAILED: Red Hue did not set to 50, got {val}")
            exit(1)

        # Click Orange Band
        page.click("#band-orange")

        # Verify Hue Slider reset to 0 (default for Orange)
        val = page.input_value("#tune-hue")
        if val != "0":
            print(f"FAILED: Switching to Orange did not reset slider. Got {val}, expected 0")
            exit(1)

        # Set Orange Hue to -20
        page.fill("#tune-hue", "-20")
        page.evaluate("document.getElementById('tune-hue').dispatchEvent(new Event('input'))")

        # Click Red Band
        page.click("#band-red")

        # Verify Hue Slider returned to 50
        val = page.input_value("#tune-hue")
        if val != "50":
            print(f"FAILED: Switching back to Red did not restore value. Got {val}, expected 50")
            exit(1)

        print("PASSED: Band Switching")

        # 2. Test Reset Band
        # We are on Red (50). Click Reset Band.
        page.click("#resetBandBtn")

        val = page.input_value("#tune-hue")
        if val != "0":
             print(f"FAILED: Reset Band did not reset slider. Got {val}, expected 0")
             exit(1)

        print("PASSED: Reset Band")

        browser.close()

if __name__ == "__main__":
    test_tuning_ui()
