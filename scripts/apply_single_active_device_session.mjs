import fs from 'node:fs';

const path = new URL('../index.html', import.meta.url);
let html = fs.readFileSync(path, 'utf8');

const loginBefore = "const {data,error}=await cloudClient.auth.signInWithPassword({email,password});if(error)throw error;if(!data?.user)throw new Error('Der Anbieter hat keinen Benutzer zurückgegeben.');await activateCloudUser(data.user);";
const loginAfter = "const {data,error}=await cloudClient.auth.signInWithPassword({email,password});if(error)throw error;if(!data?.user)throw new Error('Der Anbieter hat keinen Benutzer zurückgegeben.');const {error:otherSessionsError}=await cloudClient.auth.signOut({scope:'others'});if(otherSessionsError){await cloudClient.auth.signOut({scope:'local'});throw new Error('Andere Gerätesitzungen konnten nicht sicher beendet werden: '+(otherSessionsError.message||'Unbekannter Fehler'));}await activateCloudUser(data.user);";

if (html.includes(loginBefore)) {
  html = html.replace(loginBefore, loginAfter);
} else if (!html.includes("cloudClient.auth.signOut({scope:'others'})")) {
  throw new Error('Login integration anchor not found; refusing to modify index.html.');
}

const signedOutBefore = "else if(event==='SIGNED_OUT'){setCloudProfileIndicator(false);clearTimeout(cloudTimer);cloudReady=false;cloudSavePending=false;cloudUser=null;cloudMessage('Sitzung beendet. Deine lokalen Laufdaten bleiben auf diesem Gerät erhalten. Bitte melde dich erneut an.');}";
const signedOutAfter = "else if(event==='SIGNED_OUT'){setCloudProfileIndicator(false);clearTimeout(cloudTimer);if(window.plannerCloudCheckTimer){clearInterval(window.plannerCloudCheckTimer);window.plannerCloudCheckTimer=null;}cloudReady=false;cloudSavePending=false;cloudUser=null;cloudMessage('Sitzung beendet oder auf einem anderen Gerät abgemeldet. Deine lokalen Laufdaten bleiben auf diesem Gerät erhalten; die Cloud-Synchronisierung ist gestoppt. Bitte melde dich erneut an.');}";

if (html.includes(signedOutBefore)) {
  html = html.replace(signedOutBefore, signedOutAfter);
} else if (!html.includes('Sitzung beendet oder auf einem anderen Gerät abgemeldet.')) {
  throw new Error('SIGNED_OUT integration anchor not found; refusing to modify index.html.');
}

const activateBefore = "async function activateCloudUser(user){const previousUserId=localStorage.getItem('trailPlannerActiveUserId');";
const activateAfter = "async function activateCloudUser(user){const {data:activeSession,error:sessionError}=await cloudClient.rpc('is_current_auth_session_active');if(sessionError||activeSession!==true){await cloudClient.auth.signOut({scope:'local'});cloudMessage('Diese Gerätesitzung ist nicht mehr aktiv. Bitte melde dich erneut an.');return;}const previousUserId=localStorage.getItem('trailPlannerActiveUserId');";
if (html.includes(activateBefore)) {
  html = html.replace(activateBefore, activateAfter);
} else if (!html.includes("cloudClient.rpc('is_current_auth_session_active')")) {
  throw new Error('activateCloudUser session-check anchor not found; refusing to modify index.html.');
}

const pollBefore = "if(cloudBusy||document.hidden)return;try{const {data,error}=await cloudClient.from('planner_data').select('data,updated_at').eq('user_id',cloudUser.id).maybeSingle();";
const pollAfter = "if(cloudBusy||document.hidden)return;try{const {data:activeSession,error:sessionError}=await cloudClient.rpc('is_current_auth_session_active');if(sessionError)throw sessionError;if(activeSession!==true){await cloudClient.auth.signOut({scope:'local'});return;}const {data,error}=await cloudClient.from('planner_data').select('data,updated_at').eq('user_id',cloudUser.id).maybeSingle();";
if (html.includes(pollBefore)) {
  html = html.replace(pollBefore, pollAfter);
} else if (!html.includes("const {data:activeSession,error:sessionError}=await cloudClient.rpc('is_current_auth_session_active');")) {
  throw new Error('cloud polling session-check anchor not found; refusing to modify index.html.');
}

fs.writeFileSync(path, html);
console.log('Single-active-device login integration applied to index.html.');
