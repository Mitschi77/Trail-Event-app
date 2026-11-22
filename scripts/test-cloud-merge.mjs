import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=source.indexOf('function jsonSame(a,b)');
const end=source.indexOf('function mergeCloudSnapshots',start);
assert.notEqual(start,-1,'Three-way merge helper must exist in index.html');
assert.notEqual(end,-1,'Three-way merge helper boundary must exist');
const helper=source.slice(start,end)+'\nglobalThis.mergeJsonThreeWay=mergeJsonThreeWay;';
const context={};
vm.runInNewContext(helper,context);
const merge=context.mergeJsonThreeWay;

function check(name,base,local,remote,expected,expectedConflicts=[]) {
 const conflicts=[];
 const result=merge(base,local,remote,'trailEventDataEdits',conflicts);
 assert.deepEqual(JSON.parse(JSON.stringify(result.value)),expected,name+' merged value');
 assert.deepEqual(conflicts,expectedConflicts,name+' conflicts');
}

check('different routes merge',
 {routeA:{travelPlan:{accommodation:'A'}},routeB:{travelPlan:{accommodation:'B'}}},
 {routeA:{travelPlan:{accommodation:'A2'}},routeB:{travelPlan:{accommodation:'B'}}},
 {routeA:{travelPlan:{accommodation:'A'}},routeB:{travelPlan:{accommodation:'B2'}}},
 {routeA:{travelPlan:{accommodation:'A2'}},routeB:{travelPlan:{accommodation:'B2'}}});

check('different fields on same route merge',
 {routeA:{travelPlan:{accommodation:'Old',paid:false}}},
 {routeA:{travelPlan:{accommodation:'New',paid:false}}},
 {routeA:{travelPlan:{accommodation:'Old',paid:true}}},
 {routeA:{travelPlan:{accommodation:'New',paid:true}}});

check('same field conflict is surfaced',
 {routeA:{travelPlan:{paid:false}}},
 {routeA:{travelPlan:{paid:true}}},
 {routeA:{travelPlan:{paid:'unknown'}}},
 {routeA:{travelPlan:{paid:true}}},
 ['trailEventDataEdits.routeA.travelPlan.paid']);

check('deletion merges with unrelated update',
 {routeA:{x:1},routeB:{x:1}},
 {routeA:{x:1}},
 {routeA:{x:2},routeB:{x:1}},
 {routeA:{x:2}});


// Simulate two devices that opened the same cloud snapshot and edited it
// independently before either device had received the other's update.
const twoDeviceBase = {
 routeA: { travelPlan: { accommodation: 'Base A', paid: false } },
 routeB: { travelPlan: { accommodation: 'Base B', paid: false } }
};
const iphoneRapidEdits = {
 routeA: { travelPlan: { accommodation: 'iPhone A v2', paid: false } },
 routeB: { travelPlan: { accommodation: 'Base B', paid: false } }
};
const ipadConcurrentEdits = {
 routeA: { travelPlan: { accommodation: 'Base A', paid: true } },
 routeB: { travelPlan: { accommodation: 'iPad B', paid: false } }
};
check('two devices merge rapid independent edits without data loss',
 twoDeviceBase, iphoneRapidEdits, ipadConcurrentEdits,
 {
  routeA: { travelPlan: { accommodation: 'iPhone A v2', paid: true } },
  routeB: { travelPlan: { accommodation: 'iPad B', paid: false } }
});

// After the first successful merge, both clients use that result as their
// common baseline. A second rapid edit from each device must also converge.
const firstConverged = {
 routeA: { travelPlan: { accommodation: 'iPhone A v2', paid: true } },
 routeB: { travelPlan: { accommodation: 'iPad B', paid: false } }
};
const iphoneSecondBurst = {
 routeA: { travelPlan: { accommodation: 'iPhone A v3', paid: true } },
 routeB: { travelPlan: { accommodation: 'iPad B', paid: false } }
};
const ipadSecondBurst = {
 routeA: { travelPlan: { accommodation: 'iPhone A v2', paid: true } },
 routeB: { travelPlan: { accommodation: 'iPad B v2', paid: false } }
};
check('two devices converge after a second burst of changes',
 firstConverged, iphoneSecondBurst, ipadSecondBurst,
 {
  routeA: { travelPlan: { accommodation: 'iPhone A v3', paid: true } },
  routeB: { travelPlan: { accommodation: 'iPad B v2', paid: false } }
});

