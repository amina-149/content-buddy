#!/usr/bin/env python3
"""
YouTube uploader via Playwright browser automation on studio.youtube.com
Zero API quota usage. Uses saved session cookies.

Usage:
  python youtube_upload.py \
    --video /path/to/video.mp4 \
    --title "My Video Title" \
    --description "Video description" \
    --cookies /path/to/youtube_cookies.json \
    [--shorts]
"""

import argparse
import json
import sys
import time
import os
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
except ImportError:
    print(json.dumps({"error": "playwright not installed. Run: pip install playwright && playwright install chromium"}))
    sys.exit(1)


def load_cookies(cookie_path: str) -> list:
    """Load cookies from JSON file (exported from browser via EditThisCookie or similar)."""
    with open(cookie_path, 'r') as f:
        cookies = json.load(f)
    
    # Normalize cookie format (EditThisCookie vs Playwright format)
    normalized = []
    for c in cookies:
        normalized.append({
            "name": c.get("name", c.get("Name", "")),
            "value": c.get("value", c.get("Value", "")),
            "domain": c.get("domain", c.get("Domain", ".youtube.com")),
            "path": c.get("path", c.get("Path", "/")),
            "secure": c.get("secure", c.get("Secure", True)),
            "httpOnly": c.get("httpOnly", c.get("HttpOnly", False)),
            "sameSite": c.get("sameSite", "None"),
        })
    return normalized


