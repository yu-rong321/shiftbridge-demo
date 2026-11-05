import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import * as core from '../js/core.js';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const app=await readFile(new URL('../js/app.js',import.meta.url),'utf8');
const seed=JSON.parse(await readFile(new URL('../data/demo.json',import.meta.url),'utf8'));
const key='shiftbridge.demo.v01.records';
const tick=()=>new Promise(resolve=>setTimeout(resolve,15));

async function open({storage=null,failStorage=false,dataset=seed}={}){
 const dom=new JSDOM(html,{url:'https://example.test/shiftbridge-demo/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;
 w.__core=core;w.scrollTo=()=>{};
 w.fetch=async url=>{assert.equal(String(url),'https://example.test/shiftbridge-demo/data/demo.json');return {ok:true,json:async()=>structuredClone(dataset)};};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 if(storage)w.localStorage.setItem(key,storage);
 if(failStorage)w.Storage.prototype.setItem=function(){throw new Error('Quota exceeded');};
 const code=app.replace(/^import[^\n]+\n/,'const {STATUSES,validateRecord,reviewRecord,confirmRecord,recordsFor,issuesFor,handover,answerQuestion,resolveSource,restoreRecords,sopVersionState,sopCatalog}=window.__core;\n').replaceAll('import.meta.url',JSON.stringify('https://example.test/shiftbridge-demo/js/app.js'));
 const errors=[];w.addEventListener('error',event=>errors.push(String(event.error)));
 // A closure mirrors ES-module bindings; window.history must not replace history().
 w.eval(`(function(){'use strict';\n${code}\n})();`);await tick();
 return {dom,w,d:w.document,close:()=>{dom.window.close();assert.deepEqual(errors,[],'No uncaught DOM event errors');}};
}
async function go(ctx,hash){ctx.w.location.hash=hash;await tick();}
function input(ctx,id,value){const el=ctx.d.getElementById(id);el.value=value;el.dispatchEvent(new ctx.w.Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));}
function click(ctx,selector){const el=ctx.d.querySelector(selector);assert.ok(el,selector);el.click();}
function submit(ctx,id){ctx.d.getElementById(id).dispatchEvent(new ctx.w.Event('submit',{bubbles:true,cancelable:true}));}
async function sample(ctx){await go(ctx,'record');click(ctx,'[data-action="sample"]');input(ctx,'timestamp','2026-11-05T14:00');}
function confirm(ctx){click(ctx,'#acknowledge');click(ctx,'[data-action="save-record"]');}

test('all five views render in the English workspace',async()=>{
 const c=await open();try{for(const [hash,title] of [['overview','Facility Overview'],['record','Record My Shift'],['history','Maintenance History'],['brief','Brief Next Shift'],['knowledge','Equipment Knowledge Q&A']]){await go(c,hash);assert.equal(c.d.querySelector('h1').textContent,title);}}finally{c.close();}
});
test('required field validation prevents entry into review',async()=>{
 const c=await open();try{await go(c,'record');submit(c,'record-form');assert.equal(c.d.querySelector('#validation-errors').hidden,false);assert.equal(c.d.querySelector('#author').getAttribute('aria-invalid'),'true');assert.equal(c.w.localStorage.getItem(key),null);}finally{c.close();}
});
test('draft and review never appear in history or Q&A',async()=>{
 const c=await open();try{await sample(c);input(c,'symptom','UNCONFIRMED-SENTINEL');submit(c,'record-form');assert.equal(c.d.querySelector('[data-action="save-record"]').disabled,true);await go(c,'history');assert.ok(!c.d.querySelector('main').textContent.includes('UNCONFIRMED-SENTINEL'));await go(c,'knowledge');click(c,'[data-question="What issues are open?"]');assert.ok(!c.d.querySelector('#answer-result').textContent.includes('UNCONFIRMED-SENTINEL'));}finally{c.close();}
});
test('editing a review requires a new review and acknowledgement',async()=>{
 const c=await open();try{await sample(c);submit(c,'record-form');click(c,'#acknowledge');assert.equal(c.d.querySelector('[data-action="save-record"]').disabled,false);click(c,'[data-action="edit-record"]');input(c,'symptom','Edited synthetic observation');submit(c,'record-form');assert.equal(c.d.querySelector('#acknowledge').checked,false);assert.equal(c.d.querySelector('[data-action="save-record"]').disabled,true);}finally{c.close();}
});
test('confirmed save is read back, survives reload and appears in handover',async()=>{
 const c=await open();let storage;try{await sample(c);input(c,'symptom','CONFIRMED-LOCAL-SENTINEL');submit(c,'record-form');confirm(c);assert.match(c.d.querySelector('main').textContent,/Demo record saved/);storage=c.w.localStorage.getItem(key);assert.equal(JSON.parse(storage).length,1);await go(c,'brief');assert.match(c.d.querySelector('main').textContent,/CONFIRMED-LOCAL-SENTINEL/);}finally{c.close();}
 const reload=await open({storage});try{await go(reload,'history');assert.match(reload.d.querySelector('main').textContent,/CONFIRMED-LOCAL-SENTINEL/);}finally{reload.close();}
});
test('equipment switch clears review and excludes other equipment records',async()=>{
 const c=await open();try{await sample(c);submit(c,'record-form');input(c,'equipment-select','ETCH-02');assert.ok(c.d.querySelector('#record-form'));assert.equal(c.d.querySelector('#equipment-locked').value,'ETCH-02');await go(c,'history');assert.ok(!c.d.querySelector('main').textContent.includes('REC-103'));assert.ok(c.d.querySelector('main').textContent.includes('REC-203'));}finally{c.close();}
});
test('sources open in a modal scoped to the selected equipment',async()=>{
 const c=await open();try{await go(c,'brief');click(c,'[data-source="REC-103"]');assert.equal(c.d.querySelector('#source-dialog').open,true);assert.match(c.d.querySelector('#source-content').textContent,/ETCH-01/);assert.match(c.d.querySelector('#source-content').textContent,/OPEN/);click(c,'[data-action="close-source"]');assert.equal(c.d.querySelector('#source-dialog').open,false);}finally{c.close();}
});
test('Q&A cites evidence and abstains on unsupported and cross-equipment questions',async()=>{
 const c=await open();try{await go(c,'knowledge');click(c,'[data-question="What issues are open?"]');assert.ok(c.d.querySelector('#answer-result [data-source]'));assert.match(c.d.querySelector('#answer-result').textContent,/OPEN/);input(c,'question','Has ETCH-02 been repaired?');submit(c,'question-form');assert.match(c.d.querySelector('#answer-result').textContent,/No supported answer/);click(c,'[data-question="What is the production yield forecast?"]');assert.equal(c.d.querySelector('#answer-result [data-source]'),null);}finally{c.close();}
});
test('unavailable persistence does not claim a successful save',async()=>{
 const c=await open({failStorage:true});try{assert.equal(c.d.querySelector('#storage-warning').hidden,false);await sample(c);submit(c,'record-form');confirm(c);assert.ok(c.d.querySelector('#acknowledge'));assert.ok(!c.d.querySelector('main').textContent.includes('Demo record saved'));assert.equal(c.w.localStorage.getItem(key),null);}finally{c.close();}
});
test('reset cancellation keeps data; reset confirmation clears only demo records',async()=>{
 const r=core.confirmRecord(core.reviewRecord({equipmentId:'ETCH-01',issueId:'',timestamp:'2026-11-05T14:00',author:'Jamie',shift:'Day',symptom:'Local observation',action:'Logged observation',status:'OPEN',nextAction:'Owner review',verification:''},seed),true,seed,'LOCAL-UI');
 const c=await open({storage:JSON.stringify([r])});try{c.w.localStorage.setItem('unrelated-key','keep');click(c,'#reset-demo');click(c,'[data-action="cancel-reset"]');assert.ok(c.w.localStorage.getItem(key));click(c,'#reset-demo');click(c,'[data-action="confirm-reset"]');assert.equal(c.w.localStorage.getItem(key),null);assert.equal(c.w.localStorage.getItem('unrelated-key'),'keep');assert.equal(c.d.querySelectorAll('.stat-number')[2].textContent,'6');}finally{c.close();}
});
test('source content and user text are escaped',async()=>{
 const c=await open();try{await sample(c);input(c,'symptom','<img src=x onerror="window.__bad=true">');submit(c,'record-form');assert.equal(c.d.querySelector('main img'),null);assert.match(c.d.querySelector('main').textContent,/<img/);assert.equal(c.w.__bad,undefined);}finally{c.close();}
});
test('sample loading works after all seed issues have been resolved',async()=>{
 const r=core.confirmRecord(core.reviewRecord({equipmentId:'ETCH-01',issueId:'ISS-101',timestamp:'2026-11-05T14:00',author:'Jamie',shift:'Day',symptom:'Synthetic recheck',action:'Completed fictional verification',status:'RESOLVED',nextAction:'',verification:'Verified fictional trend by Jamie'},seed),true,seed,'LOCAL-CLOSED');
 const c=await open({storage:JSON.stringify([r])});try{await go(c,'record');click(c,'[data-action="sample"]');assert.match(c.d.querySelector('#symptom').value,/synthetic|Synthetic/);}finally{c.close();}
});
test('changing to RESOLVED clears old verification and requires fresh evidence',async()=>{
 const c=await open();try{await sample(c);input(c,'status','RESOLVED');assert.equal(c.d.querySelector('#verification').value,'');submit(c,'record-form');assert.equal(c.d.querySelector('#verification').getAttribute('aria-invalid'),'true');assert.equal(c.w.localStorage.getItem(key),null);}finally{c.close();}
});

test('SOP catalog distinguishes approved current and archived revisions',async()=>{
  const c=await open();try{
    await go(c,'knowledge');
    const content=c.d.querySelector('main').textContent;
    assert.match(content,/Current SOP references/);
    assert.match(content,/Historical SOP archive/);
    assert.match(content,/ARCHIVED — NOT CURRENT/);
    assert.match(content,/SOP-01-2-OLD/);
    click(c,'[data-source="SOP-01-2-OLD"]');
    assert.match(c.d.querySelector('#source-content').textContent,/SUPERSEDED/);
    assert.match(c.d.querySelector('#source-content').textContent,/2026-10-15/);
    assert.match(c.d.querySelector('#source-content').textContent,/SOP-01-2/);
  }finally{c.close();}
});
test('old SOP question includes archived source and active successor',async()=>{
  const c=await open();try{
    await go(c,'knowledge');
    input(c,'question','Should I follow the old SOP for the pumpdown issue?');
    submit(c,'question-form');
    const ids=[...c.d.querySelectorAll('#answer-result [data-source]')].map(e=>e.dataset.source);
    assert.deepEqual(ids,['SOP-01-2-OLD','SOP-01-2']);
    assert.match(c.d.querySelector('#answer-result').textContent,/Do not treat the archived revision as current/);
  }finally{c.close();}
});
test('expired ETCH-02 SOP is archival and not shown as current',async()=>{
  const c=await open();try{
    input(c,'equipment-select','ETCH-02');
    await go(c,'knowledge');
    assert.match(c.d.querySelector('main').textContent,/SOP-02-2-OLD/);
    click(c,'[data-question="Is the old reflected RF SOP still valid?"]');
    assert.match(c.d.querySelector('#answer-result').textContent,/EXPIRED/);
    assert.deepEqual([...c.d.querySelectorAll('#answer-result [data-source]')].map(e=>e.dataset.source),['SOP-02-2-OLD','SOP-02-2']);
  }finally{c.close();}
});
test('SOP version conflict in demo data abstains in the browser UI',async()=>{
  const d=structuredClone(seed);
  d.sops.push({...d.sops.find(s=>s.id==='SOP-01-2'),id:'SOP-01-2-OVERLAP',supersedesId:null});
  const c=await open({dataset:d});try{
    await go(c,'knowledge');
    click(c,'[data-question="What does the SOP say about pumpdown?"]');
    assert.match(c.d.querySelector('#answer-result').textContent,/No supported answer/);
    assert.match(c.d.querySelector('main').textContent,/SOP validity conflict/);
  }finally{c.close();}
});
