import {STATUSES,validateRecord,reviewRecord,confirmRecord,recordsFor,issuesFor,handover,answerQuestion,resolveSource,restoreRecords,sopVersionState,sopCatalog,parseShiftNote} from './core.js';

const STORAGE_KEY='shiftbridge.demo.v01.records';
const $=selector=>document.querySelector(selector);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',edit:'M12 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-7 M16 3l5 5 M10 14l-1 4 4-1L22 8l-5-5z',history:'M3 11a9 9 0 1 1 3 8 M3 4v7h7 M12 7v5l3 2',handover:'M4 4h11v6H4z M9 14h11v6H9z M4 14v6 M1 17h6 M19 3v7 M16 7h6',message:'M21 11a8 8 0 0 1-8 8H7l-5 3V11a9 9 0 0 1 19 0z M7 9h10 M7 13h7',shield:'M12 2l8 4v6c0 5-8 10-8 10S4 17 4 12V6z M8 12l3 3 5-6',arrow:'M5 12h14 M14 7l5 5-5 5',plus:'M12 5v14 M5 12h14',file:'M14 2H5v20h14V7z M14 2v6h5 M8 12h8 M8 16h8',clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5l3 2',alert:'M12 3L2 21h20z M12 9v5 M12 17v1',check:'M4 12l5 5L20 6',link:'M10 13a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-2 2 M14 11a4 4 0 0 0-6 0l-4 4a4 4 0 0 0 6 6l2-2',spark:'M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z'};
const icon=name=>`<span class="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name]||paths.file}"/></svg></span>`;
const badge=status=>`<span class="badge ${escape(status.toLowerCase())}">${escape(status)}</span>`;
const source=id=>`<button type="button" class="source-button" data-source="${escape(id)}" aria-label="View source ${escape(id)}">${icon('link')}${escape(id)}</button>`;
const date=value=>new Date(value).toLocaleString('en-GB',{timeZone:'UTC',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false})+' UTC';
const detail=(label,value)=>`<div><dt>${escape(label)}</dt><dd>${escape(value||'—')}</dd></div>`;
let data,local=[],equipmentId='ETCH-01',view='overview',draft=null,review=null,lastSaved=null,answer=null,question='',historyStatus='ALL',historyQuery='',warning='',storageWritable=true,toastTimer,guidedStep=-1,rawNote='',noteMessage='';
const routes=['overview','record','history','brief','knowledge'];
const route=()=>routes.includes(location.hash.slice(1))?location.hash.slice(1):'overview';
const equipment=()=>data.equipment.find(e=>e.id===equipmentId);
const recordCount=id=>recordsFor(data,local,id).length;
const openIssues=id=>issuesFor(data,local,id).filter(i=>i.status!=='RESOLVED');

function equipmentSVG(id){return `<svg viewBox="0 0 220 110" fill="none" aria-hidden="true"><ellipse cx="110" cy="102" rx="84" ry="5" fill="#dfe8ee"/><path d="M36 20h108l17 10v65H36z" fill="#fefefe" stroke="#bccbd7"/><path d="M144 20l17 10v65l-17-9z" fill="#dfe8ef" stroke="#bccbd7"/><path d="M36 20h108v66H36z" fill="#f8fafc" stroke="#bccbd7"/><path d="M43 27h61v52H43z" fill="#e9f0f5" stroke="#c5d2dd"/><rect x="49" y="34" width="50" height="37" rx="3" fill="#d5e1ea" stroke="#b6c8d5"/><circle cx="74" cy="52" r="13" fill="#eef4f8" stroke="#afc1cf"/><circle cx="74" cy="52" r="8" fill="#c8d8e3"/><path d="M43 86h99v9H43z" fill="#e4ecf2" stroke="#bccbd7"/><rect x="111" y="30" width="25" height="20" rx="2" fill="#445e72"/><path d="M115 36h16m-16 4h10m-10 4h14" stroke="#8ab5c0" stroke-width="2"/><circle cx="115" cy="58" r="2" fill="#66a998"/><circle cx="124" cy="58" r="2" fill="#d5a154"/><path d="M111 68h25m-25 4h25m-25 4h25" stroke="#c1ced9"/><rect x="44" y="95" width="9" height="6" rx="1" fill="#9cafbf"/><rect x="137" y="95" width="9" height="6" rx="1" fill="#9cafbf"/><path d="M165 54h19v41h-19z" fill="#edf2f6" stroke="#bacbd7"/><path d="M169 60h11m-11 5h11m-11 5h11m-11 5h11m-11 5h11" stroke="#c2d1dc"/><path d="M159 38h16v16" stroke="#b2c5d4" stroke-width="3"/><path d="M51 17v-7h73v7" stroke="#bdcdda" stroke-width="3"/><rect x="129" y="7" width="5" height="11" rx="2" fill="${id==='ETCH-01'?'#dfb877':'#9bbdc9'}"/></svg>`;}

