// Deterministic evidence rules. No model, network service or operational control.
export const STATUSES = ['OPEN', 'MONITORING', 'RESOLVED'];
const fields = ['equipmentId','issueId','timestamp','author','shift','symptom','action','status','nextAction','verification'];
const clean = input => Object.fromEntries(fields.map(key => [key, typeof input?.[key] === 'string' ? input[key].trim() : '']));
const known = (data, id) => data.equipment.some(e => e.id === id);
const validTime = value => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?Z?$/.test(value)) return false;
  const time=Date.parse(value.endsWith('Z') ? value : `${value}Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0,16)===value.slice(0,16);
};
const utc = value => new Date(value.endsWith('Z') ? value : `${value}Z`).toISOString();

export function validateRecord(input, data) {
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
  if (r.status === 'RESOLVED' && /\b(?:unverified|unresolved|pending|unknown|not yet|not verified|not checked|not completed|no (?:repair |post[- ]repair )?(?:verification|evidence)|remains open)\b/i.test(r.verification)) error('verification','The verification still describes missing evidence or an open issue. Keep the issue unresolved or record fresh verification.');
  if (r.issueId && !data.records.some(x => x.issueId === r.issueId && x.equipmentId === r.equipmentId)) error('issueId','This issue does not belong to the selected equipment.');
  for (const key of fields) if (r[key].length > (['symptom','action','nextAction','verification'].includes(key) ? 1500 : 100)) error(key,'This field is too long.');
  return errors;
}

export function reviewRecord(input, data) {
  const errors = validateRecord(input,data);
  if (errors.length) throw new Error(errors.map(e=>e.message).join(' '));
  const record = clean(input);
  return {record, snapshot: JSON.stringify(record)};
}

export function confirmRecord(review, acknowledged, data, id) {
  if (acknowledged !== true) throw new Error('Human confirmation is required.');
  if (!review || review.snapshot !== JSON.stringify(clean(review.record))) throw new Error('Review changed. Review the record again.');
  const record = reviewRecord(review.record,data).record;
  if (!/^LOCAL-[a-zA-Z0-9-]+$/.test(id)) throw new Error('Invalid local record identity.');
  const confirmedAt = new Date().toISOString();
  return {...record, timestamp:utc(record.timestamp), id, issueId:record.issueId || `ISS-${id}`, confirmed:true, confirmationKind:'human_demo', confirmedBy:record.author, confirmedAt};
}

function recordErrors(r, data) {
  // A new local issue has no seed reference; validate the remaining fields separately.
  return validateRecord({...r, issueId:r?.issueId?.startsWith('ISS-LOCAL-') ? '' : r?.issueId},data);
}

export function restoreRecords(raw, data) {
  if (!raw) return {records:[],warning:''};
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length > 1000) throw new Error('Invalid storage format.');
    const records = [], seen = new Set();
    let rejected = 0;
    for (const r of parsed) {
      if (!r || !/^LOCAL-[a-zA-Z0-9-]+$/.test(r.id) || r.confirmed !== true || r.confirmationKind !== 'human_demo' || r.confirmedBy !== r.author || !validTime(r.confirmedAt) || recordErrors(r,data).length || (r.issueId?.startsWith('ISS-LOCAL-') && r.issueId !== `ISS-${r.id}`)) {rejected++;continue;}
      if (!seen.has(r.id)) {records.push(r);seen.add(r.id);}
    }
    return {records,warning:rejected ? `${rejected} invalid local record(s) excluded. Reset demo data to clear them.` : ''};
  } catch {
    return {records:[],warning:'Local demo data could not be read. Only the synthetic seed records are shown.'};
  }
}

export function recordsFor(data, local, equipmentId) {
  if (!known(data,equipmentId)) return [];
  return [...data.records,...local].filter(r=>r.equipmentId===equipmentId && r.confirmed===true && !recordErrors(r,data).length)
    .sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp) || Date.parse(b.confirmedAt)-Date.parse(a.confirmedAt) || b.id.localeCompare(a.id));
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

export function answerQuestion(data, local, equipmentId, question) {
  const abstain = message => ({supported:false,message,items:[]});
  const q=String(question||'').trim().toLowerCase();
  if (!known(data,equipmentId)) return abstain('Select a known equipment before asking.');
  if (!q) return abstain('Enter a question or choose an example.');
  if (q.length>500) return abstain('Keep the question under 500 characters.');
  const mentioned=q.match(/etch[\s-]*\d+/g)||[];
  if (mentioned.some(id=>id.replace(/\s+/g,'').replace(/^etch-?/,'ETCH-')!==equipmentId)) return abstain(`This answer is scoped to ${equipmentId}. Select the other equipment to inspect its evidence.`);
  if (/bypass|override|disable|setpoint|recipe|restart|start production|safe to|can i|may i|should i|yield|forecast|cost|temperature|pressure|how many|how long|why|root cause|compare/.test(q)) return abstain('The available sources do not establish that answer. This demo cannot infer causes, give operating parameters or authorize equipment operation.');
  let issues=issuesFor(data,local,equipmentId);
  const requestedIssues=(q.match(/\biss-[a-z0-9-]+/g)||[]).map(id=>id.toUpperCase());
  if (requestedIssues.some(id=>!issues.some(i=>i.issueId===id))) return abstain(`That issue has no confirmed evidence in the ${equipmentId} workspace. Check its ID and equipment scope.`);
  if (requestedIssues.length) issues=issues.filter(i=>requestedIssues.includes(i.issueId));
  const statusQuestion=/status|open|unresolved|fixed|repair|resolved|handover|follow.?up|brief|issues/.test(q);
  const sopQuestion=/sop|procedure|checklist|check|pumpdown|vacuum|reflected|\brf\b|cooling|closure/.test(q);
  const items=[];
  if (sopQuestion && !statusQuestion) {
    let topics=[];
    if (/pumpdown|vacuum/.test(q)) topics.push('pumpdown');
    if (/reflected|\brf\b/.test(q)) topics.push('rf');
    if (/cooling/.test(q)) topics.push('cooling');
    if (/closure|close|verification/.test(q)) topics.push('closure');
    const generalSopRequest=/^(?:(?:show|list)(?: the)?(?: available)? (?:sops?|procedures?)|what (?:sops?|procedures?) (?:are available|are in scope))\??$/.test(q);
    if (!topics.length && !generalSopRequest) return abstain(`No matching SOP topic is available for ${equipmentId}. Use one of the listed SOP topics.`);
    const sops=data.sops.filter(s=>s.equipmentId===equipmentId && (!topics.length||topics.includes(s.topic)));
    if (!sops.length) return abstain(`No matching SOP section is available for ${equipmentId}.`);
    for (const s of sops) items.push({text:`${s.document} ${s.section}: ${s.text}`,sourceIds:[s.id]});
  } else if (statusQuestion) {
    if (/\bopen\b|\bunresolved\b|follow.?up/.test(q) && !/\bresolved\b|\bclosed\b/.test(q)) issues=issues.filter(i=>i.status!=='RESOLVED');
    for (const i of issues) items.push({text:`${i.issueId} — ${i.status}. ${i.observation} ${i.status==='RESOLVED' ? `Recorded verification: ${i.verification}` : `Next action: ${i.nextAction} No verified repair is established for this issue.`}`,sourceIds:[i.sourceId]});
  } else if (/recent|latest|last|history|maintenance|action|work|happen/.test(q)) {
    for (const r of recordsFor(data,local,equipmentId).slice(0,3)) items.push({text:`${r.id} · ${r.status}: ${r.action}`,sourceIds:[r.id]});
  } else return abstain('No supported answer was found in the available evidence. Try a question about open issues, recent work or a listed SOP topic.');
  if (!items.length) return abstain('No confirmed evidence is available for this equipment.');
  return {supported:true,message:`Source-based response · ${equipmentId} · deterministic demo`,items};
}
