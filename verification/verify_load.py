from playwright.sync_api import sync_playwright, expect
import time
import os

def test_load_no_spam():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the local index.html
        url = "file://" + os.path.abspath("index.html")
        page.goto(url)

        # Wait a bit to see if spam occurs
        time.sleep(2)

        # Check for error console messages
        # The app logs errors to #error-console .console-msg
        error_msgs = page.locator("#error-console .console-msg.error").all_text_contents()

        print("Error messages found:", error_msgs)

        # We expect NO "Task failed" messages
        task_failures = [msg for msg in error_msgs if "Task failed" in msg]

        if task_failures:
            print("FAILED: Found Task failed messages!")
            for msg in task_failures:
                print(msg)
            exit(1)
        else:
            print("PASSED: No Task failed messages found.")

        # Also verify we can see the Adjustments drawer (just to ensure UI loaded)
        page.locator("#drawer-adj").hover()
        expect(page.locator("#drawer-adj")).to_be_visible()

        browser.close()

if __name__ == "__main__":
    test_load_no_spam()
