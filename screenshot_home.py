from playwright.sync_api import sync_playwright
from pathlib import Path
p=Path('/mnt/data/work_v186/index.html').as_uri()
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True)
    for name,w,h in [('desktop',1440,1000),('mobile',390,844)]:
        page=browser.new_page(viewport={'width':w,'height':h}, device_scale_factor=1, is_mobile=(name=='mobile'))
        page.goto(p, wait_until='networkidle', timeout=30000)
        page.wait_for_timeout(2000)
        page.screenshot(path=f'/mnt/data/work_v186/{name}.png', full_page=False)
        page.close()
    browser.close()
