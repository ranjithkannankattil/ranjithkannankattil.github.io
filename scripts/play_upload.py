"""Upload the new Radio Velvet .aab to Google Play and roll it out on every closed test track.

Runs in GitHub Actions after each build. Needs the PLAY_SERVICE_ACCOUNT secret (the JSON key of a
Google Cloud service account that has release access in Play Console). Without it, it does nothing.
Each release still goes through Google's normal review before testers get it.
"""
import json, os, sys
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

PKG = "com.ranjithkb.radio"
key = os.environ.get("PLAY_SERVICE_ACCOUNT", "").strip()
if not key:
    print("No PLAY_SERVICE_ACCOUNT secret: skipping the Google Play upload."); sys.exit(0)
aab, version, notes = sys.argv[1], sys.argv[2], sys.argv[3]

creds = service_account.Credentials.from_service_account_info(
    json.loads(key), scopes=["https://www.googleapis.com/auth/androidpublisher"])
edits = build("androidpublisher", "v3", credentials=creds, cache_discovery=False).edits()
edit = edits.insert(packageName=PKG, body={}).execute()["id"]
up = edits.bundles().upload(packageName=PKG, editId=edit,
    media_body=MediaFileUpload(aab, mimetype="application/octet-stream", resumable=True)).execute()
code = str(up["versionCode"])
print(f"Uploaded {aab}: version code {code}")

tracks = [t["track"] for t in edits.tracks().list(packageName=PKG, editId=edit).execute().get("tracks", [])]
# closed tests: "alpha" plus any custom closed tracks; never production, open (beta) or internal
closed = [t for t in tracks if t not in ("production", "beta", "internal") and not t.startswith("wear:") and ":" not in t]
print("Tracks:", tracks, "-> releasing to", closed)
for t in closed:
    edits.tracks().update(packageName=PKG, editId=edit, track=t, body={"track": t, "releases": [{
        "name": f"{code} ({version})", "versionCodes": [code], "status": "completed",
        "releaseNotes": [{"language": "en-GB", "text": notes[:500]}]}]}).execute()
edits.commit(packageName=PKG, editId=edit).execute()
print(f"Sent {version} to Google for review on: {', '.join(closed)}")
