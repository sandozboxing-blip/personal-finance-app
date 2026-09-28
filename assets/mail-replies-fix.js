(function(){
'use strict';
window.openLatestLeadReply=function(preferredId){
  if(preferredId){
    var preferred=leads.find(function(l){return String(l.id)===String(preferredId)&&l.outreach&&l.outreach.status==='replied';});
    if(!preferred)return false;
    var campaign=document.getElementById('leadOutreachOv');
    if(campaign&&campaign.classList.contains('open'))closeLeadOutreach();
    openLB(preferred.id);return true;
  }
  var folder=getSelectedLeadFolder();
  var rows=leads.filter(function(l){return l.outreach&&l.outreach.status==='replied'&&(!folder||l.folder===folder);});
  if(!rows.length)rows=leads.filter(function(l){return l.outreach&&l.outreach.status==='replied';});
  rows.sort(function(a,b){return String((b.outreach||{}).replyAt||'').localeCompare(String((a.outreach||{}).replyAt||''));});
  if(!rows.length)return false;
  var campaign=document.getElementById('leadOutreachOv');
  if(campaign&&campaign.classList.contains('open'))closeLeadOutreach();
  openLB(rows[0].id);return true;
};
window.syncOutreachReplies=function(manual){
  if(outreachReplySyncing||!currentUser)return;
  var preferredId=manual&&lbid?lbid:null;
  outreachReplySyncing=true;
  var btn=document.getElementById('outreachSyncBtn');
  if(btn){btn.disabled=true;btn.textContent='Проверяваме…';}
  fetch('api.php?action=syncOutreachReplies',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'})
    .then(function(r){return r.json().catch(function(){return{};}).then(function(d){if(!r.ok)throw new Error(d.error||'Грешка при проверката');return d;});})
    .then(function(sync){return fetch('api.php?action=load',{credentials:'same-origin'}).then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error||'Данните не се заредиха');return{sync:sync,state:d.state||{}};});});})
    .then(function(result){
      var state=result.state;
      leads=state.leads||[];leadFolders=state.leadFolders||leadFolders;leadFolderMeta=state.leadFolderMeta||leadFolderMeta;lastServerUpdatedAt=state.updatedAt||lastServerUpdatedAt;
      normalizeData();saveLocal(false);renderLeads();if(window.renderReports)renderReports();
      var opened=openLatestLeadReply(preferredId);
      if(opened)toast('Отговорът е зареден в профила','var(--green)');
      else if(manual)toast('Проверени '+(result.sync.checked||0)+' входящи писма · няма съвпадение за този lead','var(--blue)');
    })
    .catch(function(e){if(manual)toast(e.message||'Грешка при проверката на пощата','var(--red)');})
    .finally(function(){outreachReplySyncing=false;if(btn){btn.disabled=false;btn.textContent='Провери отговори';}});
};
})();
