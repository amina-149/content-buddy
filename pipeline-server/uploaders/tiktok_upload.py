#!/usr/bin/env python3
"""
TikTok uploader via tiktok-uploader (Playwright/Selenium browser automation)
Zero API costs. Uses saved session cookies.

Usage:
  python tiktok_upload.py \
    --video /path/to/video.mp4 \
    --title "My TikTok caption #fyp" \
    --cookies /path/to/tiktok_cookies.json \
    [--schedule "2026-05-21 10:00"]

Cookie export:
  1. Log into tiktok.com in Chrome
  2. Install "Cookie-Editor" extension
  3. Export cookies as JSON → save as tiktok_cookies.json
"""

import argparse
import json
import sys
import os
import time
from pathlib import Path
from datetime import datetime

try:
    from tiktok_uploader.upload import upload_video as tiktok_upload_video
    TIKTOK_UPLOADER_AVAILABLE = True
except ImportError:
    TIKTOK_UPLOADER_AVAILABLE = False

try:
    from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False


def upload_via_tiktok_uploader(
    video_path: str,
    title: str,
    cookie_path: str,
    schedule: str = None
) -> dict:
    """Primary method: uses tiktok-uploader library."""
    
    try:
        kwargs = {
            "filename": video_path,
            "description": title,
            "cookies": cookie_path,
            "headless": True,
            "browser": "chrome",
        }
        
        if schedule:
            # Parse schedule string to datetime
            dt = datetime.strptime(schedule, "%Y-%m-%d %H:%M")
            kwargs["schedule"] = dt
        
        print(json.dumps({"status": "uploading", "step": "tiktok_uploader_lib"}), flush=True)
        
        # tiktok-uploader returns list of results
        results = tiktok_upload_video(**kwargs)
        
        if results and len(results) > 0:
            return {
                "success": True,
                "platform": "tiktok",
                "title": title,
                "method": "tiktok-uploader"
            }
        else:
            return {"error": "tiktok-uploader returned no results", "platform": "tiktok"}
            
    except Exception as e:
        return {"error": str(e), "platform": "tiktok", "method": "tiktok-uploader"}


def upload_via_playwright(
    video_path: str,
    title: str,
    cookie_path: str,
    headless: bool = True
) -> dict:
    """
    Fallback method: direct Playwright automation on TikTok web upload.
    Used when tiktok-uploader library fails or isn't installed.
    """
    
    abs_video_path = str(Path(video_path).resolve())
    
    def load_cookies(path: str) -> list:
        with open(path, 'r') as f:
            raw = json.load(f)
        normalized = []
        for c in raw:
            entry = {
                "name": c.get("name", ""),
                "value": c.get("value", ""),
                "domain": c.get("domain", ".tiktok.com"),
                "path": c.get("path", "/"),
                "secure": c.get("secure", True),
                "sameSite": "None",
            }
            normalized.append(entry)
        return normalized
    
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=headless,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
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
        
        # Load cookies
        try:
            cookies = load_cookies(cookie_path)
            context.add_cookies(cookies)
        except Exception as e:
            browser.close()
            return {"error": f"Cookie load failed: {str(e)}"}
        
        page = context.new_page()
        
        try:
            print(json.dumps({"status": "uploading", "step": "navigating_tiktok"}), flush=True)
            
            # TikTok creator upload page
            page.goto(
                "https://www.tiktok.com/creator#/upload",
                wait_until="networkidle",
                timeout=30000
            )
            
            # Check authentication
            if "login" in page.url.lower():
                browser.close()
                return {
                    "error": "Not logged in to TikTok. Export fresh cookies after logging in.",
                    "platform": "tiktok"
                }
            
            print(json.dumps({"status": "uploading", "step": "selecting_video"}), flush=True)
            
            # Wait for file input
            file_input = page.wait_for_selector(
                'input[type="file"][accept*="video"]',
                timeout=15000
            )
            file_input.set_input_files(abs_video_path)
            
            print(json.dumps({"status": "uploading", "step": "waiting_for_processing"}), flush=True)
            
            # Wait for video to finish processing on TikTok's end
            # Look for caption input to appear (means video was accepted)
            caption_selector = '[data-text="true"], textarea[placeholder*="caption"], textarea[placeholder*="describe"]'
            page.wait_for_selector(caption_selector, timeout=120000)
            
            # Fill caption / title
            page.click(caption_selector)
            page.keyboard.press('Control+a')
            page.type(caption_selector, title, delay=25)
            
            page.wait_for_timeout(1000)
            
            # Post button
            print(json.dumps({"status": "uploading", "step": "posting"}), flush=True)
            
            post_selectors = [
                'button:has-text("Post")',
                'button[data-e2e="post_video_button"]',
                '.btn-post',
            ]
            
            for selector in post_selectors:
                try:
                    btn = page.wait_for_selector(selector, timeout=5000)
                    if btn and btn.is_enabled():
                        btn.click()
                        break
                except PlaywrightTimeout:
                    continue
            
            # Wait for success indicator
            page.wait_for_timeout(5000)
            
            # Check for success
            success_indicators = [
                'text=Your video is being uploaded',
                'text=Video uploaded',
                'text=Posted',
            ]
            
            success = False
            for indicator in success_indicators:
                try:
                    page.wait_for_selector(indicator, timeout=10000)
                    success = True
                    break
                except PlaywrightTimeout:
                    continue
            
            browser.close()
            
            if success:
                return {
                    "success": True,
                    "platform": "tiktok",
                    "title": title,
                    "method": "playwright-direct"
                }
            else:
                return {
                    "warning": "Upload may have succeeded but no confirmation found. Check TikTok manually.",
                    "platform": "tiktok",
                    "success": True,  # Assume success if no error thrown
                    "method": "playwright-direct"
                }
                
        except Exception as e:
            browser.close()
            return {"error": str(e), "platform": "tiktok"}


def main():
    parser = argparse.ArgumentParser(description='Upload video to TikTok via browser automation')
    parser.add_argument('--video', required=True, help='Path to video file')
    parser.add_argument('--title', required=True, help='TikTok caption/title')
    parser.add_argument('--cookies', required=True, help='Path to TikTok cookies JSON file')
    parser.add_argument('--schedule', default=None, help='Schedule time: "YYYY-MM-DD HH:MM"')
    parser.add_argument('--no-headless', action='store_true', help='Show browser (debug mode)')
    
    args = parser.parse_args()
    
    abs_video = str(Path(args.video).resolve())
    
    if not os.path.exists(abs_video):
        print(json.dumps({"error": f"Video not found: {abs_video}"}))
        sys.exit(1)
    
    # Try tiktok-uploader library first (more reliable)
    if TIKTOK_UPLOADER_AVAILABLE:
        result = upload_via_tiktok_uploader(
            video_path=abs_video,
            title=args.title,
            cookie_path=args.cookies,
            schedule=args.schedule
        )
        
        if result.get("success"):
            print(json.dumps(result))
            sys.exit(0)
        
        print(json.dumps({"status": "fallback", "reason": result.get("error")}), flush=True)
    
    # Fallback to direct Playwright
    if PLAYWRIGHT_AVAILABLE:
        result = upload_via_playwright(
            video_path=abs_video,
            title=args.title,
            cookie_path=args.cookies,
            headless=not args.no_headless
        )
    else:
        result = {
            "error": "Neither tiktok-uploader nor playwright is installed. "
                     "Run: pip install tiktok-uploader OR pip install playwright && playwright install chromium"
        }
    
    print(json.dumps(result))
    sys.exit(0 if result.get("success") else 1)


if __name__ == '__main__':
    main()