import {loadDrafts, storeDrafts, freshCard, filenameSuggestion, newId} from './draft-store.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function readLocal(key,fallback=''){try{return localStorage.getItem(key)||fallback;}catch{return fallback;}}
function writeLocal(key,value){try{localStorage.setItem(key,value);}catch{}}
const state = {csrf: '', actor: null, lang: readLocal('tt-language','en'), data: null,
  local: {activeId:null,cards:{},queue:[]}, key: null, view: 'list', filter: 'all', search: '',
  busy: false, error: '', note: '', staffTab:'orders', staffOrders:[], templates:[], staffOrder:null,
  jobs: [], printJobs: [], health:null, storageError:'', activeJob:null};
const translations = {
  addName:['Add a photo and name','ചിത്രവും പേരും ചേർക്കുക'],
  entryIntro:['Choose a photo, then paste the name.','ചിത്രം തിരഞ്ഞെടുത്ത് പേര് ചേർക്കുക.'],
  yourOrder:['Your order','നിങ്ങളുടെ ഓർഡർ'], entries:['Recipients','സ്വീകർത്താക്കൾ'], review:['Review','പരിശോധിക്കുക'], approve:['Approve','അംഗീകരിക്കുക'],
  addPhoto:['Add photograph','ചിത്രം ചേർക്കുക'], changePhoto:['Change photograph','ചിത്രം മാറ്റുക'], photoHint:['Choose from Gallery or Files','ഗാലറിയിൽ നിന്നോ ഫയലുകളിൽ നിന്നോ തിരഞ്ഞെടുക്കുക'],
  name:['Name to print','അച്ചടിക്കേണ്ട പേര്'], nameHint:['Paste from WhatsApp, or type the name.','വാട്സാപ്പിൽ നിന്ന് പകർത്തുകയോ പേര് ടൈപ്പ് ചെയ്യുകയോ ചെയ്യുക.'],
  achievement:['Award / designation','അവാർഡ് / പദവി'], optional:['optional','നിർബന്ധമില്ല'],
  next:['Save and add next','സേവ് ചെയ്ത് അടുത്തത് ചേർക്കുക'], save:['Save to order','ഓർഡറിൽ സേവ് ചെയ്യുക'], back:['Back to list','പട്ടികയിലേക്ക്'],
  preview:['Placement preview','സ്ഥാനക്രമീകരണം'], previewHint:['Check the final print proof before approving.','അംഗീകരിക്കുന്നതിന് മുമ്പ് അന്തിമ അച്ചടി പ്രൂഫ് പരിശോധിക്കുക.'],
  photoHelp:['Can’t find a WhatsApp photo?','വാട്സാപ്പിലെ ചിത്രം കാണുന്നില്ലേ?'], photoHelpBody:['Open the photo in WhatsApp, save it to your phone, then choose it here. You can paste the name separately.','വാട്സാപ്പിൽ ചിത്രം തുറന്ന് ഫോണിൽ സേവ് ചെയ്യുക. തുടർന്ന് ഇവിടെ തിരഞ്ഞെടുക്കുക. പേര് പ്രത്യേകം ചേർക്കാം.'],
  useFilename:['Use filename as name','ഫയലിന്റെ പേര് ഉപയോഗിക്കുക'], filenameNote:['Suggestion only — check the spelling before using it.','നിർദ്ദേശം മാത്രം — ഉപയോഗിക്കുന്നതിന് മുമ്പ് പേര് പരിശോധിക്കുക.'],
  adjust:['Adjust photograph','ചിത്രം ക്രമീകരിക്കുക'], zoom:['Zoom','വലുപ്പം'], horizontal:['Left / right','ഇടത് / വലത്'], vertical:['Up / down','മുകളിൽ / താഴെ'], rotate:['Rotate 90°','90° തിരിക്കുക'], reset:['Reset crop','ക്രമീകരണം പുനഃസജ്ജമാക്കുക'],
  savedPhone:['Saved on this phone · not yet saved to the order','ഈ ഫോണിൽ സേവ് ചെയ്തു · ഓർഡറിൽ ഇതുവരെ സേവ് ചെയ്തിട്ടില്ല'], savedOrder:['Saved to order','ഓർഡറിൽ സേവ് ചെയ്തു'], uploading:['Uploading photograph…','ചിത്രം അപ്‌ലോഡ് ചെയ്യുന്നു…'], saving:['Saving to order…','ഓർഡറിൽ സേവ് ചെയ്യുന്നു…'], failed:['Not saved to order. Your draft is still here.','ഓർഡറിൽ സേവ് ചെയ്തിട്ടില്ല. ഡ്രാഫ്റ്റ് ഇവിടെ ഉണ്ട്.'],
  savingPhone:['Saving on this phone…','ഈ ഫോണിൽ സേവ് ചെയ്യുന്നു…'], unsavedPhone:['Phone storage failed. Save to the order before leaving this page.','ഫോണിൽ സേവ് ചെയ്യാനായില്ല. ഈ പേജിൽ നിന്ന് പോകുന്നതിന് മുമ്പ് ഓർഡറിൽ സേവ് ചെയ്യുക.'],
  offline:['You’re offline. Keep editing; save to the order when you reconnect.','ഇന്റർനെറ്റ് ബന്ധമില്ല. തിരുത്തലുകൾ തുടരാം; ബന്ധം വന്നാൽ ഓർഡറിൽ സേവ് ചെയ്യുക.'],
  all:['All','എല്ലാം'], needsName:['Needs name','പേര് വേണം'], needsPhoto:['Needs photo','ചിത്രം വേണം'], needsReview:['Needs checking','പരിശോധിക്കണം'], reviewed:['Checked','പരിശോധിച്ചു'],
  search:['Search names','പേര് തിരയുക'], addRecipient:['Add recipient','സ്വീകർത്താവിനെ ചേർക്കുക'], addSeveral:['Add several photos','ഒന്നിലധികം ചിത്രങ്ങൾ ചേർക്കുക'],
  generate:['Check print preview','അച്ചടി പ്രൂഫ് കാണുക'], viewProof:['Review print proof','അച്ചടി പ്രൂഫ് പരിശോധിക്കുക'], proofIntro:['Check the photo and spelling. Tap the proof to enlarge.','ചിത്രവും പേരും പരിശോധിക്കുക. വലുതായി കാണാൻ പ്രൂഫിൽ അമർത്തുക.'],
  checked:['I have checked this name and photograph','ഈ പേരും ചിത്രവും ഞാൻ പരിശോധിച്ചു'], markReviewed:['Mark this entry checked','ഈ എൻട്രി പരിശോധിച്ചതായി രേഖപ്പെടുത്തുക'],
  shared:['Shared wording','പൊതുവായ വാചകങ്ങൾ'], heading:['Heading','തലക്കെട്ട്'], event:['Event / organisation','പരിപാടി / സ്ഥാപനം'], date:['Date / footer','തീയതി / അടിക്കുറിപ്പ്'],
  editShared:['Edit shared wording','പൊതുവായ വാചകങ്ങൾ തിരുത്തുക'], approveText:['I have checked the names, photographs, wording and quantities. Approve for printing.','പേരുകൾ, ചിത്രങ്ങൾ, വാചകങ്ങൾ, എണ്ണം എന്നിവ ഞാൻ പരിശോധിച്ചു. അച്ചടിക്കാൻ അംഗീകരിക്കുന്നു.'],
  finalApprove:['Approve for printing','അച്ചടിക്കാൻ അംഗീകരിക്കുക'], approvalHint:['Changes after approval will need a new review and approval.','അംഗീകാരത്തിന് ശേഷമുള്ള മാറ്റങ്ങൾ വീണ്ടും പരിശോധിച്ച് അംഗീകരിക്കണം.'],
  approved:['Approved for printing','അച്ചടിക്കാൻ അംഗീകരിച്ചു'], approvedBody:['Your approved artwork is with the production team. They will complete the print checks.','അംഗീകരിച്ച ഡിസൈൻ പ്രൊഡക്ഷൻ ടീമിന് ലഭിച്ചു. അവർ അച്ചടി പരിശോധനകൾ പൂർത്തിയാക്കും.'],
  recordCount:['Recipients','സ്വീകർത്താക്കൾ'], copyCount:['Copies','കോപ്പികൾ'], componentCount:['Printed pieces','അച്ചടി ഭാഗങ്ങൾ'],
  emptyTitle:['Every award starts with a name.','ഓരോ അവാർഡും ഒരു പേരിൽ തുടങ്ങുന്നു.'], emptyBody:['Add your first photograph and name. You can come back to unfinished entries.','ആദ്യത്തെ ചിത്രവും പേരും ചേർക്കുക. പൂർത്തിയാകാത്ത എൻട്രികളിലേക്ക് പിന്നീട് മടങ്ങാം.'],
  group:['Model group','മോഡൽ ഗ്രൂപ്പ്'], copies:['Copies for this recipient','ഈ സ്വീകർത്താവിനുള്ള കോപ്പികൾ'], close:['Close','അടയ്ക്കുക'], cancel:['Cancel','റദ്ദാക്കുക'],
  localNote:['Phone drafts are temporary. Save to the order before clearing browser data or changing devices.','ഫോണിലെ ഡ്രാഫ്റ്റുകൾ താൽക്കാലികമാണ്. ബ്രൗസർ ഡാറ്റ മായ്ക്കുന്നതിനോ ഉപകരണം മാറ്റുന്നതിനോ മുമ്പ് ഓർഡറിൽ സേവ് ചെയ്യുക.'],
  incomplete:['Incomplete','പൂർത്തിയായിട്ടില്ല'], edit:['Edit entry','എൻട്രി തിരുത്തുക'], helperNote:['You can add recipients in your assigned group. The organiser reviews and approves the order.','നിങ്ങൾക്ക് നൽകിയ ഗ്രൂപ്പിൽ സ്വീകർത്താക്കളെ ചേർക്കാം. സംഘാടകൻ ഓർഡർ പരിശോധിച്ച് അംഗീകരിക്കും.'],
  retry:['Try again','വീണ്ടും ശ്രമിക്കുക'], sort:['Sort','ക്രമീകരിക്കുക'], orderAdded:['Order added','ചേർത്ത ക്രമം'], nameAZ:['Name A–Z','പേര് അനുസരിച്ച്'],
  duplicate:['A similar name or photograph may already be in this order. Check before adding another copy.','സമാനമായ പേരോ ചിത്രമോ ഈ ഓർഡറിൽ ഉണ്ടാകാം. വീണ്ടും ചേർക്കുന്നതിന് മുമ്പ് പരിശോധിക്കുക.'],
  conflict:['This entry changed on another device. Your changes are kept on this phone. Compare with the saved entry before saving again.','മറ്റൊരു ഉപകരണത്തിൽ ഈ എൻട്രി മാറി. നിങ്ങളുടെ മാറ്റങ്ങൾ ഈ ഫോണിൽ സൂക്ഷിച്ചിട്ടുണ്ട്. വീണ്ടും സേവ് ചെയ്യുന്നതിന് മുമ്പ് പരിശോധിക്കുക.'],
  compare:['Compare saved entry','സേവ് ചെയ്ത എൻട്രിയുമായി താരതമ്യം ചെയ്യുക'],
  placement:['See placement preview','സ്ഥാനക്രമീകരണം കാണുക'], moreOptions:['More options','കൂടുതൽ ഓപ്ഷനുകൾ'], listIntro:['Keep every photograph with the right name.','ഓരോ ചിത്രത്തോടും ശരിയായ പേര് ചേർക്കുക.'], orderDetails:['Order details','ഓർഡർ വിവരങ്ങൾ'], fixedWording:['The fixed design and wording appear in the final print proof.','സ്ഥിരമായ ഡിസൈനും വാചകങ്ങളും അന്തിമ അച്ചടി പ്രൂഫിൽ കാണാം.'], savedEntries:['Saved recipients','സേവ് ചെയ്ത സ്വീകർത്താക്കൾ'], readyToCheck:['Ready to check','പരിശോധിക്കാൻ തയ്യാറാണ്'], photoFirst:['Choose the person’s photo','സ്വീകരിക്കുന്നയാളുടെ ചിത്രം തിരഞ്ഞെടുക്കുക'], personNumber:['Person','സ്വീകർത്താവ്'],
};
const t = key => translations[key]?.[state.lang === 'ml' ? 1 : 0] || key;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const objectUrls = new Map();
let persistChain = Promise.resolve();

function announce(message) { $('#announcer').textContent = message; }
function setError(error) { state.error = error?.message || String(error); announce(state.error); }
function resource(result, key) { return result?.[key] ?? result; }
function getRecipient(result) { return result?.recipient ?? result; }
function visibleIssues(recipient) {
  const labels={needs_name:'Add the recipient name.',needs_photo:'Add a photograph.',missing_name:'Add the recipient name.',missing_photo:'Add a photograph.'};
  return [...(recipient.issues||[]).filter(issue=>!['needs_checking','needs_proof','unchecked','stale_proof'].includes(issue)).map(issue=>labels[issue]||issue),...(recipient.proof?.warnings||[]).map(warning=>typeof warning==='string'?warning:warning.message||'Check photo quality before printing.')];
}

async function api(path, {method = 'GET', body, headers = {}, raw = false} = {}) {
  const init = {method, credentials:'same-origin', headers:{...headers}};
  if (method !== 'GET' && method !== 'HEAD') init.headers['x-csrf-token'] = state.csrf;
  if (body !== undefined) {
    if (raw) init.body = body;
    else { init.body = JSON.stringify(body); init.headers['content-type']='application/json'; }
  }
  const response = await fetch(path, init);
  const type = response.headers.get('content-type') || '';
  const result = type.includes('json') ? await response.json() : await response.text();
  if (!response.ok) {
    const error = new Error(result?.error?.message || result?.message || result?.error || `Request failed (${response.status}).`);
    error.status = response.status; error.details = result;
    throw error;
  }
  if (result?.csrf) state.csrf = result.csrf;
  return result;
}

