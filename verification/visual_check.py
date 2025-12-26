from playwright.sync_api import sync_playwright, expect
import os
import time

def verify_visuals():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        # Set viewport big enough to show all drawers
        page.set_viewport_size({"width": 1280, "height": 1024})

        url = "file://" + os.path.abspath("index.html")
        page.goto(url)

        # Hover over the Color Tuning Drawer (middle one) to open it
        # Based on index.html: #drawer-tools
        # Wait for it to be ready
        time.sleep(1)

        # We need to force visibility or hover.
        # Since drawers are position fixed/absolute on the right, let's try to hover.
        # #drawer-tools contains the "Lip" and "Content".
        # The Lip is always visible.

        page.hover("#drawer-tools")

        # Wait for transition
        time.sleep(1)

        # Take screenshot of the drawer area
        page.locator("#drawer-tools").screenshot(path="verification/drawer_tuning.png")

        # Also take full page
        page.screenshot(path="verification/full_page.png")

        browser.close()

if __name__ == "__main__":
    verify_visuals()
