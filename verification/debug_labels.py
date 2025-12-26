from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        cwd = os.getcwd()
        page.goto(f"file://{cwd}/index.html")

        # 1. Screenshot current state (Toolbar + top of canvas)
        # Clip to a region that includes the bottom of the toolbar and top of canvas
        page.screenshot(path="verification/labels_before.png", clip={"x":0, "y":0, "width": 600, "height": 100})

        # 2. Apply fix: Remove overflow-x-auto from toolbar
        # The toolbar is the div with class 'h-12'
        page.evaluate("""
            const toolbar = document.querySelector('.h-12');
            toolbar.classList.remove('overflow-x-auto');
            toolbar.classList.add('overflow-visible');
        """)

        # 3. Screenshot after fix
        page.screenshot(path="verification/labels_after.png", clip={"x":0, "y":0, "width": 600, "height": 100})

        browser.close()

if __name__ == "__main__":
    run()
