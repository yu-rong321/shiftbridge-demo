// Deterministic evidence rules. No model, network service or operational control.
export const STATUSES = ['OPEN', 'MONITORING', 'RESOLVED'];
const fields = ['equipmentId','issueId','timestamp','author','shift','symptom','action','status','nextAction','verification','rawNote'];
const clean = input => Object.fromEntries(fields.map(key => [key, typeof input?.[key] === 'string' ? input[key].trim() : '']));
const known = (data, id) => data.equipment.some(e => e.id === id);
const validTime = value => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?Z?$/.test(value)) return false;
  const time=Date.parse(value.endsWith('Z') ? value : `${value}Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0,16)===value.slice(0,16);
};
const utc = value => new Date(value.endsWith('Z') ? value : `${value}Z`).toISOString();

export function validateRecord(input, data, local=[]) {
  const r = clean(input), errors = [];
  const error = (field, message) => errors.push({field, message});
  if (!known(data, r.equipmentId)) error('equipmentId','Select a known equipment ID.');
  if (!validTime(r.timestamp)) error('timestamp','Enter a valid observation date and time (UTC).');
  for (const [key, label] of [['author','Recorded by'],['symptom','Observation'],['action','Action taken']]) {
    if (!r[key]) error(key,`${label} is required.`);
  }
  if (!['Day','Night'].includes(r.shift)) error('shift','Select Day or Night shift.');
  if (!STATUSES.includes(r.status)) error('status','Select a valid issue status.');
  if (r.status !== 'RESOLVED' && !r.nextAction) error('nextAction','An unresolved issue needs a next action.');
  if (r.status === 'RESOLVED' && r.verification.length < 12) error('verification','RESOLVED requires specific verification evidence (at least 12 characters).');
  const missingVerification=/\b(?:unverified|unresolved|not verified|not checked|not completed|remains open)\b|\bverification(?: is| remains)? (?:pending|unknown|not yet)\b|\bno (?:repair |post[- ]repair )?verification\b|\bno (?:repair |post[- ]repair |verification )evidence\b|\bno evidence(?:\s*(?:[.;]|$)|\s+(?:exists|available|recorded|provided|yet|for (?:repair|verification)|to (?:verify|confirm)|of (?:a )?(?:repair|verification|completion)))/i;
  if (r.status === 'RESOLVED' && missingVerification.test(r.verification)) error('verification','The verification still describes missing evidence or an open issue. Keep the issue unresolved or record fresh verification.');
  const seedIssue=data.records.some(x=>x.issueId===r.issueId&&x.equipmentId===r.equipmentId);
  const localIssue=Array.isArray(local)&&local.some(x=>x.issueId===r.issueId&&x.equipmentId===r.equipmentId&&x.confirmed===true&&x.confirmationKind==='human_demo');
  if(r.issueId && !seedIssue && !localIssue) error('issueId','This issue is not in the selected equipment\'s confirmed history.');
  for (const key of fields) if (r[key].length > (['symptom','action','nextAction','verification'].includes(key) ? 1500 : key==='rawNote' ? 2000 : 100)) error(key,'This field is too long.');
  return errors;
}

export function reviewRecord(input, data, local=[]) {
  const errors = validateRecord(input,data,local);
  if (errors.length) throw new Error(errors.map(e=>e.message).join(' '));
  const record = clean(input);
  return {record, snapshot: JSON.stringify(record)};
}

export function confirmRecord(review, acknowledged, data, id, local=[]) {
  if (acknowledged !== true) throw new Error('Human confirmation is required.');
  if (!review || review.snapshot !== JSON.stringify(clean(review.record))) throw new Error('Review changed. Review the record again.');
  const record = reviewRecord(review.record,data,local).record;
  if (!/^LOCAL-[a-zA-Z0-9-]+$/.test(id)) throw new Error('Invalid local record identity.');
  const confirmedAt = new Date().toISOString();
  return {...record, timestamp:utc(record.timestamp), id, issueId:record.issueId || `ISS-${id}`, confirmed:true, confirmationKind:'human_demo', confirmedBy:record.author, confirmedAt};
}

function recordErrors(r,data,priorLocal=[]) {
  // A source creates its own ISS-LOCAL-* identity. Subsequent shifts must cite a
  // previously accepted confirmed source from the SAME equipment and issue.
  const creation=typeof r?.id==='string' && r.issueId===`ISS-${r.id}` && /^LOCAL-[a-zA-Z0-9-]+$/.test(r.id);
  return validateRecord({...r,issueId:creation?'':r.issueId},data,priorLocal);
}

export function restoreRecords(raw,data){
  if(!raw)return {records:[],warning:''};
  try{
    const parsed=JSON.parse(raw);
    if(!Array.isArray(parsed)||parsed.length>1000)throw new Error('Invalid storage format.');
    const records=[],seen=new Set();
    let rejected=0;
    for(const r of parsed){
      const idOk=typeof r?.id==='string'&&/^LOCAL-[a-zA-Z0-9-]+$/.test(r.id);
      const metadataOk=idOk&&r.confirmed===true&&r.confirmationKind==='human_demo'&&r.confirmedBy===r.author&&validTime(r.confirmedAt);
      const sourceOk=metadataOk&&!recordErrors(r,data,records).length;
      if(!sourceOk||seen.has(r?.id)){rejected++;continue;}
      records.push(r);seen.add(r.id);
    }
    return {records,warning:rejected?`${rejected} invalid local record(s) excluded. Reset demo data to clear them.`:''};
  }catch{
    return {records:[],warning:'Local demo data could not be read. Only the synthetic seed records are shown.'};
  }
}

export function recordsFor(data,local,equipmentId){
  if(!known(data,equipmentId))return [];
  // Revalidate local records as an append-only source chain, including links
  // from one confirmed shift to another. A fabricated local issue is excluded.
  const accepted=restoreRecords(JSON.stringify(Array.isArray(local)?local:[]),data).records;
  return [...data.records.filter(r=>r.confirmed===true&&!validateRecord(r,data).length),...accepted]
    .filter(r=>r.equipmentId===equipmentId)
    .sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp)||Date.parse(b.confirmedAt)-Date.parse(a.confirmedAt)||b.id.localeCompare(a.id));
}

export function issuesFor(data, local, equipmentId) {
  const issues = new Map();
  for (const r of recordsFor(data,local,equipmentId)) if (!issues.has(r.issueId)) {
    issues.set(r.issueId,{issueId:r.issueId,equipmentId,status:r.status,observation:r.symptom,action:r.action,nextAction:r.nextAction,verification:r.verification,author:r.author,timestamp:r.timestamp,sourceId:r.id});
  }
  return [...issues.values()];
}

export function handover(data, local, equipmentId) {
  const issues=issuesFor(data,local,equipmentId);
  return {equipmentId,open:issues.filter(i=>i.status!=='RESOLVED'),completed:issues.filter(i=>i.status==='RESOLVED'),recent:recordsFor(data,local,equipmentId).slice(0,4).map(r=>({text:r.action,status:r.status,sourceId:r.id,timestamp:r.timestamp}))};
}

export function resolveSource(data, local, id, equipmentId) {
  return recordsFor(data,local,equipmentId).find(r=>r.id===id) || data.sops.find(s=>s.id===id && s.equipmentId===equipmentId) || null;
}

// Narrow, deterministic narrative extractor. This is a local demonstration of
// drafting, NOT a language model: only explicit observed facts are copied.
export function parseShiftNote(raw,equipmentId){
  const note=String(raw??'').trim();
  const reject=message=>({supported:false,message,draft:null});
  if(!note||note.length>2000)return reject('Enter a shift note between 1 and 2,000 characters.');
  const mentioned=[...new Set((note.match(/\bETCH[-\s]?\d{2}\b/gi)||[]).map(x=>x.toUpperCase().replace(/\s/g,'').replace(/^ETCH(\d)/,'ETCH-$1')))];
  if(mentioned.length!==1||mentioned[0]!==equipmentId)return reject('Include exactly the selected equipment ID. The demo does not infer equipment identity.');
  const observation=note.match(/\b(?:i|we)\s+(?:observed|noticed)\s+([^.!?\n]{8,450})[.!?]/i);
  const action=note.match(/\b(?:i|we)\s+((?:reviewed|checked|inspected|recorded|captured|logged)\s+[^.!?\n]{8,450})[.!?]/i);
  const next=note.match(/\bnext shift\s*:\s*([^.!?\n]{8,450})[.!?]?/i);
  const person=note.match(/\brecorded by\s*:\s*([a-z][a-z' -]{1,60})(?:[.!?\n]|$)/i);
  const shift=note.match(/\b(day|night)\s+shift\b/i);
  const state=note.match(/\b(?:issue|fault|alarm)\s+(?:is|remains|still)\s+(open|monitoring)\b/i);
  const conflicting=/\b(?:issue|fault|alarm)\s+(?:is|remains|still)\s+(?:resolved|closed|fixed)\b/i.test(note);
  if(!observation||!action||!next||!person||!shift||!state||conflicting)return reject('This note is outside the supported demo pattern or contains conflicting status. Use the sample narrative or fill the review fields manually; no facts were inferred.');
  return {supported:true,message:'Explicit details extracted by fixed local rules. Review every field before confirmation.',draft:{
    equipmentId,issueId:'',author:person[1].trim(),shift:shift[1].toLowerCase()==='day'?'Day':'Night',
    symptom:observation[1].trim(),action:`We ${action[1].trim()}`,status:state[1].toUpperCase(),
    nextAction:next[1].trim(),verification:'',rawNote:note
  }};
}

// SOP validity is evaluated against the fictional dataset's fixed scenario date,
// not the viewer's current clock. Historical sources remain inspectable, never operative.
const SOP_VERSION_STATUSES = ['ACTIVE','SUPERSEDED','EXPIRED','WITHDRAWN'];
const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const isDay = d => typeof d === 'string' && dayPattern.test(d) && !Number.isNaN(Date.parse(d+'T00:00:00Z')) && new Date(d+'T00:00:00Z').toISOString().slice(0,10) === d;

export function sopVersionState(s, data) {
  if (!s || !isDay(data?.scenarioDate) || !isDay(s.effectiveDate) ||
      (s.retiredDate !== null && !isDay(s.retiredDate)) ||
      !SOP_VERSION_STATUSES.includes(s.versionStatus) ||
      s.approvalStatus !== 'APPROVED' ||
      (s.retiredDate !== null && s.retiredDate <= s.effectiveDate) ||
      (s.versionStatus === 'ACTIVE' && (s.supersededById || s.retiredDate)) ||
      (s.versionStatus !== 'ACTIVE' && !s.retiredDate)) return 'INVALID';
  if (data.scenarioDate < s.effectiveDate) return 'NOT_YET_EFFECTIVE';
  if (s.retiredDate && data.scenarioDate >= s.retiredDate) return s.versionStatus === 'ACTIVE' ? 'EXPIRED' : s.versionStatus;
  // An archival revision is never eligible even if metadata contradicts its dates.
  if (s.versionStatus !== 'ACTIVE') return 'INVALID';
  return 'ACTIVE';
}

export function sopCatalog(data, equipmentId, topic=null) {
  const relevant=data.sops.filter(s=>s.equipmentId===equipmentId && (topic===null || s.topic===topic));
  const invalid=message=>({active:[],archived:[],error:message});
  if (!relevant.length) return invalid('No SOP evidence is available for this equipment and topic.');
  if (relevant.some(s=>sopVersionState(s,data)==='INVALID')) return invalid('SOP validity metadata is incomplete or contradictory.');
  for (const s of relevant) {
    if (s.supersededById) {
      const next=data.sops.find(n=>n.id===s.supersededById);
      if (!next || next.equipmentId!==s.equipmentId || next.topic!==s.topic ||
          next.supersedesId!==s.id || next.effectiveDate!==s.retiredDate)
        return invalid('SOP supersession chain is broken or crosses equipment/topic boundaries.');
    }
    if (s.supersedesId) {
      const previous=data.sops.find(p=>p.id===s.supersedesId);
      if (!previous || previous.equipmentId!==s.equipmentId || previous.topic!==s.topic ||
          previous.supersededById!==s.id || s.effectiveDate!==previous.retiredDate)
        return invalid('SOP successor metadata is inconsistent.');
    }
  }
  const topics=[...new Set(relevant.map(s=>s.topic))];
  const active=[],archived=[];
  for (const t of topics) {
    const group=relevant.filter(s=>s.topic===t);
    const current=group.filter(s=>sopVersionState(s,data)==='ACTIVE');
    if (current.length!==1) return invalid('SOP approval or version status is ambiguous: no unique effective version.');
    active.push(current[0]);
    archived.push(...group.filter(s=>s.versionStatus!=='ACTIVE'));
  }
  return {active,archived,error:''};
}

export function answerQuestion(data, local, equipmentId, question) {
  const abstain = message => ({supported:false,message,items:[]});
  const q=String(question||'').trim().toLowerCase();
  if (!known(data,equipmentId)) return abstain('Select a known equipment before asking.');
  if (!q) return abstain('Enter a question or choose an example.');
  if (q.length>500) return abstain('Keep the question under 500 characters.');
  const mentioned=q.match(/etch[\s-]*\d+/g)||[];
  if (mentioned.some(id=>id.replace(/\s+/g,'').replace(/^etch-?/,'ETCH-')!==equipmentId)) return abstain(`This answer is scoped to ${equipmentId}. Select the other equipment to inspect its evidence.`);
  const historicalSopQuestion=/\b(old|older|previous|outdated|obsolete|superseded|expired|legacy|archived?|historical)\b|\brev(?:ision)?\s*0[.]9\b/.test(q) && /\bsop\b|procedure|revision/.test(q);
  if (/bypass|override|disable|setpoint|recipe|restart|start production|safe to|yield|forecast|cost|temperature|pressure|how many|how long|why|root cause|compare/.test(q) || (/(?:can|may|should) i\b/.test(q) && !historicalSopQuestion)) return abstain('The available sources do not establish that answer. This demo cannot infer causes, give operating parameters or authorize equipment operation.');
  let issues=issuesFor(data,local,equipmentId);
  const requestedIssues=(q.match(/\biss-[a-z0-9-]+/g)||[]).map(id=>id.toUpperCase());
  if (requestedIssues.some(id=>!issues.some(i=>i.issueId===id))) return abstain(`That issue has no confirmed evidence in the ${equipmentId} workspace. Check its ID and equipment scope.`);
  if (requestedIssues.length) issues=issues.filter(i=>requestedIssues.includes(i.issueId));
  const statusQuestion=/status|open|unresolved|fixed|repair|resolved|handover|follow.?up|brief|issues/.test(q);
  const sopQuestion=/sop|procedure|checklist|check|pumpdown|vacuum|reflected|\brf\b|cooling|closure/.test(q);
  const items=[];
  if (sopQuestion && (!statusQuestion || historicalSopQuestion)) {
    const topics=[];
    if (/pumpdown|vacuum/.test(q)) topics.push('pumpdown');
    if (/reflected|\brf\b/.test(q)) topics.push('rf');
    if (/cooling/.test(q)) topics.push('cooling');
    if (/closure|close|verification/.test(q)) topics.push('closure');
    const generalSopRequest=/\b(sop|sops|procedure|procedures|revision|revisions)\b/.test(q) &&
      /\b(current|active|valid|effective|available|list|show|which|version|revisions)\b/.test(q);
    if (!topics.length && !generalSopRequest && !historicalSopQuestion)
      return abstain(`No matching SOP topic is available for ${equipmentId}. Use one of the listed SOP topics.`);
    const selected=topics.length?topics:[...new Set(data.sops.filter(s=>s.equipmentId===equipmentId).map(s=>s.topic))];
    for (const topic of selected) {
      const catalog=sopCatalog(data,equipmentId,topic);
      if (catalog.error) return abstain(`Unable to establish an approved current SOP for ${equipmentId} / ${topic}: ${catalog.error}`);
      if (historicalSopQuestion) {
        if (!catalog.archived.length) continue;
        for (const old of catalog.archived) {
          const current=catalog.active[0];
          items.push({text:`${old.document} ${old.section} ${old.revision} is ${old.versionStatus} as of ${data.scenarioDate} (effective ${old.effectiveDate}; retired ${old.retiredDate}). Its successor is ${current.document} ${current.section} ${current.revision}, effective ${current.effectiveDate}. Do not treat the archived revision as current guidance. This fictional reference does not authorize equipment operation.`,sourceIds:[old.id,current.id]});
        }
      } else {
        for (const current of catalog.active) items.push({text:`${current.document} ${current.section} ${current.revision} — ACTIVE as of ${data.scenarioDate} (effective ${current.effectiveDate}). ${current.text} This is fictional reference material, not operational authorization.`,sourceIds:[current.id]});
      }
    }
    if (historicalSopQuestion && !items.length) return abstain(`No historical SOP revision is recorded for ${equipmentId} and the requested topic.`);
  } else if (statusQuestion) {
    if (/\bopen\b|\bunresolved\b|follow.?up/.test(q) && !/\bresolved\b|\bclosed\b/.test(q)) issues=issues.filter(i=>i.status!=='RESOLVED');
    for (const i of issues) items.push({text:`${i.issueId} — ${i.status}. ${i.observation} ${i.status==='RESOLVED' ? `Recorded verification: ${i.verification}` : `Next action: ${i.nextAction} No verified repair is established for this issue.`}`,sourceIds:[i.sourceId]});
  } else if (/recent|latest|last|history|maintenance|action|work|happen/.test(q)) {
    const matching=recordsFor(data,local,equipmentId).filter(r=>!requestedIssues.length||requestedIssues.includes(r.issueId));
    for (const r of matching.slice(0,3)) items.push({text:`${r.id} · ${r.status}: Reported action: ${r.action}${r.status!=='RESOLVED'?' This record does not establish a verified repair.':''}`,sourceIds:[r.id]});
  } else return abstain('No supported answer was found in the available evidence. Try a question about open issues, recent work or a listed SOP topic.');
  if (!items.length) return abstain('No confirmed evidence is available for this equipment.');
  return {supported:true,message:`Source-based response · ${equipmentId} · deterministic demo`,items};
}
