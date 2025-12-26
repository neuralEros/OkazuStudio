
from playwright.sync_api import sync_playwright, expect
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Determine absolute path to index.html
        cwd = os.getcwd()
        file_path = f"file://{cwd}/index.html"

        print(f"Loading {file_path}")
        page.goto(file_path)

        # Wait for app to load (checking for drawer-tools)
        expect(page.locator("#drawer-tools")).to_be_visible()

        # Hover over the tools drawer to open it
        page.locator("#drawer-tools").hover()

        # Wait for drawer content to be visible (transition)
        page.wait_for_timeout(500)

        # Take a screenshot of the drawer
        page.screenshot(path="verification/drawer_check_fixed_v3.png")
        print("Screenshot saved to verification/drawer_check_fixed_v3.png")

        browser.close()

if __name__ == "__main__":
    run()
