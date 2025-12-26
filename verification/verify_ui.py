import os
from playwright.sync_api import sync_playwright

def verify_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the local index.html directly
        cwd = os.getcwd()
        page.goto(f"file://{cwd}/index.html")

        # 1. Verify Load Button Text and Labels
        btnA = page.locator("#btnA")
        btnB = page.locator("#btnB")

        # Screenshot the top toolbar area to verify buttons and labels
        page.locator(".h-12").screenshot(path="verification/toolbar.png")
        print("Captured toolbar screenshot")

        # 2. Verify Color Tuning Bands (Swap Darks/Lights)
        # Open the Color Tuning Drawer (#drawer-tools)
        # We need to hover or force open it to take a screenshot?
        # The drawers are side-drawers.
        # We can take a screenshot of the #drawer-tools contents even if hidden offscreen,
        # or we can force its transform to 0 to make it visible.

        # Temporarily make drawer visible for screenshot
        page.evaluate("document.querySelector('#drawer-tools').style.transform = 'translateY(-50%) translateX(0)'")
        page.wait_for_timeout(500) # Wait for transition

        # Screenshot the luminance row
        page.locator(".tuning-lum-row").screenshot(path="verification/lum_row.png")
        print("Captured luminance row screenshot")

        # 3. Verify Opacity Slider State (Should be disabled as no images loaded)
        opacity_slider = page.locator("#opacitySlider")
        is_disabled = opacity_slider.is_disabled()
        print(f"Opacity Slider Disabled: {is_disabled}")

        # Screenshot the opacity slider area
        opacity_slider.locator("..").screenshot(path="verification/opacity_area.png")

        browser.close()

if __name__ == "__main__":
    verify_ui()
