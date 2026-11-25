// Installation is optional. This module neither reads drafts nor stores order credentials.
export function installationCapabilities(environment={}) {
  const nav=environment.navigator||globalThis.navigator||{};
  const standalone=Boolean(environment.standalone ?? (nav.standalone || globalThis.matchMedia?.('(display-mode: standalone)').matches));
  const secure=Boolean(environment.secure ?? globalThis.isSecureContext);
  const userAgent=String(environment.userAgent ?? nav.userAgent ?? '');
  const touchPoints=Number(environment.maxTouchPoints ?? nav.maxTouchPoints ?? 0);
  const ios=/iPhone|iPad|iPod/i.test(userAgent)||(/Macintosh/i.test(userAgent)&&touchPoints>1);
  return {secure,standalone,ios,android:/Android/i.test(userAgent),canUseServiceWorker:secure&&('serviceWorker' in nav)};
}

export function validateOrderLink(value,origin) {
  let url;
  try{url=new URL(String(value).trim(),origin);}catch{throw new Error('invalid-link');}
  if(url.origin!==origin||url.pathname!=='/o'||url.search||url.username||url.password)throw new Error('wrong-shop-link');
  const token=url.hash.slice(1);
  if(!/^[a-zA-Z0-9_-]{24,256}$/.test(token))throw new Error('invalid-link');
  return '/o#'+token;
}

export function openOrderLink(value,{location:currentLocation=globalThis.location,history:currentHistory=globalThis.history}={}) {
  const target=validateOrderLink(value,currentLocation.origin);
  if(currentLocation.pathname==='/o'){
    // A fragment-only navigation does not re-run app initialisation. Put the new
    // credential in this history entry, then reload so the normal access exchange
    // consumes it and removes the fragment. Never persist it in browser storage.
    currentHistory.replaceState(null,'',target);
    currentLocation.reload();
  }else currentLocation.assign(target);
}

