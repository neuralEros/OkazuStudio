from playwright.sync_api import sync_playwright
import os

def verify_app_loads():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Get absolute path to index.html
        cwd = os.getcwd()
        file_path = f"file://{cwd}/index.html"
        print(f"Navigating to {file_path}")

        page.goto(file_path)

        # Wait for the app to initialize
        page.wait_for_selector("#workspace-labels")

        # Take a screenshot
        page.screenshot(path="verification/app_loaded.png")

        browser.close()

if __name__ == "__main__":
    verify_app_loads()
