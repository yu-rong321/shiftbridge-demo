import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateRecord, reviewRecord, confirmRecord, recordsFor, issuesFor, handover, answerQuestion, resolveSource, restoreRecords } from '../js/core.js';

const data = JSON.parse(await readFile(new URL('../data/demo.json', import.meta.url)));
const valid = {equipmentId:'ETCH-01', issueId:'', timestamp:'2026-11-05T14:00', author:'Alex Chen', shift:'Day', symptom:'Long pumpdown observed', action:'Reviewed trend and recorded observation', status:'OPEN', nextAction:'Recheck at next handover', verification:''};
const saved = (patch={}) => confirmRecord(reviewRecord({...valid,...patch},data),true,data,'LOCAL-TEST');

test('required fields and unsupported equipment are rejected',()=>{
  assert.ok(validateRecord({...valid,author:'  ',equipmentId:'ETCH-99'},data).length>=2);
});
test('resolved requires recorded verification',()=>{
  assert.ok(validateRecord({...valid,status:'RESOLVED'},data).some(x=>x.field==='verification'));
});
test('open requires explicit next action',()=>{
  assert.ok(validateRecord({...valid,nextAction:''},data).some(x=>x.field==='nextAction'));
});
test('confirmation is a separate mandatory step',()=>{
  const review=reviewRecord(valid,data);
  assert.throws(()=>confirmRecord(review,false,data,'LOCAL-X'),/confirm/i);
  assert.equal(saved().confirmed,true);
});
test('mutating the review snapshot cannot bypass revalidation',()=>{
  const review=reviewRecord(valid,data);
  review.record.equipmentId='ETCH-99';
  assert.throws(()=>confirmRecord(review,true,data,'LOCAL-X'));
});
test('equipment issue references must belong to selected equipment',()=>{
  assert.ok(validateRecord({...valid,issueId:'ISS-201'},data).some(x=>x.field==='issueId'));
});
test('drafts are excluded from official history',()=>{
  const draft={...valid,id:'DRAFT',confirmed:false};
  assert.equal(recordsFor(data,[draft],'ETCH-01').some(r=>r.id==='DRAFT'),false);
});
test('ETCH-01 history contains no ETCH-02 records',()=>{
  assert.ok(recordsFor(data,[],'ETCH-01').every(r=>r.equipmentId==='ETCH-01'));
});
test('unknown equipment returns no records',()=>assert.deepEqual(recordsFor(data,[],'ETCH-99'),[]));
test('OPEN remains open even when action text claims fixed',()=>{
  const local=saved({action:'Fixed and repaired everything',issueId:'ISS-101'});
  const issue=issuesFor(data,[local],'ETCH-01').find(i=>i.issueId==='ISS-101');
  assert.equal(issue.status,'OPEN');
  assert.ok(handover(data,[local],'ETCH-01').open.some(i=>i.issueId==='ISS-101'));
});
test('only a verified confirmed resolution closes its own issue',()=>{
  const local=saved({issueId:'ISS-101',status:'RESOLVED',verification:'Synthetic acceptance trend checked by Alex Chen',nextAction:''});
  assert.equal(issuesFor(data,[local],'ETCH-01').find(i=>i.issueId==='ISS-101').status,'RESOLVED');
  assert.ok(issuesFor(data,[local],'ETCH-02').some(i=>i.status==='OPEN'));
});
test('handover every item has an equipment-scoped source',()=>{
  const brief=handover(data,[],'ETCH-01');
  for(const item of [...brief.open,...brief.completed,...brief.recent]){
    assert.ok(resolveSource(data,[],item.sourceId,'ETCH-01'));
  }
});
test('Q&A status answers cite confirmed records and retain OPEN',()=>{
  const answer=answerQuestion(data,[],'ETCH-01','What issues are open?');
  assert.equal(answer.supported,true);
  assert.ok(answer.items.some(x=>x.text.includes('OPEN')));
  for(const item of answer.items) assert.ok(item.sourceIds.every(id=>resolveSource(data,[],id,'ETCH-01')));
});
test('Q&A SOP answers cite actual SOP sections',()=>{
  const answer=answerQuestion(data,[],'ETCH-01','What does the SOP say about pumpdown?');
  assert.equal(answer.supported,true);
  assert.ok(answer.items.some(x=>x.sourceIds.some(id=>id.startsWith('SOP-'))));
});
test('unsupported questions abstain without invented facts',()=>{
  const answer=answerQuestion(data,[],'ETCH-01','What is the production yield forecast?');
  assert.equal(answer.supported,false);
  assert.deepEqual(answer.items,[]);
});
test('cross-equipment and unknown equipment requests abstain',()=>{
  for(const q of ['Has ETCH-02 been repaired?','Compare ETCH-01 and ETCH-02','Status of ETCH-99']){
    assert.equal(answerQuestion(data,[],'ETCH-01',q).supported,false);
  }
});
test('negative procedural question must not return a positive instruction',()=>{
  assert.equal(answerQuestion(data,[],'ETCH-01','Can I bypass the pumpdown interlock?').supported,false);
});
test('cross-equipment source lookup is denied',()=>{
  const r=data.records.find(r=>r.equipmentId==='ETCH-02');
  assert.equal(resolveSource(data,[],r.id,'ETCH-01'),null);
});
test('corrupt storage does not become trusted data',()=>{
  assert.equal(restoreRecords('{broken',data).warning.length>0,true);
  assert.deepEqual(restoreRecords(JSON.stringify([{...valid,id:'LOCAL-X',confirmed:false}]),data).records,[]);
});
test('valid local records restore once and retain evidence',()=>{
  const r=saved();
  const restored=restoreRecords(JSON.stringify([r,r]),data);
  assert.equal(restored.records.length,1);
  assert.equal(restored.records[0].confirmed,true);
});
test('seed issue IDs never overlap across equipment and all records validate',()=>{
  for(const record of data.records) assert.deepEqual(validateRecord(record,data),[]);
  const issueEquipment=new Map();
  for(const record of data.records){
    if(issueEquipment.has(record.issueId)) assert.equal(issueEquipment.get(record.issueId),record.equipmentId);
    issueEquipment.set(record.issueId,record.equipmentId);
  }
});
test('unrelated SOP topics abstain instead of returning generic evidence',()=>{
  assert.equal(answerQuestion(data,[],'ETCH-01','What does the SOP say about gas leaks?').supported,false);
});
test('unknown issue IDs abstain and known issue queries stay focused',()=>{
  assert.equal(answerQuestion(data,[],'ETCH-01','What is the status of ISS-999?').supported,false);
  const answer=answerQuestion(data,[],'ETCH-01','What is the status of ISS-101?');
  assert.equal(answer.items.length,1);
  assert.match(answer.items[0].text,/ISS-101/);
});
test('negative verification cannot turn an OPEN issue into verified completion',()=>{
  const errors=validateRecord({...valid,status:'RESOLVED',issueId:'ISS-101',verification:'No repair verification; issue remains open.'},data);
  assert.ok(errors.some(x=>x.field==='verification'));
});
test('impossible calendar dates are rejected',()=>{
  assert.ok(validateRecord({...valid,timestamp:'2026-02-30T12:00'},data).some(x=>x.field==='timestamp'));
});
test('maintenance answers for one issue exclude unrelated work',()=>{
  const answer=answerQuestion(data,[],'ETCH-01','What maintenance was done for ISS-101?');
  assert.equal(answer.supported,true);
  assert.ok(answer.items.every(i=>i.sourceIds.every(id=>data.records.find(r=>r.id===id).issueId==='ISS-101')));
});
test('valid verification can report absence of recurring symptoms',()=>{
  assert.deepEqual(validateRecord({...valid,status:'RESOLVED',verification:'Jamie verified the acceptance trend; no evidence of recurring pumpdown drift was observed.'},data),[]);
});
