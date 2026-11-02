"""One-off: follow each stream's redirects like a browser would and report the final URL,
content type and whether audio arrives (https pages can't play http:// audio)."""
import json, subprocess
from pathlib import Path
d = json.loads(Path("probe/result.json").read_text())
urls = [c["url"] for c in d["current"]] + [c["url"] for c in d["candidates"] if c["runner"][0] == "ok"]
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"
out = []
for u in dict.fromkeys(urls):
    p = subprocess.run(["curl", "-sS", "-L", "--max-time", "8", "-A", UA, "-H", "Origin: https://ranjithkb.com",
                        "-o", "/tmp/b", "-w", "%{http_code}|%{url_effective}|%{content_type}|%{num_redirects}|%{size_download}", u],
                       capture_output=True, text=True)
    hdr = subprocess.run(["curl", "-sS", "-I", "-L", "--max-time", "6", "-A", UA, u], capture_output=True, text=True).stdout
    locs = [l.split(":", 1)[1].strip() for l in hdr.splitlines() if l.lower().startswith("location:")]
    out.append({"url": u, "result": p.stdout, "rc": p.returncode, "locations": locs})
Path("probe/redirects.json").write_text(json.dumps(out, indent=1))
