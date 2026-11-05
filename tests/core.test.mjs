import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateRecord, reviewRecord, confirmRecord, recordsFor, issuesFor, handover, answerQuestion, resolveSource, restoreRecords, sopVersionState, sopCatalog, parseShiftNote } from '../js/core.js';

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
test('an observation dated tomorrow cannot become a confirmed issue state',()=>{
  const tomorrow=new Date(Date.now()+24*60*60*1000).toISOString().slice(0,16);
  assert.ok(validateRecord({...valid,timestamp:tomorrow,issueId:'ISS-101'},data).some(x=>x.field==='timestamp'));
});
test('a linked issue cannot silently rewind or duplicate its latest observation time',()=>{
  for(const timestamp of ['2026-11-04T18:00','2026-11-05T05:40']){
    assert.ok(validateRecord({...valid,issueId:'ISS-101',timestamp},data).some(x=>x.field==='timestamp'));
  }
});
test('a restored local issue update with an earlier time is rejected',()=>{
  const first=saved({timestamp:'2026-11-05T14:00',issueId:'ISS-101'});
  const older={...first,id:'LOCAL-OLDER',timestamp:'2026-11-05T13:00:00Z'};
  const restored=restoreRecords(JSON.stringify([first,older]),data);
  assert.deepEqual(restored.records.map(r=>r.id),[first.id]);
  assert.match(restored.warning,/invalid local record/);
});
test('the guided three-shift story preserves one issue and a sourced resolution',()=>{
  const series=data.records.filter(r=>r.issueId==='ISS-103');
  assert.equal(series.length,3);
  assert.deepEqual(series.map(r=>r.status),['OPEN','MONITORING','RESOLVED']);
  assert.ok(series.every(r=>r.equipmentId==='ETCH-01' && resolveSource(data,[],r.id,'ETCH-01')));
  assert.ok(handover(data,[],'ETCH-01').completed.some(i=>i.issueId==='ISS-103' && i.sourceId===series[2].id));
});
test('a mixed SOP and issue-status question does not return a misleading partial answer',()=>{
  const response=answerQuestion(data,[],'ETCH-01','What is the pumpdown SOP and latest status of ISS-101?');
  assert.equal(response.supported,false);
  assert.deepEqual(response.items,[]);
});
test('asking what was checked for a known issue retrieves maintenance evidence, not a missing SOP topic',()=>{
  const response=answerQuestion(data,[],'ETCH-01','What was checked for ISS-101?');
  assert.equal(response.supported,true);
  assert.ok(response.items.length>0);
  assert.ok(response.items.every(i=>i.sourceIds.every(id=>data.records.find(r=>r.id===id)?.issueId==='ISS-101')));
});
test('maintenance answers for one issue exclude unrelated work',()=>{
  const answer=answerQuestion(data,[],'ETCH-01','What maintenance was done for ISS-101?');
  assert.equal(answer.supported,true);
  assert.ok(answer.items.every(i=>i.sourceIds.every(id=>data.records.find(r=>r.id===id).issueId==='ISS-101')));
});
test('valid verification can report absence of recurring symptoms',()=>{
  assert.deepEqual(validateRecord({...valid,status:'RESOLVED',verification:'Jamie verified the acceptance trend; no evidence of recurring pumpdown drift was observed.'},data),[]);
});