function header(staff = false) {
  return `<header class="topbar"><a class="brand" href="${staff?'/staff':'/o'}" aria-label="Trichur Trophies"><span class="brand-mark" aria-hidden="true">T</span><span><span class="brand-title">Trichur Trophies</span><span class="brand-subtitle">Personalise & Print</span></span></a><div class="header-actions">${state.updateAvailable?`<button id="update-app" class="button secondary compact">${state.lang==='ml'?'ആപ്പ് പുതുക്കുക':'Update app'}</button>`:''}${staff ? `<span class="small muted desktop-only">${esc(state.actor?.username || '')}</span>${state.actor?'<button class="button quiet compact" id="logout">Sign out</button>':''}` : `<button class="button quiet compact" id="language" lang="${state.lang==='en'?'ml':'en'}">${state.lang==='en'?'മലയാളം':'English'}</button>`}</div></header>${!navigator.onLine?`<div class="offline-bar" role="status">${t('offline')}</div>`:''}`;
}

function notices() {
  return `${state.error ? `<div class="alert error" role="alert">${esc(state.error)}</div>` : ''}${state.note ? `<div class="alert info" role="status">${esc(state.note)}</div>`:''}${state.storageError?`<div class="alert error" role="alert">${esc(state.storageError)}</div>`:''}`;
}

function footer() {
  return `<footer class="app-footer">Trichur Trophies · Mattom, Thrissur${!location.pathname.startsWith('/staff')?`<br>${t('localNote')}`:''}</footer>`;
}

