import assert from 'node:assert/strict';
import {renderDelta,promoBanners} from '../cms/server/content.js';
const L='https://uksinchon.com/black-friday/';
const html=renderDelta({ops:[{insert:'앞 문단\n'},{insert:'블랙프라이데이 프로모션',attributes:{link:L,background:'#ffffff'}},{insert:'\n',attributes:{header:2,align:'center'}},{insert:'끌리는 학교 쉽게 문의하기',attributes:{link:L}},{insert:'\n',attributes:{header:2,align:'center'}},{insert:'중간 문단 '},{insert:'본문 속 링크',attributes:{link:L}},{insert:' 는 그대로\n'},{insert:'다른 링크',attributes:{link:'https://uksinchon.com/hello-uk/'}},{insert:'\n'}]});

assert.equal((html.match(/promo-banner/g)||[]).length,1);
assert(html.includes('alt="블랙프라이데이 어학원 체크인 · 블랙프라이데이 프로모션 · 끌리는 학교 쉽게 문의하기"'));
assert(html.includes('<a href="https://uksinchon.com/black-friday/" rel="noopener noreferrer">본문 속 링크</a>'));
assert(html.includes('<a href="https://uksinchon.com/hello-uk/"'));
assert(!html.includes('\u0000'));
console.log('PASS link-only lines to the Black Friday check-in become one banner; inline and other links stay as text');
