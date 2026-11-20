import assert from 'node:assert/strict';
import {cleanTable,renderTable,cleanSnapshot} from '../cms/server/content.js';
for(const [c,r] of [[1,1],[3,3],[10,50]]){const t=cleanTable({layout:'grid',columns:Array(c).fill(''),rows:Array.from({length:r-1},()=>Array(c).fill(''))});assert.equal(t.layout,'grid');assert.equal(t.rows.length,r-1);assert.equal((renderTable(t).match(/<td>/g)||[]).length,c*r);}
assert.throws(()=>cleanTable({layout:'grid',columns:Array(11).fill(''),rows:[]}));
assert.throws(()=>cleanTable({layout:'grid',columns:[''],rows:[['','']]}));
const table=cleanTable({layout:'grid',columns:['<script>alert(1)</script>'],rows:[['a\nb']]});assert(renderTable(table).includes('&lt;script&gt;'));assert(!renderTable(table).includes('<script>'));
const legacy=cleanTable({caption:'기존 비교',columns:['항목','조건'],rows:[['a','b']],source:'https://example.org',notes:'원문 보존'});assert(!legacy.layout);assert(renderTable(legacy).includes('<caption>기존 비교</caption>'));assert.throws(()=>cleanTable({columns:[''],rows:[]}));
const s=cleanSnapshot({schemaVersion:2,title:'가상 표',delta:{ops:[{insert:{comparisonTable:table}},{insert:'\n'}]}},'가상 작성자');assert.equal(s.delta.ops[0].insert.comparisonTable.layout,'grid');
const sized=cleanTable({layout:'grid',widths:[50,20,30],columns:['','',''],rows:[]});assert.deepEqual(sized.widths,[50,20,30]);assert(renderTable(sized).includes('<colgroup><col class="cw-50"><col class="cw-20"><col class="cw-30"></colgroup>'));
for(const bad of [[50,50],[2,48,50],[50,20,31],['50',20,30],[50.5,19.5,30]])assert(!cleanTable({layout:'grid',widths:bad,columns:['','',''],rows:[]}).widths);
{const {renderBody}=await import('../cms/server/content.js').catch(()=>({}));const d=cleanSnapshot({schemaVersion:2,title:'가상 구분선',delta:{ops:[{insert:'위\n'},{insert:{divider:true}},{insert:'아래\n'}]}},'가상 작성자');assert.deepEqual(d.delta.ops[1].insert,{divider:true});assert.throws(()=>cleanSnapshot({schemaVersion:2,title:'x',delta:{ops:[{insert:{divider:'<b>'}},{insert:'\n'}]}},'가상'));}
console.log('PASS divider kept and validated; column widths saved only when valid; blank 1x1–10x50 grids, bounds, escaping, serialization and unchanged legacy table rendering');