function bindGlobal() {
  if($('#language'))$('#language').onclick=()=>{state.lang=state.lang==='en'?'ml':'en';writeLocal('tt-language',state.lang);document.documentElement.lang=state.lang;if(state.data)renderCustomer();};
  if($('#logout'))$('#logout').onclick=async()=>{try{await api('/api/logout',{method:'POST',body:{}});state.actor=null;renderLogin();}catch(error){setError(error);renderStaff();}};
  if($('#update-app'))$('#update-app').onclick=async()=>{await persist();if(state.storageError){setError(new Error('Save your draft to the order before updating because phone storage is unavailable.'));if(state.data)renderCustomer();return;}state.updateRequested=true;state.swRegistration?.waiting?.postMessage({type:'ACTIVATE_UPDATE'});};
  $$('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
}

async function persist() {
  if (!state.key) return;
  const snapshot = structuredClone(state.local);
  for(const card of Object.values(snapshot.cards||{}))if(['saving-local','local-error','saving','uploading'].includes(card.status))card.status='local';
  persistChain = persistChain.catch(()=>{}).then(() => storeDrafts(state.key,snapshot));
  try {await persistChain; state.storageError='';}
  catch {state.storageError='This browser could not save the draft on this phone. Keep the page open and save to the order now.';updateSaveState();}
}

function cardFromRecipient(recipient) {
  return {...freshCard(recipient.groupId), ...recipient,
    serverRevision:recipient.revision, version:0,savedVersion:0,edited:false,status:'saved',photo:null,filename:recipient.originalFilename||'',uploadId:null};
}

function currentCard() { return state.local.cards[state.local.activeId]; }
function clearOfflineDraftErrors() {
  for(const card of Object.values(state.local.cards)) {
    if(!translations.offline.includes(card.error))continue;
    card.error='';
    if(card.status==='error')card.status='local';
  }
}
function findTemplate(groupId) {
  const group=state.data?.groups.find(item=>item.id===groupId);
  return state.data?.templates.find(item=>item.id===group?.templateId);
}
function allowedGroups() {return state.data.groups.filter(group=>!state.data.scopeGroupId || group.id===state.data.scopeGroupId);}
function defaultGroup() {return allowedGroups()[0]?.id || '';}
function isOrganiser() {return state.data?.role!=='helper';}
function effectiveShared(groupId) {return {...state.data.order.shared,...(state.data.groups.find(group=>group.id===groupId)?.shared||{})};}
function sharedFields(groupId){
  const groups=groupId?state.data.groups.filter(group=>group.id===groupId):state.data.groups;
  const components=groups.flatMap(group=>findTemplate(group.id)?.components||[]);
  return ['heading','event','date','logo'].filter(field=>components.some(component=>component[field+'Box']));
}
function groupSharedSummaries(){return state.data.groups.filter(group=>Object.keys(group.shared||{}).length).map(group=>`<hr class="section-separator"><h3>${esc(group.label)} — ${t('shared')}</h3>${sharedSummary(group.id)}`).join('');}

async function refreshOrder() {
  state.data = await api('/api/customer/order');
  state.local.orderCache=state.data;
  for (const recipient of state.data.recipients) {
    const draft=state.local.cards[recipient.id];
    if (!draft || (!draft.edited && draft.savedVersion===draft.version)) state.local.cards[recipient.id]=cardFromRecipient(recipient);
    else if (recipient.revision !== draft.serverRevision && draft.status !== 'saving' && draft.status !== 'uploading') draft.conflict=true;
  }
  await persist();
}

async function loadCustomer() {
  state.data = await api('/api/customer/order');
  const actorScope=state.actor?.linkId || state.actor?.accessId || state.actor?.grantId || `${state.data.role}:${state.data.scopeGroupId || 'all'}`;
  state.key=`order:${state.data.order.id}:${actorScope}`;
  try {state.local = await loadDrafts(state.key);} catch {state.storageError='Phone draft storage is unavailable. Save each entry to the order before leaving this page.';}
  clearOfflineDraftErrors();
  for(const recipient of state.data.recipients) {
    const draft=state.local.cards[recipient.id];
    if(!draft || (!draft.edited&&draft.savedVersion===draft.version)) state.local.cards[recipient.id]=cardFromRecipient(recipient);
    else if(draft.serverRevision!==recipient.revision) draft.conflict=true;
  }
  if(!state.local.activeId&&!state.data.recipients.length&&!Object.values(state.local.cards).some(card=>card.edited||card.serverRevision)){
    const card=freshCard(defaultGroup());state.local.cards[card.id]=card;state.local.activeId=card.id;state.local.view='entry';
  }
  state.view=state.local.view || (state.local.activeId?'entry':'list');
  if(state.view==='entry'&&!currentCard())state.view='list';
  state.local.orderCache=state.data;
  try{localStorage.setItem('tt-last-order-key',state.key);}catch{}
  await persist();
  renderCustomer();
}

async function openCard(id) {
  state.error='';state.note='';state.local.activeId=id;state.view='entry';state.local.view='entry';
  await persist();renderCustomer();window.scrollTo({top:0,behavior:'instant'});
}

async function newCard() {
  const card=freshCard(defaultGroup());state.local.cards[card.id]=card;await openCard(card.id);
}

async function showList() {state.error='';state.note='';state.view='list';state.local.view='list';await persist();await refreshOrder().catch(setError);renderCustomer();window.scrollTo(0,0);}

function renderedRecipients() {
  const remote=new Map(state.data.recipients.map(r=>[r.id,r]));
  for (const draft of Object.values(state.local.cards)) if(draft.edited || draft.serverRevision || draft.photo || draft.name) remote.set(draft.id,{...remote.get(draft.id),...draft,revision:draft.serverRevision});
  return [...remote.values()].filter(r=>!state.data.scopeGroupId || r.groupId===state.data.scopeGroupId);
}

function counts() {
  const recipients=state.data.recipients;
  return {recipients:recipients.length,copies:recipients.reduce((sum,r)=>sum+(r.copies||1),0),components:recipients.reduce((sum,r)=>sum+(r.copies||1)*(findTemplate(r.groupId)?.components?.length||1),0)};
}

function summaryStrip() {const n=counts();return `<div class="summary-strip"><div><strong>${n.recipients}</strong><span>${t('recordCount')}</span></div><div><strong>${n.copies}</strong><span>${t('copyCount')}</span></div><div><strong>${n.components}</strong><span>${t('componentCount')}</span></div></div>`;}

function photoUrl(card) {
  if(card.photo) {
    const cached=objectUrls.get(card.id);
    if(cached?.blob===card.photo)return cached.url;
    if(cached)URL.revokeObjectURL(cached.url);
    const url=URL.createObjectURL(card.photo);objectUrls.set(card.id,{blob:card.photo,url});return url;
  }
  return card.assetId?`/api/media/${encodeURIComponent(card.assetId)}`:'';
}

function previewMarkup(card) {
  const template=findTemplate(card.groupId);
  const shared=effectiveShared(card.groupId);
  const component=template?.components?.[0];
  const ratio=(component?.widthMm||85)/(component?.heightMm||156);
  const photo=component?.photo;
  const photoGeometry=photo?`left:${photo.x/component.widthMm*100}%;top:${photo.y/component.heightMm*100}%;width:${photo.width/component.widthMm*100}%;height:${photo.height/component.heightMm*100}%;border-radius:${photo.shape==='circle'?'50%':'2%'};`:'';
  return `<div class="preview-panel"><p class="eyebrow">${t('preview')}</p><div class="preview-stage"><div class="insert-preview ${template?.synthetic===false?'fixed-layout':''}" style="aspect-ratio:${ratio}"><div class="insert-heading" id="preview-heading" style="${component?.headingBox?'':'display:none'}">${esc(shared.heading || '')}</div><div class="insert-event" style="${component?.eventBox?'':'display:none'}">${esc(shared.event || '')}</div><div class="insert-photo" style="${photoGeometry}" id="preview-photo">${photoUrl(card)?`<img src="${esc(photoUrl(card))}" alt="${esc(t('preview'))}" id="crop-preview">`:esc(t('addPhoto'))}</div><div class="insert-name" id="preview-name">${esc(card.name || t('name'))}</div><div class="insert-achievement" id="preview-achievement" style="${component?.achievementBox?'':'display:none'}">${esc(card.achievement||'')}</div><div class="insert-date" style="${component?.dateBox?'':'display:none'}">${esc(shared.date||'')}</div></div></div>${template?.synthetic===false?`<p class="small muted fixed-design-note">${t('fixedWording')}</p>`:''}<p class="small muted">${t('previewHint')}</p></div>`;
}

function renderCustomer() {
  if(!state.data)return;
  const step=state.view==='proof'?2:state.view==='approval'?3:1;
  $('#app').innerHTML=`${header()}<main class="shell customer-shell" data-view="${esc(state.view)}"><div class="customer-hero"><div><p class="eyebrow customer-order-label">${esc(state.data.order.title)}</p><h1>${state.view==='entry'?t('addName'):state.view==='proof'?t('review'):state.view==='approval'?t('finalApprove'):t('entries')}</h1><p class="muted">${state.view==='entry'?t('entryIntro'):state.view==='proof'?t('proofIntro'):state.data.role==='helper'?t('helperNote'):t('listIntro')}</p></div><span class="order-tag">${esc(state.data.order.id.slice(0,8).toUpperCase())} · ${allowedGroups().map(g=>esc(g.label)).join(' / ')}</span></div><ol class="steps"><li class="${step===1?'active':''}"><span class="step-number">1</span>${t('entries')}</li><li class="${step===2?'active':''}"><span class="step-number">2</span>${t('review')}</li><li class="${step===3?'active':''}"><span class="step-number">3</span>${t('approve')}</li></ol>${notices()}<div id="customer-content"></div></main>${footer()}`;
  if(state.view==='entry')renderEntry();
  else if(state.view==='proof')renderProof();
  else if(state.view==='approval')renderApproval();
  else renderList();
  bindGlobal();
}

function renderEntry() {
  const card=currentCard();if(!card){state.view='list';renderList();return;}
  const template=findTemplate(card.groupId);
  const suggestion=filenameSuggestion(card.filename);
  const groups=allowedGroups();
  const hasAchievement=template?.components?.some(component=>component.achievementBox);
  $('#customer-content').innerHTML=`<div class="entry-layout"><section class="card entry-card"><div class="row-space"><h2>${card.serverRevision?t('edit'):t('addRecipient')}</h2><span class="badge">${esc(groups.find(g=>g.id===card.groupId)?.label||'')}</span></div>${groups.length>1?`<div class="field"><label for="group">${t('group')}</label><select id="group">${groups.map(g=>`<option value="${esc(g.id)}" ${g.id===card.groupId?'selected':''}>${esc(g.label)}</option>`).join('')}</select></div>`:''}<div class="field"><span class="field-label">${t('addPhoto')}</span><button type="button" class="photo-button" id="choose-photo">${photoUrl(card)?`<img src="${esc(photoUrl(card))}" alt="Selected photograph"><span><strong>${t('changePhoto')}</strong><small>${esc(card.filename||t('photoHint'))}</small></span>`:`<span class="symbol" aria-hidden="true">＋</span><span><strong>${t('addPhoto')}</strong><small>${t('photoHint')}</small></span>`}</button><input class="visually-hidden" id="photo-input" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" aria-label="${t('addPhoto')}"><details class="photo-help"><summary>${t('photoHelp')}</summary><p>${t('photoHelpBody')}</p></details>${photoUrl(card)?`<details class="crop-controls"><summary>${t('adjust')}</summary><div class="range-row"><label for="zoom">${t('zoom')}</label><input id="zoom" type="range" min="1" max="4" step=".01" value="${card.crop?.zoom||1}"><output id="zoom-output">${(card.crop?.zoom||1).toFixed(1)}×</output></div><div class="range-row"><label for="crop-x">${t('horizontal')}</label><input id="crop-x" type="range" min="-1" max="1" step=".01" value="${card.crop?.x||0}"><output></output></div><div class="range-row"><label for="crop-y">${t('vertical')}</label><input id="crop-y" type="range" min="-1" max="1" step=".01" value="${card.crop?.y||0}"><output></output></div><div class="button-row"><button type="button" class="button secondary compact" id="rotate-photo">${t('rotate')}</button><button type="button" class="button quiet compact" id="reset-crop">${t('reset')}</button></div></details>`:''}</div><div class="field"><label for="recipient-name">${t('name')}</label><input id="recipient-name" autocomplete="off" spellcheck="false" value="${esc(card.name)}" maxlength="240" placeholder="${t('name')}" aria-describedby="name-hint"><span class="field-hint" id="name-hint">${t('nameHint')}</span>${suggestion&&!card.name.trim()?`<div><button class="text-link" type="button" id="use-filename">${t('useFilename')}: ${esc(suggestion)}</button><div class="field-hint">${t('filenameNote')}</div></div>`:''}</div>${hasAchievement?`<div class="field"><label for="achievement">${t('achievement')} <span class="optional">(${t('optional')})</span></label><textarea id="achievement" rows="2" maxlength="500" spellcheck="false">${esc(card.achievement)}</textarea></div>`:''}<details class="small"><summary class="count-label">${t('copies')}: <span id="copies-label">${card.copies||1}</span></summary><div class="field" style="margin-top:12px"><label for="copies">${t('copies')}</label><input id="copies" type="number" min="1" max="100" step="1" value="${card.copies||1}"></div></details><div id="draft-warnings"></div><div id="save-state" class="save-state" role="status"></div><div class="entry-actions"><button id="save-next" class="button full">${t('next')}</button><div class="button-row"><button id="save-card" class="button secondary grow">${t('save')}</button><button id="entry-list" class="button quiet grow">${t('back')}</button></div><button id="generate-proof" class="button quiet full">${t('generate')}</button></div></section>${previewMarkup(card)}</div>`;
  simplifyCustomerEntry(card,groups);
  placeEntryPreview();
  $('#choose-photo').onclick=()=>$('#photo-input').click();
  $('#photo-input').onchange=async event=>{
    const file=event.target.files?.[0];if(!file)return;
    card.photo=file;card.filename=file.name;card.uploadId=newId();card.crop={x:0,y:0,zoom:1,rotation:0};card.proof=null;
    await changed(card);renderCustomer();
  };
  $('#recipient-name').oninput=event=>{card.name=event.target.value;changed(card);$('#preview-name').textContent=card.name||t('name');$('#use-filename')?.closest('div').classList.toggle('hidden',!!card.name.trim());};
  if($('#achievement'))$('#achievement').oninput=event=>{card.achievement=event.target.value;changed(card);$('#preview-achievement').textContent=card.achievement;};
  $('#copies').oninput=event=>{card.copies=Math.min(100,Math.max(1,Number(event.target.value)||1));$('#copies-label').textContent=card.copies;changed(card);};
  $('#group')?.addEventListener('change',async event=>{card.groupId=event.target.value;await changed(card);renderCustomer();});
  $('#use-filename')?.addEventListener('click',()=>{card.name=suggestion;changed(card);renderCustomer();$('#recipient-name').focus();});
  for(const [id,key]of [['zoom','zoom'],['crop-x','x'],['crop-y','y']])$('#'+id)?.addEventListener('input',event=>{card.crop[key]=Number(event.target.value);changed(card);updateCropPreview();});
  $('#rotate-photo')?.addEventListener('click',()=>{card.crop.rotation=((card.crop.rotation||0)+90)%360;changed(card);updateCropPreview();});
  $('#reset-crop')?.addEventListener('click',()=>{card.crop={x:0,y:0,zoom:1,rotation:0};changed(card);renderCustomer();});
  $('#save-next').onclick=()=>saveAndNext();
  $('#save-card').onclick=async()=>{await saveCard(card);updateSaveState();};
  $('#entry-list').onclick=showList;
  if(card.proof&&!card.edited){$('#generate-proof').textContent=t('viewProof');$('#generate-proof').onclick=()=>{state.proofRecipientId=card.id;state.view='proof';renderCustomer();};}
  else $('#generate-proof').onclick=()=>generateProof(card);
  updateCropPreview();updateSaveState();
}

async function changed(card) {
  card.version++;const version=card.version;card.edited=true;card.status='saving-local';card.proof=null;card.reviewedRevision=null;
  updateSaveState();await persist();if(card.version===version)card.status=state.storageError?'local-error':'local';updateSaveState();
}

function updateCropPreview() {
  const card=currentCard();const image=$('#crop-preview');if(!card||!image)return;
  const crop=card.crop||{};const box=image.parentElement;
  const position=()=>{
    if(!image.naturalWidth||!box.clientWidth)return;
    const rotation=((crop.rotation||0)%360+360)%360;
    const swap=rotation===90||rotation===270;
    const sourceWidth=swap?image.naturalHeight:image.naturalWidth;
    const sourceHeight=swap?image.naturalWidth:image.naturalHeight;
    const scale=Math.max(box.clientWidth/sourceWidth,box.clientHeight/sourceHeight)*(crop.zoom||1);
    const rotatedWidth=sourceWidth*scale,rotatedHeight=sourceHeight*scale;
    const x=(box.clientWidth-rotatedWidth)/2+(crop.x||0)*(rotatedWidth-box.clientWidth)/2;
    const y=(box.clientHeight-rotatedHeight)/2+(crop.y||0)*(rotatedHeight-box.clientHeight)/2;
    const width=image.naturalWidth*scale,height=image.naturalHeight*scale;
    image.style.position='absolute';image.style.width=`${width}px`;image.style.height=`${height}px`;
    image.style.left=`${x+rotatedWidth/2-width/2}px`;image.style.top=`${y+rotatedHeight/2-height/2}px`;
    image.style.transform=`rotate(${rotation}deg)`;
  };
  if(image.complete)position();else image.onload=position;
  if($('#zoom-output'))$('#zoom-output').textContent=(crop.zoom||1).toFixed(1)+'×';
}

function placeEntryPreview(){
  const panel=$('#local-preview')||$('.preview-panel'),layout=$('.entry-layout'),actions=$('.entry-actions');if(!panel||!layout||!actions)return;
  if(window.innerWidth<=760){actions.before(panel);panel.style.marginTop='12px';if(panel.tagName==='DETAILS')panel.open=!!state.localPreviewOpen;}
  else{layout.append(panel);panel.style.marginTop='';if(panel.tagName==='DETAILS')panel.open=true;}
}

function simplifyCustomerEntry(card,groups){
  const layout=$('.entry-layout'),entry=$('.entry-card'),nameField=$('#recipient-name').closest('.field');
  const toolbar=document.createElement('div');toolbar.className='entry-navigation';
  const back=$('#entry-list');back.className='button quiet compact';toolbar.append(back);
  const count=document.createElement('span');count.className='small muted';count.textContent=`${state.data.recipients.length} ${t('savedEntries').toLocaleLowerCase()}`;toolbar.append(count);layout.before(toolbar);
  const tools=document.createElement('div');tools.className='entry-tools';nameField.after(tools);
  const crop=$('.crop-controls'),help=$('.photo-help');if(crop)tools.append(crop);if(help)tools.append(help);
  const options=document.createElement('details');options.className='entry-options';options.innerHTML=`<summary>${t('moreOptions')}</summary>`;
  const group=$('#group')?.closest('.field');if(group)options.append(group);
  const copies=$('#copies').closest('details');options.append(copies);$('#draft-warnings').before(options);
  if($('#achievement')){$('#achievement').rows=1;$('#achievement').classList.add('compact-achievement');}
  const preview=$('.preview-panel'),disclosure=document.createElement('details');disclosure.id='local-preview';disclosure.className='preview-disclosure';disclosure.innerHTML=`<summary><span>${t('placement')}</span><span class="preview-summary-arrow" aria-hidden="true">⌄</span></summary>`;preview.before(disclosure);disclosure.append(preview);
  disclosure.addEventListener('toggle',()=>{if(window.innerWidth<=760)state.localPreviewOpen=disclosure.open;if(disclosure.open)updateCropPreview();});
  crop?.addEventListener('toggle',()=>{if(crop.open&&window.innerWidth<=760){state.localPreviewOpen=true;disclosure.open=true;updateCropPreview();}});
  const secondary=$('.entry-actions .button-row'),proof=$('#generate-proof');proof.className='button secondary grow';secondary.append(proof);
  const groupInfo=groups.find(group=>group.id===card.groupId);
  if(groupInfo?.expectedQuantity===1){
    const save=$('#save-card'),next=$('#save-next');
    next.className='button quiet full';options.append(next);$('.entry-actions').prepend(save);save.className='button full';proof.className='button secondary full';
  }
  entry.classList.add('entry-card-simple');
}

function updateSaveState() {
  const card=currentCard();const target=$('#save-state');if(!target||!card)return;
  const key=card.status==='uploading'?'uploading':card.status==='saving'?'saving':card.status==='saving-local'?'savingPhone':card.status==='local-error'?'unsavedPhone':card.status==='error'?'failed':card.savedVersion===card.version&&card.serverRevision?'savedOrder':card.status==='empty'?'': 'savedPhone';
  target.className=`save-state ${key==='savedOrder'?'saved':key==='failed'?'error':''}`;
  target.innerHTML=key?`<span class="status-dot"></span>${esc(t(key))}`:'';
  const warnings=$('#draft-warnings');
  if(warnings){
    const duplicate=(card.duplicateWarnings?.length>0)||(card.name&&state.data.recipients.some(r=>r.id!==card.id&&r.name?.trim()===card.name.trim()));
    warnings.innerHTML=`${card.conflict?`<div class="alert error">${t('conflict')}<br><button class="text-link" id="compare-conflict">${t('compare')}</button></div>`:''}${duplicate?`<div class="alert">${t('duplicate')}</div>`:''}${card.error?`<div class="alert error">${esc(card.error)}</div>`:''}${state.storageError?`<div class="alert error">${esc(state.storageError)}</div>`:''}`;
    $('#compare-conflict')?.addEventListener('click',()=>compareConflict(card));
  }
  ['save-next','save-card','generate-proof'].forEach(id=>{if($('#'+id))$('#'+id).disabled=state.busy||(id==='generate-proof'&&(!card.name?.trim()||(!card.assetId&&!card.photo)));});
}

async function saveCard(card) {
  if(state.busy)return false;
  if(card.conflict){card.error=t('conflict');updateSaveState();return false;}
  if(!navigator.onLine){card.status='error';card.error=t('offline');await persist();updateSaveState();return false;}
  state.busy=true;card.error='';card.status='saving';updateSaveState();
  const captured=structuredClone(card);const version=card.version;
  try{
    const result=await api(`/api/customer/recipients/${encodeURIComponent(card.id)}`,{method:'PUT',body:{expectedRevision:card.serverRevision,groupId:captured.groupId,name:captured.name,achievement:captured.achievement,copies:captured.copies,crop:captured.crop}});
    let recipient=getRecipient(result);card.serverRevision=recipient.revision;
    if(!Number.isInteger(card.serverRevision))throw new Error('The server did not confirm this entry. Please refresh and compare before retrying.');
    await persist();
    if(captured.photo){
      card.status='uploading';updateSaveState();
      const uploaded=await api(`/api/customer/recipients/${encodeURIComponent(card.id)}/photo`,{method:'POST',raw:true,body:captured.photo,headers:{'content-type':captured.photo.type||'application/octet-stream','x-file-name':encodeURIComponent(captured.filename||'photo'),'x-expected-revision':String(card.serverRevision),'x-upload-id':captured.uploadId||newId()}});
      recipient=getRecipient(uploaded);card.serverRevision=recipient.revision;card.assetId=recipient.assetId;
      if(card.uploadId===captured.uploadId){card.photo=null;card.uploadId=null;}
      if(captured.crop.x||captured.crop.y||captured.crop.zoom!==1||captured.crop.rotation){
        recipient=getRecipient(await api(`/api/customer/recipients/${encodeURIComponent(card.id)}`,{method:'PUT',body:{expectedRevision:card.serverRevision,groupId:captured.groupId,name:captured.name,achievement:captured.achievement,copies:captured.copies,crop:captured.crop}}));
        card.serverRevision=recipient.revision;
      }
    } else if(recipient.assetId)card.assetId=recipient.assetId;
    card.savedVersion=version;card.edited=card.version!==version;card.status=card.edited?'local':'saved';
    card.proof=recipient.proof;card.reviewedRevision=recipient.reviewedRevision;
    const at=state.data.recipients.findIndex(r=>r.id===card.id);
    if(at>=0)state.data.recipients[at]=recipient;else state.data.recipients.push(recipient);
    await persist();await refreshOrder();announce(t('savedOrder'));return card.version===version;
  }catch(error){card.status='error';card.error=error.message;if(error.status===409)card.conflict=true;await persist();announce(error.message);return false;}
  finally{state.busy=false;updateSaveState();}
}

async function saveAndNext(){
  const card=currentCard();if(!await saveCard(card))return;
  if(state.local.queue.length){await openCard(state.local.queue.shift());return;}
  const next=freshCard(card.groupId);state.local.cards[next.id]=next;await openCard(next.id);
}

function entryState(recipient){
  if(!recipient.name?.trim()||(!recipient.assetId&&!recipient.photo))return {label:t('incomplete'),class:'warn'};
  if(recipient.reviewedRevision===recipient.revision && !recipient.edited)return {label:t('reviewed'),class:'good'};
  return {label:t('needsReview'),class:''};
}

function renderList() {
  let recipients=renderedRecipients();
  const allCount=recipients.length;
  if(state.search)recipients=recipients.filter(r=>r.name?.toLocaleLowerCase().includes(state.search.toLocaleLowerCase()));
  if(state.filter==='name')recipients=recipients.filter(r=>!r.name?.trim());
  if(state.filter==='photo')recipients=recipients.filter(r=>!r.assetId&&!r.photo);
  if(state.filter==='review')recipients=recipients.filter(r=>r.reviewedRevision!==r.revision||r.edited||!r.serverRevision);
  if(state.sort==='name')recipients.sort((a,b)=>(a.name||'').localeCompare(b.name||'',state.lang));
  $('#customer-content').innerHTML=`${state.data.order.approvalId?`<div class="alert success"><strong>${t('approved')}</strong><br>${t('approvedBody')}</div>`:''}${summaryStrip()}<div class="toolbar"><h2>${t('entries')} <span class="muted small">(${allCount})</span></h2><div class="button-row" style="margin:0"><button id="add-recipient" class="button">＋ ${t('addRecipient')}</button><button id="add-several" class="button secondary">${t('addSeveral')}</button><input id="bulk-input" type="file" multiple class="visually-hidden" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"></div></div>${allCount?`<div class="toolbar"><input class="text" id="search" type="search" placeholder="${t('search')}" aria-label="${t('search')}" value="${esc(state.search)}"><select class="text" id="sort" style="width:auto" aria-label="${t('sort')}"><option value="added">${t('orderAdded')}</option><option value="name" ${state.sort==='name'?'selected':''}>${t('nameAZ')}</option></select></div><div class="pill-tabs">${[['all','all'],['name','needsName'],['photo','needsPhoto'],['review','needsReview']].map(([value,label])=>`<button class="pill ${state.filter===value?'active':''}" data-filter="${value}">${t(label)}</button>`).join('')}</div><div class="recipient-grid">${recipients.map((r,index)=>{const status=entryState(r);return `<button class="recipient-card" data-recipient="${esc(r.id)}">${photoUrl(r)?`<img class="recipient-photo" src="${esc(r.photo?photoUrl(r):r.assetId?`/api/media/${encodeURIComponent(r.assetId)}?thumb=1`:photoUrl(r))}" loading="lazy" alt="${esc(r.name||'Recipient photograph')}">`:`<span class="recipient-photo">${t('needsPhoto')}</span>`}<span class="recipient-detail"><strong>${esc(r.name||`${t('name')} ${index+1}`)}</strong><small>${esc(state.data.groups.find(g=>g.id===r.groupId)?.label||'')} · ${r.copies||1} ${t('copyCount')}</small><br><span class="badge ${status.class}">${status.label}</span>${r.edited?` <span class="badge warn">${state.lang==='ml'?'ഫോണിൽ മാത്രം':'Phone draft'}</span>`:''}</span><span aria-hidden="true">›</span></button>`;}).join('')||`<div class="empty-state">${state.lang==='ml'?'എൻട്രികൾ കണ്ടെത്തിയില്ല.':'No matching entries.'}</div>`}</div>`:`<div class="empty-state"><h2>${t('emptyTitle')}</h2><p>${t('emptyBody')}</p><button id="first-recipient" class="button copper">${t('addRecipient')}</button></div>`}${isOrganiser()?`<section class="card" style="margin-top:26px"><div class="row-space"><h2>${t('shared')}</h2><button class="text-link" id="edit-shared">${t('editShared')}</button></div>${sharedSummary()}${groupSharedSummaries()}<div class="button-row"><button id="approval-page" class="button">${t('review')} & ${t('approve')}</button></div></section>`:''}`;
  simplifyCustomerList();
  $('#add-recipient').onclick=newCard;$('#first-recipient')?.addEventListener('click',newCard);
  $('#add-several').onclick=()=>$('#bulk-input').click();
  $('#bulk-input').onchange=bulkPhotos;
  $$('[data-recipient]').forEach(button=>button.onclick=()=>openCard(button.dataset.recipient));
  $$('[data-filter]').forEach(button=>button.onclick=()=>{state.filter=button.dataset.filter;renderList();});
  $('#search')?.addEventListener('input',event=>{const position=event.target.selectionStart;state.search=event.target.value;renderList();$('#search').focus();$('#search').setSelectionRange(position,position);});
  $('#sort')?.addEventListener('change',event=>{state.sort=event.target.value;renderList();});
  $('#edit-shared')?.addEventListener('click',editShared);
  $('#approval-page')?.addEventListener('click',()=>{state.view='approval';renderCustomer();});
}

function simplifyCustomerList(){
  const bulk=$('#add-several'),more=document.createElement('details');more.className='list-intake-options';more.innerHTML=`<summary>${t('moreOptions')}</summary>`;bulk.before(more);more.append(bulk);bulk.className='button quiet compact';
  const approval=$('#approval-page'),section=approval?.closest('section');
  if(section){
    const counts=$('#customer-content .summary-strip');if(counts)section.prepend(counts);
    if(!sharedFields().length){$('#edit-shared')?.remove();$('h2',section).textContent=t('orderDetails');}
    const details=document.createElement('details');details.className='customer-order-details';details.innerHTML=`<summary>${t('orderDetails')}</summary>`;section.before(details);details.append(section);
    details.before(approval);approval.className='button full approval-list-cta';approval.disabled=!state.data.recipients.length;
  }else $('#customer-content .summary-strip')?.remove();
  $('#search')?.closest('.toolbar').classList.add('recipient-search');
}

async function bulkPhotos(event){
  const files=[...event.target.files];if(!files.length)return;
  if(files.length>100){state.error='Choose up to 100 photos at a time to keep your phone responsive.';renderCustomer();return;}
  for(const file of files){const card=freshCard(defaultGroup());card.photo=file;card.filename=file.name;card.uploadId=newId();card.version=1;card.edited=true;card.status='local';state.local.cards[card.id]=card;state.local.queue.push(card.id);}
  const first=state.local.queue.shift();await persist();await openCard(first);
}

async function generateProof(card){
  if(card.edited||!card.serverRevision){if(!await saveCard(card))return;}
  if(!card.name.trim()||!card.assetId){card.error=state.lang==='ml'?'പ്രൂഫിന് പേരും ചിത്രവും ആവശ്യമാണ്.':'Add the name and photograph before generating a proof.';updateSaveState();return;}
  if(state.busy)return;
  state.busy=true;card.status='saving';updateSaveState();state.error='';
  try{
    const result=await api(`/api/customer/recipients/${encodeURIComponent(card.id)}/proof`,{method:'POST',body:{expectedRevision:card.serverRevision}});
    const job=resource(result,'job');state.activeJob=job.id||result.jobId;
    state.view='proof';state.proofRecipientId=card.id;renderCustomer();
    if(state.activeJob)await pollJob(state.activeJob,progress=>{const status=$('#proof-status');if(status)status.textContent=`${state.lang==='ml'?'പ്രൂഫ് തയ്യാറാക്കുന്നു':'Preparing print proof'}${Number.isFinite(progress.progress)?` · ${Math.round(progress.progress)}%`:''}`;});
    await refreshOrder();state.view='proof';state.proofRecipientId=card.id;state.activeJob=null;renderCustomer();
  }catch(error){state.activeJob=null;setError(error);renderCustomer();}
  finally{state.busy=false;updateSaveState();}
}

async function pollJob(id,onProgress){
  for(let attempts=0;attempts<240;attempts++){
    const result=await api(`/api/jobs/${encodeURIComponent(id)}`);const job=resource(result,'job');onProgress?.(job);
    if(['completed','succeeded','complete'].includes(job.status))return job;
    if(['failed','cancelled','canceled'].includes(job.status))throw new Error(job.error?.message||job.error||'The job could not finish. Your saved entry is safe.');
    await delay(1000);
  }
  throw new Error('The proof is still in the queue. Return to your entry and check again shortly.');
}

function renderProof(){
  const recipient=state.data.recipients.find(r=>r.id===state.proofRecipientId)||currentCard();
  if(!recipient){state.view='list';renderList();return;}
  const proof=recipient.proof;const artworks=proof?.artworks||[];
  $('#customer-content').innerHTML=`<div class="toolbar"><button id="proof-back" class="button quiet">← ${t('back')}</button><button id="proof-edit" class="button secondary">${t('edit')}</button></div><div class="review-layout"><section><div class="proof-gallery">${artworks.length?artworks.map((art,index)=>`<figure class="proof-figure"><img src="/api/artworks/${encodeURIComponent(art.id)}" data-enlarge="${esc(art.id)}" alt="${esc(recipient.name)} — ${esc(art.componentId||'component')}" style="width:${index?300:430}px;max-width:100%"><figcaption>${esc(art.componentId||'Insert')}</figcaption></figure>`).join(''):`<div class="empty-state"><p id="proof-status">${state.activeJob?(state.lang==='ml'?'പ്രൂഫ് തയ്യാറാക്കുന്നു…':'Preparing your print proof…'):(state.lang==='ml'?'അന്തിമ പ്രൂഫ് ഇനിയും തയ്യാറാക്കിയിട്ടില്ല.':'The final proof has not been generated yet.')}</p>${!state.activeJob?`<button id="proof-generate" class="button">${t('generate')}</button>`:''}</div>`}</div></section><aside class="card"><p class="eyebrow">${t('review')}</p><h2 class="review-name">${esc(recipient.name)}</h2><p class="muted">${esc(recipient.achievement||'')}</p><dl class="shared-summary"><dt>${t('copies')}</dt><dd>${recipient.copies||1}</dd><dt>${t('group')}</dt><dd>${esc(state.data.groups.find(g=>g.id===recipient.groupId)?.label||'')}</dd></dl>${sharedSummary(recipient.groupId)}${visibleIssues(recipient).length?`<div class="alert">${visibleIssues(recipient).map(esc).join('<br>')}</div>`:''}<label class="check-row"><input id="entry-reviewed" type="checkbox" ${!artworks.length?'disabled':''}><span>${t('checked')}</span></label><button id="mark-reviewed" class="button full" disabled>${t('markReviewed')}</button>${recipient.reviewedRevision===recipient.revision?`<p class="alert success">${t('reviewed')}</p>`:''}</aside></div>`;
  $('#proof-back').onclick=showList;$('#proof-edit').onclick=()=>openCard(recipient.id);
  $('#proof-generate')?.addEventListener('click',()=>generateProof(state.local.cards[recipient.id]||cardFromRecipient(recipient)));
  $('#entry-reviewed').onchange=event=>{$('#mark-reviewed').disabled=!event.target.checked;};
  $('#mark-reviewed').onclick=async()=>{
    $('#mark-reviewed').disabled=true;
    try{await api(`/api/customer/recipients/${encodeURIComponent(recipient.id)}/review`,{method:'POST',body:{expectedRevision:recipient.revision,proofId:proof.id}});await refreshOrder();state.note=t('reviewed');state.view='list';renderCustomer();}
    catch(error){setError(error);renderCustomer();}
  };
  $$('[data-enlarge]').forEach(img=>img.onclick=()=>enlargeProof(img.dataset.enlarge,recipient.name));
}

function sharedSummary(groupId){
  const shared=groupId?effectiveShared(groupId):(state.data.order.shared||{}),fields=sharedFields(groupId);
  if(!fields.length)return `<p class="small muted fixed-design-note">${t('fixedWording')}</p>`;
  return `<dl class="shared-summary">${['heading','event','date'].filter(field=>fields.includes(field)).map(field=>`<dt>${t(field)}</dt><dd>${esc(shared[field]||'—')}</dd>`).join('')}${fields.includes('logo')&&shared.logoAssetId?`<dt>Logo</dt><dd><img src="/api/media/${encodeURIComponent(shared.logoAssetId)}" alt="Organisation logo" style="max-width:100px;max-height:70px"></dd>`:''}</dl>`;
}

function renderApproval(){
  const recipients=state.data.recipients;
  const unchecked=recipients.filter(r=>r.reviewedRevision!==r.revision||!r.proof||!r.name?.trim()||!r.assetId);
  const localDirty=Object.values(state.local.cards).filter(c=>c.edited);
  const canApprove=recipients.length>0&&!unchecked.length&&!localDirty.length;
  $('#customer-content').innerHTML=`<button id="approval-back" class="button quiet">← ${t('back')}</button>${summaryStrip()}<div class="review-layout"><section class="card"><h2>${t('shared')}</h2>${sharedSummary()}${groupSharedSummaries()}<button id="approval-edit-shared" class="text-link">${t('editShared')}</button><hr class="section-separator"><h2>${t('review')}</h2>${!recipients.length?`<div class="alert">${t('emptyBody')}</div>`:unchecked.length?`<div class="alert">${state.lang==='ml'?`${unchecked.length} എൻട്രികൾ കൂടി പരിശോധിക്കണം.`:`${unchecked.length} entries still need checking.`}</div>`:`<div class="alert success">${state.lang==='ml'?'എല്ലാ എൻട്രികളും പരിശോധിച്ചു.':'Every saved entry has been individually checked.'}</div>`}${localDirty.length?`<div class="alert">${state.lang==='ml'?`${localDirty.length} ഡ്രാഫ്റ്റുകൾ ഈ ഫോണിൽ സേവ് ചെയ്യാനുണ്ട്.`:`${localDirty.length} phone drafts still have unsaved changes.`}</div>`:''}<div class="recipient-grid">${recipients.map(r=>`<button class="recipient-card" data-review="${esc(r.id)}">${r.assetId?`<img class="recipient-photo" src="/api/media/${encodeURIComponent(r.assetId)}?thumb=1" loading="lazy" alt="${esc(r.name)}">`:''}<span class="recipient-detail"><strong>${esc(r.name||t('needsName'))}</strong><span class="badge ${entryState(r).class}">${entryState(r).label}</span></span></button>`).join('')}</div></section><aside class="card"><p class="eyebrow">${t('approve')}</p><h2>${t('finalApprove')}</h2><p class="muted small">${t('approvalHint')}</p><label class="check-row"><input id="approve-confirm" type="checkbox" ${!canApprove?'disabled':''}><span>${t('approveText')}</span></label><button id="final-approve" class="button full" disabled>${t('finalApprove')}</button>${state.data.order.approvalId?`<div class="alert success">${t('approved')}</div>`:''}</aside></div>`;
  if(!sharedFields().length)$('#approval-edit-shared')?.remove();$('#approval-back').onclick=showList;$('#approval-edit-shared')?.addEventListener('click',editShared);
  $$('[data-review]').forEach(button=>button.onclick=()=>{state.proofRecipientId=button.dataset.review;state.view='proof';renderCustomer();});
  $('#approve-confirm').onchange=event=>{$('#final-approve').disabled=!event.target.checked;};
  $('#final-approve').onclick=async()=>{ $('#final-approve').disabled=true;try{await api('/api/customer/approve',{method:'POST',body:{expectedRevision:state.data.order.revision,confirm:true}});await refreshOrder();state.view='list';state.note=t('approvedBody');renderCustomer();}catch(error){setError(error);await refreshOrder().catch(()=>{});renderCustomer();}};
}

function dialog(title,body,footerHtml=''){
  $('#dialog')?.remove();const node=document.createElement('dialog');node.id='dialog';node.innerHTML=`<div class="dialog-head"><h2>${title}</h2><button class="close-button" data-close aria-label="${t('close')}">×</button></div><div class="dialog-body">${body}</div>${footerHtml?`<div class="dialog-footer">${footerHtml}</div>`:''}`;document.body.append(node);node.showModal();bindGlobal();return node;
}

function enlargeProof(id,name){const node=dialog(esc(name),`<img src="/api/artworks/${encodeURIComponent(id)}" alt="${esc(name)}">`);node.classList.add('large-proof-dialog');}

function editShared(){
  const shared=state.data.order.shared||{};
  const editable=sharedFields();if(!editable.length)return;
  dialog(t('editShared'),`<div class="alert">${t('approvalHint')}</div><div class="field"><label for="shared-heading">${t('heading')}</label><textarea id="shared-heading" maxlength="500">${esc(shared.heading||'')}</textarea></div><div class="field"><label for="shared-event">${t('event')}</label><textarea id="shared-event" maxlength="500">${esc(shared.event||'')}</textarea></div><div class="field"><label for="shared-date">${t('date')}</label><input id="shared-date" value="${esc(shared.date||'')}" maxlength="100"></div><div class="field"><label for="shared-logo">Organisation logo (optional)</label><input id="shared-logo" type="file" accept="image/png,image/jpeg,image/webp"><span class="field-hint">A new logo replaces the order logo and requires fresh proofs.</span></div><div id="dialog-error"></div>`,`<button class="button secondary" data-close>${t('cancel')}</button><button class="button" id="save-shared">${t('save')}</button>`);
  for(const field of ['heading','event','date','logo'])if(!editable.includes(field))$('#shared-'+field)?.closest('.field').remove();
  $('#save-shared').onclick=async()=>{
    $('#save-shared').disabled=true;
    try{
      const fields={...shared,heading:$('#shared-heading')?.value??shared.heading??'',event:$('#shared-event')?.value??shared.event??'',date:$('#shared-date')?.value??shared.date??''};
      const file=$('#shared-logo')?.files[0];
      if(file){const response=await api('/api/customer/logo',{method:'POST',raw:true,body:file,headers:{'content-type':file.type,'x-file-name':encodeURIComponent(file.name)}});fields.logoAssetId=response.asset?.id||response.assetId||response.id;await refreshOrder();}
      await api('/api/customer/shared',{method:'PATCH',body:{expectedRevision:state.data.order.revision,shared:fields}});
      await refreshOrder();$('#dialog').close();state.note=t('approvalHint');renderCustomer();
    }catch(error){$('#dialog-error').innerHTML=`<div class="alert error">${esc(error.message)}</div>`;$('#save-shared').disabled=false;}
  };
}

async function compareConflict(card){
  try{
    const latest=await api('/api/customer/order');const saved=latest.recipients.find(r=>r.id===card.id);
    if(!saved)throw new Error('The saved entry is no longer available. Ask the organiser to check it.');
    dialog(t('compare'),`<div class="grid-2"><section><h3>On this phone</h3><p>${esc(card.name)}</p><p>${esc(card.achievement)}</p>${photoUrl(card)?`<img src="${esc(photoUrl(card))}" alt="Phone draft" style="width:100%;max-height:220px;object-fit:contain">`:''}</section><section><h3>Saved to order</h3><p>${esc(saved.name)}</p><p>${esc(saved.achievement||'')}</p>${saved.assetId?`<img src="/api/media/${encodeURIComponent(saved.assetId)}" alt="Saved photograph" style="width:100%;max-height:220px;object-fit:contain">`:''}</section></div><div class="alert">Keeping your changes updates this entry from the current saved revision. Check the photograph as well as the name.</div>`,`<button id="use-saved" class="button secondary">Use saved entry</button><button id="keep-local" class="button">Keep my draft changes</button>`);
    $('#use-saved').onclick=async()=>{state.local.cards[card.id]=cardFromRecipient(saved);await persist();$('#dialog').close();renderCustomer();};
    $('#keep-local').onclick=async()=>{card.serverRevision=saved.revision;card.conflict=false;card.error='';if(!card.photo)card.assetId=saved.assetId;await persist();$('#dialog').close();renderCustomer();};
  }catch(error){setError(error);renderCustomer();}
}

// Staff screens use the same authenticated server and immutable print artifacts.
function renderLogin(){
  $('#app').innerHTML=`${header(true)}<main class="shell"><section class="card login-card"><p class="eyebrow">Staff workspace</p><h1>Good work,<br>ready to print.</h1><p class="muted">Sign in to manage orders, prepare templates and release approved artwork.</p>${notices()}<form id="login-form"><div class="field"><label for="username">Username</label><input id="username" name="username" autocomplete="username" required autofocus></div><div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required></div><button class="button full" type="submit">Sign in</button></form><p class="small muted" style="margin-top:20px">First setup? Create your admin account using the setup command in the README.</p></section></main>${footer()}`;
  $('#login-form').onsubmit=async event=>{event.preventDefault();const button=$('button[type=submit]',event.target);button.disabled=true;try{const result=await api('/api/login',{method:'POST',body:{username:$('#username').value,password:$('#password').value}});state.actor=result.actor||result.user;const session=await api('/api/session');state.actor=session.actor;state.error='';await loadStaff();}catch(error){setError(error);renderLogin();}};
}

async function loadStaff(){
  const [orders,templates]=await Promise.all([api('/api/staff/orders'),api('/api/templates')]);
  state.staffOrders=resource(orders,'orders');state.templates=resource(templates,'templates');renderStaff();
}

function renderStaff(){
  const tabs=[['orders','Orders'],['templates','Templates'],['jobs','Production jobs'],['health','Storage & health']];
  $('#app').innerHTML=`${header(true)}<main class="shell"><div class="staff-layout"><nav class="staff-nav" aria-label="Staff navigation">${tabs.map(([key,label])=>`<button data-staff-tab="${key}" class="${state.staffTab===key?'active':''}">${label}</button>`).join('')}</nav><section class="staff-content">${notices()}<div id="staff-content"></div></section></div></main>${footer()}`;
  if(state.staffOrder)renderStaffOrder();else if(state.staffTab==='templates')renderTemplates();else if(state.staffTab==='jobs')renderJobs();else if(state.staffTab==='health')renderHealth();else renderOrders();
  $$('[data-staff-tab]').forEach(button=>button.onclick=async()=>{state.staffTab=button.dataset.staffTab;state.staffOrder=null;state.error='';state.note='';if(state.staffTab==='health')await refreshHealth();else if(state.staffTab==='jobs')await refreshJobs();else renderStaff();});
  bindGlobal();
}

function renderOrders(){
  const approved=state.staffOrders.filter(o=>o.approvalId).length;
  $('#staff-content').innerHTML=`<div class="staff-heading"><div><h1>Orders</h1></div><button id="new-order" class="button">＋ New order</button></div><div class="metric-grid"><div class="metric-card"><strong>${state.staffOrders.length}</strong><span>Total orders</span></div><div class="metric-card"><strong>${approved}</strong><span>Customer approved</span></div><div class="metric-card"><strong>${state.staffOrders.length-approved}</strong><span>Awaiting approval</span></div><div class="metric-card"><strong>${state.templates.length}</strong><span>Template versions</span></div></div><div class="toolbar"><h2>All orders</h2><button id="refresh-orders" class="button quiet compact">Refresh</button></div>${state.staffOrders.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Order</th><th>Recipients</th><th>Approval</th><th></th></tr></thead><tbody>${state.staffOrders.map(o=>`<tr><td><strong>${esc(o.title)}</strong><small>${esc(o.id.slice(0,8).toUpperCase())} · Revision ${o.revision}</small></td><td>${o.recipientCount??o.count??'—'}</td><td><span class="badge ${o.approvalId?'good':'warn'}">${o.approvalId?'Approved':'In progress'}</span></td><td><button class="button secondary compact" data-order="${esc(o.id)}">Open order</button></td></tr>`).join('')}</tbody></table></div>`:`<div class="empty-state"><h2>No orders yet</h2><p>Create an order and share its private link with the organiser.</p><button id="first-order" class="button copper">Create an order</button></div>`}`;
  $('#new-order').onclick=createOrderDialog;$('#first-order')?.addEventListener('click',createOrderDialog);
  $('#refresh-orders').onclick=async()=>{try{await loadStaff();}catch(error){setError(error);renderStaff();}};
  $$('[data-order]').forEach(button=>button.onclick=()=>openStaffOrder(button.dataset.order));
}

function groupRow(index){return `<div class="group-row" data-group-row><div class="field"><label>Group name</label><input data-group-label value="Group ${index+1}" maxlength="120" required></div><div class="field group-template-field"><label>Template version</label><select data-group-template required aria-label="Model"><option value="" disabled selected>Choose a model</option>${state.templates.map(t=>`<option value="${esc(t.id)}">${esc(t.modelCode||t.name||t.id)} · ${esc(t.name||'')} v${t.version||1}</option>`).join('')}</select></div><div class="field"><label>Expected</label><input type="number" data-group-quantity min="1" max="5000" value="1" required></div><button type="button" class="button quiet" data-remove-group aria-label="Remove group">×</button></div>`;}

function createOrderDialog(){
  dialog('New order', `<form id="create-order-form">
    <div class="field"><label for="order-title">Order name</label><input id="order-title" placeholder="e.g. College awards" maxlength="180" required></div>
    <h3>Model and quantity</h3><div id="order-groups">${groupRow(0)}</div>
    <button type="button" id="add-group" class="text-link">+ Add another model</button>
    <details class="order-wording"><summary>Shared wording (optional)</summary>
      <div class="field"><label for="order-heading">Heading</label><input id="order-heading" maxlength="500"></div>
      <div class="field"><label for="order-event">Event / organisation</label><input id="order-event" maxlength="500"></div>
      <div class="field"><label for="order-date">Date / footer</label><input id="order-date" maxlength="100"></div>
      <p class="small muted" id="fixed-heading-note"></p>
    </details><div id="dialog-error"></div></form>`, `<button class="button secondary" data-close>Cancel</button><button class="button" type="submit" form="create-order-form">Create order</button>`);
  function updateFields(){
    const selected=$$('[data-group-template]').map(select=>state.templates.find(template=>template.id===select.value));
    for(const [key,box] of [['heading','headingBox'],['event','eventBox'],['date','dateBox']]){
      const input=$('#order-'+key);
      const supported=selected.every(template=>template?.components.some(component=>component[box]));
      input.disabled=!supported;
      input.closest('.field').hidden=!supported;
    }
    $('#fixed-heading-note').textContent=selected.map(template=>template?.fixedHeading).filter(Boolean).map(heading=>'Printed in the artwork: '+heading).join(' · ');
  }
  const groupContainer=$('#order-groups');
  groupContainer.onchange=updateFields;
  groupContainer.onclick=event=>{
    const remove=event.target.closest('[data-remove-group]');
    if(remove&&$$('[data-group-row]').length>1){remove.closest('[data-group-row]').remove();updateFields();}
  };
  $('#add-group').onclick=()=>{groupContainer.insertAdjacentHTML('beforeend',groupRow($$('[data-group-row]').length));updateFields();};
  updateFields();
  $('#create-order-form').onsubmit=async event=>{
    event.preventDefault();const button=$('button[form=create-order-form]');button.disabled=true;
    const groups=$$('[data-group-row]').map(row=>({label:$('[data-group-label]',row).value,templateId:$('[data-group-template]',row).value,expectedQuantity:Number($('[data-group-quantity]',row).value)}));
    try{const result=await api('/api/staff/orders',{method:'POST',body:{title:$('#order-title').value,shared:Object.fromEntries(['heading','event','date'].map(key=>{const input=$('#order-'+key);return [key,input.disabled?'':input.value];})),groups}});$('#dialog').close();await openStaffOrder(result.order?.id||result.id);if(result.url)showLink(result.url,'Organiser link');}
    catch(error){$('#dialog-error').innerHTML=`<div class="alert error">${esc(error.message)}</div>`;button.disabled=false;}
  };
}

async function openStaffOrder(id){
  try{const [order,jobs]=await Promise.all([api(`/api/staff/orders/${encodeURIComponent(id)}`),api(`/api/staff/orders/${encodeURIComponent(id)}/print-jobs`)]);state.staffOrder=order;state.printJobs=resource(jobs,'printJobs')?.jobs||resource(jobs,'printJobs');if(!Array.isArray(state.printJobs))state.printJobs=jobs.jobs||[];state.error='';renderStaff();}
  catch(error){setError(error);renderStaff();}
}

function renderStaffOrder(){
  const data=state.staffOrder;const order=data.order;const recipients=data.recipients||[];const groups=data.groups||[];
  const totalCopies=recipients.reduce((sum,r)=>sum+(r.copies||1),0);
  const reviewed=recipients.filter(r=>r.reviewedRevision===r.revision).length;
  const components=recipients.reduce((sum,r)=>{const group=groups.find(g=>g.id===r.groupId);const template=(data.templates||state.templates).find(t=>t.id===group?.templateId);return sum+(r.copies||1)*(template?.components.length||1);},0);
  $('#staff-content').innerHTML=`<button class="button quiet" id="staff-back">← All orders</button><div class="staff-heading" style="margin-top:14px"><div><p class="eyebrow">${esc(order.id.slice(0,8).toUpperCase())} · Revision ${order.revision}</p><h1>${esc(order.title)}</h1><span class="badge ${order.approvalId?'good':'warn'}">${order.approvalId?'Customer approved':'Awaiting customer approval'}</span></div><div class="button-row" style="margin:0"><button id="refresh-order" class="button secondary">Refresh</button>${state.actor?.role==='admin'?`<button id="archive-order" class="button quiet">${order.archivedAt?'Reopen order':'Archive order'}</button>`:''}</div></div><div class="metric-grid"><div class="metric-card"><strong>${recipients.length}</strong><span>Recipients</span></div><div class="metric-card"><strong>${totalCopies}</strong><span>Copies</span></div><div class="metric-card"><strong>${components}</strong><span>Printed pieces</span></div><div class="metric-card"><strong>${reviewed}/${recipients.length}</strong><span>Individually checked</span></div></div><section class="card"><div class="row-space"><h2>Customer access</h2><button id="create-link" class="button secondary compact">Share order link / QR</button></div><p class="small muted">An organiser manages and approves this order. Helpers contribute within one assigned group. Treat links as passwords.</p>${data.links?.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Scope</th><th>Status</th><th></th></tr></thead><tbody>${data.links.map(link=>`<tr><td>${esc(link.role)}${link.groupId?` · ${esc(groups.find(g=>g.id===link.groupId)?.label||link.groupId)}`:''}</td><td>${link.revoked?'Revoked':'Active'}</td><td>${!link.revoked?`<button class="button danger compact" data-revoke="${esc(link.id)}">Revoke</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:''}</section><section class="card" style="margin-top:20px"><div class="row-space"><h2>Models and shared wording</h2><button id="manage-groups" class="button secondary compact">Edit groups</button></div><p class="small">${groups.map(g=>`${esc(g.label)} · ${g.expectedQuantity} expected`).join('<br>')}</p><dl class="shared-summary"><dt>Heading</dt><dd>${esc(order.shared?.heading||'—')}</dd><dt>Event / organisation</dt><dd>${esc(order.shared?.event||'—')}</dd><dt>Date / footer</dt><dd>${esc(order.shared?.date||'—')}</dd></dl></section><section class="card" style="margin-top:20px"><div class="row-space"><h2>Print production</h2><button id="export-order" class="button" ${!order.approvalId?'disabled':''}>Prepare A3 PDF</button></div><p class="small muted">Only immutable, approved artwork can be exported. Production release also requires verified model and printer calibration.</p><div class="artifact-links"><a class="button secondary compact" href="/api/calibration.pdf" target="_blank" rel="noopener">Calibration PDF</a><button id="selected-reprint" class="button secondary compact" ${!order.approvalId?'disabled':''}>Selected-piece reprint</button></div><div id="print-jobs">${printJobMarkup()}</div></section><div class="toolbar" style="margin-top:28px"><h2>Recipient entries</h2></div>${recipients.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Photograph & name</th><th>Group</th><th>Copies</th><th>Review</th><th>Proof</th></tr></thead><tbody>${recipients.map(r=>`<tr><td><div class="inline-controls">${r.assetId?`<img src="/api/media/${encodeURIComponent(r.assetId)}?thumb=1" alt="${esc(r.name)}" width="40" height="48" style="object-fit:cover;border-radius:5px" loading="lazy">`:''}<span><strong>${esc(r.name||'Name needed')}</strong><small>${esc(r.achievement||'')}</small></span></div></td><td>${esc(groups.find(g=>g.id===r.groupId)?.label||'')}</td><td>${r.copies||1}</td><td><span class="badge ${r.reviewedRevision===r.revision?'good':'warn'}">${r.reviewedRevision===r.revision?'Checked':'Needs checking'}</span></td><td>${r.proof?.artworks?.[0]?`<button class="button secondary compact" data-staff-proof="${esc(r.proof.artworks[0].id)}" data-name="${esc(r.name)}">View proof</button>`:'—'}</td></tr>`).join('')}</tbody></table></div>`:`<div class="empty-state"><p>No recipients have been saved to this order yet.</p></div>`}`;
  $('#archive-order')?.addEventListener('click',archiveOrderDialog);$('#staff-back').onclick=async()=>{state.staffOrder=null;await loadStaff();};$('#refresh-order').onclick=()=>openStaffOrder(order.id);$('#create-link').onclick=createLinkDialog;
  $('#manage-groups').onclick=manageGroupsDialog;$('#export-order').onclick=()=>exportDialog();$('#selected-reprint').onclick=()=>exportDialog(true);
  $$('[data-staff-proof]').forEach(button=>button.onclick=()=>enlargeProof(button.dataset.staffProof,button.dataset.name));
  $$('[data-revoke]').forEach(button=>button.onclick=async()=>{try{await api(`/api/staff/links/${encodeURIComponent(button.dataset.revoke)}`,{method:'DELETE'});await openStaffOrder(order.id);}catch(error){setError(error);renderStaff();}});
  bindPrintJobs();
}

function printJobMarkup(){
  return state.printJobs.length?state.printJobs.map(job=>`<div class="job-row"><div class="job-detail"><strong class="small">${esc(job.id.slice(0,8))} · ${job.diagnostic?'Diagnostic export':'Production export'}</strong><small>${esc(job.status||'queued')}${job.superseded?' · Superseded':''} · Revision ${job.revision??'—'}</small>${job.error?`<div class="alert error">${esc(job.error)}</div>`:''}</div><div class="artifact-links">${['generated','completed','ready','released','printed'].includes(job.status)&&!job.superseded?`<a class="button secondary compact" href="/api/print-jobs/${encodeURIComponent(job.id)}/pdf" download>PDF</a><a class="button secondary compact" href="/api/print-jobs/${encodeURIComponent(job.id)}/manifest" download>Manifest</a><a class="button secondary compact" href="/api/print-jobs/${encodeURIComponent(job.id)}/zip" download>Artwork ZIP</a>${!job.diagnostic&&job.status!=='printed'?`<button class="button compact" data-print-action="${job.status==='released'?'printed':'release'}" data-print-id="${esc(job.id)}">${job.status==='released'?'Confirm printed':'Release'}</button>`:''}`:''}</div></div>`).join(''):`<p class="small muted" style="margin-top:18px">No print exports yet.</p>`;
}

function bindPrintJobs(){
  $$('[data-print-action]').forEach(button=>button.onclick=()=>{
    const action=button.dataset.printAction;
    dialog(action==='printed'?'Confirm physical printing':'Release for printing',`<p>${action==='printed'?'Confirm only after the operator has physically printed and counted the sheets. Downloading a PDF does not mean it was printed.':'Check the approved artwork, calibrated size, correct stock and printer profile before releasing this job.'}</p><div id="dialog-error"></div>`,`<button class="button secondary" data-close>Cancel</button><button class="button" id="confirm-print-action">${action==='printed'?'I have printed these sheets':'Release this job'}</button>`);
    $('#confirm-print-action').onclick=async()=>{try{await api(`/api/staff/print-jobs/${encodeURIComponent(button.dataset.printId)}/${action}`,{method:'POST',body:{confirmed:true}});$('#dialog').close();await openStaffOrder(state.staffOrder.order.id);}catch(error){$('#dialog-error').innerHTML=`<div class="alert error">${esc(error.message)}</div>`;}};
  });
}

function createLinkDialog(){
  const data=state.staffOrder;
  dialog('Create a private order link',`<div class="field"><label for="link-role">Access</label><select id="link-role"><option value="organiser">Organiser — manage and approve the order</option><option value="helper">Helper — contribute to one model group</option></select></div><div class="field hidden" id="link-group-field"><label for="link-group">Allowed model group</label><select id="link-group">${data.groups.map(g=>`<option value="${esc(g.id)}">${esc(g.label)}</option>`).join('')}</select></div><div id="dialog-error"></div>`,`<button class="button secondary" data-close>Cancel</button><button class="button" id="generate-link">Create link</button>`);
  $('#link-role').onchange=()=>$('#link-group-field').classList.toggle('hidden',$('#link-role').value!=='helper');
  $('#generate-link').onclick=async()=>{try{const role=$('#link-role').value;const result=await api(`/api/staff/orders/${encodeURIComponent(data.order.id)}/links`,{method:'POST',body:{role,groupId:role==='helper'?$('#link-group').value:null}});showLink(result.url,role==='helper'?'Helper link':'Organiser link');}catch(error){$('#dialog-error').innerHTML=`<div class="alert error">${esc(error.message)}</div>`;}};
}

function manageGroupsDialog(){
  const data=state.staffOrder;
  dialog('Edit model group',`<div class="alert">Changing the template, expected quantity or shared wording invalidates the order approval and requires fresh checks for affected entries.</div><div class="field"><label for="edit-group-id">Group</label><select id="edit-group-id">${data.groups.map(group=>`<option value="${esc(group.id)}">${esc(group.label)}</option>`).join('')}</select></div><div class="grid-2"><div class="field"><label for="edit-group-template">Template version</label><select id="edit-group-template">${state.templates.map(template=>`<option value="${esc(template.id)}">${esc(template.modelCode)} · v${template.version||1}</option>`).join('')}</select></div><div class="field"><label for="edit-group-quantity">Expected recipients</label><input id="edit-group-quantity" type="number" min="1" max="10000"></div></div><label class="check-row"><input id="edit-group-overrides" type="checkbox"><span>Use different shared wording for this group</span></label><div id="group-wording" class="hidden"><div class="field"><label for="group-heading">Heading</label><input id="group-heading" maxlength="500"></div><div class="field"><label for="group-event">Event / organisation</label><input id="group-event" maxlength="500"></div><div class="field"><label for="group-date">Date / footer</label><input id="group-date" maxlength="100"></div></div><div id="dialog-error"></div>`,`<button class="button secondary" data-close>Cancel</button><button id="save-group" class="button">Save group changes</button>`);
  const populate=()=>{const group=data.groups.find(g=>g.id===$('#edit-group-id').value);$('#edit-group-template').value=group.templateId;$('#edit-group-quantity').value=group.expectedQuantity;$('#edit-group-overrides').checked=Object.keys(group.shared||{}).length>0;$('#group-wording').classList.toggle('hidden',!$('#edit-group-overrides').checked);for(const key of ['heading','event','date'])$('#group-'+key).value=group.shared?.[key]??data.order.shared?.[key]??'';};
  populate();$('#edit-group-id').onchange=populate;$('#edit-group-overrides').onchange=()=>$('#group-wording').classList.toggle('hidden',!$('#edit-group-overrides').checked);
  $('#save-group').onclick=async()=>{const button=$('#save-group');button.disabled=true;try{const body={expectedRevision:data.order.revision,templateId:$('#edit-group-template').value,expectedQuantity:Number($('#edit-group-quantity').value),shared:$('#edit-group-overrides').checked?{heading:$('#group-heading').value,event:$('#group-event').value,date:$('#group-date').value}:null};await api(`/api/staff/orders/${encodeURIComponent(data.order.id)}/groups/${encodeURIComponent($('#edit-group-id').value)}`,{method:'PATCH',body});$('#dialog').close();await openStaffOrder(data.order.id);}catch(error){$('#dialog-error').innerHTML=`<div class="alert error">${esc(error.message)}</div>`;button.disabled=false;}};
}

function archiveOrderDialog(){
  const order=state.staffOrder.order,archived=!order.archivedAt;
  dialog(archived?'Archive this order':'Reopen this order',`<p>${archived?'Archiving closes customer access and revokes existing private links. It does not immediately delete the order. The configured retention policy applies later.':'Reopening allows production work again. Previously revoked customer links remain revoked; create a new link if the customer needs access.'}</p><div id="dialog-error"></div>`,`<button class="button secondary" data-close>Cancel</button><button id="confirm-archive" class="button">${archived?'Archive order':'Reopen order'}</button>`);
  $('#confirm-archive').onclick=async()=>{const button=$('#confirm-archive');button.disabled=true;try{await api(`/api/staff/orders/${encodeURIComponent(order.id)}/archive`,{method:'POST',body:{expectedRevision:order.revision,archived}});$('#dialog').close();await openStaffOrder(order.id);}catch(error){$('#dialog-error').innerHTML=`<div class="alert error">${esc(error.message)}</div>`;button.disabled=false;}};
}

async function printerCalibrationDialog(){
  let profile={orientation:'portrait',marginMm:10,gapMm:3};
  try{const profiles=await api('/api/staff/profiles');profile={...profile,...(profiles.find(p=>p.id==='a3-default')||{})};}catch(error){setError(error);renderStaff();return;}
  dialog('Calibrate A3 printer profile',`<p>Print the calibration sheet at <strong>100% / Actual Size</strong>. Measure its 100 mm ruler with a physical ruler. Use the same settings for production exports.</p><a class="button secondary" href="/api/calibration.pdf" target="_blank" rel="noopener">Calibration PDF</a><div class="grid-2" style="margin-top:20px"><div class="field"><label for="profile-orientation">Orientation</label><select id="profile-orientation"><option value="portrait" ${profile.orientation==='portrait'?'selected':''}>Portrait</option><option value="landscape" ${profile.orientation==='landscape'?'selected':''}>Landscape</option></select></div><div class="field"><label for="profile-margin">Printer margin (mm)</label><input id="profile-margin" type="number" min="5" max="30" step=".1" value="${profile.marginMm}"></div></div><div class="grid-2"><div class="field"><label for="profile-gap">Cutting gap (mm)</label><input id="profile-gap" type="number" min="1" max="20" step=".1" value="${profile.gapMm}"></div><div class="field"><label for="profile-measured">Measured 100 mm ruler (mm)</label><input id="profile-measured" type="number" min="1" step=".01" placeholder="Enter physical measurement"></div></div><div class="field"><label for="profile-notes">Printer and media notes</label><textarea id="profile-notes" placeholder="Record printer, driver, paper and Actual Size setting."></textarea></div><label class="check-row"><input id="profile-confirm" type="checkbox"><span>I physically printed and measured the calibration sheet using these settings.</span></label><div id="dialog-error"></div>`,`<button class="button secondary" data-close>Cancel</button><button id="save-profile-calibration" class="button" disabled>Record printer calibration</button>`);
  $('#profile-confirm').onchange=event=>$('#save-profile-calibration').disabled=!event.target.checked;
  $('#save-profile-calibration').onclick=async()=>{const button=$('#save-profile-calibration');button.disabled=true;try{await api('/api/staff/profiles/a3-default/calibrate',{method:'POST',body:{confirmed:true,notes:$('#profile-notes').value,measured100Mm:Number($('#profile-measured').value),profile:{id:'a3-default',orientation:$('#profile-orientation').value,marginMm:Number($('#profile-margin').value),gapMm:Number($('#profile-gap').value),media:'photo-paper'}}});$('#dialog').close();state.note='Printer calibration recorded. Model fit must also be calibrated before production export.';renderStaff();}catch(error){$('#dialog-error').innerHTML=`<div class="alert error">${esc(error.message)}</div>`;button.disabled=false;}};
}

async function showLink(url,title){
  if(!url){setError(new Error('The server did not return an access link.'));renderStaff();return;}
  const hostname=new URL(url).hostname;
  const loopback=hostname==='localhost'||hostname==='[::1]'||hostname.startsWith('127.');
  const shopWifi=/^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(hostname);
  const hint=loopback?'This address works only on this PC. To share with a phone, start the shop Wi-Fi launcher and create a link there.':
    shopWifi?'Connect the customer’s phone to the shop Wi-Fi, then scan with its camera.':
    'Ask the customer to scan with their phone camera. Share only with the intended customer.';
  const node=dialog(title,`<p>${hint}</p><div id="qr-area" aria-live="polite" style="text-align:center">Preparing QR code…</div><div class="link-output" id="access-url">${esc(url)}</div><div id="copy-result" role="status"></div>`,`<button class="button secondary" id="copy-link">Copy link</button>${navigator.share?'<button class="button" id="share-link">Share link</button>':''}<button class="button secondary" data-close>Done</button>`);
  $('#copy-link').onclick=async()=>{try{await navigator.clipboard.writeText(url);$('#copy-result').textContent='Link copied.';}catch{const range=document.createRange();range.selectNodeContents($('#access-url'));const selection=getSelection();selection.removeAllRanges();selection.addRange(range);$('#copy-result').textContent='Select and copy the highlighted link.';}};
  const share=node.querySelector('#share-link');
  if(share)share.onclick=async()=>{try{await navigator.share({title:'Your Trichur Trophies order',url});}catch(error){if(error.name!=='AbortError')node.querySelector('#copy-result').textContent='Use Copy link to share this order.';}};
  const area=node.querySelector('#qr-area');
  try{
    const result=await api('/api/staff/order-qr',{method:'POST',body:{url}});
    const image=new Image();
    image.id='order-qr';
    image.alt='QR code for this private order';
    image.width=image.height=260;
    image.style.cssText='width:min(100%,260px);height:auto;image-rendering:pixelated';
    image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(result.svg);
    area.replaceChildren(image);
  }catch(error){area.textContent='QR unavailable. '+error.message+' You can still copy the link.';}
}

function exportDialog(selected=false){
  const data=state.staffOrder;
  dialog(selected?'Reprint selected pieces':'Prepare approved A3 artwork',`<p class="small muted">Paper size is exactly 297 × 420 mm. Inserts are never scaled down to fit.</p><div class="grid-2"><div class="field"><label for="orientation">Orientation</label><select id="orientation"><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></div><div class="field"><label for="margin">Printer margins (mm)</label><input id="margin" type="number" min="5" max="30" step=".1" value="10"></div></div><div class="field"><label for="gap">Cutting gap (mm)</label><input id="gap" type="number" min="1" max="20" step=".1" value="3"></div><label class="check-row"><input id="diagnostic" type="checkbox"><span>Diagnostic export for uncalibrated demonstration templates. This cannot be released as a production job.</span></label>${selected?`<hr class="section-separator"><div class="field"><label for="reprint-recipient">Recipient</label><select id="reprint-recipient">${data.recipients.map(r=>`<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('')}</select></div><div class="grid-2"><div class="field"><label for="reprint-copy">Copy number</label><input id="reprint-copy" type="number" min="1" value="1"></div><div class="field"><label for="reprint-component">Component ID</label><input id="reprint-component" value="front" required></div></div><p class="small muted">Choose the exact component from the placement manifest (for example front or base).</p>`:''}<div id="dialog-error"></div>`,`<button class="button secondary" data-close>Cancel</button><button class="button" id="start-export">Queue export</button>`);
  $('#start-export').onclick=async()=>{
    $('#start-export').disabled=true;
    try{
      const body={diagnostic:$('#diagnostic').checked,profile:{id:'a3-default',orientation:$('#orientation').value,marginMm:Number($('#margin').value),gapMm:Number($('#gap').value)}};
      if(selected)body.selection=[{recipientId:$('#reprint-recipient').value,copyNumber:Number($('#reprint-copy').value),componentId:$('#reprint-component').value}];
      const response=await api(`/api/staff/orders/${encodeURIComponent(data.order.id)}/export`,{method:'POST',body});
      $('#dialog').close();state.note='Export queued. The worker will publish the complete PDF and manifest together.';await openStaffOrder(data.order.id);
      const jobId=response.job?.id||response.jobId||response.id;
      if(jobId){await pollJob(jobId);await openStaffOrder(data.order.id);}
    }catch(error){if($('#dialog')?.open){$('#dialog-error').innerHTML=`<div class="alert error">${esc(error.message)}</div>`;$('#start-export').disabled=false;}else{setError(error);renderStaff();}}
  };
}

function renderTemplates(){
  $('#staff-content').innerHTML=`<div class="staff-heading"><div><p class="eyebrow">Design library</p><h1>Fixed design. Personal detail.</h1><p class="small muted">Published versions stay unchanged for existing orders.</p></div>${state.actor?.role==='admin'||state.actor?.role==='owner'?`<button id="new-template" class="button">＋ New version</button>`:''}</div><div class="button-row" style="margin-bottom:20px"><button id="printer-calibration" class="button secondary">Calibrate printer profile</button><a class="button quiet" href="/api/calibration.pdf" target="_blank" rel="noopener">Calibration PDF</a></div><div class="alert info">Reference canvas dimensions are not confirmed physical cut sizes. Prepare clean masters and verify actual printed fit before production use.</div><div class="template-grid">${state.templates.map(template=>`<article class="template-card"><div class="template-mini"><img src="/api/templates/${encodeURIComponent(template.id)}/thumbnail" alt="${esc(template.modelCode)} template geometry preview" loading="lazy"></div><p class="eyebrow">${esc(template.modelCode||'Model')} · Version ${template.version||1}</p><h2>${esc(template.name||template.modelCode)}</h2><p class="small muted">${template.components.map(c=>`${esc(c.id)}: ${Number(c.widthMm).toFixed(2)} × ${Number(c.heightMm).toFixed(2)} mm`).join('<br>')}</p><span class="badge ${template.calibrated?'good':'warn'}">${template.calibrated?'Calibrated':'Physical calibration required'}</span>${template.synthetic||template.demo?` <span class="badge">Synthetic demonstration</span>`:''}<div class="button-row"><button class="button secondary compact" data-template-detail="${esc(template.id)}">View geometry</button>${state.actor?.role==='admin'||state.actor?.role==='owner'?`<button class="button quiet compact" data-template-clone="${esc(template.id)}">New version</button><button class="button quiet compact" data-calibrate="${esc(template.id)}">Calibrate</button>`:''}</div></article>`).join('')}</div>`;
  $('#printer-calibration').onclick=printerCalibrationDialog;$('#new-template')?.addEventListener('click',()=>templateDialog());
  $$('[data-template-clone]').forEach(button=>button.onclick=()=>templateDialog(state.templates.find(t=>t.id===button.dataset.templateClone)));
  $$('[data-template-detail]').forEach(button=>button.onclick=()=>{const template=state.templates.find(t=>t.id===button.dataset.templateDetail);dialog(esc(template.name||template.modelCode),`<pre style="white-space:pre-wrap;overflow-wrap:anywhere;font-size:.75rem">${esc(JSON.stringify(template,null,2))}</pre>`);});
  $$('[data-calibrate]').forEach(button=>button.onclick=()=>calibrationDialog(state.templates.find(t=>t.id===button.dataset.calibrate)));
}

function templateDialog(existing){
  const source=existing?structuredClone(existing):{modelCode:'NEW-MODEL',name:'New insert',version:1,synthetic:false,calibrated:false,components:[{id:'front',name:'Front',widthMm:85,heightMm:156,media:'photo-paper',allowRotation:true,bleedMm:0,safeZoneMm:3,photo:{x:20,y:42,width:45,height:55,shape:'circle'},nameBox:{x:8,y:110,width:69,height:17,minFontMm:3,maxFontMm:5}}]};
  delete source.id;delete source.createdAt;delete source.calibrations;source.calibrated=false;source.version=(existing?.version||0)+1;
  dialog(existing?'Create a new immutable version':'Set up a template',`<p class="small muted">Enter geometry in millimetres. Changes produce a new immutable version; existing orders retain their previous design.</p><div class="grid-2"><div class="field"><label for="template-model">Model code</label><input id="template-model" value="${esc(source.modelCode)}"></div><div class="field"><label for="template-name">Template name</label><input id="template-name" value="${esc(source.name)}"></div></div><div class="field"><label for="template-component">Component</label><select id="template-component">${source.components.map((c,i)=>`<option value="${i}">${esc(c.name||c.id)}</option>`).join('')}</select></div><div id="numeric-template-fields"></div><details><summary class="count-label">Advanced component and field JSON</summary><div class="field" style="margin-top:14px"><label for="template-geometry">Template definition</label><textarea class="code-input" id="template-geometry" spellcheck="false">${esc(JSON.stringify(source,null,2))}</textarea><span class="field-hint">Use this for additional components or advanced field options. Numeric edits update the same definition.</span><button class="button secondary compact" id="apply-template-json">Load JSON into numeric fields</button></div></details><div class="alert">Use clean prepared assets with old recipient names and photos removed. PNG is required for transparent foreground decoration. Physical fit remains unverified until calibration.</div><div id="dialog-error"></div>`,`<button class="button secondary" data-close>Cancel</button><button class="button" id="save-template">Publish new version</button>`);
  const read=()=>{const definition=JSON.parse($('#template-geometry').value);if(!Array.isArray(definition.components)||!definition.components.length)throw new Error('Add at least one component.');return definition;};
  const errorMessage=error=>{$('#dialog-error').innerHTML=`<div class="alert error">${esc(error.message)}</div>`;};
  const renderNumeric=()=>{
    try{
      const definition=read();let index=Number($('#template-component').value)||0;if(!definition.components[index])index=0;
      const c=definition.components[index];
      $('#template-component').innerHTML=definition.components.map((item,i)=>`<option value="${i}" ${i===index?'selected':''}>${esc(item.name||item.id)}</option>`).join('');
      const number=(key,label,value,min=0,max=1000)=>`<div class="field"><label for="numeric-${key}">${label}</label><input id="numeric-${key}" data-number="${key}" type="number" min="${min}" max="${max}" step=".01" value="${Number(value)||0}"></div>`;
      const boxes=[['photo','Photograph'],['nameBox','Recipient name'],['headingBox','Common heading'],['achievementBox','Achievement'],['eventBox','Event'],['dateBox','Date'],['logoBox','Organisation logo']];
      $('#numeric-template-fields').innerHTML=`<div class="grid-2">${number('widthMm','Width (mm)',c.widthMm,5,500)}${number('heightMm','Height (mm)',c.heightMm,5,500)}${number('bleedMm','Bleed footprint (mm)',c.bleedMm||0,0,20)}${number('safeZoneMm','Safe inset (mm)',c.safeZoneMm||3,0,50)}</div><label class="check-row"><input id="numeric-rotation" type="checkbox" ${c.allowRotation?'checked':''}><span>Allow 90° rotation during sheet packing</span></label>${boxes.map(([key,label])=>`<details class="crop-controls" ${key==='photo'||key==='nameBox'?'open':''}><summary>${label} geometry</summary>${!['photo','nameBox'].includes(key)?`<label class="check-row"><input type="checkbox" data-box-toggle="${key}" ${c[key]?'checked':''}><span>Include ${label.toLowerCase()}</span></label>`:''}<div class="grid-2">${number(`${key}.x`,'Left (mm)',c[key]?.x||0)}${number(`${key}.y`,'Top (mm)',c[key]?.y||0)}${number(`${key}.width`,'Width (mm)',c[key]?.width||c.widthMm*.8,.1)}${number(`${key}.height`,'Height (mm)',c[key]?.height||10,.1)}${!['photo','logoBox'].includes(key)?`${number(`${key}.minFontMm`,'Minimum font (mm)',c[key]?.minFontMm||2.5,1,20)}${number(`${key}.maxFontMm`,'Maximum font (mm)',c[key]?.maxFontMm||5,1,30)}`:''}</div>${key==='photo'?`<div class="field"><label for="numeric-shape">Photo shape</label><select id="numeric-shape"><option value="circle" ${c.photo?.shape==='circle'?'selected':''}>Circle / oval</option><option value="rect" ${c.photo?.shape==='rect'?'selected':''}>Rectangle</option><option value="rounded" ${c.photo?.shape==='rounded'?'selected':''}>Rounded rectangle</option></select></div>`:''}</details>`).join('')}<h3 style="margin-top:22px">Prepared artwork layers</h3>${['background','foreground'].map(layer=>`<div class="field"><label for="${layer}-asset">${layer==='background'?'Fixed background':'Transparent foreground'} image</label><input type="file" id="${layer}-asset" accept="image/png,image/jpeg,image/webp"><span class="field-hint" id="${layer}-asset-state">${c[layer+'Path']?'Existing prepared layer is retained.':'No prepared layer selected.'}</span><button type="button" class="text-link" data-remove-layer="${layer}">Remove ${layer} layer</button></div>`).join('')}`;
      const change=(key,value)=>{try{const latest=read(),part=latest.components[index];if(key.includes('.')){const [box,field]=key.split('.');part[box]={...(part[box]||{x:0,y:0,width:Math.min(part.widthMm,20),height:10}),[field]:value};}else part[key]=value;$('#template-geometry').value=JSON.stringify(latest,null,2);$('#dialog-error').innerHTML='';}catch(error){errorMessage(error);}};
      $$('[data-number]').forEach(input=>input.onchange=()=>change(input.dataset.number,Number(input.value)));
      $('#numeric-rotation').onchange=event=>change('allowRotation',event.target.checked);
      $('#numeric-shape').onchange=event=>change('photo.shape',event.target.value);
      $$('[data-box-toggle]').forEach(input=>input.onchange=()=>{try{const latest=read(),part=latest.components[index],key=input.dataset.boxToggle;if(input.checked){part[key]={x:0,y:0,width:part.widthMm*.8,height:10,minFontMm:2.5,maxFontMm:5};}else delete part[key];$('#template-geometry').value=JSON.stringify(latest,null,2);renderNumeric();}catch(error){errorMessage(error);}});
      for(const layer of ['background','foreground'])$('#'+layer+'-asset').onchange=async event=>{const file=event.target.files[0];if(!file)return;const status=$('#'+layer+'-asset-state');status.textContent='Uploading prepared layer…';$('#save-template').disabled=true;try{const uploaded=await api('/api/staff/template-assets',{method:'POST',raw:true,body:file,headers:{'content-type':file.type,'x-file-name':encodeURIComponent(file.name)}});change(layer+'Path',uploaded.path);status.textContent=`Prepared layer uploaded: ${file.name}`;}catch(error){status.textContent='Upload failed; previous layer retained.';errorMessage(error);}finally{$('#save-template').disabled=false;}};
      $$('[data-remove-layer]').forEach(button=>button.onclick=()=>{try{const latest=read();delete latest.components[index][button.dataset.removeLayer+'Path'];$('#template-geometry').value=JSON.stringify(latest,null,2);renderNumeric();}catch(error){errorMessage(error);}});
    }catch(error){errorMessage(error);}
  };
  renderNumeric();$('#template-component').onchange=renderNumeric;$('#apply-template-json').onclick=renderNumeric;
  $('#save-template').onclick=async()=>{const button=$('#save-template');button.disabled=true;try{const body=read();body.modelCode=$('#template-model').value;body.name=$('#template-name').value;body.calibrated=false;await api('/api/staff/templates',{method:'POST',body});$('#dialog').close();state.templates=resource(await api('/api/templates'),'templates');renderStaff();}catch(error){errorMessage(error);button.disabled=false;}};
}

function calibrationDialog(template){
  const component=template.components[0];
  dialog(`Calibrate ${esc(template.modelCode)}`,`<p>Print the calibration PDF at <strong>100% / Actual Size</strong> with fit-to-page disabled. Measure the ruler, then print and measure the insert and check its real cut fit.</p><a class="button secondary" href="/api/calibration.pdf" target="_blank" rel="noopener">Download calibration PDF</a><div class="grid-2" style="margin-top:20px"><div class="field"><label for="measured-width">Measured ${esc(component.id)} width (mm)</label><input id="measured-width" type="number" step=".01" min="1" placeholder="${component.widthMm}"></div><div class="field"><label for="measured-height">Measured height (mm)</label><input id="measured-height" type="number" step=".01" min="1" placeholder="${component.heightMm}"></div></div><div class="field"><label for="calibration-notes">Printer / media / checks</label><textarea id="calibration-notes" placeholder="Record printer model, driver settings, stock and physical fit checks."></textarea></div><label class="check-row"><input id="calibration-confirm" type="checkbox"><span>I physically printed, measured and checked this model and printer profile. For paired components I checked both pieces.</span></label><div id="dialog-error"></div>`,`<button class="button secondary" data-close>Cancel</button><button id="save-calibration" class="button" disabled>Record physical calibration</button>`);
  $('#calibration-confirm').onchange=event=>$('#save-calibration').disabled=!event.target.checked;
  $('#save-calibration').onclick=async()=>{try{await api(`/api/staff/templates/${encodeURIComponent(template.id)}/calibrate`,{method:'POST',body:{profileId:'a3-default',confirmed:true,notes:$('#calibration-notes').value,measuredWidthMm:Number($('#measured-width').value),measuredHeightMm:Number($('#measured-height').value)}});$('#dialog').close();state.templates=resource(await api('/api/templates'),'templates');renderStaff();}catch(error){$('#dialog-error').innerHTML=`<div class="alert error">${esc(error.message)}</div>`;}};
}

async function refreshJobs(){try{const response=await api('/api/staff/jobs');state.jobs=resource(response,'jobs');}catch(error){setError(error);}renderStaff();}
function renderJobs(){
  $('#staff-content').innerHTML=`<div class="staff-heading"><div><p class="eyebrow">Background work</p><h1>Production jobs</h1><p class="small muted">Proofs and exports continue on the server after customers close their browsers.</p></div><button id="refresh-jobs" class="button secondary">Refresh</button></div><section class="card">${state.jobs.length?state.jobs.map(job=>`<div class="job-row"><div class="job-detail"><strong>${esc(job.type||job.kind||'Job')}</strong><small>${esc(job.id)} · ${esc(job.status)} · ${job.attempts||0} attempts</small>${job.progress!==undefined?`<progress max="100" value="${Number(job.progress)||0}"></progress>`:''}${job.error?`<div class="alert error">${esc(job.error)}</div>`:''}</div><div class="button-row">${job.status==='failed'?`<button class="button secondary compact" data-job-action="retry" data-job-id="${esc(job.id)}">Retry</button>`:''}${['queued','running','pending'].includes(job.status)?`<button class="button secondary compact" data-job-action="cancel" data-job-id="${esc(job.id)}">Cancel</button>`:''}</div></div>`).join(''):'<p class="muted">No background jobs yet.</p>'}</section>`;
  $('#refresh-jobs').onclick=refreshJobs;
  $$('[data-job-action]').forEach(button=>button.onclick=async()=>{try{await api(`/api/jobs/${encodeURIComponent(button.dataset.jobId)}/${button.dataset.jobAction}`,{method:'POST',body:{}});await refreshJobs();}catch(error){setError(error);renderStaff();}});
}

async function refreshHealth(){try{state.health=await api('/api/staff/health');}catch(error){setError(error);}renderStaff();}
function renderHealth(){
  const health=state.health;
  $('#staff-content').innerHTML=`<div class="staff-heading"><div><p class="eyebrow">Operations</p><h1>Storage & health</h1></div><button id="refresh-health" class="button secondary">Refresh</button></div><section class="card">${health?`<dl class="shared-summary">${Object.entries(health).map(([key,value])=>`<dt>${esc(key.replace(/([A-Z])/g,' $1'))}</dt><dd>${esc(typeof value==='object'?JSON.stringify(value):value)}</dd>`).join('')}</dl>`:'<p class="muted">Load current server health.</p>'}<hr class="section-separator"><h2>Backup before changing the server</h2><p class="small muted">Use the coordinated database-and-files backup scripts in BACKUP_RESTORE.md. Keep a copy on a separate device and test a restore. Deleting unsynced phone drafts cannot be undone by a server backup.</p></section>`;
  $('#refresh-health').onclick=refreshHealth;
}

async function init(){
  document.documentElement.lang=state.lang;
  try{
    const session=await api('/api/session');state.actor=session.actor||null;
    const token=location.pathname.startsWith('/o')?decodeURIComponent(location.hash.slice(1)):'';
    if(token){const access=await api('/api/access',{method:'POST',body:{token}});state.actor=access.actor||(await api('/api/session')).actor;history.replaceState({},'',location.pathname);}
    if(location.pathname.startsWith('/staff')){if(!state.actor||!['admin','owner','production','staff'].includes(state.actor.role))renderLogin();else await loadStaff();}
    else await loadCustomer();
  }catch(error){
    if(!location.pathname.startsWith('/staff')&&!location.hash&&!error.status){
      try{
        const key=readLocal('tt-last-order-key');
        if(key){const cached=await loadDrafts(key);if(cached.orderCache){state.key=key;state.local=cached;state.data=cached.orderCache;state.view=cached.view||'list';if(state.view==='entry'&&!currentCard())state.view='list';state.note=state.lang==='ml'?'ഈ ഫോണിലെ ഡ്രാഫ്റ്റ് തുറന്നു. ഓർഡറിൽ സേവ് ചെയ്യാനും പ്രൂഫ് പരിശോധിക്കാനും വീണ്ടും ബന്ധിപ്പിക്കുക.':'Opened the draft saved on this phone. Reconnect to save to the order or review proofs. Saved photographs may need a connection.';renderCustomer();return;}}
      }catch{}
    }
    state.error=error.message;
    if(location.pathname.startsWith('/staff'))renderLogin();
    else $('#app').innerHTML=`${header()}<main class="shell"><section class="card login-card"><p class="eyebrow">Your private order</p><h1>Let’s find your order.</h1><div class="alert error">${esc(error.message)}</div><p class="muted">Open the private link shared by Trichur Trophies. If it expired or was revoked, ask the shop for a new link.</p><button class="button secondary" id="reload">Try again</button><p class="small muted" style="margin-top:22px">Staff can <a href="/staff">sign in here</a>.</p></section></main>${footer()}`;
    $('#reload')?.addEventListener('click',()=>location.reload());bindGlobal();
  }
}

async function setupOfflineShell(){
  if(!window.isSecureContext||!('serviceWorker' in navigator))return;
  try{
    const registration=await navigator.serviceWorker.register('/sw.js',{scope:'/'});state.swRegistration=registration;
    const showUpdate=()=>{if(!registration.waiting)return;state.updateAvailable=true;const actions=$('.header-actions');if(actions&&!$('#update-app')){actions.insertAdjacentHTML('afterbegin',`<button id="update-app" class="button secondary compact">${state.lang==='ml'?'ആപ്പ് പുതുക്കുക':'Update app'}</button>`);bindGlobal();}};
    showUpdate();registration.addEventListener('updatefound',()=>{registration.installing?.addEventListener('statechange',showUpdate);});
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(state.updateRequested)location.reload();});
  }catch{/* An unavailable cache never blocks online entry or deletes phone drafts. */}
}

window.addEventListener('online',()=>{if(state.data){clearOfflineDraftErrors();persist();state.note=state.lang==='ml'?'ഇന്റർനെറ്റ് ബന്ധം തിരിച്ചെത്തി. ഫോണിലെ ഡ്രാഫ്റ്റുകൾ ഓർഡറിൽ സേവ് ചെയ്യുക.':'Connection restored. Save any phone drafts to your order.';renderCustomer();}});
window.addEventListener('offline',()=>{if(state.data)renderCustomer();});
window.addEventListener('pagehide',()=>{persist();});
window.addEventListener('hashchange',async()=>{
  if(!location.pathname.startsWith('/o')||!location.hash)return;
  await persist();
  if(state.storageError&&Object.values(state.local.cards).some(card=>card.edited)){
    history.replaceState({},'',location.pathname);setError(new Error('Save your current draft to the order before opening another link. Phone storage is unavailable.'));if(state.data)renderCustomer();return;
  }
  location.reload();
});
window.addEventListener('resize',()=>{placeEntryPreview();updateCropPreview();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')persist();});
window.addEventListener('beforeunload',event=>{if(state.storageError&&Object.values(state.local.cards).some(c=>c.edited)){event.preventDefault();event.returnValue='';}});
init().finally(setupOfflineShell);

