import assert from 'node:assert/strict';
import {cleanTable,renderTable,cleanSnapshot} from '../cms/server/content.js';
for(const [c,r] of [[1,1],[3,3],[10,50]]){const t=cleanTable({layout:'grid',columns:Array(c).fill(''),rows:Array.from({length:r-1},()=>Array(c).fill(''))});assert.equal(t.layout,'grid');assert.equal(t.rows.length,r-1);assert.equal((renderTable(t).match(/<td>/g)||[]).length,c*r);}
assert.throws(()=>cleanTable({layout:'grid',columns:Array(11).fill(''),rows:[]}));
assert.throws(()=>cleanTable({layout:'grid',columns:[''],rows:[['','']]}));
const table=cleanTable({layout:'grid',columns:['<script>alert(1)</script>'],rows:[['a\nb']]});assert(renderTable(table).includes('&lt;script&gt;'));assert(!renderTable(table).includes('<script>'));
const legacy=cleanTable({caption:'기존 비교',columns:['항목','조건'],rows:[['a','b']],source:'https://example.org',notes:'원문 보존'});assert(!legacy.layout);assert(renderTable(legacy).includes('<caption>기존 비교</caption>'));assert.throws(()=>cleanTable({columns:[''],rows:[]}));
const s=cleanSnapshot({schemaVersion:2,title:'가상 표',delta:{ops:[{insert:{comparisonTable:table}},{insert:'\n'}]}},'가상 작성자');assert.equal(s.delta.ops[0].insert.comparisonTable.layout,'grid');
console.log('PASS blank 1x1–10x50 grids, bounds, escaping, serialization and unchanged legacy table rendering');
