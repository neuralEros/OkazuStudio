from playwright.sync_api import sync_playwright
import os
import time

def verify_sliders():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))

        url = "file://" + os.path.abspath("index.html")
        page.goto(url)
        time.sleep(1)

        # 1. Fake Image Load
        # We inject a dummy canvas into state.imgA so canDraw() returns true
        print("--- INJECTING DUMMY IMAGE ---")
        page.evaluate("""
            const c = document.createElement('canvas');
            c.width=100; c.height=100;
            const ctx = c.getContext('2d');
            ctx.fillStyle='red'; ctx.fillRect(0,0,100,100);
            window.appState = { ...state }; # Expose state if not already (we removed it, but we can access `state` if we are in main scope... wait, state is not global?)
            # state is not global. We need to trigger handleFileLoad or similar.
            # Or we can just access the input directly and mock a file event? No, headless file chooser is tricky.
            # But wait, main.js is in global scope? No, it's inside `init()`?
            # `state` is defined at top level of main.js. But main.js is loaded as <script>.
            # So `state` IS global window.state?
            # Let's check.
        """)

        # Check if state is global
        is_global = page.evaluate("typeof window.state !== 'undefined'")
        if not is_global:
            # It's not attached to window explicitly, but declared with const in top level scope of script.
            # In browser, top level const is not on window.
            # But we can try to upload a file via input.
            pass

        # Create a dummy file
        with open("dummy.png", "wb") as f:
            f.write(b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82')

        print("--- UPLOADING FILE ---")
        with page.expect_file_chooser() as fc_info:
            page.evaluate("document.getElementById('fileA').click()")
        file_chooser = fc_info.value
        file_chooser.set_files("dummy.png")

        time.sleep(1)

        # 2. Check if Sliders are Enabled
        disabled = page.evaluate("document.getElementById('tune-hue').disabled")
        print(f"SLIDER DISABLED: {disabled}")

        if disabled:
            print("FAILED: Slider is disabled after image load")
            # exit(1) # Continue to debug

        # 3. Move Slider
        print("--- MOVING SLIDER ---")
        page.fill("#tune-hue", "50")
        page.evaluate("document.getElementById('tune-hue').dispatchEvent(new Event('input'))")

        # 4. Check Label
        label = page.inner_text("#val-tune-hue")
        print(f"LABEL VALUE: {label}")

        if label == "50":
            print("PASSED: Label updated")
        else:
            print(f"FAILED: Label did not update. Expected 50, got {label}")

        browser.close()

if __name__ == "__main__":
    verify_sliders()
