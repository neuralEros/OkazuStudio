
from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_viewport_size({"width": 1280, "height": 720})
        
        file_path = os.path.abspath("index.html")
        page.goto(f"file://{file_path}")
        
        # Trigger modal with correct signature: title, message, choices
        page.evaluate("""
            window.showModal(
                'Test Title', 
                'Comparison Check.', 
                [{ label: 'Action', value: 'action' }]
            );
        """)
        
        # Wait for modal visibility
        page.wait_for_selector("#modal-overlay")
        page.wait_for_timeout(500)
        
        page.screenshot(path="/home/jules/verification/fix_check.png")
        print("Screenshot generated.")
        browser.close()

if __name__ == "__main__":
    run()
