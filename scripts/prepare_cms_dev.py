"""Prepare only allowed public files for local Pages development.
Usage: python3 scripts/prepare_cms_dev.py
Never copies private price_manager data, tokens, tests or local D1 storage.
"""
from pathlib import Path
import shutil
from package_site import PUBLIC_FILES
ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/'.wrangler/dev-public'
EXTRA=('_routes.json','_headers','robots.txt','blog/styles.css','admin/index.html','admin/naver-help.html','workers/naver-scheduler/index.js','admin/help.html','admin/editor.css','admin/editor.js','admin/vendor/quill-2.0.3.js','admin/vendor/quill-2.0.3.css','admin/vendor/QUILL-LICENSE.txt')
if __name__=='__main__':
 OUTPUT.mkdir(parents=True,exist_ok=True)
 for name in (*PUBLIC_FILES,*EXTRA):
  src=ROOT/name;target=OUTPUT/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,target)
 assert not (OUTPUT/'price_manager').exists()
 print(f'Public development assets: {OUTPUT}')
