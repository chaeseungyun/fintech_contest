# 시연 영상 녹화: 개발 서버(npm run dev)를 띄운 뒤
#   pip install playwright imageio-ffmpeg
#   python scripts/record-demo.py [URL]          (기본 http://localhost:5173/?demo)
# 설치된 Chrome 으로 1920×1080 녹화 → demo-video/FinStayAI_demo.mp4 (H.264).
# 장면 설명은 src/fixtures/demo.json, 누르는 순서는 아래 run() 이다.
# 폰 안에서만 누르고, 장면마다 설명을 읽을 시간을 둔다.
import os, subprocess, sys, time
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5173/?demo"
READ = 9000  # 장면 하나를 읽는 시간(ms)

def run(pg):
    phone = pg.locator(".phone")
    def tap(text=None, sel=None, exact=False):
        loc = phone.locator(sel).first if sel else phone.get_by_text(text, exact=exact).first
        smooth(loc)
        box = loc.bounding_box()
        x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
        pg.mouse.move(x, y, steps=12); pg.wait_for_timeout(250)
        pg.mouse.down(); pg.wait_for_timeout(80); pg.mouse.up()
        pg.wait_for_timeout(700)
    def smooth(loc, block="center"):
        loc.evaluate(f"e => e.scrollIntoView({{behavior:'smooth', block:'{block}'}})")
        pg.wait_for_timeout(900)
    def wait(ms=READ): pg.wait_for_timeout(ms)

    wait(1500)
    wait(READ - 2000)                                  # 1 홈
    tap(sel=".aicheck")                                # 2 혜택 탭 (배너 속 점검 한 줄)
    wait(5000)
    smooth(phone.get_by_text("조건을 채우면 받을 수 있는 우대").first, "start")
    wait(5000)
    tap("대출 자동납부 출금 2건 이상이면 받아요")       # 3 분석 중 (관리비)
    wait(4500)
    tap("결과 바로 보기") if phone.get_by_text("결과 바로 보기").count() else None
    wait(READ - 3000)                                  # 4 비교 결과
    tap(sel='.hchart g.col[aria-label^="3개월"]')
    wait(4500)
    tap("분석 과정 보기")                              # 5 결과 상세
    wait(4000)
    smooth(phone.get_by_text("연결된 상품에 미치는 영향").first, "start")
    wait(5500)
    tap("계좌 납부로 변경 절차 안내받기")              # 6 실행 안내
    wait(READ)
    tap("홈으로")
    wait(1200)
    tap(sel=".aimain")
    wait(READ - 2000)                                  # 7 허브
    tap("톡톡카드를 해지하면")
    wait(5000)
    if phone.get_by_text("결과 바로 보기").count(): tap("결과 바로 보기")
    wait(READ)                                         # 8 비교 결과 (카드 해지)
    tap("분석 과정 보기")                              # 9 결과 상세
    wait(1500)
    smooth(phone.get_by_text("우대 상한 조정").first)
    wait(6000)
    smooth(phone.get_by_text("그래도 갈아탄다면").first, "start")
    wait(4000)
    tap("우대 확인일 · 변경 가능 구간 자세히 보기")     # 10 타임라인
    wait(READ + 1500)

with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")
    ctx = b.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1,
                        record_video_dir="demo-video/raw", record_video_size={"width": 1920, "height": 1080})
    pg = ctx.new_page()
    pg.goto(URL); pg.wait_for_load_state("networkidle")
    t = time.time()
    run(pg)
    print("seconds", round(time.time() - t))
    path = pg.video.path()
    ctx.close(); b.close()

import imageio_ffmpeg
out = os.path.join("demo-video", "FinStayAI_demo.mp4")
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-loglevel", "error", "-y", "-i", path, "-c:v", "libx264",
                "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-r", "30", out],
               check=True)
print(out)
