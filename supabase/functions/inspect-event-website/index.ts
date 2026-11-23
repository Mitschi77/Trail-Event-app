import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { request as httpsRequest } from "node:https";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json"}});}
function clean(v:unknown,max=500):string{return String(v??"").replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/\s+/g," ").trim().slice(0,max);}
function isPublicIp(address:string):boolean{
  const ip=address.toLowerCase().replace(/^\[|\]$/g,"");
  if(/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip)){
    const p=ip.split(".").map(Number);
    if(p.some(n=>!Number.isInteger(n)||n<0||n>255))return false;
    const [a,b,c]=p;
    return !(a===0||a===10||a===127||a>=224||a===100&&b>=64&&b<=127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===0||b===168||b===88&&c===99)||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113);
  }
  if(!ip.includes(":"))return false;
  const normalized=ip.split("%")[0];
  const parts=normalized.split(":");
  const prefix=parseInt(parts[0]||"",16);
  const second=parseInt(parts[1]||"0",16);
  return Number.isFinite(prefix)&&prefix>=0x2000&&prefix<=0x3fff&&
    !(prefix===0x2001&&(second<=0x01ff||second===0x0db8))&&
    prefix!==0x2002&&prefix!==0x3fff;
}
async function resolvePublicAddresses(host:string):Promise<string[]>{
  if(host==="localhost"||host.endsWith(".localhost")||host.endsWith(".local")||host.includes(":")||/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host))throw new Error("Bitte eine öffentliche Domain statt einer lokalen oder IP-Adresse verwenden.");
  const resolved=await Promise.allSettled([Deno.resolveDns(host,"A"),Deno.resolveDns(host,"AAAA")]);
  const addresses=[...new Set(resolved.flatMap(result=>result.status==="fulfilled"?result.value:[]))];
  if(!addresses.length||addresses.some(address=>!isPublicIp(address)))throw new Error("Die Webadresse verweist nicht ausschließlich auf öffentliche IP-Adressen.");
  return addresses;
}
async function safeUrl(raw:string):Promise<URL>{
  const u=new URL(raw);
  if(u.protocol!=="https:"||u.username||u.password||u.port)throw new Error("Nur öffentliche HTTPS-Webadressen ohne Zugangsdaten und Sonderports sind erlaubt.");
  await resolvePublicAddresses(u.hostname.toLowerCase());
  return u;
}
type PinnedResponse={status:number;headers:Record<string,string|string[]|undefined>;body:string};
async function pinnedHttpsGet(url:URL,maxBytes=2000000,timeoutMs=12000):Promise<PinnedResponse>{
  const host=url.hostname.toLowerCase();
  const addresses=await resolvePublicAddresses(host);
  let lastError:unknown=null;
  for(const address of addresses){
    try{
      return await new Promise<PinnedResponse>((resolve,reject)=>{
        const family=address.includes(":")?6:4;
        const lookup=((_hostname:string,options:any,callback:any)=>{
          if(options?.all)callback(null,[{address,family}]);
          else callback(null,address,family);
        }) as any;
        const req=httpsRequest({
          protocol:"https:",
          hostname:host,
          port:Number(url.port||443),
          path:url.pathname+url.search,
          method:"GET",
          headers:{"User-Agent":"TrailEventPlannerBot/1.0","Accept":"text/html,application/xhtml+xml,application/gpx+xml,application/xml;q=0.9,*/*;q=0.8","Accept-Encoding":"identity","Connection":"close"},
          agent:false,
          servername:host,
          lookup,
        },response=>{
          const chunks:Uint8Array[]=[];
          let total=0;
          response.on("data",(chunk:Uint8Array)=>{
            total+=chunk.byteLength;
            if(total>maxBytes){req.destroy(new Error("Die Antwort ist zu groß für den automatischen Import."));return;}
            chunks.push(chunk);
          });
          response.on("end",()=>{
            const bytes=new Uint8Array(total);
            let offset=0;
            for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
            resolve({status:response.statusCode||0,headers:response.headers as Record<string,string|string[]|undefined>,body:new TextDecoder().decode(bytes)});
          });
          response.on("error",reject);
        });
        req.setTimeout(timeoutMs,()=>req.destroy(new Error("Zeitüberschreitung beim Abruf der Website.")));
        req.on("error",reject);
        req.end();
      });
    }catch(error){lastError=error;}
  }
  throw lastError instanceof Error?lastError:new Error("Keine geprüfte öffentliche IP-Adresse konnte erreicht werden.");
}
async function fetchHtml(url:URL):Promise<{html:string,url:URL}>{
  let target=url;
  for(let n=0;n<4;n++){
    const response=await pinnedHttpsGet(target,2000000,12000);
    if([301,302,303,307,308].includes(response.status)){
      const loc=response.headers.location;
      if(typeof loc!=="string"||!loc||n===3)throw new Error("Zu viele oder ungültige Weiterleitungen.");
      target=await safeUrl(new URL(loc,target).toString());
      continue;
    }
    if(response.status<200||response.status>=300)throw new Error("Website nicht erreichbar (HTTP "+(response.status||"unbekannt")+".");
    const contentType=response.headers["content-type"];
    if(!/text\/html|application\/xhtml\+xml/i.test(typeof contentType==="string"?contentType:""))throw new Error("Die Adresse liefert keine HTML-Webseite.");
    return{html:response.body,url:target};
  }
  throw new Error("Zu viele Weiterleitungen.");
}
function meta(html:string,key:string):string{for(const tag of html.matchAll(/<meta\b[^>]*>/gi)){const t=tag[0],n=t.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i),c=t.match(/content\s*=\s*["']([^"']*)["']/i);if(n?.[1].toLowerCase()===key.toLowerCase()&&c?.[1])return clean(c[1]);}return"";}
function collect(v:unknown,out:Record<string,unknown>[],d=0){if(d>8||out.length>30||!v)return;if(Array.isArray(v)){for(const x of v)collect(x,out,d+1);return;}if(typeof v!=="object")return;const o=v as Record<string,unknown>,types=Array.isArray(o["@type"])?o["@type"]:[o["@type"]];if(types.some(t=>/Event|Race|SportsEvent/i.test(String(t||""))))out.push(o);for(const x of Object.values(o))if(typeof x==="object")collect(x,out,d+1);}
function dateOnly(v:unknown):string{if(!v)return"";const d=new Date(String(v));return Number.isNaN(d.getTime())?"":d.toISOString().slice(0,10);}
function extractGpxStats(xml:string){const pts=[...xml.matchAll(/<trkpt\b[^>]*lat=["']([^"']+)["'][^>]*lon=["']([^"']+)["'][^>]*>([\s\S]*?)<\/trkpt>/gi)];let distance=0,ascent=0,prev:null|{lat:number;lon:number;ele:number}=null;for(const p of pts){const lat=Number(p[1]),lon=Number(p[2]),ele=Number(p[3].match(/<ele>\s*(-?[\d.]+)/i)?.[1]||0);if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;if(prev){const rad=Math.PI/180,dl=(lat-prev.lat)*rad,dn=(lon-prev.lon)*rad,a=Math.sin(dl/2)**2+Math.cos(prev.lat*rad)*Math.cos(lat*rad)*Math.sin(dn/2)**2;distance+=6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));if(ele>prev.ele)ascent+=ele-prev.ele;}prev={lat,lon,ele};}return{points:pts.length,km:distance?Number(distance.toFixed(1)):null,hm:ascent?Math.round(ascent):null};}
async function extract(html:string,source:URL){const blocks=[...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)],events:Record<string,unknown>[]=[];for(const m of blocks){try{collect(JSON.parse(m[1].trim()),events);}catch{}}const ev=events[0]||{},loc=(ev.location&&typeof ev.location==="object"?ev.location:{}) as Record<string,unknown>,addr=(loc.address&&typeof loc.address==="object"?loc.address:{}) as Record<string,unknown>;const name=clean(ev.name)||meta(html,"og:title")||meta(html,"twitter:title")||clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||"");const date=dateOnly(ev.startDate)||dateOnly(meta(html,"event:start_time"));const location=clean(loc.name)||clean(addr.addressLocality)||clean(addr.streetAddress);const country=clean(typeof addr.addressCountry==="object"?(addr.addressCountry as Record<string,unknown>).name:addr.addressCountry);const desc=clean(ev.description)||meta(html,"og:description")||meta(html,"description");const page=clean(html.replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi," ").replace(/<[^>]+>/g," "),30000);
const dm=page.match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/),fallback=dm?dm[3]+"-"+dm[2].padStart(2,"0")+"-"+dm[1].padStart(2,"0"):"";
const routes:Record<string,unknown>[]=[],seen=new Set<string>();const add=(n:string,km:number,hm:number|null)=>{const k=n.toLowerCase()+"|"+km+"|"+hm;if(!seen.has(k)&&routes.length<15){seen.add(k);routes.push({name:n,km,hm,maxh:null,startLocation:location||null,cutoffs:[],aidStations:[],gpxUrl:null,utmbScore:null});}};
const lines=html.replace(/<br\s*\/?\s*>|<\/p>|<\/li>|<\/h[1-6]>/gi,"\n").replace(/<[^>]+>/g," ").split(/[\n\r]+/).map(x=>clean(x)).filter(Boolean);
for(const line of lines){const m=line.match(/(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:km|kilometer(?:n)?)(?![a-z])/i);if(!m)continue;const km=Number(m[1].replace(",","."));if(!(km>0&&km<=500))continue;const hm=line.match(/(\d{2,5})\s*(?:hm|höhenmeter|elevation\s*(?:gain)?|vertical\s*gain)/i);add(line.slice(0,80)||String(km)+" km",km,hm?Number(hm[1]):null);}
if(!routes.length){for(const m of [...page.matchAll(/\b(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:km|kilometer(?:n)?)(?![a-z])/gi)].slice(0,8)){const km=Number(m[1].replace(",","."));if(km>0&&km<=500)add(String(km)+" km (bitte prüfen)",km,null);}}
const scoreMatch=page.match(/(?:UTMB\s*)?(?:Index|Score|Punkte)\s*[:\-]?\s*(\d{2,4})\b/i)||page.match(/\b(\d{2,4})\s*(?:UTMB\s*)?(?:Index|Score)\b/i),utmbScore=scoreMatch?Number(scoreMatch[1]):null;
const cutoffLines=lines.filter(x=>/(cut.?off|zeitlimit|spätestens|latest\s*time|closing\s*time|durchgangszeit)/i.test(x));
const stationLines=lines.filter(x=>/(verpflegung|aid\s*station|versorgung|refreshment|ravitaillement|food\s*station)/i.test(x));
const cutoffs=cutoffLines.slice(0,30).map(line=>{const km=line.match(/(\d{1,3}(?:[.,]\d{1,2})?)\s*km/i),time=line.match(/\b([01]?\d|2[0-3])[:.][0-5]\d\b/);return{name:line.slice(0,70),km:km?Number(km[1].replace(",",".")):null,time:time?time[0].replace(".",":"):null,source:source.toString(),verified:false};}).filter(x=>x.km!==null||x.time!==null);
const aidStations=stationLines.slice(0,40).map(line=>{const km=line.match(/(\d{1,3}(?:[.,]\d{1,2})?)\s*km/i),time=line.match(/\b([01]?\d|2[0-3])[:.][0-5]\d\b/);return{name:line.slice(0,70),km:km?Number(km[1].replace(",",".")):null,food:/essen|food|verpflegung|ravitaillement/i.test(line)?line:null,drink:/getränk|drink|water|eau/i.test(line)?"Getränke":null,cutoffTime:time?time[0].replace(".",":"):null,source:source.toString(),verified:false};}).filter(x=>x.km!==null||x.name);
let gpxUrl:string|null=null;for(const m of html.matchAll(/<a\b[^>]*href=["']([^"']+\.gpx(?:\?[^"']*)?)["'][^>]*>/gi)){try{const u=await safeUrl(new URL(m[1],source).toString());gpxUrl=u.toString();break;}catch{}}
let gpxStats:Record<string,unknown>|null=null;if(gpxUrl){try{const u=await safeUrl(gpxUrl);if(u.hostname===source.hostname){const r=await pinnedHttpsGet(u,5000000,10000);const contentType=r.headers["content-type"];if(r.status>=200&&r.status<300&&/gpx|xml|octet-stream/i.test(typeof contentType==="string"?contentType:"")){const xml=r.body;if(xml.length<=5000000&&/<gpx\b/i.test(xml))gpxStats=extractGpxStats(xml);}}}catch{}}
const type=/backyard/i.test(name+" "+desc)?"Backyard":/marathon/i.test(name)?"Marathon":/trail|ultra|mountain|sky.?race/i.test(name+" "+desc)?"Trailrunning / Ultra":"";
return{fields:{name,date:date||fallback,startTime:"",location,startLocation:location,country,type,utmbScore},routes:routes.map(r=>({...r,utmbScore,gpxUrl,gpxStats,cutoffs,aidStations})),detected:{gpxUrl,gpxStats,utmbScore,cutoffs:cutoffs.length,aidStations:aidStations.length},warnings:[!name?"Kein eindeutiger Veranstaltungsname erkannt.":"",!date&&!fallback?"Kein sicheres Veranstaltungsdatum erkannt.":"",!routes.length?"Keine eindeutigen Streckenangaben erkannt.":"Streckendaten bitte mit der offiziellen Ausschreibung abgleichen.",!gpxUrl?"Kein direkter GPX-Link erkannt.":"GPX-Link gefunden; Trackdaten nur bei erfolgreichem Abruf übernommen.",utmbScore===null?"Kein eindeutiger UTMB Score erkannt.":"UTMB Score bitte auf Streckenbezug und Aktualität prüfen.",!cutoffs.length?"Keine eindeutigen Cut-off-Angaben erkannt.":"Cut-offs bitte mit der offiziellen Tabelle abgleichen.",!aidStations.length?"Keine eindeutigen Verpflegungsstellen erkannt.":"Verpflegungsstellen bitte mit der offiziellen Tabelle abgleichen.",!desc?"Keine Veranstaltungsbeschreibung gefunden.":""].filter(Boolean),source:source.toString()};}
Deno.serve(async(req)=>{if(req.method==="OPTIONS")return new Response("ok",{headers:cors});if(req.method!=="POST")return json({error:"Method not allowed"},405);try{const body=await req.json();if(typeof body.url!=="string"||body.url.length>2000)return json({error:"Bitte eine gültige Webadresse übergeben."},400);const page=await fetchHtml(await safeUrl(body.url));return json(await extract(page.html,page.url));}catch(e){return json({error:clean(e instanceof Error?e.message:"Website konnte nicht ausgelesen werden.",300)},422);}});