function pageHeader(title,subtitle,actions=''){return `<div class="page-header"><div><span class="eyebrow">ASTER SEMICONDUCTOR / FAB 01</span><h1>${title}</h1><p>${subtitle}</p></div>${actions?`<div class="page-actions">${actions}</div>`:''}</div>`;}
function context(){return `<div class="workspace-context"><strong>${equipmentId}</strong><span class="context-divider">/</span><span>${escape(equipment().name)}</span><span class="context-divider">/</span><span>${escape(equipment().zone)}</span><span class="badge confirmed">EQUIPMENT-SCOPED</span></div>`;}
function recordTable(records){return `<div class="table-wrap"><table><thead><tr><th>OBSERVATION / RECORD</th><th>DATE & SHIFT</th><th>STATUS AT ENTRY</th><th>SOURCE</th></tr></thead><tbody>${records.length?records.map(r=>`<tr><td><div class="record-title">${escape(r.symptom)}</div><span class="table-secondary"><span class="mono">${escape(r.equipmentId)} · ${escape(r.issueId)}</span> · ${escape(r.author)}</span></td><td>${escape(date(r.timestamp))}<span class="table-secondary">${escape(r.shift)} shift</span></td><td>${badge(r.status)}<span class="table-secondary">Human-confirmed demo</span></td><td>${source(r.id)}</td></tr>`).join(''):`<tr><td colspan="4" class="empty">No confirmed records match these filters.</td></tr>`}</tbody></table></div>`;}

const guideTitles=['Explore ETCH-01','Capture a shift note','Review and confirm','Brief the next shift','Ask with citations'];
function guideBanner(){
 if(guidedStep<0)return '';
 const descriptions=[
   'Inspect the selected fictional ETCH-01 equipment workspace before recording anything.',
   'Use the example narrative or edit it. Generate a deterministic, editable draft.',
   'Inspect each extracted field, then explicitly review and confirm before saving.',
   'Inspect the newly confirmed issue and its linked source in the handover.',
   'Ask what issues are open and inspect the cited maintenance records.'
 ];
 const action=guidedStep===0?'<button type="button" class="button small" data-action="tour-next">Continue: Record shift →</button>':
   guidedStep===3&&view==='record'?'<button type="button" class="button small" data-action="tour-next">Continue: Handover →</button>':
   guidedStep===3&&view==='brief'?'<button type="button" class="button small" data-action="tour-next">Continue: Ask a question →</button>':
   guidedStep===4&&view==='knowledge'&&answer?.supported?'<button type="button" class="button small" data-action="tour-finish">Finish guided demo ✓</button>':'';
 return `<section class="tour-bar" aria-label="Guided demonstration"><div class="tour-info"><span class="tour-step">GUIDED DEMO · STEP ${guidedStep+1}/5</span><h2>${escape(guideTitles[guidedStep])}</h2><p>${escape(descriptions[guidedStep])}</p></div><div class="tour-actions">${action}<button type="button" class="text-button" data-action="tour-exit">Exit guide</button></div></section>`;
}
function evidenceTrail(){
  const featured=data.featuredCase;
  if(!featured||featured.equipmentId!==equipmentId)return '';
  const records=data.records.filter(r=>r.confirmed===true&&r.equipmentId===equipmentId&&r.issueId===featured.issueId)
    .sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp));
  if(records.length!==3)return '';
  return `<section class="story-panel" aria-label="Three-shift evidence trail"><div class="section-heading"><div><h2>Three-shift evidence trail</h2><p>${escape(featured.title)} · ${escape(featured.issueId)} · Each step links to its original record.</p></div><span class="badge confirmed">SYNTHETIC CASE</span></div><div class="story-grid">${records.map((r,index)=>`<article class="story-step"><span class="story-index">SHIFT ${index+1} OF 3</span><div class="story-state">${badge(r.status)}<span>${escape(r.shift)} · ${escape(date(r.timestamp))}</span></div><h3>${escape(r.author)}</h3><p>${escape(r.symptom)}</p><div class="story-evidence"><strong>${r.status==='RESOLVED'?'RECORDED VERIFICATION':'NEXT ACTION'}</strong><span>${escape(r.status==='RESOLVED'?r.verification:r.nextAction)}</span></div>${source(r.id)}</article>`).join('')}</div><p class="trace-note">OPEN → MONITORING → RESOLVED only after an explicit verification record. The scenario does not establish equipment release or an independently authenticated sign-off.</p></section>`;
}
function overview(){
 const total=data.equipment.reduce((n,e)=>n+recordCount(e.id),0),open=data.equipment.reduce((n,e)=>n+openIssues(e.id).length,0);
 const stats=[['Equipment in scope','2','Etch Bay A · Fab 01','grid',''],['Open follow-ups',String(open),'Unresolved · handover required','alert','amber'],['Confirmed records',String(total),'Synthetic seed + local demo','file','teal'],['Your demo records',String(local.length),'Saved in this browser only','check','']];
 return pageHeader('Facility Overview','A clear picture of your equipment. A continuous record of your shifts.',`<button type="button" class="button" data-action="tour-start">Start guided demo ${icon('arrow')}</button><a class="button secondary" href="#record">${icon('plus')}Record My Shift</a>`)+
 `<div class="stats-grid">${stats.map(([label,n,foot,i,color])=>`<div class="stat-card"><span class="stat-label">${label}</span><span class="stat-icon ${color}">${icon(i)}</span><strong class="stat-number">${n}</strong><div class="stat-foot">${foot}</div></div>`).join('')}</div>
 <div class="section-heading"><div><h2>Equipment workspace</h2><p>Two systems. Separate records, issues and knowledge.</p></div><span class="badge">FAB 01</span></div>
 <div class="equipment-grid">${data.equipment.map(e=>{
   const issues=openIssues(e.id),latest=recordsFor(data,local,e.id)[0];
   return `<article class="equipment-card ${e.id===equipmentId?'selected':''}"><div class="equipment-visual"><span class="equipment-scope">${escape(e.type.toUpperCase())}</span>${e.id===equipmentId?'<span class="selected-chip">ACTIVE WORKSPACE</span>':''}${equipmentSVG(e.id)}</div><div class="equipment-body"><div class="card-top"><div><div class="equipment-id">${e.id}</div><div class="equipment-name">${escape(e.name)}</div></div>${issues.length?`<span class="badge open">${issues.length} OPEN FOLLOW-UP${issues.length===1?'':'S'}</span>`:'<span class="badge resolved">NO OPEN FOLLOW-UPS</span>'}</div><div class="equipment-meta"><div>LOCATION<strong>${escape(e.zone)}</strong></div><div>MAINTENANCE OWNER<strong>${escape(e.team)}</strong></div></div><div class="issue-strip"><strong>${issues.length?'HANDOVER FOCUS':'CURRENT RECORD'}</strong>${escape(issues[0]?.observation||'No unresolved issue is recorded. This is not operational release.')}</div><div class="card-bottom"><span>${recordCount(e.id)} confirmed records</span><button class="text-button" data-equipment="${e.id}" data-target="history">View workspace →</button></div><div class="table-secondary">Last record ${escape(date(latest.timestamp))}</div></div></article>`;
 }).join('')}</div>
  ${evidenceTrail()}
 <div class="section-heading"><div><h2>Recent maintenance · ${equipmentId}</h2><p>Confirmed observations from the active equipment workspace.</p></div><a class="text-button" href="#history">View history →</a></div>
 ${recordTable(recordsFor(data,local,equipmentId).slice(0,3))}
 <div class="guide"><div class="guide-icon">${icon('handover')}</div><div><h3>From one shift to the next. Without losing the context.</h3><p>Capture an observation, confirm the facts, then inspect a handover with linked evidence.</p></div><button type="button" class="button secondary small" data-action="tour-start">Start guided demo ${icon('arrow')}</button></div>
 <p class="trace-note">Scenario snapshot: 05 Nov 2026 · All observation times use UTC. Equipment illustrations and all records are fictional.</p>`;
}