def upload_video(
    video_path: str,
    title: str,
    description: str,
    cookie_path: str,
    is_shorts: bool = False,
    headless: bool = True
) -> dict:
    """
    Upload video to YouTube via studio.youtube.com browser automation.
    Returns dict with video_id or error.
    """
    
    abs_video_path = str(Path(video_path).resolve())
    if not os.path.exists(abs_video_path):
        return {"error": f"Video file not found: {abs_video_path}"}
    
    if not os.path.exists(cookie_path):
        return {"error": f"Cookie file not found: {cookie_path}"}

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=headless,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-dev-shm-usage',
            ]
        )
        
        context = browser.new_context(
            viewport={"width": 1280, "height": 900},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            )
        )
        
        # Inject cookies
        try:
            cookies = load_cookies(cookie_path)
            context.add_cookies(cookies)
        except Exception as e:
            browser.close()
            return {"error": f"Failed to load cookies: {str(e)}"}
        
        page = context.new_page()
        
        try:
            # Navigate to YouTube Studio upload page
            print(json.dumps({"status": "navigating", "step": "opening_studio"}), flush=True)
            page.goto("https://studio.youtube.com", wait_until="networkidle", timeout=30000)
            
            # Check if logged in
            if "studio.youtube.com" not in page.url or "accounts.google.com" in page.url:
                browser.close()
                return {"error": "Not logged in. Export fresh cookies from browser and update cookie file."}
            
            # Click upload button
            print(json.dumps({"status": "uploading", "step": "clicking_upload_button"}), flush=True)
            
            # YouTube Studio upload button selectors (may need updating if YT changes UI)
            upload_selectors = [
                'button[aria-label="Upload videos"]',
                '#upload-btn',
                'ytcp-button#upload-btn',
                'button:has-text("Upload")',
            ]
            
            upload_btn = None
            for selector in upload_selectors:
                try:
                    upload_btn = page.wait_for_selector(selector, timeout=5000)
                    if upload_btn:
                        break
                except PlaywrightTimeout:
                    continue
            
            if not upload_btn:
                # Try the create button first
                page.click('button[aria-label="Create"]', timeout=10000)
                page.wait_for_timeout(1000)
                page.click('tp-yt-paper-item:has-text("Upload videos")', timeout=10000)
            else:
                upload_btn.click()
            
            page.wait_for_timeout(2000)
            
            # File input — YouTube uses a hidden input
            print(json.dumps({"status": "uploading", "step": "selecting_file"}), flush=True)
            
            # Wait for file input to appear
            file_input = page.wait_for_selector('input[type="file"]', timeout=15000)
            file_input.set_input_files(abs_video_path)
            
            print(json.dumps({"status": "uploading", "step": "file_selected_waiting_upload"}), flush=True)
            
            # Wait for upload dialog to appear
            page.wait_for_selector('ytcp-uploads-dialog', timeout=30000)
            
            # Wait for upload to start (progress bar appears)
            page.wait_for_selector('.progress-label', timeout=15000)
            
            # Fill in title
            print(json.dumps({"status": "uploading", "step": "filling_metadata"}), flush=True)
            
            # Clear and fill title field
            title_selector = '#title-textarea #child-input'
            page.wait_for_selector(title_selector, timeout=15000)
            page.triple_click(title_selector)
            page.keyboard.press('Control+a')
            page.type(title_selector, title, delay=30)
            
            # Fill description
            desc_selector = '#description-textarea #child-input'
            if page.is_visible(desc_selector):
                page.triple_click(desc_selector)
                page.keyboard.press('Control+a')
                page.type(desc_selector, description, delay=20)
            
            # Set as "Not made for kids"
            try:
                not_for_kids = page.wait_for_selector(
                    'tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]',
                    timeout=5000
                )
                not_for_kids.click()
            except PlaywrightTimeout:
                pass  # Already set or not required
            
            # Click Next through details steps (3 times to reach visibility)
            for step_num in range(3):
                print(json.dumps({"status": "uploading", "step": f"wizard_step_{step_num + 1}"}), flush=True)
                try:
                    next_btn = page.wait_for_selector(
                        'ytcp-button#next-button',
                        timeout=10000
                    )
                    next_btn.click()
                    page.wait_for_timeout(1500)
                except PlaywrightTimeout:
                    break
            
            # Wait for upload to complete (percentage reaches 100 or "Upload complete" text)
            print(json.dumps({"status": "uploading", "step": "waiting_for_upload_complete"}), flush=True)
            
            max_wait = 600  # 10 minutes max
            start = time.time()
            while time.time() - start < max_wait:
                try:
                    # Check for "Upload complete" or "Processing will begin shortly"
                    complete = page.query_selector('.progress-label.done')
                    if complete:
                        break
                    
                    # Also check by text
                    done_text = page.query_selector('text=Upload complete')
                    if done_text:
                        break
                    
                    processing_text = page.query_selector('text=Processing will begin shortly')
                    if processing_text:
                        break
                        
                    page.wait_for_timeout(3000)
                except Exception:
                    page.wait_for_timeout(3000)
            
            # Set visibility to Public (on the visibility step)
            try:
                public_radio = page.wait_for_selector(
                    'tp-yt-paper-radio-button[name="PUBLIC"]',
                    timeout=10000
                )
                public_radio.click()
            except PlaywrightTimeout:
                pass  # May already be public or handled differently
            
            # Click Publish / Save
            print(json.dumps({"status": "uploading", "step": "publishing"}), flush=True)
            
            publish_selectors = [
                'ytcp-button#done-button',
                'ytcp-button:has-text("Publish")',
                'ytcp-button:has-text("Save")',
            ]
            
            published = False
            for selector in publish_selectors:
                try:
                    btn = page.wait_for_selector(selector, timeout=5000)
                    if btn and btn.is_enabled():
                        btn.click()
                        published = True
                        break
                except PlaywrightTimeout:
                    continue
            
            if not published:
                browser.close()
                return {"error": "Could not find Publish button. UI may have changed."}
            
            # Wait for confirmation and extract video ID
            page.wait_for_timeout(3000)
            
            # Try to extract video URL from confirmation dialog
            video_id = None
            try:
                video_link = page.wait_for_selector(
                    'a[href*="youtu.be"], a[href*="youtube.com/watch"]',
                    timeout=10000
                )
                if video_link:
                    href = video_link.get_attribute('href')
                    # Extract ID from youtu.be/ID or ?v=ID
                    if 'youtu.be/' in href:
                        video_id = href.split('youtu.be/')[-1].split('?')[0]
                    elif 'v=' in href:
                        video_id = href.split('v=')[-1].split('&')[0]
            except PlaywrightTimeout:
                pass  # Confirmation dialog format varies
            
            browser.close()
            
            return {
                "success": True,
                "video_id": video_id,
                "platform": "youtube",
                "url": f"https://youtu.be/{video_id}" if video_id else None,
                "title": title
            }
            
        except Exception as e:
            browser.close()
            return {"error": str(e), "platform": "youtube"}


def main():
    parser = argparse.ArgumentParser(description='Upload video to YouTube via browser automation')
    parser.add_argument('--video', required=True, help='Path to video file')
    parser.add_argument('--title', required=True, help='Video title')
    parser.add_argument('--description', default='', help='Video description')
    parser.add_argument('--cookies', required=True, help='Path to YouTube cookies JSON file')
    parser.add_argument('--shorts', action='store_true', help='Mark as YouTube Shorts')
    parser.add_argument('--no-headless', action='store_true', help='Show browser window (debug mode)')
    
    args = parser.parse_args()
    
    result = upload_video(
        video_path=args.video,
        title=args.title,
        description=args.description,
        cookie_path=args.cookies,
        is_shorts=args.shorts,
        headless=not args.no_headless
    )
    
    print(json.dumps(result))
    sys.exit(0 if result.get("success") else 1)


if __name__ == '__main__':
    main()