import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../supabase/functions/inspect-event-website/index.ts', import.meta.url), 'utf8');

assert.match(source, /async function safeUrl\(raw:string\):Promise<URL>/);
assert.match(source, /Deno\.resolveDns\(host,"A"\)/);
assert.match(source, /Deno\.resolveDns\(host,"AAAA"\)/);
assert.match(source, /Promise\.allSettled/);
assert.match(source, /addresses\.some\(address=>!isPublicIp\(address\)\)/);
assert.match(source, /if\(!addresses\.length\|\|addresses\.some/);
assert.match(source, /target=await safeUrl\(new URL\(loc,target\)\.toString\(\)\)/);
assert.match(source, /const u=await safeUrl\(new URL\(m\[1\],source\)\.toString\(\)\)/);
assert.match(source, /fetchHtml\(await safeUrl\(body\.url\)\)/);
assert.match(source, /const u=await safeUrl\(gpxUrl\)/);
assert.match(source, /Nur öffentliche HTTPS-Webadressen sind erlaubt/);
console.log('Website inspector SSRF guard regression tests passed.');