function defaultDraft(){return {equipmentId,issueId:'',timestamp:new Date().toISOString().slice(0,16),author:'',shift:'Day',symptom:'',action:'',status:'OPEN',nextAction:'',verification:''};}
function steps(stage){return `<div class="workflow-steps">${['Enter record','Review & confirm','Simulated save'].map((s,i)=>`${i?'<span class="step-line"></span>':''}<span class="step ${i===stage?'active':''}"><span class="step-number">${i<stage?'✓':i+1}</span>${s}</span>`).join('')}</div>`;}
function formField(key,label,type='text',required=false,hint=''){
 const value=escape(draft[key]);
 return `<div class="field ${type==='textarea'?'full':''}"><label for="${key}">${label}${required?' <span class="required">*</span>':''}</label>${type==='textarea'?`<textarea id="${key}" name="${key}" maxlength="1500" ${required?'required':''} aria-describedby="${key}-hint ${key}-error" placeholder="${key==='symptom'?'Describe what you observed, without assuming a cause.':key==='action'?'Record only what was actually done.':key==='nextAction'?'Name the follow-up and who should take it.':'State the recorded evidence and who checked it.'}">${value}</textarea>`:`<input id="${key}" name="${key}" type="${type}" value="${value}" maxlength="100" ${required?'required':''} aria-describedby="${key}-hint ${key}-error" ${key==='author'?'placeholder="e.g. Alex Chen" autocomplete="off"':''}>`}<p class="hint" id="${key}-hint">${hint}</p><span class="field-error" id="${key}-error"></span></div>`;
}
function recordView(){
 const header=pageHeader('Record My Shift','Turn an observation into a confirmed, traceable handover record.');
 if(lastSaved)return header+context()+steps(2)+`<div class="success-banner"><h2>Demo record saved</h2><p><span class="mono">${escape(lastSaved.id)}</span> · ${equipmentId} · Human-confirmed in this demo.</p><p>Stored in this browser only. No NAS, shared database or AI service was contacted.</p></div><div class="panel"><h2>The next shift can now find this evidence.</h2><p class="muted">${escape(lastSaved.symptom)}</p><div class="citation-row">${source(lastSaved.id)}${badge(lastSaved.status)}</div><div class="button-row"><button class="button secondary" data-action="new-record">Record another observation</button><a class="button" href="#brief">Brief Next Shift ${icon('arrow')}</a></div></div>`;
 if(review){const r=review.record;return header+context()+steps(1)+`<div class="two-column"><section class="panel"><div class="panel-title"><h2>Review the record</h2><span class="badge">UNCONFIRMED</span></div><dl class="detail-list">${detail('Equipment',r.equipmentId)}${detail('Issue',r.issueId||'New issue — assigned on save')}${detail('Observation time',r.timestamp+' UTC')}${detail('Recorded by / shift',r.author+' / '+r.shift)}${detail('Observation',r.symptom)}${detail('Action taken',r.action)}${detail('Issue status',r.status)}${detail('Next action',r.nextAction)}${detail('Verification evidence',r.verification)}${r.rawNote?detail('Original raw note',r.rawNote):''}</dl><div class="review-notice">This is still an unconfirmed record. It will enter history, handover and Q&A only after you confirm and save.</div><label class="confirmation"><input id="acknowledge" type="checkbox"> <span>I have reviewed the equipment ID, facts, issue status and next action. I confirm this synthetic demo record as <strong>${escape(r.author)}</strong>.</span></label><div class="button-row"><button class="button secondary" data-action="edit-record">Back to edit</button><button class="button" data-action="save-record" disabled>Confirm & simulate save ${icon('check')}</button></div></section><aside class="aside-panel"><h3>One explicit confirmation.</h3><p>Saving is a separate action after review. Editing any field requires a fresh review.</p><div class="aside-divider"></div><h3>OPEN stays open.</h3><p>Taking an action does not prove a repair. Status and verification are recorded explicitly.</p><p>This checkbox simulates human review; it is not identity verification.</p></aside></div>`;}
 if(!draft||draft.equipmentId!==equipmentId)draft=defaultDraft();
 const issues=issuesFor(data,local,equipmentId);
 const narrativePanel=`<section class="note-converter"><div class="panel-title"><h2>Raw shift note</h2><span class="badge">DETERMINISTIC DEMO</span></div><p class="muted">Paste a maintenance narrative. The built-in extractor recognizes only explicit equipment, observation, action, OPEN/MONITORING status, next shift and author. It is not an AI model and does not guess missing facts.</p><label for="raw-note">Technician narrative (optional)</label><textarea id="raw-note" maxlength="2000" placeholder="On ETCH-01 during the Day shift, I observed...">${escape(rawNote)}</textarea><div class="note-buttons"><button type="button" class="button secondary small" data-action="note-sample">Load narrative example</button><button type="button" class="button small" data-action="generate-draft">Generate demo draft →</button></div><p class="note-status" id="note-message" role="status">${escape(noteMessage)}</p><p class="hint">Unrecognized notes are not converted. You can always enter and confirm the structured fields manually.</p></section>`;
 return header+context()+steps(0)+narrativePanel+`<div class="two-column"><section class="panel"><div class="panel-title"><h2>Shift observation</h2><button class="text-button" data-action="sample">Load sample record</button></div><form id="record-form" novalidate><div id="validation-errors" class="validation-box" role="alert" hidden></div><div class="form-grid"><div class="field"><label for="equipment-locked">Equipment ID</label><input id="equipment-locked" value="${equipmentId}" readonly aria-describedby="equipment-hint"><p class="hint" id="equipment-hint">Switch equipment using the workspace selector above.</p></div><div class="field"><label for="issueId">Related issue</label><select name="issueId" id="issueId"><option value="">New observation / new issue</option>${issues.map(i=>`<option value="${escape(i.issueId)}" ${draft.issueId===i.issueId?'selected':''}>${escape(i.issueId)} · ${i.status}</option>`).join('')}</select><span class="field-error" id="issueId-error"></span></div>${formField('timestamp','Observation time (UTC)','datetime-local',true)}${formField('author','Recorded by','text',true)}<div class="field"><label for="shift">Shift <span class="required">*</span></label><select name="shift" id="shift">${['Day','Night'].map(s=>`<option ${draft.shift===s?'selected':''}>${s}</option>`).join('')}</select><span class="field-error" id="shift-error"></span></div><div class="field"><label for="status">Issue status <span class="required">*</span></label><select name="status" id="status">${STATUSES.map(s=>`<option ${draft.status===s?'selected':''}>${s}</option>`).join('')}</select><span class="field-error" id="status-error"></span></div>${formField('symptom','Observation','textarea',true)}${formField('action','Action taken','textarea',true)}${formField('nextAction','Next action / owner','textarea',draft.status!=='RESOLVED','Required for OPEN and MONITORING issues.')}${formField('verification','Verification evidence','textarea',draft.status==='RESOLVED','Required for RESOLVED. Describe the evidence; do not infer success.')}</div><div class="form-footer"><p class="hint">Draft only. Nothing enters official demo history until review and confirmation.</p><button class="button" type="submit">Review record ${icon('arrow')}</button></div></form></section><aside class="aside-panel"><h3>Capture facts that travel.</h3><p>A useful handover separates what happened, what was done, what is still open and what comes next.</p><ul><li>Equipment context is locked to <strong>${equipmentId}</strong>.</li><li>OPEN and MONITORING require a next action.</li><li>RESOLVED requires recorded verification.</li><li>Drafts are excluded from all answers and summaries.</li></ul><div class="aside-divider"></div><h3>Simulation boundary</h3><p>All records are synthetic. This demo saves confirmed records locally in your browser and does not authenticate the named reviewer.</p></aside></div>`;
}

