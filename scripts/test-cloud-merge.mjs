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

console.log('Cloud route merge regression tests passed (4 cases).');
