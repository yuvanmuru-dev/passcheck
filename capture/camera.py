"""Keep only the most recent frame in memory; never record a video."""
import threading
import time
from pathlib import Path

import cv2


def parse_roi(value: str):
    if not value.strip():
        return None
    try:
        x, y, w, h = map(int, value.split(","))
    except ValueError as exc:
        raise ValueError("ROI must be x,y,width,height") from exc
    if min(x, y) < 0 or min(w, h) <= 0:
        raise ValueError("ROI needs nonnegative coordinates and positive dimensions")
    return x, y, w, h


def encode_frame(frame, roi=None) -> bytes:
    if roi:
        x, y, w, h = roi
        height, width = frame.shape[:2]
        if x >= width or y >= height:
            raise ValueError("ROI is outside the image")
        frame = frame[y:min(y + h, height), x:min(x + w, width)]
    height, width = frame.shape[:2]
    scale = min(1, 768 / max(height, width))
    if scale < 1:
        frame = cv2.resize(frame, (max(1, round(width * scale)), max(1, round(height * scale))))
    ok, encoded = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
    if not ok:
        raise RuntimeError("Could not encode frame")
    return encoded.tobytes()


def image_jpeg(path: str, roi=None) -> bytes:
    frame = cv2.imread(str(Path(path)))
    if frame is None:
        raise ValueError(f"Could not read image: {path}")
    return encode_frame(frame, roi)


class Camera:
    def __init__(self, index=0, video_file=None, roi=None):
        self.video_file = video_file
        self.roi = roi
        self._capture = cv2.VideoCapture(video_file or index)
        if not self._capture.isOpened():
            self._capture.release()
            raise RuntimeError("Cannot open camera/video. Try --file for a manual upload.")
        fps = self._capture.get(cv2.CAP_PROP_FPS)
        self._interval = 1 / fps if video_file and 0 < fps <= 240 else 1 / 30
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._frame = None
        self._frame_at = 0.0
        self._thread = threading.Thread(target=self._read, daemon=True)
        self._thread.start()

    def _read(self):
        while not self._stop.is_set():
            ok, frame = self._capture.read()
            if ok:
                with self._lock:
                    self._frame = frame
                    self._frame_at = time.monotonic()
            elif self.video_file:
                self._capture.set(cv2.CAP_PROP_POS_FRAMES, 0)
            self._stop.wait(self._interval)

    def snapshot(self, timeout=3) -> bytes:
        deadline = time.monotonic() + timeout
        while True:
            with self._lock:
                if self._frame is not None and time.monotonic() - self._frame_at < 2:
                    frame = self._frame.copy()
                    break
            if time.monotonic() >= deadline:
                raise RuntimeError("No recent camera frame available")
            time.sleep(0.03)
        return encode_frame(frame, self.roi)

    def close(self):
        self._stop.set()
        self._thread.join(timeout=2)
        if not self._thread.is_alive():
            self._capture.release()