function history(){
 const records=recordsFor(data,local,equipmentId).filter(r=>(historyStatus==='ALL'||r.status===historyStatus)&&(!historyQuery||[r.id,r.issueId,r.symptom,r.action,r.author].join(' ').toLowerCase().includes(historyQuery.toLowerCase())));
 return pageHeader('Maintenance History','A readable record of observations, actions and recorded verification.',`<a class="button" href="#record">${icon('plus')}Add record</a>`)+context()+`<div class="filters"><div class="field"><label for="status-filter">Status at entry</label><select id="status-filter"><option value="ALL">All statuses</option>${STATUSES.map(s=>`<option ${historyStatus===s?'selected':''}>${s}</option>`).join('')}</select></div><div class="field"><label for="history-search">Search records</label><input id="history-search" type="search" value="${escape(historyQuery)}" placeholder="Issue, observation or author"></div><span class="result-count">${records.length} confirmed record${records.length===1?'':'s'} · ${equipmentId}</span></div><div id="history-results">${recordTable(records)}</div><p class="trace-note">Status is preserved as recorded at that time. Brief Next Shift uses the latest confirmed observation for each issue. Drafts never appear here.</p>`;
}

function brief(){
 const b=handover(data,local,equipmentId),latest=recordsFor(data,local,equipmentId)[0];
 return pageHeader('Brief Next Shift','Know what remains open, what was verified and where the evidence lives.')+context()+`<div class="brief-heading">${icon('handover')}<div><h2>${equipmentId} · Next-shift handover</h2><p>Latest recorded context: ${latest?escape(date(latest.timestamp)):'No confirmed records'} · ${b.open.length} unresolved follow-up${b.open.length===1?'':'s'}</p></div></div><div class="two-column"><div><section class="brief-section"><h2>Open follow-ups <span class="count-pill">${b.open.length}</span></h2>${b.open.length?b.open.map(i=>`<article class="issue-card"><div class="card-top"><h3 class="mono">${escape(i.issueId)}</h3>${badge(i.status)}</div><p>${escape(i.observation)}</p><div class="action-box"><strong>NEXT ACTION</strong>${escape(i.nextAction)}</div>${source(i.sourceId)}<span class="table-secondary">${escape(i.author)} · ${escape(date(i.timestamp))}</span></article>`).join(''):'<div class="panel empty">No unresolved issues are recorded. This does not establish operational release.</div>'}</section><section class="brief-section"><h2>Verified completed work <span class="count-pill">${b.completed.length}</span></h2>${b.completed.map(i=>`<article class="issue-card completed"><div class="card-top"><h3 class="mono">${escape(i.issueId)}</h3>${badge(i.status)}</div><p>${escape(i.action)}</p><div class="action-box"><strong>RECORDED VERIFICATION</strong>${escape(i.verification)}</div>${source(i.sourceId)}</article>`).join('')||'<div class="panel empty">No verified completed work is recorded.</div>'}</section><p class="trace-note">Summary built from the latest confirmed record per issue. Every displayed claim links to its underlying record. Completion of one issue does not resolve another.</p></div><aside class="aside-panel"><h3>Handover, with boundaries.</h3><p>This summary preserves the recorded issue states. It does not infer a repair from an action or from a quiet interval.</p><div class="aside-divider"></div><h3>Reference for this equipment</h3>${sopList()}<div class="aside-divider"></div><p>Generated by deterministic rules. No AI inference or equipment release decision.</p></aside></div>`;
}

