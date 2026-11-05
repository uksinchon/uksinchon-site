/** Local-only regression server. Start, run check_cms.py, then stop. */
import {fixture} from './lib/seo-fixture.mjs';
const f=await fixture({port:8791,setupKey:'local-test-setup-key-not-for-production-32'});
console.log('CMS FIXTURE READY '+f.base);
try{await new Promise(resolve=>process.once('SIGTERM',resolve));}finally{await f.mf.dispose();}