const copy={
  en:{
    panel:'App and order help',install:'Add to Home Screen',installed:'Added to your Home Screen',open:'Open an order link',
    optional:'Optional. You can keep using this website in your browser.',
    ios:'On iPhone or iPad, open this page in Safari. Tap Share, then Add to Home Screen. If shown, leave Open as Web App enabled and tap Add.',
    android:'On Android, open this page in Chrome. Open the browser menu, then choose Install app or Add to Home screen. The wording depends on your browser.',
    desktop:'In a supported browser, use the install icon in the address bar or the browser menu. If installation is unavailable, you can keep using this website.',
    insecure:'Adding this app needs the shop’s secure HTTPS address. This test address cannot provide the installed app experience. You can still use the order page in this browser while connected.',
    offline:'Phone drafts may be available offline. Uploading, checking proofs and approving an order need a connection to the shop server.',
    installedHelp:'Open the app from your Home Screen. If your session expires or the app opens without an order, open your private order link again or paste it below.',
    reentry:'Paste the private link the shop sent you. This opens that order; it does not create a new one. Keep the link private.',
    label:'Private order link',placeholder:'Paste your order link here',continue:'Open this order',close:'Close',
    prompt:'Install app',promptDismissed:'Installation was cancelled. You can install later or keep using this page.',
    promptAccepted:'Your browser accepted the request. Follow its installation instructions.',
    invalid:'Paste the complete private order link, including the part after #.',wrongShop:'Use the private order link for this shop address. Open a link for a different shop address directly in your browser.',
    failure:'The browser could not open installation. Use its menu, or keep using this page.',
  },
  ml:{
    panel:'ആപ്പും ഓർഡറും',install:'ഹോം സ്ക്രീനിൽ ചേർക്കുക',installed:'ഹോം സ്ക്രീനിൽ ചേർത്തിട്ടുണ്ട്',open:'ഓർഡർ ലിങ്ക് തുറക്കുക',
    optional:'ഇത് നിർബന്ധമല്ല. ബ്രൗസറിൽ തന്നെ ഈ വെബ്സൈറ്റ് ഉപയോഗിക്കാം.',
    ios:'iPhone അല്ലെങ്കിൽ iPad-ൽ ഈ പേജ് Safari-യിൽ തുറക്കുക. Share അമർത്തി Add to Home Screen തിരഞ്ഞെടുക്കുക. Open as Web App കാണുന്നുവെങ്കിൽ അത് ഓൺ ആക്കി Add അമർത്തുക.',
    android:'Android-ൽ ഈ പേജ് Chrome-ൽ തുറക്കുക. ബ്രൗസർ മെനുവിൽ Install app അല്ലെങ്കിൽ Add to Home screen തിരഞ്ഞെടുക്കുക. ബ്രൗസർ അനുസരിച്ച് പേര് മാറാം.',
    desktop:'ബ്രൗസറിലെ ഇൻസ്റ്റാൾ ചിഹ്നമോ മെനുവോ ഉപയോഗിക്കുക. ഈ സൗകര്യം ഇല്ലെങ്കിലും വെബ്സൈറ്റ് ഉപയോഗിക്കാം.',
    insecure:'ആപ്പ് ചേർക്കാൻ കടയുടെ സുരക്ഷിത HTTPS വിലാസം ആവശ്യമാണ്. ഈ ടെസ്റ്റ് വിലാസത്തിൽ ഇൻസ്റ്റാൾ സൗകര്യം ലഭ്യമല്ല. കണക്ഷൻ ഉള്ളപ്പോൾ ഓർഡർ പേജ് ബ്രൗസറിൽ ഉപയോഗിക്കാം.',
    offline:'ഈ ഫോണിൽ സൂക്ഷിച്ച ഡ്രാഫ്റ്റുകൾ ഓഫ്‌ലൈനിൽ ലഭ്യമായേക്കാം. ഫോട്ടോ അയയ്ക്കാനും പ്രൂഫ് പരിശോധിക്കാനും അംഗീകരിക്കാനും കടയുടെ സർവറുമായി കണക്ഷൻ വേണം.',
    installedHelp:'ഹോം സ്ക്രീനിൽ നിന്ന് ആപ്പ് തുറക്കാം. ഓർഡർ കാണുന്നില്ലെങ്കിൽ കട അയച്ച സ്വകാര്യ ലിങ്ക് വീണ്ടും തുറക്കുക, അല്ലെങ്കിൽ താഴെ പേസ്റ്റ് ചെയ്യുക.',
    reentry:'കട അയച്ച സ്വകാര്യ ലിങ്ക് പേസ്റ്റ് ചെയ്യുക. നിലവിലുള്ള ഓർഡർ തുറക്കും; പുതിയ ഓർഡർ ഉണ്ടാക്കില്ല. ലിങ്ക് രഹസ്യമായി സൂക്ഷിക്കുക.',
    label:'സ്വകാര്യ ഓർഡർ ലിങ്ക്',placeholder:'ഓർഡർ ലിങ്ക് ഇവിടെ പേസ്റ്റ് ചെയ്യുക',continue:'ഈ ഓർഡർ തുറക്കുക',close:'അടയ്ക്കുക',
    prompt:'ആപ്പ് ഇൻസ്റ്റാൾ ചെയ്യുക',promptDismissed:'ഇൻസ്റ്റാൾ റദ്ദാക്കി. പിന്നീട് ഇൻസ്റ്റാൾ ചെയ്യാം; ഈ പേജ് തുടർന്നും ഉപയോഗിക്കാം.',
    promptAccepted:'ബ്രൗസർ അഭ്യർത്ഥന സ്വീകരിച്ചു. അതിലെ ഇൻസ്റ്റാൾ നിർദ്ദേശങ്ങൾ പാലിക്കുക.',
    invalid:'#-ന് ശേഷമുള്ള ഭാഗം ഉൾപ്പെടെ പൂർണ്ണ ഓർഡർ ലിങ്ക് പേസ്റ്റ് ചെയ്യുക.',wrongShop:'ഈ കടയുടെ വിലാസത്തിനുള്ള ഓർഡർ ലിങ്ക് ഉപയോഗിക്കുക. മറ്റൊരു വിലാസത്തിനുള്ള ലിങ്ക് ബ്രൗസറിൽ നേരിട്ട് തുറക്കുക.',
    failure:'ബ്രൗസറിന് ഇൻസ്റ്റാൾ തുറക്കാനായില്ല. അതിലെ മെനു ഉപയോഗിക്കുക, അല്ലെങ്കിൽ ഈ പേജ് തുടരുക.',
  },
};