function sopList(){
 const all=data.sops.filter(s=>s.equipmentId===equipmentId);
 const archived=all.filter(s=>s.versionStatus!=='ACTIVE');
 const active=all.filter(s=>s.versionStatus==='ACTIVE');
 const renderSop=(s,isArchived)=>{
   const state=sopVersionState(s,data);
   const successor=s.supersededById ? data.sops.find(x=>x.id===s.supersededById && x.equipmentId===equipmentId) : null;
   const label=isArchived ? 'ARCHIVED — NOT CURRENT' : state==='ACTIVE' ? 'ACTIVE (SIMULATED)' : 'REVIEW REQUIRED';
   return `<div class="sop-entry ${isArchived?'sop-archived':''}"><h3>${escape(s.document)} ${escape(s.section)}</h3><p><strong>${escape(label)}</strong><br>${escape(s.title)}<br>${escape(s.revision)} · Effective ${escape(s.effectiveDate)}${s.retiredDate?' · Retired '+escape(s.retiredDate):''}${successor?'<br>Superseded by '+escape(successor.id):''}</p>${source(s.id)}</div>`;
 };
 const warnings=[...new Set(all.map(s=>s.topic))].map(t=>sopCatalog(data,equipmentId,t)).filter(c=>c.error);
 return `<div class="sop-catalog-title"><strong>Current SOP references</strong><p class="hint">As of ${escape(data.scenarioDate)} · fictional approval metadata</p></div>${warnings.length?'<p class="sop-warning">SOP validity conflict: current status cannot be trusted.</p>':''}${active.map(s=>renderSop(s,false)).join('')}${archived.length?'<div class="sop-catalog-title"><strong>Historical SOP archive</strong><p class="hint">Not for current operation or repair decisions.</p></div>'+archived.map(s=>renderSop(s,true)).join(''):''}`;
}
function answerHTML(){if(!answer)return '';return answer.supported?`<section class="answer-panel" aria-labelledby="answer-title"><div class="answer-header">${icon('spark')}<span id="answer-title">Evidence-based answer · ${equipmentId}</span></div><div class="answer-content"><p class="answer-question">Question: ${escape(question)}</p>${answer.items.map(i=>`<div class="answer-item"><p>${escape(i.text)}</p><div class="citation-row">${i.sourceIds.map(source).join('')}</div></div>`).join('')}<div class="answer-footer">Deterministic retrieval from confirmed records and fictional SOPs. No generative AI call was made.</div></div></section>`:`<div class="no-evidence" role="status"><strong>No supported answer</strong><br>${escape(answer.message)}</div>`;}
function knowledge(){const sopExample=equipmentId==='ETCH-01'?'What does the SOP say about pumpdown?':'What does the SOP say about reflected RF power?';return pageHeader('Equipment Knowledge Q&A','Ask within the evidence. Inspect the source. Keep uncertainty visible.')+context()+`<div class="knowledge-layout"><div><section class="question-box"><form id="question-form"><label class="question-label" for="question">Ask about ${equipmentId}</label><p class="hint" style="margin-bottom:14px">Current issue status, recent maintenance and the listed fictional SOP topics.</p><textarea class="question-input" id="question" name="question" maxlength="500" placeholder="What issues should the next shift follow up?" required>${escape(question)}</textarea><div class="question-footer"><p class="hint">Answers stay within ${equipmentId}.<br>Missing evidence leads to an explicit abstention.</p><button class="button" type="submit">Ask question ${icon('arrow')}</button></div></form><div class="examples"><span class="examples-label">TRY A QUESTION</span>${['What issues are open?','What maintenance was done recently?',sopExample,equipmentId==='ETCH-01'?'Is the old pumpdown SOP still valid?':'Is the old reflected RF SOP still valid?','What is the production yield forecast?'].map(q=>`<button type="button" data-question="${escape(q)}">${escape(q)}</button>`).join('')}</div></section><div id="answer-result" aria-live="polite">${answerHTML()}</div></div><aside class="aside-panel"><h3>Knowledge in scope</h3><p><strong>${recordCount(equipmentId)} confirmed records</strong><br>Only ${equipmentId} evidence is available to this answer.</p>${sopList()}<div class="aside-divider"></div><h3>A source, not a guess.</h3><p>This v0.4 simulates version-aware source-grounded Q&A with fixed retrieval rules. Unsupported questions, cross-equipment requests and operating decisions are not answered.</p></aside></div>`;}

