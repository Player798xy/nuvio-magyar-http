import cv2
import json
import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')

cmd = ['node', '-e', 'require("./src/scrapers/onlinestream.js").getOnlineStreamStreams("5901").then(s=>console.log(JSON.stringify(s)))']
proc = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
streams = json.loads(proc.stdout)

print(f"Testing {len(streams)} M1 streams with cv2:")
for i, s in enumerate(streams):
    url = s['url']
    name = s['name']
    print(f"\n[{i}] {name}")
    print(f"    URL: {url}")
    # OpenCV can read direct urls, for localhost proxy start server or test direct
    # If proxy url, extract original url
    test_url = url
    if '/proxy/hls.m3u8?url=' in url:
        import urllib.parse
        parsed = urllib.parse.urlparse(url)
        params = urllib.parse.parse_qs(parsed.query)
        test_url = params.get('url', [url])[0]
        print(f"    Target upstream: {test_url}")

    cap = cv2.VideoCapture(test_url)
    cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 5000)
    cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 5000)
    ret, frame = cap.read()
    if ret and frame is not None:
        h, w = frame.shape[:2]
        print(f"    ===> RESULT: WORKING! Resolution: {w}x{h} (Height: {h}p)")
    else:
        print(f"    ===> RESULT: FAILED TO PLAY!")
    cap.release()
