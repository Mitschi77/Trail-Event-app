import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../supabase/functions/inspect-event-website/index.ts', import.meta.url), 'utf8');

assert.ok(source.includes('if(/^\\d{1,3}(?:\\.\\d{1,3}){3}$/.test(ip))'), 'IPv4 detection must use working digit and dot escapes.');
assert.ok(source.includes(String.raw`replace(/^\[|\]$/g,"")`), 'IPv6 bracket stripping must use working bracket escapes.');
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
assert.match(source, /Nur öffentliche HTTPS-Webadressen ohne Zugangsdaten und Sonderports sind erlaubt/);

assert.match(source, /import \{ request as httpsRequest \} from "node:https"/);
assert.match(source, /async function resolvePublicAddresses\(host:string\)/);
assert.match(source, /addresses\.some\(address=>!isPublicIp\(address\)\)/);
assert.match(source, /const req=httpsRequest\(\{/);
assert.match(source, /hostname:host/);
assert.match(source, /servername:host/);
assert.match(source, /agent:false/);
assert.match(source, /lookup,/);
assert.match(source, /callback\(null,address,family\)/);
assert.match(source, /pinnedHttpsGet\(target,2000000,12000\)/);
assert.match(source, /pinnedHttpsGet\(u,5000000,10000\)/);
assert.doesNotMatch(source, /await fetch\(/, 'Outbound website requests must not use unpinned fetch().');
assert.match(source, /u\.port\)throw new Error/);
assert.match(source, /second<=0x01ff/);

console.log('Website inspector SSRF guard regression tests passed.');