function render(focus=false){
 view=route();
 for(const link of document.querySelectorAll('[data-view]')){if(link.dataset.view===view)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
 $('#main').innerHTML=guideBanner()+({overview,record:recordView,history,brief,knowledge}[view])();
 $('#equipment-select').value=equipmentId;
 if(focus){$('#main').focus();window.scrollTo({top:0,behavior:'instant'});}
}
function showWarning(){const box=$('#storage-warning');box.textContent=warning;box.hidden=!warning;}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4500);}
function readForm(){const f=$('#record-form');if(f){const form=new FormData(f);draft={...draft,...Object.fromEntries(form),equipmentId,rawNote};}return draft;}
function validation(errors){
 const box=$('#validation-errors');box.hidden=!errors.length;box.innerHTML=errors.length?`<strong>Complete these fields before review.</strong><ul>${errors.map(e=>`<li>${escape(e.message)}</li>`).join('')}</ul>`:'';
 for(const input of document.querySelectorAll('#record-form [name]')){const error=errors.find(e=>e.field===input.name);input.setAttribute('aria-invalid',String(!!error));const message=document.getElementById(`${input.name}-error`);if(message)message.textContent=error?.message||'';}
 if(errors.length)document.getElementById(errors[0].field)?.focus();
}
function switchEquipment(id,target){
 if(!data.equipment.some(e=>e.id===id))return;
 if(id!==equipmentId){equipmentId=id;draft=null;review=null;lastSaved=null;answer=null;question='';rawNote='';noteMessage='';guidedStep=-1;historyQuery='';historyStatus='ALL';toast(`Workspace switched to ${id}. Evidence is isolated to this equipment.`);}
 if(target&&location.hash!==`#${target}`)location.hash=target;else render();
}
function inspectSource(id){
 const s=resolveSource(data,local,id,equipmentId);
 if(!s){toast('This source is not available in the current equipment scope.');return;}
 const isSop=!!s.document;
 $('#source-content').innerHTML=`<h2 id="source-title" class="source-heading">${escape(s.id)}</h2><div class="source-badges"><span class="badge">${escape(s.equipmentId)}</span><span class="badge confirmed">${isSop?'FICTIONAL SOP':'HUMAN-CONFIRMED DEMO'}</span>${!isSop?badge(s.status):''}</div><dl class="detail-list">${isSop?detail('Document / section',s.document+' '+s.section)+detail('Revision',s.revision)+detail('Version status',sopVersionState(s,data)+' (scenario '+data.scenarioDate+')')+detail('Approval state',s.approvalStatus)+detail('Effective date',s.effectiveDate)+detail('Retired date',s.retiredDate)+detail('Supersedes',s.supersedesId)+detail('Superseded by',s.supersededById)+detail('Title',s.title)+detail('Source text',s.text):detail('Related issue',s.issueId)+detail('Observation time',date(s.timestamp))+detail('Recorded by / shift',s.author+' / '+s.shift)+detail('Observation',s.symptom)+detail('Action taken',s.action)+detail('Status at entry',s.status)+detail('Next action',s.nextAction)+detail('Verification evidence',s.verification)+(s.rawNote?detail('Original raw note',s.rawNote):'')+detail('Confirmed by',s.confirmedBy)+detail('Confirmation time',date(s.confirmedAt))}</dl><div class="source-note">${isSop?'Synthetic reference only. SUPERSEDED, EXPIRED or WITHDRAWN versions are archival and must not be treated as current maintenance guidance. No actual operation is authorized.':'Synthetic source record. Confirmation is simulated and does not authenticate the named reviewer.'}</div>`;
 $('#source-dialog').showModal();
}
function ask(q){question=q.trim();$('#question').value=question;answer=answerQuestion(data,local,equipmentId,question);if(guidedStep===4)render();else $('#answer-result').innerHTML=answerHTML();}

