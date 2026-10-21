#!/usr/bin/env python3
"""
Neur demo launcher: one command to run the whole app locally, for free.

Starts two local servers and opens the app in your browser:
  - the backend API (api/server.py) on :8000
  - a static server for the app/ folder on :8080

No AWS, no Amazon Bedrock, no API keys. The agents run on the saved answers in
demo/scenarios/, so this works with no internet and costs nothing. A small
"Sample data" tag shows on the plan screen because the answers are saved, not
live.

Usage:
    python run_demo.py                 # fallback mode (saved answers as backup)
    python run_demo.py --demo          # force demo mode (saved answers only)
    python run_demo.py --no-open       # don't open the browser automatically
    python run_demo.py --api-port 9000 --web-port 9090

Stop everything with Ctrl-C.
"""

import argparse
import os
import sys
import threading
import time
import webbrowser
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent
APP_DIR = REPO_ROOT / "app"
sys.path.insert(0, str(REPO_ROOT))


def start_api(host, port):
    """Run the Neur backend API in a background thread."""
    from api.server import NeurHandler  # imported here so sys.path is set first

    httpd = ThreadingHTTPServer((host, port), NeurHandler)
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd


def start_web(host, port):
    """Serve the app/ folder (static files) in a background thread."""
    handler = partial(SimpleHTTPRequestHandler, directory=str(APP_DIR))
    httpd = ThreadingHTTPServer((host, port), handler)
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    return httpd


def main():
    parser = argparse.ArgumentParser(description="Run the Neur demo locally (no AWS, free).")
    parser.add_argument("--demo", action="store_true", help="Force demo mode (saved answers only).")
    parser.add_argument("--no-open", action="store_true", help="Don't open the browser.")
    parser.add_argument("--api-port", type=int, default=8000)
    parser.add_argument("--web-port", type=int, default=8080)
    parser.add_argument("--host", default="127.0.0.1")
    args = parser.parse_args()

    # Keep it free and offline: never try to reach Bedrock. Default to fallback,
    # which uses saved answers when no live agent is configured (none is here).
    os.environ.setdefault("NEUR_MODE", "demo" if args.demo else "fallback")
    # Make sure no stale Bedrock settings cause a live call attempt.
    os.environ.pop("BEDROCK_MODEL_ID", None)

    api = start_api(args.host, args.api_port)
    web = start_web(args.host, args.web_port)

    # The front end calls the API cross-origin; point it at the API port.
    app_url = f"http://{args.host}:{args.web_port}/?api=http://{args.host}:{args.api_port}"
    if args.demo:
        app_url += "&demo=1"

    print("Neur demo is running (local, no AWS, free).")
    print(f"  App:  {app_url}")
    print(f"  API:  http://{args.host}:{args.api_port}/health")
    print(f"  Mode: {os.environ['NEUR_MODE']}  (agents run on saved answers)")
    print("Press Ctrl-C to stop.")

    if not args.no_open:
        # Give the servers a moment, then open the browser.
        threading.Timer(0.8, lambda: webbrowser.open(app_url)).start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down.")
        api.shutdown()
        web.shutdown()


if __name__ == "__main__":
    main()