// A real same-field race must remain visible as a conflict, not silently
// choose whichever device happened to save last.
check('two devices changing the same field report a conflict',
 { routeA: { travelPlan: { accommodation: 'Base' } } },
 { routeA: { travelPlan: { accommodation: 'iPhone' } } },
 { routeA: { travelPlan: { accommodation: 'iPad' } } },
 { routeA: { travelPlan: { accommodation: 'iPhone' } } },
 ['trailEventDataEdits.routeA.travelPlan.accommodation']);


const retryStart=source.indexOf('function cloudRetryDelay(attempt){');
const retryEnd=source.indexOf('function schedulePlannerCloudRetry',retryStart);
assert.notEqual(retryStart,-1,'Cloud retry delay helper must exist');
assert.notEqual(retryEnd,-1,'Cloud retry scheduler boundary must exist');
const retrySource=source.slice(retryStart,retryEnd)+'\nglobalThis.cloudRetryDelay=cloudRetryDelay;';
const retryContext={};
vm.runInNewContext(retrySource,retryContext);
assert.deepEqual(
 [0,1,2,3,4,5,6,99].map(retryContext.cloudRetryDelay),
 [5000,15000,30000,60000,120000,300000,300000,300000],
 'Cloud retry must use bounded exponential backoff'
);
assert.ok(source.includes("window.addEventListener('online'"),'Cloud save must resume when the device comes back online');

const resumeStart=source.indexOf('async function resumePlannerCloudAfterReconnect(){');
const resumeEnd=source.indexOf('function schedulePlannerCloudRetry',resumeStart);
assert.notEqual(resumeStart,-1,'Reconnect reconciliation helper must exist');
assert.notEqual(resumeEnd,-1,'Reconnect helper boundary must exist');
const resumeBody=source.slice(resumeStart,resumeEnd);
assert.ok(resumeBody.indexOf('await checkForRemotePlannerChanges()')<resumeBody.indexOf('queuePlannerCloudSave()'),'Remote changes must be reconciled before retrying local writes');
const retryStartBody=source.indexOf('function schedulePlannerCloudRetry(){');
const retryEndBody=source.indexOf("window.addEventListener('online'",retryStartBody);
const retryBody=source.slice(retryStartBody,retryEndBody);
assert.ok(retryBody.includes('resumePlannerCloudAfterReconnect()'),'Timed retries must reconcile the cloud before saving');
assert.ok(source.includes("window.addEventListener('focus',resumePlannerCloudAfterReconnect)"),'Returning to the app must reconcile cloud state');
assert.ok(source.includes("if(!document.hidden)resumePlannerCloudAfterReconnect()"),'Returning to a visible app must reconcile cloud state');

assert.ok(source.includes('Deine lokalen Änderungen bleiben erhalten.'),'Failed cloud save must clearly preserve local edits');

const remoteCheckStart=source.indexOf('async function checkForRemotePlannerChanges(){');
const remoteCheckEnd=source.indexOf('function startCloudChangeChecks()',remoteCheckStart);
assert.notEqual(remoteCheckStart,-1,'Remote cloud reconciliation must exist');
assert.notEqual(remoteCheckEnd,-1,'Remote cloud reconciliation boundary must exist');
const remoteCheckBody=source.slice(remoteCheckStart,remoteCheckEnd);
assert.ok(remoteCheckBody.includes('await savePreRestoreBackup({createdAt:new Date().toISOString(),keys:local})'),'Remote sync must back up local data in IndexedDB before applying cloud changes');
assert.ok(!remoteCheckBody.includes("localStorage.setItem('trailEventPreRestoreBackup'"),'Remote sync must not store the full recovery snapshot in quota-limited localStorage');

console.log('Cloud route merge and offline retry regression tests passed.');