document.addEventListener('input',event=>{
 if(event.target.id==='raw-note'){rawNote=event.target.value;noteMessage='Note updated. Re-run the extractor or check the structured fields manually.';const status=$('#note-message');if(status)status.textContent=noteMessage;}
 if(event.target.closest('#record-form')){readForm();review=null;}
 if(event.target.id==='history-search'){
   historyQuery=event.target.value;
   const filtered=recordsFor(data,local,equipmentId).filter(r=>(historyStatus==='ALL'||r.status===historyStatus)&&[r.id,r.issueId,r.symptom,r.action,r.author].join(' ').toLowerCase().includes(historyQuery.toLowerCase()));
   $('#history-results').innerHTML=recordTable(filtered);$('.result-count').textContent=`${filtered.length} confirmed record${filtered.length===1?'':'s'} · ${equipmentId}`;
 }
});
document.addEventListener('change',event=>{
 if(event.target.id==='equipment-select')switchEquipment(event.target.value);
 if(event.target.id==='acknowledge')$('[data-action="save-record"]').disabled=!event.target.checked;
 if(event.target.id==='status-filter'){historyStatus=event.target.value;render();$('#status-filter').focus();}
 if(event.target.closest('#record-form')){readForm();review=null;if(event.target.id==='status'){
   if(draft.status==='RESOLVED'){draft.verification='';$('#verification').value='';toast('RESOLVED requires fresh verification. Previous verification text was cleared.');}
   $('#verification').required=draft.status==='RESOLVED';$('#nextAction').required=draft.status!=='RESOLVED';
   for(const key of ['verification','nextAction']){const label=document.querySelector(`label[for="${key}"]`);label.innerHTML=(key==='verification'?'Verification evidence':'Next action / owner')+(document.getElementById(key).required?' <span class="required">*</span>':'');}
 }}
});
document.addEventListener('submit',event=>{
 if(event.target.id==='record-form'){event.preventDefault();readForm();const errors=validateRecord(draft,data,local);validation(errors);if(!errors.length){review=reviewRecord(draft,data,local);render(true);}}
 if(event.target.id==='question-form'){event.preventDefault();ask($('#question').value);}
});
document.addEventListener('click',event=>{
 const sourceButton=event.target.closest('[data-source]');if(sourceButton){inspectSource(sourceButton.dataset.source);return;}
 const scoped=event.target.closest('[data-equipment]');if(scoped){switchEquipment(scoped.dataset.equipment,scoped.dataset.target);return;}
 const example=event.target.closest('[data-question]');if(example){ask(example.dataset.question);return;}
 const action=event.target.closest('[data-action]')?.dataset.action;
 if(action==='tour-start'){
   // Starting the tour is non-destructive: prior browser-local records remain intact.
   equipmentId='ETCH-01';guidedStep=0;rawNote='';noteMessage='';draft=null;review=null;lastSaved=null;answer=null;question='';
   location.hash='#overview';render(true);
 }
 if(action==='tour-next'){
   if(guidedStep===0){
     guidedStep=1;rawNote=data.guidedDemoNote;noteMessage='';draft=defaultDraft();review=null;lastSaved=null;
     if(location.hash!=='#record')location.hash='#record';else render(true);
   }else if(guidedStep===3&&view==='record'){
     if(location.hash!=='#brief')location.hash='#brief';else render(true);
   }else if(guidedStep===3&&view==='brief'){
     guidedStep=4;question='What issues are open on ETCH-01?';answer=null;
     if(location.hash!=='#knowledge')location.hash='#knowledge';else render(true);
   }
 }
 if(action==='tour-exit'){guidedStep=-1;render();toast('Guided demo closed. Your confirmed demo records are unchanged.');}
 if(action==='tour-finish'){guidedStep=-1;render();toast('Guided demo complete. Review the cited evidence anytime.');}
 if(action==='note-sample'){
   rawNote=equipmentId==='ETCH-01'?data.guidedDemoNote:data.guidedDemoNote.replaceAll('ETCH-01',equipmentId).replace('chamber door indicator','wafer transfer sensor');
   noteMessage='Synthetic example loaded. Generate the demo draft to extract its explicitly stated fields.';
   render();
 }
 if(action==='generate-draft'){
   const result=parseShiftNote(rawNote,equipmentId);
   noteMessage=result.message;
   if(result.supported){
     draft={...defaultDraft(),...result.draft};review=null;lastSaved=null;
     if(guidedStep===1)guidedStep=2;
   }
   render();
 }
 if(action==='close-source')$('#source-dialog').close();
 if(action==='sample'){
   rawNote='';noteMessage='';
   const latest=openIssues(equipmentId).find(i=>data.records.some(r=>r.issueId===i.issueId));draft={...defaultDraft(),issueId:latest?.issueId||'',author:'Jamie Park',symptom:latest?(equipmentId==='ETCH-01'?'Pumpdown drift remains visible in the synthetic trend.':'The reflected RF event remains under review.'):'New synthetic observation recorded for review.',action:'Reviewed the previous shift record and preserved the new observation. No repair was performed.',nextAction:'Next shift: review recurrence with the equipment owner and retain the source record.',verification:'No repair verification; issue remains open.'};review=null;render();toast('Sample loaded as an unconfirmed draft. Review before saving.');
 }
 if(action==='edit-record'){review=null;render(true);}
 if(action==='new-record'){lastSaved=null;review=null;draft=defaultDraft();rawNote='';noteMessage='';render(true);}
 if(action==='save-record'){
   if(!review||!$('#acknowledge')?.checked)return;
   try{
     const id=`LOCAL-${crypto.randomUUID()}`,saved=confirmRecord(review,true,data,id,local),next=[...local,saved];
     if(!storageWritable)throw new Error('Browser storage is unavailable. The record remains unconfirmed; no save was claimed.');
     window.localStorage.setItem(STORAGE_KEY,JSON.stringify(next));
     const readback=restoreRecords(window.localStorage.getItem(STORAGE_KEY),data);
     if(!readback.records.some(r=>r.id===saved.id))throw new Error('The saved record could not be read back. No successful save was confirmed.');
     local=readback.records;lastSaved=saved;review=null;draft=null;answer=null;warning=readback.warning;if(guidedStep===2)guidedStep=3;showWarning();render(true);toast('Confirmed demo record saved locally.');
   }catch(error){warning=error.message||'Local save failed. No successful save was confirmed.';showWarning();toast('Save failed. Keep this review open and try again.');}
 }
 if(action==='cancel-reset')$('#reset-dialog').close();
 if(action==='confirm-reset'){
   try{window.localStorage.removeItem(STORAGE_KEY);local=[];draft=null;review=null;lastSaved=null;answer=null;question='';rawNote='';noteMessage='';guidedStep=-1;warning='';storageWritable=true;showWarning();$('#reset-dialog').close();render();toast('Local demo records reset. Synthetic seed records retained.');}
   catch{warning='Browser storage could not be reset. Your displayed records were retained.';showWarning();$('#reset-dialog').close();}
 }
 if(event.target.closest('#reset-demo'))$('#reset-dialog').showModal();
});
window.addEventListener('hashchange',()=>{if(data)render(true);});
// Never silently merge state from another browser tab while a record is in review.
window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY){warning='Demo data changed in another tab. Reload this page before saving a new record.';storageWritable=false;showWarning();}});

