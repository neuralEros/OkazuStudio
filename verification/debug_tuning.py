from playwright.sync_api import sync_playwright
import os
import time

def debug_tuning():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Capture console logs
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))

        url = "file://" + os.path.abspath("index.html")
        page.goto(url)

        time.sleep(1)

        # 2. Interact with Bands (Force Click)
        print("--- CLICKING ORANGE BAND ---")
        page.evaluate("document.getElementById('band-orange').click()")
        time.sleep(0.5)

        # Check State
        state_band = page.evaluate("window.appState.activeColorBand")
        print(f"STATE: activeColorBand = {state_band}")

        # Check UI Slider Value
        hue_val = page.evaluate("document.getElementById('tune-hue').value")
        print(f"UI: tune-hue = {hue_val}")

        # 3. Change Slider (Force Input)
        print("--- MOVING HUE SLIDER TO 50 ---")
        page.fill("#tune-hue", "50") # Fill works if element exists in DOM, usually less strict than click
        page.evaluate("document.getElementById('tune-hue').dispatchEvent(new Event('input'))")
        time.sleep(0.5)

        hue_val_new = page.evaluate("document.getElementById('tune-hue').value")
        print(f"UI: tune-hue = {hue_val_new}")

        state_val = page.evaluate("window.appState.adjustments.colorTuning.orange.hue")
        print(f"STATE: colorTuning.orange.hue = {state_val}")

        # 4. Switch Back to Red
        print("--- CLICKING RED BAND ---")
        page.evaluate("document.getElementById('band-red').click()")
        time.sleep(0.5)

        hue_val_red = page.evaluate("document.getElementById('tune-hue').value")
        print(f"UI: tune-hue (Red) = {hue_val_red}")

        state_band = page.evaluate("window.appState.activeColorBand")
        print(f"STATE: activeColorBand = {state_band}")

        # 5. Switch Back to Orange
        print("--- CLICKING ORANGE BAND AGAIN ---")
        page.evaluate("document.getElementById('band-orange').click()")
        time.sleep(0.5)

        hue_val_orange = page.evaluate("document.getElementById('tune-hue').value")
        print(f"UI: tune-hue (Orange) = {hue_val_orange}")

        browser.close()

if __name__ == "__main__":
    debug_tuning()