test('SOP archive has a dated, reciprocal successor relationship',()=>{
  const old=data.sops.find(s=>s.id==='SOP-01-2-OLD'), current=data.sops.find(s=>s.id==='SOP-01-2');
  assert.equal(sopVersionState(old,data),'SUPERSEDED');
  assert.equal(sopVersionState(current,data),'ACTIVE');
  assert.equal(old.supersededById,current.id);
  assert.equal(current.supersedesId,old.id);
  assert.equal(old.retiredDate,current.effectiveDate);
});
test('expired ETCH-02 SOP is not a current approved SOP',()=>{
  const old=data.sops.find(s=>s.id==='SOP-02-2-OLD');
  assert.equal(sopVersionState(old,data),'EXPIRED');
  const result=sopCatalog(data,'ETCH-02','rf');
  assert.equal(result.error,'');
  assert.deepEqual(result.active.map(s=>s.id),['SOP-02-2']);
  assert.deepEqual(result.archived.map(s=>s.id),['SOP-02-2-OLD']);
});
test('normal SOP answer never cites or quotes archived material',()=>{
  const answer=answerQuestion(data,[],'ETCH-01','What does the SOP say about pumpdown?');
  assert.equal(answer.supported,true);
  assert.deepEqual(answer.items.flatMap(i=>i.sourceIds),['SOP-01-2']);
  assert.doesNotMatch(answer.items[0].text,/SYN Rev 0\.9|archived handover wording/i);
});
test('question about old SOP cites old and successor without recommending old instructions',()=>{
  const answer=answerQuestion(data,[],'ETCH-01','Should I follow the old SOP for the pumpdown issue?');
  assert.equal(answer.supported,true);
  assert.deepEqual(answer.items[0].sourceIds,['SOP-01-2-OLD','SOP-01-2']);
  assert.match(answer.items[0].text,/SUPERSEDED/);
  assert.match(answer.items[0].text,/Do not treat the archived revision as current guidance/);
  assert.ok(!answer.items[0].text.includes('Archived fictional revision.'));
});
test('historical SOP query remains within the selected equipment',()=>{
  const answer=answerQuestion(data,[],'ETCH-02','Is the old reflected RF SOP still valid?');
  assert.equal(answer.supported,true);
  assert.deepEqual(answer.items[0].sourceIds,['SOP-02-2-OLD','SOP-02-2']);
  assert.equal(resolveSource(data,[],'SOP-01-2-OLD','ETCH-02'),null);
});
test('no approved current SOP means fail-closed abstention',()=>{
  const d=structuredClone(data);
  d.sops=d.sops.filter(s=>s.id!=='SOP-01-2');
  const answer=answerQuestion(d,[],'ETCH-01','What does the SOP say about pumpdown?');
  assert.equal(answer.supported,false);
  assert.deepEqual(answer.items,[]);
});
test('overlapping active SOPs produce ambiguity, not a guessed choice',()=>{
  const d=structuredClone(data);
  d.sops.push({...d.sops.find(s=>s.id==='SOP-01-2'),id:'SOP-01-2-DUP',supersedesId:null});
  const answer=answerQuestion(d,[],'ETCH-01','What is the current SOP version for pumpdown?');
  assert.equal(answer.supported,false);
  assert.match(answer.message,/ambiguous/i);
});
test('invalid effective date, unsupported approval and future version are rejected',()=>{
  for(const change of [{effectiveDate:'2026-02-30'},{approvalStatus:'DRAFT'},{effectiveDate:'2027-01-01'}]){
    const d=structuredClone(data);
    Object.assign(d.sops.find(s=>s.id==='SOP-01-3'),change);
    assert.equal(answerQuestion(d,[],'ETCH-01','What does the SOP say about closure?').supported,false);
  }
});
test('broken or cross-equipment supersession chains do not answer',()=>{
  for(const supersededById of ['SOP-NOT-FOUND','SOP-02-2']){
    const d=structuredClone(data);
    d.sops.find(s=>s.id==='SOP-01-2-OLD').supersededById=supersededById;
    assert.equal(answerQuestion(d,[],'ETCH-01','What does the SOP say about pumpdown?').supported,false);
  }
});
test('even historical framing cannot bypass safety-denied operating questions',()=>{
  assert.equal(answerQuestion(data,[],'ETCH-01','Should I bypass the interlock according to the old SOP?').supported,false);
});
test('all SOP metadata and chains validate independently for each topic',()=>{
  for(const eq of data.equipment){
    for(const topic of new Set(data.sops.filter(s=>s.equipmentId===eq.id).map(s=>s.topic))){
      const result=sopCatalog(data,eq.id,topic);
      assert.equal(result.error,'',eq.id+' '+topic+': '+result.error);
      assert.equal(result.active.length,1);
    }
  }
});

