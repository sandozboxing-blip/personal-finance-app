(function(){
'use strict';
var individualLeadId=null,individualSending=false,originalLeadCommunication=window.renderLeadCommunication;
function mailIcon(){return'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>';}
window.renderLeadCommunication=function(l){
  var html=originalLeadCommunication(l);
  if(!l.email)return html;
  var button='<button class="btn btnp btnsm individual-mail-open" onclick="openIndividualEmail('+JSON.stringify(l.id)+')">'+mailIcon()+'<span>Изпрати индивидуален имейл</span></button>';
  return html.replace('<div class="lbcommactions">','<div class="lbcommactions">'+button);
};
function ensureComposer(){
  var ov=document.getElementById('individualEmailOv');if(ov)return ov;
  ov=document.createElement('div');ov.id='individualEmailOv';ov.className='individual-email-ov';ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-labelledby','individualEmailTitle');
  ov.innerHTML='<div class="individual-email-modal"><header><div><span>ИНДИВИДУАЛЕН ИМЕЙЛ</span><h2 id="individualEmailTitle">Ново съобщение</h2><p id="individualEmailRecipient"></p></div><button class="individual-email-close" onclick="closeIndividualEmail()" aria-label="Затвори"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></header><main><label><span>Тема</span><input id="individualEmailSubject" maxlength="120" autocomplete="off"></label><label><span>Съобщение</span><textarea id="individualEmailBody" maxlength="5000"></textarea></label><div class="individual-email-note"><svg viewBox="0 0 24 24"><path d="M12 8v5m0 4h.01"/><circle cx="12" cy="12" r="9"/></svg><span>Имейлът ще бъде изпратен само до този бизнес и ще се запише в профила му.</span></div><div class="individual-email-error" id="individualEmailError" hidden></div></main><footer><button class="btn btng" onclick="closeIndividualEmail()">Отказ</button><button class="btn btnp individual-email-send" id="individualEmailSend" onclick="sendIndividualEmail()">'+mailIcon()+'<span>Изпрати имейла</span></button></footer></div>';
  ov.addEventListener('click',function(e){if(e.target===ov)closeIndividualEmail();});document.body.appendChild(ov);return ov;
}
window.openIndividualEmail=function(id){
  var l=leads.find(function(x){return String(x.id)===String(id);});if(!l||!l.email){toast('Този бизнес няма имейл адрес','var(--yellow)');return;}
  individualLeadId=l.id;var ov=ensureComposer(),draft=outreachDraft(l),errorBox=document.getElementById('individualEmailError');if(errorBox){errorBox.hidden=true;errorBox.textContent='';}
  document.getElementById('individualEmailTitle').textContent='Имейл до '+l.name;
  document.getElementById('individualEmailRecipient').textContent=l.email;
  document.getElementById('individualEmailSubject').value=draft.subject||'';
  document.getElementById('individualEmailBody').value=draft.body||'';
  ov.classList.add('open');document.body.classList.add('individual-email-open');setTimeout(function(){document.getElementById('individualEmailSubject').focus();},50);
};
window.closeIndividualEmail=function(){if(individualSending)return;var ov=document.getElementById('individualEmailOv');if(ov)ov.classList.remove('open');document.body.classList.remove('individual-email-open');individualLeadId=null;};
window.sendIndividualEmail=function(){
  if(individualSending)return;var l=leads.find(function(x){return String(x.id)===String(individualLeadId);});if(!l)return;
  var subject=document.getElementById('individualEmailSubject').value.trim(),body=document.getElementById('individualEmailBody').value.trim(),btn=document.getElementById('individualEmailSend');
  if(!subject){toast('Добави тема на имейла','var(--yellow)');document.getElementById('individualEmailSubject').focus();return;}
  if(body.length<40){toast('Съобщението трябва да е поне 40 символа','var(--yellow)');document.getElementById('individualEmailBody').focus();return;}
  if(!confirm('Да изпратя този имейл само до '+l.email+'?'))return;
  individualSending=true;btn.disabled=true;btn.classList.add('loading');btn.querySelector('span').textContent='Изпращане…';
  fetch('api.php?action=sendIndividualOutreach',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({leadId:l.id,subject:subject,body:body,consentConfirmed:true,individual:true})})
    .then(function(r){return r.json().catch(function(){return{};}).then(function(d){if(!r.ok)throw new Error(d.error||'Грешка при изпращане');return d;});})
    .then(function(result){var now=new Date().toISOString();l.email=result.email||l.email;l.outreach=Object.assign({},l.outreach||{},{subject:subject,body:body,status:'sent',sentAt:now,updatedAt:now,sendError:'',recipientEmail:result.email||l.email});scheduleLeadFollowup(l);saveData();individualSending=false;closeIndividualEmail();openLB(l.id);toast('Имейлът е изпратен до '+l.email,'var(--green)');})
    .catch(function(e){var message=e.message||'Имейлът не беше изпратен',errorBox=document.getElementById('individualEmailError');if(errorBox){errorBox.hidden=false;errorBox.textContent=message;}toast(message,'var(--red)');})
    .finally(function(){individualSending=false;if(btn){btn.disabled=false;btn.classList.remove('loading');btn.querySelector('span').textContent='Изпрати имейла';}});
};
document.addEventListener('keydown',function(e){var ov=document.getElementById('individualEmailOv');if(e.key==='Escape'&&ov&&ov.classList.contains('open')){e.preventDefault();e.stopImmediatePropagation();closeIndividualEmail();}},true);
})();
