"""Package public site files and an offline, single-file pharmacy preview."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_FILES = (
    'index.html', 'logo.png', 'favicon.ico', 'apple-icon.png',
    'pharmacy/index.html', 'pharmacy/styles.css', 'pharmacy/consultation.js',
    'assets/meta-pixel-config.js', 'assets/meta-pixel.js',
    'seminar-2027/index.html', 'seminar-2027/styles.css', 'seminar-2027/source.json',
    'docs/PHARMACY_LANDING.md', 'docs/META_PIXEL.md', 'docs/SEMINAR_2027.md',
    *(str(p.relative_to(ROOT)) for p in sorted((ROOT / 'seminar-2027/images').iterdir())
      if p.is_file() and p.suffix.lower() in ('.png', '.gif', '.jpg')),
)


def single_file_preview():
    html = (ROOT / 'pharmacy/index.html').read_text(encoding='utf-8')
    css = (ROOT / 'pharmacy/styles.css').read_text(encoding='utf-8')
    js = (ROOT / 'pharmacy/consultation.js').read_text(encoding='utf-8')
    stylesheet = '<link rel="stylesheet" href="./styles.css">'
    script = '<script src="./consultation.js" defer></script>'
    assert html.count(stylesheet) == html.count(script) == 1
    assert '</style' not in css.lower() and '</script' not in js.lower()
    html = html.replace(stylesheet, '<style>\n' + css + '\n</style>')
    # Inline scripts do not honor defer: run after the form exists instead.
    html = html.replace(script, '')
    # A portable/offline preview must not contact Meta, even after activation.
    for tracking in ['meta-pixel-config.js', 'meta-pixel.js']:
        tag = '<script src="../assets/' + tracking + '" defer></script>'
        assert html.count(tag) == 1
        html = html.replace(tag, '')
    html = html.replace('</body>', '<script>\n' + js + '\n</script>\n</body>')
    for file, mime in [('logo.png', 'image/png'), ('favicon.ico', 'image/x-icon'), ('apple-icon.png', 'image/png')]:
        encoded = base64.b64encode((ROOT / file).read_bytes()).decode('ascii')
        html = html.replace('../' + file, 'data:' + mime + ';base64,' + encoded)
    # This one-file preview can be saved anywhere. Home is an explicit web link.
    html = html.replace('href="../index.html"', 'href="https://uksinchon.com/"')
    return html


def package(output):
    output.mkdir(parents=True, exist_ok=True)
    preview = output / '약대_상담페이지_바로열기.html'
    preview.write_text(single_file_preview(), encoding='utf-8')
    instructions = '''영국유학센터 신촌점 — PC 미리보기 수정본

가장 쉬운 확인 방법
1. ZIP을 모두 압축 해제합니다.
2. ‘약대_상담페이지_바로열기.html’을 두 번 클릭합니다.
   이 파일 하나에 화면 구성, 로고, 상담 기능이 모두 들어 있습니다.
   Python 설치나 서버 실행 없이 확인할 수 있습니다.
3. 일반 홈페이지를 보려면 같은 폴더의 index.html을 엽니다.
   ‘영국 약대 파운데이션 상담’을 누르면 pharmacy/index.html이 열립니다.

중요: pharmacy 폴더만 D드라이브로 이동하거나 HTML 하나만 따로 꺼내지 마세요.
폴더를 유지하면 CSS·JS·로고가 같은 위치에서 정상 연결됩니다.
단독 파일 ‘약대_상담페이지_바로열기.html’은 다른 폴더로 옮겨도 됩니다.

자동 복사가 차단되면 화면 안내에 따라 선택된 내용을 Ctrl+C로 복사하세요.
작성만으로 접수되지 않습니다. 카카오톡 채널에 직접 붙여넣고 전송해야 합니다.
전화·카카오톡·홈페이지 방문은 인터넷/해당 앱 연결이 필요합니다.

이 파일은 PC 확인용이며, 인터넷에 공개된 페이지는 아닙니다.
광고 주소는 정적 홈페이지에 실제 배포한 뒤 사용합니다.
배포 파일: index.html, logo.png, favicon.ico, apple-icon.png, pharmacy/ 폴더 전체
배포 후 예정 주소: https://uksinchon.com/pharmacy/
광고 주소 예시: https://uksinchon.com/pharmacy/?utm_source=studygroup&utm_medium=paid_social&utm_campaign=pharmacy_foundation&utm_content=showreel
운영 안내: docs/PHARMACY_LANDING.md
'''
    archive = output / '영국유학센터_신촌점_약대페이지_수정본.zip'
    with ZipFile(archive, 'w', ZIP_DEFLATED) as z:
        for file in PUBLIC_FILES:
            z.write(ROOT / file, file)
        z.write(preview, preview.name)
        z.writestr('먼저읽어주세요.txt', instructions)
    with ZipFile(archive) as z:
        assert z.testzip() is None
        assert len(z.namelist()) == len(PUBLIC_FILES) + 2
    return {'preview': str(preview), 'archive': str(archive),
            'preview_sha256': hashlib.sha256(preview.read_bytes()).hexdigest()}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    print(json.dumps(package(args.output.resolve()), ensure_ascii=False, indent=2))