async function init(){
 for(const element of document.querySelectorAll('[data-icon]'))element.innerHTML=icon(element.dataset.icon);
 try{
   const response=await fetch(new URL('../data/demo.json',import.meta.url));
   if(!response.ok)throw new Error(`Dataset request returned ${response.status}.`);
   data=await response.json();
   if(data.schemaVersion!==2||!Array.isArray(data.equipment)||!Array.isArray(data.records)||!Array.isArray(data.sops))throw new Error('Unsupported demo dataset.');
   try{const restored=restoreRecords(window.localStorage.getItem(STORAGE_KEY),data);local=restored.records;warning=restored.warning;const probe=`${STORAGE_KEY}.probe`;window.localStorage.setItem(probe,'1');window.localStorage.removeItem(probe);}
   catch{storageWritable=false;warning='Browser storage is unavailable. Seed data remains readable; simulated saving is disabled.';}
   $('#equipment-select').innerHTML=data.equipment.map(e=>`<option value="${e.id}">${e.id}</option>`).join('');$('#equipment-select').disabled=false;$('#reset-demo').disabled=false;showWarning();render();
 }catch(error){$('#main').innerHTML=`<div class="fatal"><h1>Workspace could not load</h1><p>${escape(error.message)}</p><p>Serve this site over HTTP(S), then reload. Opening index.html directly from the filesystem cannot load the JSON dataset.</p><button class="button secondary" data-action="reload">Reload workspace</button></div>`;document.querySelector('[data-action="reload"]').addEventListener('click',()=>location.reload());}
}
init();
