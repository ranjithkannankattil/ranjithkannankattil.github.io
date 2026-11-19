#!/usr/bin/env python3
"""Replace the Radio Velvet store listing's phone screenshots on Google Play (no app upload).

Reads play-01.png … play-08.png from https://media.ranjithkb.com/radio/play/<version>/ and puts them on every
language of the listing. Run by hand from Actions ("Play store screenshots"); needs the PLAY_SERVICE_ACCOUNT secret.
Google reviews listing changes like a release.
"""
import json, os, sys, tempfile, urllib.request
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

PKG = "com.ranjithkb.radio"
version = sys.argv[1]
base = f"https://media.ranjithkb.com/radio/play/{version}"
files = []
for i in range(1, 9):
    u = f"{base}/play-{i:02d}.png"
    req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0 (RadioVelvet release script)"})
    try:
        data = urllib.request.urlopen(req, timeout=30).read()
    except Exception as e:
        print("Missing", u, "-", e); break
    f = os.path.join(tempfile.gettempdir(), f"play-{i:02d}.png"); open(f, "wb").write(data); files.append(f)
if len(files) < 2:
    sys.exit("Fewer than 2 screenshots found: nothing changed.")
creds = service_account.Credentials.from_service_account_info(
    json.loads(os.environ["PLAY_SERVICE_ACCOUNT"]), scopes=["https://www.googleapis.com/auth/androidpublisher"])
edits = build("androidpublisher", "v3", credentials=creds, cache_discovery=False).edits()
edit = edits.insert(packageName=PKG, body={}).execute()["id"]
langs = [l["language"] for l in edits.listings().list(packageName=PKG, editId=edit).execute().get("listings", [])] or ["en-GB"]
for lang in langs:
    edits.images().deleteall(packageName=PKG, editId=edit, language=lang, imageType="phoneScreenshots").execute()
    for f in files:
        edits.images().upload(packageName=PKG, editId=edit, language=lang, imageType="phoneScreenshots",
            media_body=MediaFileUpload(f, mimetype="image/png")).execute()
edits.commit(packageName=PKG, editId=edit).execute()
print(f"Store listing: {len(files)} phone screenshots for {', '.join(langs)} sent to Google for review")
