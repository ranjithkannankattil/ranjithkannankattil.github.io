#!/usr/bin/env python3
"""Replace the Radio Velvet store listing's phone screenshots on Google Play (no app upload).

Reads play-01.png … play-08.png from https://media.ranjithkb.com/radio/play/<version>/ and puts them on every
language of the listing. With "tv" as the version it does the Android TV listing instead: tv-01.png … tv-08.png
(1920 × 1080) from radio/play/tv/ as TV screenshots plus tv-banner.png (1280 × 720) as the TV banner; the phone
screenshots are left alone. Run by hand from Actions ("Play store screenshots"); needs the PLAY_SERVICE_ACCOUNT secret.
Google reviews listing changes like a release.
"""
import json, os, sys, tempfile, urllib.request
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

PKG = "com.ranjithkb.radio"
version = sys.argv[1]
tv = version == "tv"
base = f"https://media.ranjithkb.com/radio/play/{version}"
prefix, kind = ("tv", "tvScreenshots") if tv else ("play", "phoneScreenshots")

def fetch(name):
    u = f"{base}/{name}"
    req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0 (RadioVelvet release script)"})
    data = urllib.request.urlopen(req, timeout=30).read()
    f = os.path.join(tempfile.gettempdir(), name); open(f, "wb").write(data); return f

files = []
for i in range(1, 9):
    u = f"{base}/{prefix}-{i:02d}.png"
    req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0 (RadioVelvet release script)"})
    try:
        data = urllib.request.urlopen(req, timeout=30).read()
    except Exception as e:
        print("Missing", u, "-", e); break
    f = os.path.join(tempfile.gettempdir(), f"{prefix}-{i:02d}.png"); open(f, "wb").write(data); files.append(f)
banner = fetch("tv-banner.png") if tv else None
if len(files) < (1 if tv else 2):
    sys.exit("Fewer than 2 screenshots found: nothing changed.")
creds = service_account.Credentials.from_service_account_info(
    json.loads(os.environ["PLAY_SERVICE_ACCOUNT"]), scopes=["https://www.googleapis.com/auth/androidpublisher"])
edits = build("androidpublisher", "v3", credentials=creds, cache_discovery=False).edits()
edit = edits.insert(packageName=PKG, body={}).execute()["id"]
langs = [l["language"] for l in edits.listings().list(packageName=PKG, editId=edit).execute().get("listings", [])] or ["en-GB"]
for lang in langs:
    edits.images().deleteall(packageName=PKG, editId=edit, language=lang, imageType=kind).execute()
    for f in files:
        edits.images().upload(packageName=PKG, editId=edit, language=lang, imageType=kind,
            media_body=MediaFileUpload(f, mimetype="image/png")).execute()
    if banner:
        edits.images().deleteall(packageName=PKG, editId=edit, language=lang, imageType="tvBanner").execute()
        edits.images().upload(packageName=PKG, editId=edit, language=lang, imageType="tvBanner",
            media_body=MediaFileUpload(banner, mimetype="image/png")).execute()
edits.commit(packageName=PKG, editId=edit).execute()
print(f"Store listing: {len(files)} {'TV' if tv else 'phone'} screenshots{' and the TV banner' if tv else ''} for {', '.join(langs)} sent to Google for review")
