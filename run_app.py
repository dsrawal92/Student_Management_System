import webview
import threading
import sys
import time
from app import app

def start_flask():
    """Background thread me Flask server launch karein."""
    app.run(port=5000, debug=False, use_reloader=False)

if __name__ == '__main__':
    # 1. Background Flask thread
    t = threading.Thread(target=start_flask)
    t.daemon = True
    t.start()

    # 2. Server setup ke liye delay
    time.sleep(1)

    # 3. Clean desktop window
    window = webview.create_window(
        title="School Office Management System",
        url="http://127.0.0.1:5000",
        width=1280,
        height=800,
        resizable=True,
        min_size=(1024, 650)
    )

    webview.start()
    sys.exit()