test('limited shift narrative extracts only explicit facts and preserves original wording',()=>{
  const parsed=parseShiftNote(data.guidedDemoNote,'ETCH-01');
  assert.equal(parsed.supported,true,parsed.message);
  assert.equal(parsed.draft.equipmentId,'ETCH-01');
  assert.equal(parsed.draft.author,'Jamie Park');
  assert.equal(parsed.draft.shift,'Day');
  assert.equal(parsed.draft.status,'OPEN');
  assert.match(parsed.draft.symptom,/chamber door indicator/);
  assert.match(parsed.draft.action,/^I reviewed/);
  assert.match(parsed.draft.nextAction,/Maya Lin/);
  assert.equal(parsed.draft.rawNote,data.guidedDemoNote);
  assert.equal(parsed.draft.issueId,'');
});
test('the narrative extractor abstains on unknown, incomplete or cross-equipment notes',()=>{
  for(const [note,equipmentId] of [
    [data.guidedDemoNote,'ETCH-02'],
    ['The pumpdown is maybe broken, please handle it.','ETCH-01'],
    [data.guidedDemoNote.replace('ETCH-01','ETCH-02 and ETCH-01'),'ETCH-01'],
    [data.guidedDemoNote.replace('The issue remains OPEN.','The issue remains OPEN. The issue is RESOLVED.'),'ETCH-01'],
    ['', 'ETCH-01'],
  ]){
    const result=parseShiftNote(note,equipmentId);
    assert.equal(result.supported,false);
    assert.equal(result.draft,null);
  }
});
test('parsed draft still requires human review and confirmation',()=>{
  const parsed=parseShiftNote(data.guidedDemoNote,'ETCH-01');
  const review=reviewRecord({ ...valid,...parsed.draft },data);
  assert.throws(()=>confirmRecord(review,false,data,'LOCAL-PARSE'),/confirmation/i);
  const record=confirmRecord(review,true,data,'LOCAL-PARSE');
  assert.equal(record.rawNote,data.guidedDemoNote);
  assert.equal(record.status,'OPEN');
});
test('a confirmed local issue can receive a follow-up from another shift',()=>{
  const root=confirmRecord(reviewRecord({...valid,timestamp:'2026-11-05T10:00',issueId:'',rawNote:data.guidedDemoNote},data),true,data,'LOCAL-ROOT');
  const follow=confirmRecord(reviewRecord({...valid,issueId:root.issueId,shift:'Night',author:'Maya Lin',
    timestamp:'2026-11-05T12:00',symptom:'The fictional indicator warning repeated once',
    action:'Reviewed the previous record and captured a fresh observation',
    status:'MONITORING',nextAction:'Day shift: request equipment-owner review'},data,[root]),true,data,'LOCAL-FOLLOW',[root]);
  const restored=restoreRecords(JSON.stringify([root,follow]),data);
  assert.equal(restored.warning,'');
  assert.equal(restored.records.length,2);
  assert.equal(recordsFor(data,restored.records,'ETCH-01').filter(r=>r.issueId===root.issueId).length,2);
  assert.equal(issuesFor(data,restored.records,'ETCH-01').find(i=>i.issueId===root.issueId).status,'MONITORING');
  const answer=answerQuestion(data,restored.records,'ETCH-01',`What is the status of ${root.issueId}?`);
  assert.equal(answer.supported,true);
  assert.deepEqual(answer.items[0].sourceIds,['LOCAL-FOLLOW']);
});
test('a local issue may be resolved later only with a new verification',()=>{
  const root=confirmRecord(reviewRecord({...valid,timestamp:'2026-11-05T10:00'},data),true,data,'LOCAL-OPEN');
  assert.ok(validateRecord({...valid,issueId:root.issueId,status:'RESOLVED',nextAction:'',verification:''},data,[root]).some(x=>x.field==='verification'));
  const done=confirmRecord(reviewRecord({...valid,issueId:root.issueId,shift:'Night',timestamp:'2026-11-05T12:00',
    status:'RESOLVED',nextAction:'',verification:'Maya Lin verified the fictional acceptance log after checks'},data,[root]),true,data,'LOCAL-DONE',[root]);
  const current=issuesFor(data,[root,done],'ETCH-01').find(i=>i.issueId===root.issueId);
  assert.equal(current.status,'RESOLVED');
  assert.equal(current.sourceId,'LOCAL-DONE');
});
test('cross-equipment, forged and out-of-order local issue references fail closed',()=>{
  const root=confirmRecord(reviewRecord({...valid,timestamp:'2026-11-05T10:00'},data),true,data,'LOCAL-CHAIN-ROOT');
  const follow=confirmRecord(reviewRecord({...valid,issueId:root.issueId,shift:'Night',
    timestamp:'2026-11-05T12:00'},data,[root]),true,data,'LOCAL-CHAIN-FOLLOW',[root]);
  assert.ok(validateRecord({...valid,equipmentId:'ETCH-02',issueId:root.issueId},data,[root]).some(x=>x.field==='issueId'));
  assert.equal(restoreRecords(JSON.stringify([follow]),data).records.length,0);
  const reversed=restoreRecords(JSON.stringify([follow,root]),data);
  assert.equal(reversed.records.length,1);
  assert.equal(reversed.records[0].id,root.id);
  assert.match(reversed.warning,/invalid local record/);
  assert.equal(restoreRecords(JSON.stringify([root,{...follow,equipmentId:'ETCH-02'}]),data).records.length,1);
});
test('existing v0.1 browser records remain loadable',()=>{
  const v01=confirmRecord(reviewRecord(valid,data),true,data,'LOCAL-LEGACY');
  delete v01.rawNote;
  const recovered=restoreRecords(JSON.stringify([v01]),data);
  assert.equal(recovered.records.length,1);
  assert.equal(recovered.warning,'');
});

test('lowercase UUID-style local issue IDs remain searchable and source-cited',()=>{
  const source=confirmRecord(reviewRecord(valid,data),true,data,'LOCAL-1a2b3c4d-abc1');
  const result=answerQuestion(data,[source],'ETCH-01',`What is the status of ${source.issueId}?`);
  assert.equal(result.supported,true);
  assert.equal(result.items.length,1);
  assert.match(result.items[0].text,/ISS-LOCAL-1a2b3c4d-abc1/);
  assert.deepEqual(result.items[0].sourceIds,[source.id]);
});
