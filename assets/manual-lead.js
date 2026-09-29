(function(){
'use strict';

function value(id){var el=document.getElementById(id);return el?el.value.trim():'';}
function normalizedSite(input){try{var raw=String(input||'').trim();if(!raw)return'';var url=new URL(/^https?:\/\//i.test(raw)?raw:'https://'+raw);return url.hostname.replace(/^www\./,'').toLowerCase()+url.pathname.replace(/\/$/,'');}catch(e){return String(input||'').trim().toLowerCase();}}
function phoneDigits(input){return String(input||'').replace(/\D/g,'');}

window.openManualLead=function(){
  var folders=getLeadFolderNames();
  if(!folders.length){toast('Първо създай папка за бизнеса','var(--yellow)');createLeadFolder();return;}
  var selected=getSelectedLeadFolder();
  if(!selected||folders.indexOf(selected)<0)selected=folders[0];
  document.getElementById('manualLeadFolder').innerHTML=leadFolderOptions(selected,false);
  ['manualLeadName','manualLeadEmail','manualLeadPhone','manualLeadWebsite','manualLeadCategory','manualLeadAddress','manualLeadNote'].forEach(function(id){document.getElementById(id).value='';});
  var error=document.getElementById('manualLeadError');error.hidden=true;error.textContent='';
  document.getElementById('manualLeadOv').classList.add('open');
  document.body.classList.add('manual-lead-open');
  setTimeout(function(){document.getElementById('manualLeadName').focus();},40);
};

window.closeManualLead=function(){
  var ov=document.getElementById('manualLeadOv');if(ov)ov.classList.remove('open');
  document.body.classList.remove('manual-lead-open');
};

window.saveManualLead=function(event){
  if(event)event.preventDefault();
  var name=value('manualLeadName'),folder=value('manualLeadFolder'),email=value('manualLeadEmail').toLowerCase(),phone=value('manualLeadPhone'),website=value('manualLeadWebsite'),error=document.getElementById('manualLeadError');
  error.hidden=true;error.textContent='';
  if(!name){error.textContent='Напиши име на бизнеса.';error.hidden=false;document.getElementById('manualLeadName').focus();return;}
  if(!folder){error.textContent='Избери папка.';error.hidden=false;document.getElementById('manualLeadFolder').focus();return;}
  if(email&&!document.getElementById('manualLeadEmail').checkValidity()){error.textContent='Провери имейл адреса.';error.hidden=false;document.getElementById('manualLeadEmail').focus();return;}
  var siteKey=normalizedSite(website),phoneKey=phoneDigits(phone),duplicate=leads.find(function(lead){return(email&&String(lead.email||'').trim().toLowerCase()===email)||(siteKey&&normalizedSite(lead.website)===siteKey)||(phoneKey.length>=7&&phoneDigits(lead.phone)===phoneKey);});
  if(duplicate){error.textContent='Този бизнес вероятно вече съществува: '+duplicate.name;error.hidden=false;return;}
  var lead={id:Date.now(),name:name,folder:folder,email:email,phone:phone,website:website,category:value('manualLeadCategory'),address:value('manualLeadAddress'),note:value('manualLeadNote'),stars:0,reviews:'',price:'',image:'',status:'unset',pipeline:'new',followup:'',tags:[],extra:{Source:'Ръчно добавен'},aiPhone:'',aiEmail:''};
  leads.push(lead);saveData();populateCats();updateBadges();
  var folderFilter=document.getElementById('lFolderF');if(folderFilter)folderFilter.value=folder;
  closeManualLead();renderLeadFolders();renderLeads();openLB(lead.id);toast('Бизнесът е добавен в „'+folder+'“','var(--green)');
};

document.addEventListener('keydown',function(event){var ov=document.getElementById('manualLeadOv');if(event.key==='Escape'&&ov&&ov.classList.contains('open')){event.preventDefault();event.stopImmediatePropagation();closeManualLead();}},true);
})();
