import assert from 'node:assert/strict';
import {cleanSnapshot,renderDelta,semanticContent} from '../cms/server/content.js';
const url='/media/11111111-1111-4111-8111-111111111111';
const snapshot=size=>cleanSnapshot({schemaVersion:2,title:'가상 사진',delta:{ops:[{insert:{image:url},attributes:{imageWidth:size}},{insert:'\n',attributes:{align:'right'}}]}},'가상 작성자');
for(const size of [10,50,100]){const s=snapshot(size);assert.equal(s.delta.ops[0].attributes.imageWidth,size);const html=renderDelta(s.delta);assert(html.includes('class="image-width-'+size+'"'));assert(html.includes('article-image ql-align-right'));assert(!html.includes('style='));}
for(const size of [0,9,101,Infinity,'50','50%;position:fixed',null]){const s=snapshot(size);assert(!s.delta.ops[0].attributes);assert(!renderDelta(s.delta).includes('image-width-'));}
assert.notEqual(semanticContent(snapshot(50)),semanticContent(snapshot(100)));
const old=cleanSnapshot({title:'기존 사진',delta:{ops:[{insert:{image:url}},{insert:'\n'}]}},'기존 작성자');assert(!renderDelta(old.delta).includes('image-width-'));
console.log('PASS bounded image sizes, safe CSS classes, alignment, legacy rendering and revision tracking');
