(function(){
'use strict';
var inboxMessages=[],inboxChecked=0,inboxSelectedLeadId=null,inboxBusy=false;
function icon(){return'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4z"/><path d="m4 7 8 6 8-6"/></svg>';}
function chevron(){return'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9 5 5 5-5"/></svg>';}
function ensureReplyInbox(){
  var ov=document.getElementById('replyInboxOv');if(ov)return ov;
  ov=document.createElement('div');ov.id='replyInboxOv';ov.className='reply-inbox-ov';ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-labelledby','replyInboxTitle');
  ov.innerHTML='<section class="reply-inbox-modal"><header><div class="reply-inbox-heading"><span>ИМЕЙЛ КОМУНИКАЦИЯ</span><h2 id="replyInboxTitle">Отговори в папката</h2><p id="replyInboxSummary"></p></div><button class="reply-inbox-close" onclick="closeReplyInbox()" aria-label="Затвори"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></header><div class="reply-inbox-body" id="replyInboxBody"></div></section>';
  ov.addEventListener('click',function(e){if(e.target===ov)closeReplyInbox();});document.body.appendChild(ov);return ov;
}
function asDate(value){if(!value)return null;var d=new Date(value);return isNaN(d)?null:d;}
function fmtDate(value){var d=asDate(value);return d?d.toLocaleDateString('bg-BG',{day:'2-digit',month:'2-digit',year:'numeric'}):'Без дата';}
function fmtTime(value){var d=asDate(value);return d?d.toLocaleTimeString('bg-BG',{hour:'2-digit',minute:'2-digit'}):'—';}
function stamp(value){return fmtDate(value)+' · '+fmtTime(value);}
function cleanReplyBody(value){
  var lines=String(value||'').replace(/\r/g,'').split('\n'),kept=[];
  for(var i=0;i<lines.length;i++){
    var line=lines[i];
    if(/^\s*(On .+wrote:|На .+(написа|писа):|-----\s*Original Message\s*-----|From:\s|От:\s)/i.test(line))break;
    if(/^\s*>/.test(line))continue;
    kept.push(line);
  }
  return kept.join('\n').replace(/\n{3,}/g,'\n\n').trim();
}
function replyRows(folder){var rows=[];leads.forEach(function(l){if(folder&&l.folder!==folder)return;var messages=l.outreach&&Array.isArray(l.outreach.replyMessages)?l.outreach.replyMessages:[];messages.forEach(function(m){rows.push({lead:l,message:m});});});return rows.sort(function(a,b){return String(b.message.date||'').localeCompare(String(a.message.date||''));});}
function usedIds(){var ids={};leads.forEach(function(l){var messages=l.outreach&&Array.isArray(l.outreach.replyMessages)?l.outreach.replyMessages:[];messages.forEach(function(m){if(m.messageId)ids[String(m.messageId)]=true;});});return ids;}
function messageBlock(sender,date,body,type){return'<section class="reply-message '+type+'"><header><strong>'+sender+'</strong><time datetime="'+esc(date||'')+'">'+stamp(date)+'</time></header><p>'+esc(body||'Няма извлечен текст от съобщението.')+'</p></section>';}
function threadSummary(title,meta,date,type){return'<summary><span class="reply-summary-icon '+type+'">'+icon()+'</span><span class="reply-summary-copy"><strong>'+esc(title||'Без тема')+'</strong><small>'+esc(meta||'')+'</small></span><time datetime="'+esc(date||'')+'">'+stamp(date)+'</time><span class="reply-summary-chevron">'+chevron()+'</span></summary>';}
function messageCard(row){
  var l=row.lead,m=row.message,o=l.outreach||{},clientBody=cleanReplyBody(m.body),sentBody=o.body||'',sentSubject=o.subject||String(m.subject||'').replace(/^\s*(re|отг)\s*:\s*/i,'');
  return'<details class="reply-thread matched">'+threadSummary(m.subject||sentSubject,l.name,m.date,'matched')+'<div class="reply-thread-content"><div class="reply-conversation">'+messageBlock('Digital Eight',o.sentAt,sentBody,'outgoing')+messageBlock('Клиент',m.date,clientBody,'incoming')+'</div><button class="reply-open-lead" data-lead-id="'+esc(String(l.id))+'" onclick="closeReplyInbox();openLB(this.dataset.leadId)">Отвори бизнеса</button></div></details>';
}
function unmatchedCard(m,folder,selectedId,index){
  var options=leads.filter(function(l){return!folder||l.folder===folder;}).map(function(l){return'<option value="'+esc(String(l.id))+'" '+(String(l.id)===String(selectedId||'')?'selected':'')+'>'+esc(l.name)+'</option>';}).join(''),targetId='replyTarget-unmatched-'+index,body=cleanReplyBody(m.body);
  return'<details class="reply-thread unmatched">'+threadSummary(m.subject||'Без тема',m.email||'Неразпознат клиент',m.date,'unmatched')+'<div class="reply-thread-content">'+messageBlock('Клиент',m.date,body,'incoming')+'<div class="reply-link-row"><label for="'+targetId+'"><span>Свържи с бизнес</span><select id="'+targetId+'">'+options+'</select></label><button data-message-id="'+esc(String(m.messageId||''))+'" data-target="'+targetId+'" onclick="attachInboxReply(this.dataset.messageId,this)">Свържи отговора</button></div></div></details>';
}
function renderReplyInbox(){
  var folder=getSelectedLeadFolder(),matched=replyRows(folder),used=usedIds(),unmatched=inboxMessages.filter(function(m){return m.messageId&&!used[String(m.messageId)]&&/^\s*(re|отг)\s*:/i.test(m.subject||'');}).sort(function(a,b){return String(b.date||'').localeCompare(String(a.date||''));});
  document.getElementById('replyInboxTitle').textContent='Отговори · '+(folder||'Всички папки');document.getElementById('replyInboxSummary').textContent=inboxChecked+' проверени входящи · '+matched.length+' свързани · '+unmatched.length+' за преглед';
  var body=document.getElementById('replyInboxBody');body.innerHTML=(matched.length?'<section class="reply-group"><div class="reply-group-title"><h3>Отговорили в тази папка</h3><b>'+matched.length+'</b></div>'+matched.map(messageCard).join('')+'</section>':'<section class="reply-empty"><div>'+icon()+'</div><h3>Все още няма автоматично свързани отговори</h3><p>Ако писмото е пристигнало, отвори го от списъка по-долу и го свържи с правилния бизнес.</p></section>')+(unmatched.length?'<section class="reply-group"><div class="reply-group-title"><h3>Неразпознати входящи отговори</h3><b>'+unmatched.length+'</b></div>'+unmatched.map(function(m,i){return unmatchedCard(m,folder,inboxSelectedLeadId,i);}).join('')+'</section>':'');
}
window.openReplyInbox=function(messages,checked,selectedId){inboxMessages=Array.isArray(messages)?messages:[];inboxChecked=checked||0;inboxSelectedLeadId=selectedId||null;var ov=ensureReplyInbox();renderReplyInbox();ov.classList.add('open');document.body.classList.add('reply-inbox-open');setTimeout(function(){var close=ov.querySelector('.reply-inbox-close');if(close)close.focus();},30);};
window.closeReplyInbox=function(){var ov=document.getElementById('replyInboxOv');if(ov)ov.classList.remove('open');document.body.classList.remove('reply-inbox-open');};
window.attachInboxReply=function(messageId,button){if(inboxBusy)return;var select=document.getElementById(button&&button.dataset?button.dataset.target:''),leadId=select&&select.value;if(!leadId){toast('Избери бизнес','var(--yellow)');return;}inboxBusy=true;if(button){button.disabled=true;button.textContent='Свързване…';}fetch('api.php?action=attachOutreachReply',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({leadId:leadId,messageId:messageId})}).then(function(r){return r.json().catch(function(){return{};}).then(function(d){if(!r.ok)throw new Error(d.error||'Отговорът не се свърза');return d;});}).then(function(){return fetch('api.php?action=load',{credentials:'same-origin'});}).then(function(r){return r.json();}).then(function(d){var state=d.state||{};leads=state.leads||leads;lastServerUpdatedAt=state.updatedAt||lastServerUpdatedAt;normalizeData();saveLocal(false);renderLeads();renderReplyInbox();toast('Отговорът е свързан с бизнеса','var(--green)');}).catch(function(e){toast(e.message||'Грешка при свързване','var(--red)');}).finally(function(){inboxBusy=false;if(button){button.disabled=false;button.textContent='Свържи отговора';}});};
document.addEventListener('keydown',function(e){var ov=document.getElementById('replyInboxOv');if(e.key==='Escape'&&ov&&ov.classList.contains('open')){e.preventDefault();e.stopImmediatePropagation();closeReplyInbox();}},true);
})();