
from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        # Load local index.html with file:// protocol
        path = os.path.abspath('index.html')
        page.goto(f'file://{path}')

        # Take screenshot of the initial state
        page.screenshot(path='verification/initial.png')

        # Hover over the middle drawer (Color Tuning) to open it
        # The drawer ID is 'drawer-tools'
        # We need to simulate hover.
        page.locator('#drawer-tools').hover()

        # Wait for the drawer content to be visible or animation to likely complete
        page.wait_for_timeout(500)

        # Take a screenshot of the opened Color Tuning drawer
        page.screenshot(path='verification/color_tuning_drawer.png')

        # Click on the 'Green' band button
        page.locator('#band-green').click()

        # Verify it has the active class (by taking screenshot or checking class)
        # Check active class style via screenshot
        page.wait_for_timeout(200)
        page.screenshot(path='verification/green_band_selected.png')

        browser.close()

if __name__ == '__main__':
    run()
