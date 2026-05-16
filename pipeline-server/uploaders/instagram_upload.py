#!/usr/bin/env python3
"""
Instagram Reels uploader via instagrapi (uses private mobile API — no Graph API needed)
Zero official API costs. Works with personal AND business accounts.

Usage:
  python instagram_upload.py \
    --video /path/to/video.mp4 \
    --caption "My caption #hashtag" \
    --username your_username \
    --password your_password \
    [--session /path/to/session.json]

Session file caches login state to avoid repeated 2FA prompts.
"""

import argparse
import json
import sys
import os
from pathlib import Path

try:
    from instagrapi import Client
    from instagrapi.exceptions import LoginRequired, TwoFactorRequired, ChallengeRequired
except ImportError:
    print(json.dumps({
        "error": "instagrapi not installed. Run: pip install instagrapi"
    }))
    sys.exit(1)


SESSION_DEFAULT = Path.home() / '.omnisolve' / 'instagram_session.json'


def get_client(username: str, password: str, session_path: str = None) -> Client:
    """
    Initialize instagrapi client with session caching.
    On first run: full login (may trigger 2FA).
    On subsequent runs: reuse cached session.
    """
    cl = Client()
    
    # Anti-detection settings
    cl.set_locale('en_US')
    cl.set_timezone_offset(0)
    
    session_file = Path(session_path or SESSION_DEFAULT)
    session_file.parent.mkdir(parents=True, exist_ok=True)
    
    if session_file.exists():
        try:
            cl.load_settings(str(session_file))
            cl.login(username, password)
            print(json.dumps({"status": "auth", "step": "session_reused"}), flush=True)
            return cl
        except LoginRequired:
            print(json.dumps({"status": "auth", "step": "session_expired_relogging"}), flush=True)
            session_file.unlink(missing_ok=True)
    
    # Fresh login
    try:
        print(json.dumps({"status": "auth", "step": "fresh_login"}), flush=True)
        cl.login(username, password)
        cl.dump_settings(str(session_file))
        return cl
    
    except TwoFactorRequired:
        raise Exception(
            "2FA required. Run this script manually once with --no-headless equivalent "
            "to complete 2FA, then the session will be cached for future runs. "
            "Or disable 2FA on your Instagram account used for automation."
        )
    
    except ChallengeRequired:
        raise Exception(
            "Instagram challenge required (suspicious login). "
            "Open Instagram app on your phone and approve the login, then retry."
        )


def upload_reel(
    video_path: str,
    caption: str,
    username: str,
    password: str,
    session_path: str = None,
    thumbnail_path: str = None
) -> dict:
    """
    Upload video as Instagram Reel.
    Returns dict with media_id and url or error.
    """
    
    abs_video_path = str(Path(video_path).resolve())
    if not os.path.exists(abs_video_path):
        return {"error": f"Video file not found: {abs_video_path}"}
    
    try:
        cl = get_client(username, password, session_path)
        
        print(json.dumps({"status": "uploading", "step": "uploading_reel"}), flush=True)
        
        # Upload as Reel
        kwargs = {
            "path": abs_video_path,
            "caption": caption,
        }
        
        if thumbnail_path and os.path.exists(thumbnail_path):
            kwargs["thumbnail"] = thumbnail_path
        
        media = cl.clip_upload(**kwargs)
        
        media_id = media.id
        # Construct URL from username and media code
        media_code = cl.media_id_to_code(media_id)
        url = f"https://www.instagram.com/reel/{media_code}/"
        
        return {
            "success": True,
            "platform": "instagram",
            "media_id": str(media_id),
            "media_code": media_code,
            "url": url,
            "caption": caption[:50] + "..." if len(caption) > 50 else caption
        }
        
    except Exception as e:
        return {"error": str(e), "platform": "instagram"}


def main():
    parser = argparse.ArgumentParser(description='Upload Reel to Instagram via instagrapi')
    parser.add_argument('--video', required=True, help='Path to video file')
    parser.add_argument('--caption', required=True, help='Reel caption with hashtags')
    parser.add_argument('--username', required=True, help='Instagram username')
    parser.add_argument('--password', required=True, help='Instagram password')
    parser.add_argument('--session', default=None, help='Path to session cache file')
    parser.add_argument('--thumbnail', default=None, help='Path to thumbnail image (optional)')
    
    args = parser.parse_args()
    
    result = upload_reel(
        video_path=args.video,
        caption=args.caption,
        username=args.username,
        password=args.password,
        session_path=args.session,
        thumbnail_path=args.thumbnail
    )
    
    print(json.dumps(result))
    sys.exit(0 if result.get("success") else 1)


if __name__ == '__main__':
    main()