function attachSupport(){
  if(document.querySelector('#pwa-support'))return;
  let deferredPrompt=null, installedThisPage=false;
  const support=document.createElement('aside');
  support.id='pwa-support';
  support.className='pwa-support';
  const lang=()=>document.documentElement.lang.startsWith('ml')?'ml':'en';
  const text=()=>copy[lang()];
  const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  document.body.append(support);

  function refresh(){
    // A language change never discards a pasted link or a still-open installation dialog.
    const currentLink=support.querySelector('#pwa-order-link')?.value||'';
    const formOpen=support.querySelector('#pwa-order-details')?.open||false;
    const helpOpen=support.querySelector('#pwa-help-details')?.open||false;
    const wasOpen=support.querySelector('#pwa-dialog')?.open||false;
    const s=text(), capabilities=installationCapabilities();
    const isInstalled=installedThisPage||capabilities.standalone;
    support.setAttribute('aria-label',s.panel);
    support.innerHTML=`<details id="pwa-help-details" ${helpOpen?'open':''}><summary>${escape(s.panel)}</summary><div class="pwa-actions"><button type="button" id="pwa-install-button" class="pwa-link">${escape(isInstalled?s.installed:s.install)}</button><button type="button" id="pwa-open-order" class="pwa-link">${escape(s.open)}</button></div><details id="pwa-order-details" ${formOpen?'open':''}><summary>${escape(s.open)}</summary><form id="pwa-order-form"><p>${escape(s.reentry)}</p><label for="pwa-order-link">${escape(s.label)}</label><input id="pwa-order-link" name="private-order-link" type="text" inputmode="url" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="${escape(s.placeholder)}"><p id="pwa-link-error" role="alert"></p><button type="submit" class="pwa-primary">${escape(s.continue)}</button></form></details></details><dialog id="pwa-dialog" aria-labelledby="pwa-dialog-title"><div class="pwa-dialog-body"><h2 id="pwa-dialog-title">${escape(isInstalled?s.installed:s.install)}</h2><p>${escape(s.optional)}</p><p>${escape(!capabilities.secure?s.insecure:isInstalled?s.installedHelp:capabilities.ios?s.ios:capabilities.android?s.android:s.desktop)}</p>${capabilities.secure&&!isInstalled&&deferredPrompt?`<button type="button" class="pwa-primary" id="pwa-native-install">${escape(s.prompt)}</button>`:''}<p class="pwa-small">${escape(s.offline)}</p><p id="pwa-install-status" role="status"></p><button type="button" class="pwa-secondary" id="pwa-close-dialog">${escape(s.close)}</button></div></dialog>`;
    support.querySelector('#pwa-order-link').value=currentLink;
    const dialog=support.querySelector('#pwa-dialog');
    support.querySelector('#pwa-install-button').onclick=()=>dialog.showModal();
    support.querySelector('#pwa-close-dialog').onclick=()=>dialog.close();
    support.querySelector('#pwa-open-order').onclick=()=>{support.querySelector('#pwa-order-details').open=true;support.querySelector('#pwa-order-link').focus();};
    support.querySelector('#pwa-order-form').onsubmit=event=>{
      event.preventDefault();
      try{openOrderLink(support.querySelector('#pwa-order-link').value);}
      catch(error){support.querySelector('#pwa-link-error').textContent=error.message==='wrong-shop-link'?s.wrongShop:s.invalid;}
    };
    const install=support.querySelector('#pwa-native-install');
    if(install)install.onclick=async()=>{
      install.disabled=true;
      const event=deferredPrompt;deferredPrompt=null;
      try{
        if(!event)throw new Error('Installation prompt unavailable');
        await event.prompt();const choice=await event.userChoice;
        support.querySelector('#pwa-install-status').textContent=choice.outcome==='accepted'?text().promptAccepted:text().promptDismissed;
      }catch{support.querySelector('#pwa-install-status').textContent=text().failure;}
      finally{install.hidden=true;}
    };
    if(wasOpen)dialog.showModal();
  }

  window.addEventListener('beforeinstallprompt',event=>{
    if(!installationCapabilities().secure)return;
    event.preventDefault();deferredPrompt=event;refresh();
  });
  window.addEventListener('appinstalled',()=>{installedThisPage=true;deferredPrompt=null;refresh();});
  globalThis.matchMedia?.('(display-mode: standalone)').addEventListener?.('change',refresh);
  new MutationObserver(refresh).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  refresh();
}

if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attachSupport,{once:true});
  else attachSupport();
}
