// ── LEADS FILE IMPORT ──────────────────────────────────
function handleFile(e) {
  var f = e.target.files[0]; if (!f) return;
  if (!f.size) { toast('⚠ Файлът е празен (0 байта). Запази данните в него и опитай отново.', 'var(--yellow)'); e.target.value = ''; return; }
  e.target.value = '';
  var r = new FileReader();
  r.onload = function(ev) {
    var txt = ev.target.result;
    if (txt.charCodeAt(0) === 0xFEFF) txt = txt.slice(1);
    var ext = f.name.split('.').pop().toLowerCase();
    try {
      var raw;
      if (ext === 'json') {
        if (!txt.trim()) throw new Error('JSON файлът е празен');
        raw = flattenJsonRecords(JSON.parse(txt));
        if (!raw.length) throw new Error('JSON файлът няма разпознаваеми бизнес записи');
      } else {
        raw = parseCSV(txt);
      }
      importLeads(raw);
    } catch(err) { toast('⚠ ' + err.message, 'var(--red)'); }
  };
  r.onerror = function() { toast('⚠ Грешка при четене на файла', 'var(--red)'); };
  r.readAsText(f, 'UTF-8');
}
function flattenJsonRecords(value) {
  var out=[];
  function walk(v,fromArray){
    if(Array.isArray(v)){v.forEach(function(item){walk(item,true);});return;}
    if(!v||typeof v!=='object')return;
    var keys=Object.keys(v),scalarCount=keys.filter(function(k){var x=v[k];return x!=null&&(typeof x==='string'||typeof x==='number'||typeof x==='boolean');}).length;
    var looksLikeLead=keys.some(function(k){return /name|title|company|business|phone|tel|email|website|url|address|category|rating|review/i.test(k);});
    if(looksLikeLead||(fromArray&&scalarCount>=2)){out.push(v);return;}
    keys.forEach(function(k){walk(v[k],false);});
  }
  walk(value,false);return out;
}
function handleDrop(e) {
  e.preventDefault();
  var f = e.dataTransfer.files[0]; if (!f) return;
  handleFile({target: {files: [f], value: ''}});
}

function parseCSV(txt) {
  var lines=txt.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n'),rows=lines.filter(function(l){return l.trim();});
  if(rows.length<2)throw new Error('Файлът е твърде кратък или празен');
  var first=rows[0],counts={',':(first.match(/,/g)||[]).length,';':(first.match(/;/g)||[]).length,'\t':(first.match(/\t/g)||[]).length};
  var delimiter=Object.keys(counts).sort(function(a,b){return counts[b]-counts[a];})[0];
  var hdrs=splitLine(rows[0],delimiter).map(function(h){return h.trim().replace(/^"|"$/g,'').toLowerCase();});
  return rows.slice(1).map(function(line){var vals=splitLine(line,delimiter),o={};hdrs.forEach(function(h,i){o[h]=(vals[i]||'').trim().replace(/^"|"$/g,'');});return o;}).filter(function(o){return Object.values(o).some(function(v){return v;});});
}
function splitLine(line,delimiter) {
  var res=[],cur='',inQ=false;delimiter=delimiter||',';
  for(var i=0;i<line.length;i++){var ch=line[i];if(ch==='"'){if(inQ&&line[i+1]==='"'){cur+='"';i++;}else inQ=!inQ;}else if(ch===delimiter&&!inQ){res.push(cur);cur='';}else cur+=ch;}
  res.push(cur);return res;
}
var SKIP = ['name','title','company','business_name','full_name','fullname','website','url','link','site','web','homepage','phone','tel','telephone','phone_number','mobile','email','email_address','contact_email','mail','category','type','niche','industry','business_category','address','location','city','place','full_address','rating','stars','score','rate','reviews'];
function normalizeLeadKey(key){return String(key||'').toLowerCase().replace(/[^a-z0-9а-я]+/g,'');}
function leadValue(value){if(value==null)return'';if(Array.isArray(value))return value.map(leadValue).filter(Boolean).join(', ');if(typeof value==='object'){var vals=Object.keys(value).map(function(k){return leadValue(value[k]);}).filter(Boolean);return vals.join(', ');}return String(value).trim();}
function pick(o, keys) {
  var wanted=keys.map(normalizeLeadKey);
  for(var ok in o){if(wanted.indexOf(normalizeLeadKey(ok))>=0){var value=leadValue(o[ok]);if(value)return value;}}
  return '';
}
function pickN(o, keys) { var v=pick(o,keys),n=parseFloat(v.replace(',','.'));return isNaN(n)?0:Math.min(5,Math.max(0,n)); }function cleanGoogle(v) { return String(v||'').replace(/^[\s·•-]+/,'').trim(); }
function importLeads(raw) {
  var now = Date.now(); var imported = [];
  for (var i = 0; i < raw.length; i++) {
    var r = raw[i]; var extra = {};
    for (var k in r) { if (SKIP.indexOf(k.toLowerCase()) < 0 && r[k]) extra[k] = r[k]; }
    var n = pick(r, ['name','title','company','business_name','full_name','fullname','business','store_name','osrxxb']);
    if (!n) { var vals=Object.values(r); n=vals.length ? String(vals[0]||'').trim() : ''; }
    if (!n) continue;
    var sourceUrl = pick(r, ['url','link','googleMapsUrl','mapsUrl']);
    if (sourceUrl) extra['Google Maps / source URL'] = sourceUrl;
    imported.push({id: now + i, name: n, website: pick(r, ['website','site','web','homepage','mre4xd href']), phone: pick(r, ['phone','tel','telephone','phone_number','mobile']), email: pick(r, ['email','email_address','contact_email','mail']), category: cleanGoogle(pick(r, ['category','categories','categoryName','type','niche','industry','business_category','rllt__details'])), address: pick(r, ['address','location','place','full_address','rllt__details 3']) || [pick(r,['street']),pick(r,['city']),pick(r,['state']),pick(r,['country','countryCode'])].filter(Boolean).join(', '), stars: pickN(r, ['rating','stars','score','rate','totalScore','yi40hd']), reviews: pick(r,['reviews','review_count','reviewsCount','rdapee']), price: pick(r,['price','price_range','rllt__details 2']), image: pick(r,['image','image_url','wA1Bge src','wa1bge src']), status: 'unset', pipeline: 'new', folder: getSelectedLeadFolder(), note: '', followup: '', tags: [], extra: extra, aiPhone: '', aiEmail: ''});
  }
  if (!imported.length) { toast('⚠ Не намерих записи с наименование. Провери файла.', 'var(--yellow)'); return; }
  leads = leads.concat(imported);
  saveData(); renderLeads(); updateBadges(); populateCats();
  var withPhone=imported.filter(function(x){return x.phone;}).length,withEmail=imported.filter(function(x){return x.email;}).length,withWeb=imported.filter(function(x){return x.website;}).length;
  toast('✓ '+imported.length+' записа · '+withPhone+' телефона · '+withEmail+' имейла · '+withWeb+' сайта','var(--green)');
}
function loadSample() {
  importLeads([
    {name:'Coffee Time Sofia',website:'coffeetime.bg',phone:'0888-123456',email:'hello@coffeetime.bg',category:'Food & Beverage',address:'Витоша 32, София',rating:'4'},
    {name:'TechHub Bulgaria',website:'techhub.bg',phone:'0899-234567',email:'info@techhub.bg',category:'Technology',address:'Бизнес парк',rating:'5'},
    {name:'Fitness Pro Gym',website:'fitnesspro.bg',phone:'0877-345678',email:'gym@fitpro.bg',category:'Фитнес',address:'Лозенец',rating:'3'},
    {name:'Студио Форма',website:'forma.bg',phone:'0888-456789',email:'forma@studio.bg',category:'Архитектура',address:'Граф Игнатиев 20',rating:'4'},
    {name:'BG Digital Marketing',website:'bgdigital.io',phone:'0898-567890',email:'team@bgdigital.io',category:'Marketing',address:'Бизнес парк',rating:'5'}
  ]);
}

// ── LEADS RENDER ───────────────────────────────────────
var SC = {unset:'prospect', prospect:'maybe', maybe:'not', not:'unset'};
var SL = {prospect:'✓ Потенциален', maybe:'? Може би', not:'✗ Не', unset:'— ?'};
var SCL = {prospect:'cg', maybe:'cy', not:'cr', unset:'cgr'};

function setLFTab(el) {
  document.querySelectorAll('#lfTabs .btn[data-f]').forEach(function(b) { b.classList.remove('active'); b.classList.add('btng'); b.style.background = ''; b.style.color = ''; });
  el.classList.add('active'); el.classList.remove('btng'); el.style.background = 'var(--b4)'; el.style.color = 'var(--w0)';
  lftab = el.dataset.f; var status=document.getElementById('lStatusF');if(status)status.value=lftab;renderLeads();
}
function setLeadStatusFromFilter(value){lftab=value||'all';var tab=document.querySelector('#lfTabs .btn[data-f="'+lftab+'"]');if(tab)setLFTab(tab);else renderLeads();}
function populateCats() {
  var cats = []; leads.forEach(function(l) { if (l.category && cats.indexOf(l.category) < 0) cats.push(l.category); }); cats.sort();
  var sel = document.getElementById('lCatF'); var cur = sel.value;
  sel.innerHTML = '<option value="">Всички категории</option>' + cats.map(function(c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join('');
  if (cur) sel.value = cur;
}
function getLeadFolderNames(){var names=(leadFolders||[]).slice();leads.forEach(function(l){if(l.folder&&names.indexOf(l.folder)<0)names.push(l.folder);});return names.filter(Boolean).sort(function(a,b){return a.localeCompare(b,'bg');});}
function getSelectedLeadFolder(){var el=document.getElementById('lFolderF');return el&&el.value?el.value:'';}
function leadFolderOptions(selected,includeNone){var first=includeNone?'<option value="">Без папка</option>':'';return first+getLeadFolderNames().map(function(name){return'<option value="'+esc(name)+'"'+(name===selected?' selected':'')+'>'+esc(name)+'</option>';}).join('');}
function renderLeadFolders(){var sel=document.getElementById('lFolderF');if(!sel)return;var cur=sel.value;sel.innerHTML='<option value="">Всички папки</option>'+leadFolderOptions(cur,false);if(cur&&getLeadFolderNames().indexOf(cur)>=0)sel.value=cur;}
var LEAD_FOLDER_COLORS=['#8b5cf6','#3b82f6','#06b6d4','#10b981','#f59e0b','#f97316','#ec4899','#ef4444'];
var LEAD_FOLDER_ICONS=[['folder','Папка'],['location','Локация'],['medical','Медицина'],['restaurant','Заведения'],['beauty','Красота'],['fitness','Спорт'],['retail','Магазини'],['services','Услуги']];
var leadFolderEditing='',leadFolderDraft={color:LEAD_FOLDER_COLORS[0],icon:'folder'};
function leadFolderIconSvg(key){var paths={folder:'<path d="M3 7h6l2 2h10v10H3z"/><path d="M3 7V5h7l2 2"/>',location:'<path d="M12 21s7-5.2 7-12a7 7 0 1 0-14 0c0 6.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.4"/>',medical:'<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',restaurant:'<path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M16 3v18M16 3c4 2 4 8 0 10"/>',beauty:'<path d="M12 3c2 4 5 6 5 10a5 5 0 0 1-10 0c0-4 3-6 5-10z"/><path d="M9 14c1 1 5 1 6-1"/>',fitness:'<path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/>',retail:'<path d="M5 8h14l-1 13H6z"/><path d="M9 10V6a3 3 0 0 1 6 0v4"/>',services:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>'};return'<svg viewBox="0 0 24 24" aria-hidden="true">'+(paths[key]||paths.folder)+'</svg>';}
function getLeadFolderMeta(name){var m=(leadFolderMeta&&leadFolderMeta[name])||{},medical=/зъболек|dental/i.test(name);return{color:/^#[0-9a-f]{6}$/i.test(m.color||'')?m.color:(medical?'#8b5cf6':'#3b82f6'),icon:LEAD_FOLDER_ICONS.some(function(x){return x[0]===m.icon;})?m.icon:(medical?'medical':'folder')};}
function createLeadFolder(){openLeadFolderEditor('');}
function editLeadFolder(e,name){if(e){e.preventDefault();e.stopPropagation();}openLeadFolderEditor(name);}
function openLeadFolderEditor(name){leadFolderEditing=name||'';leadFolderDraft=getLeadFolderMeta(name||'');var ov=document.getElementById('folderEditorOv'),body=document.getElementById('folderEditorBody'),title=document.getElementById('folderEditorTitle'),save=document.getElementById('folderEditorSave');if(!ov||!body)return;title.textContent=name?'Редактирай папка':'Създай нова папка';save.textContent=name?'Запази промените':'Създай папка';var icons=LEAD_FOLDER_ICONS.map(function(x){return'<button type="button" class="foldericonchoice '+(x[0]===leadFolderDraft.icon?'selected':'')+'" data-icon="'+x[0]+'" onclick="selectLeadFolderIcon(this.dataset.icon)">'+leadFolderIconSvg(x[0])+'<span>'+x[1]+'</span></button>';}).join('');var colors=LEAD_FOLDER_COLORS.map(function(c){return'<button type="button" class="foldercolorchoice '+(c===leadFolderDraft.color?'selected':'')+'" style="--swatch:'+c+'" data-color="'+c+'" onclick="selectLeadFolderColor(this.dataset.color)" aria-label="Цвят '+c+'"></button>';}).join('');body.innerHTML='<div class="foldereditorform"><label class="folderfield"><span>Име на папката</span><input id="folderEditorName" maxlength="70" placeholder="Напр. Зъболекари — София" value="'+esc(name||'')+'" oninput="updateLeadFolderPreview()"></label><div class="folderfieldset"><span>Икона</span><div class="foldericonchoices">'+icons+'</div></div><div class="folderfieldset"><span>Цвят</span><div class="foldercolorchoices">'+colors+'<label class="foldercustomcolor" title="Собствен цвят"><input type="color" value="'+leadFolderDraft.color+'" oninput="selectLeadFolderColor(this.value)"><span>＋</span></label></div></div></div><aside class="folderpreviewwrap"><span>ПРЕГЛЕД</span><div id="folderEditorPreview"></div><small>Цветът и иконата помагат да разпознаваш кампаниите по-бързо.</small></aside>';ov.classList.add('open');document.body.classList.add('folder-editor-open');updateLeadFolderPreview();setTimeout(function(){var input=document.getElementById('folderEditorName');if(input){input.focus();input.select();}},30);}
function closeLeadFolderEditor(){var ov=document.getElementById('folderEditorOv');if(ov)ov.classList.remove('open');document.body.classList.remove('folder-editor-open');leadFolderEditing='';}
function selectLeadFolderIcon(icon){leadFolderDraft.icon=icon;document.querySelectorAll('.foldericonchoice').forEach(function(b){b.classList.toggle('selected',b.dataset.icon===icon);});updateLeadFolderPreview();}
function selectLeadFolderColor(color){leadFolderDraft.color=color;document.querySelectorAll('.foldercolorchoice').forEach(function(b){b.classList.toggle('selected',b.dataset.color.toLowerCase()===color.toLowerCase());});updateLeadFolderPreview();}
function updateLeadFolderPreview(){var input=document.getElementById('folderEditorName'),preview=document.getElementById('folderEditorPreview');if(!preview)return;var name=(input&&input.value.trim())||'Име на папката',oldRows=leadFolderEditing?leads.filter(function(l){return l.folder===leadFolderEditing;}):[];preview.innerHTML='<article class="folderpreview" style="--folder-accent:'+leadFolderDraft.color+'"><span class="folderpreviewicon">'+leadFolderIconSvg(leadFolderDraft.icon)+'</span><strong>'+esc(name)+'</strong><small>'+oldRows.length+' leads</small><div><i style="width:'+(oldRows.length?Math.round(oldRows.filter(function(l){return l.website;}).length/oldRows.length*100):0)+'%"></i></div></article>';}
function saveLeadFolderEditor(){var input=document.getElementById('folderEditorName'),name=(input?input.value:'').trim().replace(/\s+/g,' '),old=leadFolderEditing,folderSelect=document.getElementById('lFolderF'),wasOpen=!!(old&&folderSelect&&folderSelect.value===old);if(!name){toast('Напиши име на папката','var(--yellow)');if(input)input.focus();return;}var duplicate=getLeadFolderNames().some(function(x){return x!==old&&x.toLowerCase()===name.toLowerCase();});if(duplicate){toast('Тази папка вече съществува','var(--yellow)');return;}if(!leadFolderMeta||typeof leadFolderMeta!=='object')leadFolderMeta={};if(old){var idx=leadFolders.indexOf(old);if(idx>=0)leadFolders[idx]=name;else if(leadFolders.indexOf(name)<0)leadFolders.push(name);leads.forEach(function(l){if(l.folder===old)l.folder=name;});if(old!==name)delete leadFolderMeta[old];leadFolderMeta[name]={color:leadFolderDraft.color,icon:leadFolderDraft.icon};}else{leadFolders.push(name);leadFolderMeta[name]={color:leadFolderDraft.color,icon:leadFolderDraft.icon};}saveData();closeLeadFolderEditor();renderLeadFolders();if(wasOpen&&folderSelect)folderSelect.value=name;renderLeads();toast(old?'✓ Папката е обновена':'✓ Създадена папка: '+name,'var(--green)');}
function setLeadFolder(value){var l=getLB();if(!l)return;l.folder=value;saveData();renderLeadFolders();renderLeads();}
function openLeadFolder(name){renderLeadFolders();var sel=document.getElementById('lFolderF');if(sel)sel.value=name;renderLeads();window.scrollTo({top:0,behavior:'smooth'});}
function showLeadFolders(){var sel=document.getElementById('lFolderF');if(sel)sel.value='';renderLeads();window.scrollTo({top:0,behavior:'smooth'});}
function folderMetric(label,value,kind){return'<div class="folderkpi '+kind+'"><b>'+value+'</b><span>'+label+'</span></div>';}
function renderLeadFolderView(active){var box=document.getElementById('leadFolderView');if(!box)return;var names=getLeadFolderNames();if(active){var count=leads.filter(function(l){return l.folder===active;}).length,meta=getLeadFolderMeta(active);box.className='leadfolderview compact';box.innerHTML='<button class="folderback" onclick="showLeadFolders()">← Всички папки</button><div class="compactfoldericon" style="--folder-accent:'+meta.color+'">'+leadFolderIconSvg(meta.icon)+'</div><div><span>ОТВОРЕНА ПАПКА</span><h2>'+esc(active)+'</h2></div><b>'+count+' leads</b><button class="folderedit compactedit" onclick="editLeadFolder(event,this.dataset.folder)" data-folder="'+esc(active)+'" aria-label="Редактирай папката">•••</button>';return;}box.className='leadfolderview';var totals={contacts:leads.filter(function(l){return l.phone||l.email;}).length,phones:leads.filter(function(l){return l.phone;}).length,emails:leads.filter(function(l){return l.email;}).length,sites:leads.filter(function(l){return l.website;}).length};var cards=names.map(function(name){var rows=leads.filter(function(l){return l.folder===name;}),sites=rows.filter(function(l){return l.website;}).length,contacts=rows.filter(function(l){return l.phone||l.email;}).length,meta=getLeadFolderMeta(name),sitePct=rows.length?Math.round(sites/rows.length*100):0,contactPct=rows.length?Math.round(contacts/rows.length*100):0;return'<article class="leadfoldercard" tabindex="0" role="button" data-folder="'+esc(name)+'" style="--folder-accent:'+meta.color+'" onclick="openLeadFolder(this.dataset.folder)" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();openLeadFolder(this.dataset.folder)}"><button class="folderedit" data-folder="'+esc(name)+'" onclick="editLeadFolder(event,this.dataset.folder)" aria-label="Редактирай '+esc(name)+'">•••</button><span class="foldericon">'+leadFolderIconSvg(meta.icon)+'</span><span class="foldercopy"><strong>'+esc(name)+'</strong><small>'+rows.length+' leads'+(rows.filter(function(l){return l.outreach&&l.outreach.status==='replied';}).length?' · '+rows.filter(function(l){return l.outreach&&l.outreach.status==='replied';}).length+' отговора':'')+'</small></span><span class="folderprogress"><label><span>Уебсайтове</span><b>'+sites+'/'+rows.length+'</b></label><i><em style="width:'+sitePct+'%"></em></i><label><span>Директен контакт</span><b>'+contacts+'/'+rows.length+'</b></label><i><em style="width:'+contactPct+'%"></em></i></span><span class="folderopen">Отвори папката <b>→</b></span></article>';}).join('');box.innerHTML='<div class="folderhomehead"><div><span>LEADS БИБЛИОТЕКА</span><h2>Папки с потенциални клиенти</h2><p>Организирай кампаниите си и отвори папка, за да видиш бизнесите в нея.</p></div><button class="btn btnp" onclick="createLeadFolder()">＋ Създай нова папка</button></div><div class="folderkpis">'+folderMetric('Всички бизнеси',leads.length,'all')+folderMetric('С директен контакт',totals.contacts,'contact')+folderMetric('Телефони',totals.phones,'phone')+folderMetric('Имейли',totals.emails,'email')+folderMetric('Уебсайтове',totals.sites,'site')+'</div><div class="leadfoldergrid">'+cards+'</div>';}function parseReviewCount(v){var x=String(v||'').replace(/[()\s,]/g,'').toUpperCase(),m=parseFloat(x)||0;return x.indexOf('K')>=0?m*1000:x.indexOf('M')>=0?m*1000000:m;}
function renderLeadPager(total,pages){
  var pager=document.getElementById('leadPager');if(!pager)return;
  if(!total){pager.style.display='none';pager.innerHTML='';return;}
  pager.style.display='flex';pager.innerHTML='<span>Показани '+(((leadPage-1)*leadPageSize)+1)+'–'+Math.min(leadPage*leadPageSize,total)+' от '+total+'</span><span class="pagergrow"></span><button class="btn btng btnsm" '+(leadPage<=1?'disabled':'')+' onclick="changeLeadPage(-1)">←</button><strong>'+leadPage+' / '+pages+'</strong><button class="btn btng btnsm" '+(leadPage>=pages?'disabled':'')+' onclick="changeLeadPage(1)">→</button><label>На страница <select onchange="changeLeadPageSize(this.value)"><option '+(leadPageSize===25?'selected':'')+'>25</option><option '+(leadPageSize===50?'selected':'')+'>50</option><option '+(leadPageSize===100?'selected':'')+'>100</option></select></label>';
}
function renderMobileLeadCards(rows){
  var list=document.getElementById('leadMobileList');if(!list)return;
  list.innerHTML=rows.map(function(l){
    var phone=l.phone?'<a href="tel:'+esc(l.phone)+'" onclick="event.stopPropagation()">Обади се</a>':'',email=l.email?'<a href="mailto:'+esc(l.email)+'" onclick="event.stopPropagation()">Имейл</a>':'';
    return '<article class="lead-mobile-card" onclick="openLB('+JSON.stringify(l.id)+')"><div class="lmc-head"><div class="lmc-title"><strong>'+esc(l.name)+'</strong><span>'+esc((l.folder?l.folder+' · ':'')+(l.category||l.address||'Без категория'))+'</span></div><div class="lmc-score">'+(l.stars?Number(l.stars).toFixed(1)+' ★':'Няма ★')+'</div></div><div class="lmc-meta">'+(l.phone?'<span class="lmc-chip good">Телефон</span>':'<span class="lmc-chip">Без телефон</span>')+(l.email?'<span class="lmc-chip good">Имейл</span>':'')+(l.website?'<span class="lmc-chip">Има сайт</span>':'<span class="lmc-chip good">Без сайт</span>')+(l.followup?'<span class="lmc-chip">Follow-up '+fmtD(l.followup)+'</span>':'')+'</div><div class="lmc-actions"><button class="primary" onclick="event.stopPropagation();openLB('+JSON.stringify(l.id)+')">Отвори профила</button>'+(phone||email||'<button disabled>Няма контакт</button>')+'</div></article>';
  }).join('');
}
var leadQuickCriteria={noWebsite:false,hasEmail:false,noSocial:false},leadVisibleIds=[];
function toggleLeadQuick(key,button){leadQuickCriteria[key]=!leadQuickCriteria[key];if(button)button.classList.toggle('active',leadQuickCriteria[key]);var all=document.querySelector('#lfTabs [data-f="all"]');if(all){var isAll=!leadQuickCriteria.noWebsite&&!leadQuickCriteria.hasEmail&&!leadQuickCriteria.noSocial&&lftab==='all';all.classList.toggle('active',isAll);all.style.background=isAll?'var(--b4)':'';all.style.color=isAll?'var(--w0)':'';}renderLeads();}
function clearLeadQuickFilters(button){leadQuickCriteria={noWebsite:false,hasEmail:false,noSocial:false};lftab='all';document.querySelectorAll('#lfTabs [data-quick]').forEach(function(x){x.classList.remove('active');});document.querySelectorAll('#lfTabs [data-f]').forEach(function(x){x.classList.remove('active');x.style.background='';x.style.color='';});if(button){button.classList.add('active');button.style.background='var(--b4)';button.style.color='var(--w0)';}renderLeads();}
function renderLeads() {
  normalizeData();ensureLeadPriorities();
  var q = (document.getElementById('srchQ').value || '').toLowerCase();
  var cat = document.getElementById('lCatF').value;
  var folder = getSelectedLeadFolder();
  var folderHome=!folder;renderLeadFolderView(folder);var outreachBtn=document.getElementById('leadOutreachBtn');if(outreachBtn)outreachBtn.style.display=folderHome?'none':'';var folderToolbar=document.querySelector('#pgleads>.ptbar'),folderTable=document.querySelector('#pgleads>.twrap'),activeFilters=document.getElementById('activeLeadFilters');if(folderToolbar)folderToolbar.style.display=folderHome?'none':'';if(folderTable)folderTable.style.display=folderHome?'none':'';if(activeFilters)activeFilters.style.display=folderHome?'none':'';
  var sort = document.getElementById('lSortF').value;
  var contact = (document.getElementById('lContactF') || {}).value || '';
  var rating = parseFloat((document.getElementById('lRatingF') || {}).value) || 0;
  var follow = (document.getElementById('lFollowF') || {}).value || '';
  renderActiveLeadFilters();
  var fil = leads.filter(function(l) {
    var mQ = !q || [l.name,l.website,l.phone,l.email,l.category,l.address,l.note,l.reviews,l.price,(l.tags||[]).join(' ')].join(' ').toLowerCase().indexOf(q) >= 0;
    var mC = !cat || l.category === cat;
    var mFolder = !folder || l.folder === folder;
    var mF = lftab === 'all' || l.status === lftab;
    var mContact = !contact || (contact==='phone'&&l.phone) || (contact==='email'&&l.email) || (contact==='website'&&l.website) || (contact==='no_website'&&!l.website) || (contact==='missing'&&!l.phone&&!l.email);
    var mRating = !rating || (parseFloat(l.stars)||0) >= rating;
    var now=new Date();now.setHours(0,0,0,0);var fu=l.followup?new Date(l.followup):null;if(fu)fu.setHours(0,0,0,0);var week=new Date(now);week.setDate(week.getDate()+7);
    var mFollow=!follow||(follow==='none'&&!fu)||(follow==='today'&&fu&&fu<=now)||(follow==='week'&&fu&&fu>=now&&fu<=week);
    var mQuick=(!leadQuickCriteria.noWebsite||!l.website)&&(!leadQuickCriteria.hasEmail||!!l.email)&&(!leadQuickCriteria.noSocial||!leadHasSocial(l));
    return mQ && mC && mFolder && mF && mContact && mRating && mFollow && mQuick;
  });
  leadVisibleIds=fil.map(function(l){return l.id;});var campaignBtn=document.getElementById('leadCampaignsBtn'),repliesBtn=document.getElementById('leadRepliesBtn'),folderCampaigns=leads.filter(function(l){return l.folder===folder&&l.outreach&&(l.outreach.status==='sent'||l.outreach.status==='replied');}),replyCount=folderCampaigns.filter(function(l){return l.outreach.status==='replied';}).length;if(campaignBtn){campaignBtn.textContent='Изпратени ('+folderCampaigns.length+')';campaignBtn.style.display=folderHome?'none':'';}if(repliesBtn){repliesBtn.textContent='↩ Отговори ('+replyCount+')';repliesBtn.style.display=folderHome?'none':'';repliesBtn.disabled=!replyCount;repliesBtn.classList.toggle('has-replies',replyCount>0);}
  fil.sort(function(a,b){
    var contactScore=function(x){return (x.phone?3:0)+(x.email?2:0)+(x.website?1:0);};
    if(sort==='priority') return leadPriorityCompare(a,b);
    if(sort==='quality') return (b.stars-a.stars)||(parseReviewCount(b.reviews)-parseReviewCount(a.reviews))||a.name.localeCompare(b.name,'bg');
    if(sort==='stars_desc') return (b.stars-a.stars)||a.name.localeCompare(b.name,'bg');
    if(sort==='stars_asc') return (a.stars-b.stars)||a.name.localeCompare(b.name,'bg');
    if(sort==='name_asc') return a.name.localeCompare(b.name,'bg');
    if(sort==='name_desc') return b.name.localeCompare(a.name,'bg');
    if(sort==='category') return (a.category||'').localeCompare(b.category||'','bg')||a.name.localeCompare(b.name,'bg');
    if(sort==='status'){var rank={prospect:0,maybe:1,unset:2,not:3};return (rank[a.status]??9)-(rank[b.status]??9)||b.stars-a.stars;}
    if(sort==='contacts') return contactScore(b)-contactScore(a)||b.stars-a.stars;
    if(sort==='followup') return (a.followup?new Date(a.followup):new Date('9999'))-(b.followup?new Date(b.followup):new Date('9999'));
    if(sort==='newest') return String(b.id).localeCompare(String(a.id));
    return b.stars-a.stars;
  });
  var filterKey=[q,cat,folder,sort,contact,rating,follow,lftab,leadPriorityRules.join(',')].join('|');if(filterKey!==leadFilterKey){leadFilterKey=filterKey;leadPage=1;}
  var pages=Math.max(1,Math.ceil(fil.length/leadPageSize));leadPage=Math.min(leadPage,pages);
  var rowStart=(leadPage-1)*leadPageSize,rows=fil.slice(rowStart,rowStart+leadPageSize);
  var has = leads.length > 0;
  document.getElementById('upzone').style.display = has ? 'none' : 'block';
  document.getElementById('ltable').style.display = has ? 'table' : 'none';
  document.getElementById('lempty').style.display = (has && !fil.length) ? 'block' : 'none';
  var summary=document.getElementById('leadSummary');
  if(summary){summary.style.display=folderHome?'none':'';var folderRows=leads.filter(function(l){return !folder||l.folder===folder;}),emails=folderRows.filter(function(l){return l.email;}).length,noSites=folderRows.filter(function(l){return !l.website;}).length,replied=folderRows.filter(function(l){return l.outreach&&l.outreach.status==='replied';}).length;summary.innerHTML='<div><strong>'+folderRows.length+'</strong><span>В папката</span></div><div><strong>'+noSites+'</strong><span>Без сайт</span></div><div><strong>'+emails+'</strong><span>С имейл</span></div><div><strong>'+replied+'</strong><span>Отговорили</span></div>';}  if(folderHome){var homeBadge=document.getElementById('pgbdg');homeBadge.style.display='';homeBadge.textContent=getLeadFolderNames().length+' папки';document.getElementById('ltbody').innerHTML='';renderMobileLeadCards([]);renderLeadPager(0,1);return;}

  var bdg = document.getElementById('pgbdg');
  bdg.style.display = has ? '' : 'none';
  bdg.textContent = fil.length + ' записа';
  document.getElementById('bdg-leads').textContent = leads.length; var taskBadge=document.getElementById('bdg-tasks');if(taskBadge)taskBadge.textContent=getTasks().filter(function(t){return !t.done;}).length;
  if (!has || !fil.length) { document.getElementById('ltbody').innerHTML = ''; renderMobileLeadCards([]); renderLeadPager(0,1); return; }
  var today = new Date(); today.setHours(0, 0, 0, 0);
  document.getElementById('ltbody').innerHTML = rows.map(function(l) {
    var stars = ''; for (var s = 1; s <= 5; s++) stars += '<span class="star' + (s <= l.stars ? ' on' : '') + '" onclick="event.stopPropagation();lStar(' + l.id + ',' + s + ')">★</span>';
    var fu = l.followup ? new Date(l.followup) : null; if (fu) fu.setHours(0,0,0,0);
    var fust = fu && fu <= today ? 'color:var(--red)' : 'color:var(--w3)';
    var tags = (l.tags || []).slice(0, 2).map(function(t) { return '<span class="tagp">' + esc(t) + '</span>'; }).join('');
    return '<tr onclick="openLB(' + l.id + ')">' +
      '<td><div class="tdn">' + esc(l.name) + '</div><div class="tds">' + (l.website ? '<a href="' + (l.website.indexOf('http') === 0 ? l.website : 'https://' + l.website) + '" target="_blank" onclick="event.stopPropagation()" style="color:var(--blue)">' + esc(l.website) + '</a>' : esc(l.phone || '')) + '</div>' + (tags ? '<div style="display:flex;gap:4px;margin-top:5px">' + tags + '</div>' : '') + '</td>' +
      '<td><span class="leadfolderpill">' + esc(l.folder || 'Без папка') + '</span></td>' +
      '<td>' + (l.website?'<div class="webstate yes">● Има</div><a class="leadweblink" href="'+(l.website.indexOf('http')===0?l.website:'https://'+l.website)+'" target="_blank" rel="noopener" onclick="event.stopPropagation()">'+esc(l.website)+'</a>':'<span class="webstate no">○ Няма</span>') + '</td>' +
      '<td><div class="stars">' + stars + '</div></td>' +
      '<td><button class="chip ' + SCL[l.status] + '" onclick="event.stopPropagation();lCS(' + l.id + ')">' + SL[l.status] + '</button></td>' +
      '<td style="font-size:14px;color:var(--w2)">' + esc(l.category || '—') + '</td>' +
      '<td style="font-size:12px;color:var(--w3)">' + (l.phone?'<div>✆ '+esc(l.phone)+'</div>':'') + (l.email?'<div>✉ '+esc(l.email)+'</div>':'') + (!l.phone&&!l.email?'<span style="color:var(--w4)">Няма във файла</span>':'') + '</td>' +
      '<td style="font-size:13px;font-family:var(--mono);' + fust + '">' + (l.followup ? fmtD(l.followup) : '—') + '</td>' +
      '<td onclick="event.stopPropagation()" class="lead-actions-cell"><div class="lead-row-actions">' +
        (l.email ? '<a href="mailto:' + esc(l.email) + '" class="btn btng btnsm" title="Имейл">✉</a> ' : '') +
        (l.phone ? '<a href="tel:' + esc(l.phone) + '" class="btn btng btnsm" title="Тел">✆</a> ' : '') +
        '<button class="btn btnd btnsm" onclick="delLead(' + l.id + ')">⌫</button></div>' +
      '</td></tr>';
  }).join('');
  renderMobileLeadCards(rows);
  renderLeadPager(fil.length,pages);
}
function changeLeadPage(delta){leadPage=Math.max(1,leadPage+delta);renderLeads();document.getElementById('pgleads').scrollIntoView({behavior:'smooth'});}
function changeLeadPageSize(value){leadPageSize=parseInt(value)||25;userSettings.leadPageSize=leadPageSize;saveData('profile');leadPage=1;renderLeads();}
function leadFilterLabel(id,value){var el=document.getElementById(id);if(!el||!value)return'';var option=Array.prototype.find.call(el.options,function(o){return o.value===String(value);});return option?option.textContent:String(value);}
function renderActiveLeadFilters(){
  var box=document.getElementById('activeLeadFilters'),count=document.getElementById('leadFilterCount');if(!box)return;
  ensureLeadPriorities();
  var filters=[],q=(document.getElementById('srchQ').value||'').trim(),pairs=[['folder','lFolderF'],['category','lCatF'],['contact','lContactF'],['rating','lRatingF'],['followup','lFollowF']];
  if(q)filters.push({key:'search',label:'Търсене: '+q});
  if(lftab!=='all')filters.push({key:'status',label:{prospect:'Потенциални',maybe:'Може би',not:'Не'}[lftab]||lftab});if(leadQuickCriteria.noWebsite)filters.push({key:'quick:noWebsite',label:'Без сайт'});if(leadQuickCriteria.hasEmail)filters.push({key:'quick:hasEmail',label:'С имейл'});if(leadQuickCriteria.noSocial)filters.push({key:'quick:noSocial',label:'Без социални мрежи'});
  pairs.forEach(function(x){var value=document.getElementById(x[1]).value;if(value)filters.push({key:x[0],label:leadFilterLabel(x[1],value)});});
  var sort=document.getElementById('lSortF');if(sort&&sort.value&&sort.value!=='priority')filters.push({key:'sort',label:'Подредба: '+leadFilterLabel('lSortF',sort.value)});
  leadPriorityRules.forEach(function(key,i){filters.push({key:'priority:'+key,label:(i+1)+'. '+(LEAD_PRIORITY_LABELS[key]||key),priority:true});});
  if(count){count.textContent=filters.length||'';count.style.display=filters.length?'inline-grid':'none';}
  box.innerHTML=filters.length?filters.map(function(f){var action=f.priority?'removeLeadPriority(\''+f.key.slice(9)+'\')':'clearLeadFilter(\''+f.key+'\')';return'<button class="'+(f.priority?'priorityselected':'')+'" onclick="'+action+'">'+esc(f.label)+' <b>×</b></button>';}).join('')+(filters.length>1?'<button class="clearall" onclick="resetLeadFilters()">Изчисти всички</button>':''):'';
}
function clearLeadFilter(key){
  var ids={folder:'lFolderF',category:'lCatF',contact:'lContactF',rating:'lRatingF',followup:'lFollowF'};
  if(!confirm('Премахни избрания филтър?'))return;
  if(key.indexOf('quick:')===0){var quickKey=key.slice(6);leadQuickCriteria[quickKey]=false;var quickButton=document.querySelector('#lfTabs [data-quick="'+quickKey+'"]');if(quickButton)quickButton.classList.remove('active');}else if(key==='search')document.getElementById('srchQ').value='';else if(key==='status')lftab='all';else if(key==='sort')document.getElementById('lSortF').value='priority';else if(ids[key])document.getElementById(ids[key]).value='';
  if(key==='status'){var first=document.querySelector('#lfTabs .btn');if(first)setLFTab(first);else renderLeads();}else renderLeads();
}
function applyLeadQuickFilter(key,value){var ids={category:'lCatF',contact:'lContactF',rating:'lRatingF',followup:'lFollowF'},id=ids[key],el=document.getElementById(id);if(!el)return;if(leadAddons.indexOf(key)<0)leadAddons.push(key);localStorage.setItem('d8LeadAddons',JSON.stringify(leadAddons));el.value=value;renderLeadAddons();closeLeadFilterMenu();renderLeads();}
function resetLeadFilters(){if(!confirm('Изчисти всички избрани филтри и правила за приоритет?'))return false;leadQuickCriteria={noWebsite:false,hasEmail:false,noSocial:false};document.querySelectorAll('#lfTabs [data-quick]').forEach(function(x){x.classList.remove('active');});document.getElementById('srchQ').value='';var status=document.getElementById('lStatusF');if(status)status.value='all';document.getElementById('lCatF').value='';document.getElementById('lContactF').value='';document.getElementById('lRatingF').value='';document.getElementById('lFollowF').value='';document.getElementById('lSortF').value='priority';lftab='all';ensureLeadPriorities();leadPriorityRules=[];localStorage.setItem('d8LeadPriority:'+(currentUser||'guest'),'[]');userSettings.leadPriorityRules=[];saveData('profile');renderLeadPriorityRules();setLFTab(document.querySelector('#lfTabs .btn'));return true;}
function deleteAllLeads(){if(!leads.length)return;if(!confirm('Изтрий всички '+leads.length+' leads? Това действие не може да се върне.'))return;leads=[];leadPage=1;saveData();renderLeads();populateCats();updateBadges();toast('Всички leads са изтрити','var(--red)');}
function deleteAllWeb(){if(!web.length)return;if(!confirm('Изтрий всички '+web.length+' Web Design проекта? Това действие не може да се върне.'))return;web=[];saveData();renderWeb();updateBadges();toast('Всички Web Design проекти са изтрити','var(--red)');}
function lCS(id) { var l = leads.find(function(x) { return x.id === id; }); if (!l) return; l.status = SC[l.status] || 'unset'; saveData(); renderLeads(); }
function lStar(id, n) { var l = leads.find(function(x) { return x.id === id; }); if (!l) return; l.stars = l.stars === n ? 0 : n; saveData(); renderLeads(); }
function delLead(id) { if (!confirm('Изтрий?')) return; leads = leads.filter(function(l) { return l.id !== id; }); saveData(); renderLeads(); updateBadges(); toast('⌫ Изтрит', 'var(--red)'); }

// ── LIGHTBOX ───────────────────────────────────────────
function renderLeadScraperData(l){
  var extra=l.extra&&typeof l.extra==='object'?l.extra:{},source=String(extra['Google Maps / source URL']||''),safeSource=/^https:\/\/(www\.)?google\.[^/]+\/maps\//i.test(source)||/^https:\/\/maps\.app\.goo\.gl\//i.test(source);
  var hidden={'Google Maps / source URL':1,'Source':1,'Email source':1},rows=Object.entries(extra).filter(function(e){return !hidden[e[0]]&&String(e[1]||'').trim();}).slice(0,10);
  if(!safeSource&&!rows.length)return'';
  return'<div class="fdiv"></div><div class="lbsec">Бизнес профил и контакти</div><div class="scraper-profile-card">'+(safeSource?'<a class="google-business-btn" href="'+esc(source)+'" target="_blank" rel="noopener noreferrer"><span>G</span><div><strong>Google Business Profile</strong><small>Отвори профила на бизнеса ↗</small></div></a>':'')+(rows.length?'<div class="scraper-extra-list">'+rows.map(function(e){var value=String(e[1]||''),isUrl=/^https?:\/\//i.test(value);return'<div><span>'+esc(e[0])+'</span>'+(isUrl?'<a href="'+esc(value)+'" target="_blank" rel="noopener noreferrer">Отвори ↗</a>':'<b>'+esc(value)+'</b>')+'</div>';}).join('')+'</div>':'')+'</div>';
}
function openLB(id) {
  lbid = id; var l = leads.find(function(x) { return x.id === id; }); if (!l) return;
  var init = (l.name || '?').split(' ').slice(0, 2).map(function(w) { return w[0]; }).join('').toUpperCase();
  var stars = ''; for (var s = 1; s <= 5; s++) stars += '<span class="lbstar' + (s <= l.stars ? ' on' : '') + '" onclick="lbStar(' + s + ')">★</span>';
  document.getElementById('lbhdr').innerHTML =
    '<div class="lbav">' + esc(init) + '</div>' +
    '<div class="lbidentity"><div class="lbeyebrow">LEAD ПРОФИЛ</div><div class="lbname">' + esc(l.name) + '</div>' +
    '<div class="lbmeta">' + (l.category ? '<span>' + esc(l.category) + '</span>' : '') + (l.address ? '<span>' + esc(l.address) + '</span>' : '') + '</div>' +
    '<div class="lbwebline"><span class="lbwebstatus '+(l.website?'has':'missing')+'">'+(l.website?'● Има уебсайт':'○ Няма уебсайт')+'</span>'+(l.website?'<a class="lburl" href="'+(l.website.indexOf('http')===0?l.website:'https://'+l.website)+'" target="_blank" rel="noopener">'+esc(l.website)+'</a>':'<span class="lburl empty">Добави адрес от полето по-долу</span>')+'</div>' +
    '<div class="lbchips" id="lbchips"><button class="chip ' + SCL[l.status] + '" onclick="lbCS()">' + SL[l.status] + '</button><div class="lbstars">' + stars + '</div>' +
    (l.email ? '<a href="mailto:' + esc(l.email) + '" class="chip cgr">✉ ' + esc(l.email) + '</a>' : '') +
    (l.phone ? '<a href="tel:' + esc(l.phone) + '" class="chip cgr">✆ ' + esc(l.phone) + '</a>' : '') +
    '</div></div><button class="mclose" onclick="closeLB()">✕</button>';

  document.getElementById('lbinfo').innerHTML =
    '<div class="lbsec">Информация</div>' +
    '<div class="fg"><label class="flbl">Папка</label><select class="fsel" onchange="setLeadFolder(this.value)">' + leadFolderOptions(l.folder,true) + '</select></div>' +
    '<div class="fg"><label class="flbl">Уебсайт <span class="fieldstate '+(l.website?'yes':'no')+'">'+(l.website?'Има':'Няма')+'</span></label><input class="fi" value="' + esc(l.website || '') + '" placeholder="https://example.bg" onchange="lbSet(\'website\',this.value.trim());renderLeads()"></div>' +
    '<div class="fg"><label class="flbl">Телефон</label><input class="fi" value="' + esc(l.phone || '') + '" placeholder="—" onchange="lbSet(\'phone\',this.value)"></div>' +
    '<div class="fg"><label class="flbl">Имейл</label><input class="fi" value="' + esc(l.email || '') + '" placeholder="—" onchange="lbSet(\'email\',this.value)"></div>' +
    '<div class="fg"><label class="flbl">Адрес</label><input class="fi" value="' + esc(l.address || '') + '" placeholder="—" onchange="lbSet(\'address\',this.value)"></div>' +
    '<div class="fg"><label class="flbl">Категория</label><input class="fi" value="' + esc(l.category || '') + '" placeholder="—" onchange="lbSet(\'category\',this.value)"></div>' +
    '<div class="fdiv"></div>' +
    '<div class="fg"><label class="flbl">Followup дата</label><input type="date" class="fi" value="' + esc(l.followup || '') + '" onchange="lbSet(\'followup\',this.value);renderLeads()"></div>' +
    '<div class="fg"><label class="flbl">Статус</label><select class="fsel" onchange="lbSet(\'status\',this.value);lbRefresh();renderLeads()">' +
    Object.keys(SL).map(function(v) { return '<option value="' + v + '"' + (l.status === v ? ' selected' : '') + '>' + SL[v] + '</option>'; }).join('') + '</select></div>' +
    renderLeadScraperData(l);

  document.getElementById('lbnotes').innerHTML =
    '<div class="lbsec">Бележки</div>' +
    '<textarea class="fta" style="min-height:130px" placeholder="Бележки — предишни разговори, наблюдения..." onblur="lbSet(\'note\',this.value)">' + esc(l.note || '') + '</textarea>' +
    '<div class="fdiv"></div><div class="lbsec">Тагове</div>' +
    '<div class="tagsbox" id="lbTagsBox"></div>';
  lbRenderTags();

  document.getElementById('lbai').innerHTML =
    '<div class="lbsec">Безплатен Sales Assistant</div>' +
    '<div class="aitabs"><button class="aitab active" onclick="aiTab(\'phone\',this)">📞 Телефонен скрипт</button><button class="aitab" onclick="aiTab(\'email\',this)">✉ Имейл / съобщение</button></div>' +
    '<div class="aitc active" id="aitcPhone"><button class="aibtn" id="aiBtnP" onclick="genAI(\'phone\')">✦ Създай безплатен телефонен скрипт</button>' +
    '<div class="aibox" id="aiBoxP">' + (l.aiPhone || '<div class="aiph"><div class="ico">📞</div><p>Работи офлайн и без API — opener, въпроси, възражения и затваряне.</p></div>') + '</div></div>' +
    '<div class="aitc" id="aitcEmail"><button class="aibtn" id="aiBtnE" onclick="genAI(\'email\')">✦ Създай безплатен имейл / съобщение</button>' +
    '<div class="aibox" id="aiBoxE">' + (l.aiEmail || '<div class="aiph"><div class="ico">✉</div><p>Работи офлайн и без API — готов персонализиран първи контакт и follow-up.</p></div>') + '</div></div>';

  document.getElementById('lbOv').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeLB() { document.getElementById('lbOv').classList.remove('open'); document.body.style.overflow = ''; lbid = null; }
function getLB() { return leads.find(function(x) { return x.id === lbid; }); }
function lbSet(f, v) { var l = getLB(); if (!l) return; l[f] = v; saveData(); }
function lbStar(n) { var l = getLB(); if (!l) return; l.stars = l.stars === n ? 0 : n; saveData(); lbRefresh(); }
function lbCS() { var l = getLB(); if (!l) return; l.status = SC[l.status] || 'unset'; saveData(); lbRefresh(); renderLeads(); }
function lbRefresh() {
  var l = getLB(); if (!l) return;
  var stars = ''; for (var s = 1; s <= 5; s++) stars += '<span class="lbstar' + (s <= l.stars ? ' on' : '') + '" onclick="lbStar(' + s + ')">★</span>';
  document.getElementById('lbchips').innerHTML = '<button class="chip ' + SCL[l.status] + '" onclick="lbCS()">' + SL[l.status] + '</button><div class="lbstars">' + stars + '</div>' + (l.email ? '<a href="mailto:' + esc(l.email) + '" class="chip cgr">✉ ' + esc(l.email) + '</a>' : '') + (l.phone ? '<a href="tel:' + esc(l.phone) + '" class="chip cgr">✆ ' + esc(l.phone) + '</a>' : '');
}
function lbRenderTags() {
  var l = getLB(); if (!l) return;
  document.getElementById('lbTagsBox').innerHTML = (l.tags || []).map(function(t) { return '<span class="tagp">' + esc(t) + '<button onclick="lbRmTag(\'' + esc(t) + '\')">×</button></span>'; }).join('') + '<input class="tinp" placeholder="Добави таг (Enter)..." onkeydown="lbAddTag(event)">';
}
function lbAddTag(e) { if (e.key !== 'Enter' && e.key !== ',') return; e.preventDefault(); var v = e.target.value.trim(); if (!v) return; var l = getLB(); if (!l) return; if (l.tags.indexOf(v) < 0) l.tags.push(v); saveData(); lbRenderTags(); }
function lbRmTag(t) { var l = getLB(); if (!l) return; l.tags = l.tags.filter(function(x) { return x !== t; }); saveData(); lbRenderTags(); }
function lbDel() { if (!confirm('Изтрий?')) return; var id = lbid; closeLB(); leads = leads.filter(function(l) { return l.id !== id; }); saveData(); renderLeads(); updateBadges(); toast('⌫ Изтрит', 'var(--red)'); }
function aiTab(t, el) {
  document.querySelectorAll('.aitab').forEach(function(x) { x.classList.remove('active'); });
  document.querySelectorAll('.aitc').forEach(function(x) { x.classList.remove('active'); });
  el.classList.add('active');
  document.getElementById('aitc' + t.charAt(0).toUpperCase() + t.slice(1)).classList.add('active');
}

function saveOpenAIKey(){
  var input=document.getElementById('openaiKeyInp'),status=document.getElementById('apiStatus');
  var key=(input||{}).value||'';
  if(!key.startsWith('sk-')){toast('⚠ Ключът трябва да започва с sk-','var(--yellow)');return;}
  fetch('/api/key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:key})})
    .then(function(resp){return resp.json().then(function(data){if(!resp.ok)throw new Error(data.error||'Грешка');return data;});})
    .then(function(){input.value='';status.textContent='Свързан';status.className='chip cg';toast('✓ ChatGPT е свързан','var(--green)');})
    .catch(function(err){status.textContent='Грешка';status.className='chip cr';toast('⚠ '+err.message,'var(--red)');});
}
function refreshApiStatus(){
  fetch('/api/status').then(function(r){return r.json();}).then(function(data){
    var status=document.getElementById('apiStatus');if(!status)return;
    status.textContent=data.connected?'Свързан':'Не е свързан';status.className='chip '+(data.connected?'cg':'cgr');
  }).catch(function(){});
}

// ── AI ADVICE ──────────────────────────────────────────
function salesAngle(l){
  var c=String(l.category||'').toLowerCase();
  if(/restaurant|ресторант|cafe|кафе|food|bar|bakery|пекар/.test(c)) return 'повече резервации, по-силно локално присъствие и съдържание, което показва атмосферата и менюто';
  if(/hotel|хотел|travel|туриз/.test(c)) return 'повече директни резервации, по-добро представяне на преживяването и по-малка зависимост от платформи';
  if(/beauty|salon|красот|spa|фризьор|nail/.test(c)) return 'повече записани часове, силно портфолио преди/след и редовно връщане на клиентите';
  if(/fitness|gym|фитнес|sport|спорт/.test(c)) return 'повече запитвания за членство, показване на резултати и изграждане на активна общност';
  if(/clinic|doctor|medical|dental|health|клиника|лекар|дент|здрав/.test(c)) return 'повече качествени запитвания, ясно представяне на услугите и по-високо доверие';
  if(/shop|store|retail|магазин|fashion|мода/.test(c)) return 'повече продажби, по-добро представяне на продуктите и кампании към точната аудитория';
  if(/real estate|имот|property/.test(c)) return 'повече качествени запитвания и по-силно визуално представяне на офертите';
  if(/law|legal|адвокат|account|счетов/.test(c)) return 'повече доверие, ясно обяснени услуги и постоянен поток от подходящи запитвания';
  return 'повече качествени запитвания, по-силно онлайн присъствие и по-ясно представяне на услугите';
}
function freePhoneScript(l){
  var name=l.name||'фирмата',category=l.category||'вашия бизнес',angle=salesAngle(l);
  var site=l.website?'Разгледах сайта ви '+l.website+' и':'Попаднах на '+name+' и';
  return '**ПОДГОТОВКА**\nЦел: кратък разговор от 2–3 минути и уговаряне на следваща стъпка.\n\n**НАЧАЛО**\n„Здравейте, обаждам се от Digital Eight. '+site+' ми направи впечатление начинът, по който представяте '+category+'. Удобно ли е да ви отнема 30 секунди, за да кажа защо се обаждам?“\n\n**ПРИЧИНА ЗА ОБАЖДАНЕТО**\n„Помагаме на бизнеси като '+name+' да постигат '+angle+'. Имам две конкретни идеи за вас и исках първо да разбера как работите в момента.“\n\n**КВАЛИФИКАЦИОННИ ВЪПРОСИ**\n1. „Откъде идват повечето ви нови клиенти в момента?“\n2. „Кое искате да подобрите най-много през следващите 3 месеца — повече запитвания, продажби или разпознаваемост?“\n3. „Имате ли човек, който редовно следи сайта, социалните мрежи и рекламите?“\n\n**ПРЕДЛОЖЕНИЕ**\n„На база това бих започнал с кратък анализ и 2–3 бързи подобрения, които могат да дадат видим резултат без да променяте всичко наведнъж.“\n\n**АКО КАЖАТ „НЕ МЕ ИНТЕРЕСУВА“**\n„Разбирам напълно. Мога ли само да ви изпратя две конкретни идеи за '+name+'? Ако не са полезни, няма нужда да продължаваме.“\n\n**ЗАТВАРЯНЕ**\n„Кое е по-удобно — кратък 15-минутен разговор утре или да ви изпратя идеите по имейл/WhatsApp?“\n\n**БЕЛЕЖКА СЛЕД РАЗГОВОРА**\nЗапиши нуждата, възражението и точната следваща дата за контакт.';
}
function freeEmailScript(l){
  var name=l.name||'вашия бизнес',category=l.category||'вашата сфера',angle=salesAngle(l);
  var observation=l.website?'Разгледах '+l.website+' и виждам добра основа, върху която може да се надгради.':'Попаднах на '+name+' и ми направи впечатление начинът, по който представяте бизнеса си.';
  return '**ТЕМА**\n2 конкретни идеи за '+name+'\n\n**ИМЕЙЛ**\nЗдравейте,\n\n'+observation+'\n\nВ Digital Eight помагаме на бизнеси в сферата на '+category+' да постигат '+angle+'. За '+name+' виждам няколко практични възможности, които могат да се приложат без голяма промяна наведнъж.\n\nМога да ви изпратя кратък безплатен анализ с 2–3 конкретни идеи. Ако ви бъдат полезни, можем да направим 15-минутен разговор и да обсъдим следващите стъпки.\n\nУдобно ли е да ви го изпратя?\n\nПоздрави,\nDigital Eight\n\n**КРАТЪК FOLLOW-UP СЛЕД 3 ДНИ**\n„Здравейте, пиша във връзка с идеите за '+name+'. Мога да ги изпратя в кратък вид тук — без ангажимент. Кое е по-важно за вас в момента: повече запитвания или по-силно онлайн представяне?“\n\n**СЪВЕТ**\nДобави името на конкретен човек, ако го знаеш, и спомени едно реално наблюдение от сайта или профила им.';
}
function genAI(type){
  var l=getLB();if(!l)return;var isP=type==='phone';
  var btn=document.getElementById(isP?'aiBtnP':'aiBtnE'),box=document.getElementById(isP?'aiBoxP':'aiBoxE');
  btn.disabled=true;btn.textContent='Създава...';
  var text=isP?freePhoneScript(l):freeEmailScript(l),html=fmtAI(text);
  setTimeout(function(){
    box.innerHTML=html;if(isP)l.aiPhone=html;else l.aiEmail=html;saveData();
    btn.disabled=false;btn.textContent=isP?'↻ Създай нов телефонен скрипт':'↻ Създай нов имейл';
    toast('✓ Безплатният скрипт е готов','var(--green)');
  },180);
}

function fmtAI(text) {
  var h = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^## (.+)$/gm, '<h4>$1</h4>')
    .replace(/^# (.+)$/gm, '<h4>$1</h4>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
  return '<div class="air"><p>' + h + '</p><button class="aircopy" onclick="cpAI(this)">⎘ Копирай текста</button></div>';
}
function cpAI(btn) {
  var t = btn.closest('.air').innerText.replace('⎘ Копирай текста', '').trim();
  navigator.clipboard.writeText(t).then(function() { toast('⎘ Копирано', 'var(--green)'); }).catch(function() { toast('⚠ Грешка при копиране', 'var(--red)'); });
}

// ── EXPORT ─────────────────────────────────────────────
function doExport() {
  if (!leads.length) { toast('Няма данни за експорт', 'var(--yellow)'); return; }
  var cols = ['name','website','phone','email','category','address','stars','status','followup','tags','note'];
  var hdrs = ['Наименование','Уебсайт','Телефон','Имейл','Категория','Адрес','Оценка','Статус','Followup','Тагове','Бележки'];
  var rows = leads.map(function(l) {
    return cols.map(function(c) {
      var v = c === 'tags' ? (l.tags || []).join('; ') : String(l[c] || '');
      return '"' + v.replace(/"/g, '""') + '"';
    }).join(',');
  });
  var csv = '\ufeff' + hdrs.join(',') + '\n' + rows.join('\n');
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type: 'text/csv;charset=utf-8'}));
  a.download = 'd8_leads_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  toast('↓ CSV изтегля се', 'var(--green)');
}



// ── SAFE OUTREACH WORKSPACE ──────────────────────────
var outreachSegment='email_no_site',outreachLeadId=null,outreachReplySyncing=false,outreachScopeIds=null;
function syncOutreachReplies(manual){if(outreachReplySyncing||!currentUser)return;outreachReplySyncing=true;var btn=document.getElementById('outreachSyncBtn');if(btn){btn.disabled=true;btn.textContent='Проверяваме…';}fetch('api.php?action=syncOutreachReplies',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'}).then(function(r){return r.json().catch(function(){return{};}).then(function(d){if(!r.ok)throw new Error(d.error||'IMAP грешка');return d;});}).then(function(d){if(d.updated){outreachSegment='replied';outreachScopeIds=null;return fetch('api.php?action=load',{credentials:'same-origin'}).then(function(r){return r.json();}).then(function(x){var state=x.state||{};leads=state.leads||leads;lastServerUpdatedAt=state.updatedAt||lastServerUpdatedAt;normalizeData();saveLocal(false);renderLeads();renderLeadOutreach();if(window.renderReports)renderReports();toast('Получени нови отговори: '+d.updated,'var(--green)');});}if(manual)toast('Проверени писма: '+(d.checked||0)+' · няма нов съвпадащ отговор','var(--blue)');}).catch(function(e){if(manual)toast(e.message||'Грешка при IMAP проверката','var(--red)');}).finally(function(){outreachReplySyncing=false;if(btn){btn.disabled=false;btn.textContent='Провери отговори';}});}
setInterval(function(){if(currentUser&&document.visibilityState==='visible')syncOutreachReplies(false);},60000);
var outreachSending=false;window.addEventListener('beforeunload',function(e){if(!outreachSending)return;e.preventDefault();e.returnValue='';});
function approvedOutreachRows(){return outreachRows('no_presence').filter(function(l){return l.email&&l.outreach&&l.outreach.status==='ready';});}
function updateOutreachSendButton(){var btn=document.getElementById('outreachSendAllBtn'),approve=document.getElementById('outreachApproveAllBtn'),count=approvedOutreachRows().length,candidates=outreachRows('no_presence').filter(function(l){return l.email&&(!l.outreach||l.outreach.status!=='sent');});if(btn){btn.textContent='Изпрати одобрените'+(count?' ('+count+')':'');btn.disabled=!count||outreachSending;}if(approve){approve.textContent='Одобри сегмента'+(candidates.length?' ('+candidates.length+')':'');approve.disabled=!candidates.length||outreachSending;}}
function showOutreachProgress(done,total,failed,label){var box=document.getElementById('outreachProgress');if(!box)return;box.hidden=false;var pct=total?Math.round(done/total*100):0;box.innerHTML='<div class="outreachprogresscard"><span class="modaleyebrow">ГРУПОВО ИЗПРАЩАНЕ</span><h3>'+esc(label||'Изпращаме одобрените писма…')+'</h3><p><b>'+done+'</b> от '+total+' приключени'+(failed?' · <em>'+failed+' грешки</em>':'')+'</p><div><i style="width:'+pct+'%"></i></div><small>Не затваряй страницата, докато процесът не приключи.</small></div>';}
function finishOutreachProgress(total,failed,errors){var box=document.getElementById('outreachProgress');if(!box)return;box.innerHTML='<div class="outreachprogresscard finished"><span class="modaleyebrow">КАМПАНИЯТА ПРИКЛЮЧИ</span><h3>'+(failed?'Изпращането завърши с грешки':'Всички писма са изпратени')+'</h3><p><b>'+(total-failed)+'</b> успешни'+(failed?' · <em>'+failed+' неуспешни</em>':'')+'</p>'+(errors&&errors.length?'<div class="outreacherrors">'+errors.map(function(x){return'<span>'+esc(x)+'</span>';}).join('')+'</div>':'')+'<button class="btn btnp" onclick="closeOutreachProgress()">Готово</button></div>';}function closeOutreachProgress(){var box=document.getElementById('outreachProgress');if(box){box.hidden=true;box.innerHTML='';}renderLeadOutreach();}
function approveOutreachSegment(){var rows=outreachRows('no_presence').filter(function(l){return l.email&&(!l.outreach||l.outreach.status!=='sent');});if(!rows.length){toast('Няма нови leads в този сегмент','var(--yellow)');return;}if(!confirm('Прегледа ли офертата? Ще одобриш '+rows.length+' персонализирани чернови за групово изпращане.'))return;var approved=0;rows.forEach(function(l){var d=outreachDraft(l),c=outreachCheck(d.subject,d.body,l);if(c.score>=70){l.outreach=Object.assign({},l.outreach||{},d,{status:'ready',updatedAt:new Date().toISOString()});approved++;}});saveData();renderLeadOutreach();toast('✓ Одобрени '+approved+' чернови','var(--green)');}
function syncOutreachStateBeforeSend(){return new Promise(function(resolve,reject){var started=Date.now();function wait(){if(syncInFlight){if(Date.now()-started>15000){reject(new Error('Синхронизацията отне твърде дълго'));return;}setTimeout(wait,250);return;}clearTimeout(syncTimer);syncPending=false;syncScope='';var payload=JSON.stringify(Object.assign(localState(),{saveScope:'shared'}));fetch('api.php?action=save',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:payload}).then(function(r){return r.json().catch(function(){return{};}).then(function(d){if(!r.ok)throw new Error(d.error||'Данните не се записаха');return d;});}).then(function(d){lastServerUpdatedAt=d.updatedAt||new Date().toISOString();localStorage.removeItem('d8SyncDirty');setSyncState('saved','Всичко е запазено');resolve();}).catch(reject);}wait();});}
function scheduleLeadFollowup(l){var days=parseInt(userSettings.outreachFollowupDays)||7,d=new Date();d.setDate(d.getDate()+days);var iso=d.toISOString().slice(0,10);l.followup=iso;l.outreach=Object.assign({},l.outreach||{},{nextFollowupAt:iso,followupStatus:'scheduled'});}
function sendApprovedOutreachBatch(){if(outreachSending)return;var rows=approvedOutreachRows();if(!rows.length){toast('Няма одобрени leads без сайт и социални мрежи','var(--yellow)');return;}if(!confirm('Ще изпратиш '+rows.length+' персонализирани писма до контакти с потвърдено съгласие. Продължи?'))return;outreachSending=true;updateOutreachSendButton();showOutreachProgress(0,rows.length,0,'Синхронизираме leads със сървъра…');var done=0,failed=0,errors=[];function next(){if(done>=rows.length){outreachSending=false;saveData();finishOutreachProgress(rows.length,failed,errors);updateOutreachSendButton();renderLeadOutreach();return;}var l=rows[done],d=outreachDraft(l);showOutreachProgress(done,rows.length,failed,'Изпращаме до '+l.name);fetch('api.php?action=sendOutreach',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({leadId:l.id,subject:d.subject,body:d.body,consentConfirmed:true})}).then(function(r){return r.json().catch(function(){return{};}).then(function(x){if(!r.ok)throw new Error(x.error||'Грешка при изпращане');return x;});}).then(function(){l.outreach=Object.assign({},l.outreach||{},d,{status:'sent',sentAt:new Date().toISOString(),updatedAt:new Date().toISOString(),sendError:''});scheduleLeadFollowup(l);}).catch(function(e){failed++;errors.push(l.name+': '+(e.message||'Грешка'));l.outreach=Object.assign({},l.outreach||{},d,{status:'ready',sendError:e.message||'Грешка',updatedAt:new Date().toISOString()});}).finally(function(){done++;saveLocal(true,'shared');showOutreachProgress(done,rows.length,failed,done<rows.length?'Подготвяме следващото писмо…':'Финализираме…');setTimeout(next,3000+Math.floor(Math.random()*2500));});}syncOutreachStateBeforeSend().then(next).catch(function(e){outreachSending=false;finishOutreachProgress(rows.length,rows.length,['Синхронизация: '+(e.message||'грешка')]);updateOutreachSendButton();});}function leadHasSocial(l){var extra=l&&l.extra&&typeof l.extra==='object'?l.extra:{};return Object.keys(extra).some(function(k){var v=String(extra[k]||'');return /facebook|instagram|linkedin|youtube|tiktok|twitter|x.com/i.test(k+' '+v);});}
function outreachRows(segment){var folder=getSelectedLeadFolder();return leads.filter(function(l){if(!folder||l.folder!==folder)return false;if(Array.isArray(outreachScopeIds)&&outreachScopeIds.indexOf(l.id)<0)return false;var noSite=!String(l.website||'').trim(),hasEmail=!!String(l.email||'').trim(),hasContact=hasEmail||!!String(l.phone||'').trim(),noSocial=!leadHasSocial(l);if(segment==='email_no_site')return noSite&&hasEmail;if(segment==='contact_no_site')return noSite&&hasContact;if(segment==='no_presence')return noSite&&hasContact&&noSocial;if(segment==='ready')return l.outreach&&l.outreach.status==='ready';if(segment==='sent')return l.outreach&&l.outreach.status==='sent';if(segment==='replied')return l.outreach&&l.outreach.status==='replied';return false;});}
function outreachStatusLabel(l){var s=l.outreach&&l.outreach.status;return s==='replied'?'Отговорил':s==='sent'?'Изпратен':s==='ready'?'Готов':s==='draft'?'Чернова':'Нов';}
function openLeadOutreach(){var folder=getSelectedLeadFolder();if(!folder){toast('Първо отвори папка с leads','var(--yellow)');return;}outreachScopeIds=leadVisibleIds.slice();var ov=document.getElementById('leadOutreachOv');if(!ov)return;ov.classList.add('open');document.body.classList.add('outreach-open');outreachSegment='no_presence';var rows=outreachRows(outreachSegment);document.getElementById('leadOutreachTitle').textContent='Кампания · '+folder+' · '+rows.length+' подходящи';outreachLeadId=rows.length?rows[0].id:null;renderLeadOutreach();}
function openLeadReplies(){var folder=getSelectedLeadFolder();if(!folder)return;outreachScopeIds=null;outreachSegment='replied';var rows=outreachRows('replied'),ov=document.getElementById('leadOutreachOv');document.getElementById('leadOutreachTitle').textContent='Отговори · '+folder;outreachLeadId=rows.length?rows[0].id:null;if(ov)ov.classList.add('open');document.body.classList.add('outreach-open');renderLeadOutreach();}
function openLeadCampaignHistory(){var folder=getSelectedLeadFolder();if(!folder)return;outreachScopeIds=null;var replied=outreachRows('replied');outreachSegment=replied.length?'replied':'sent';var rows=outreachRows(outreachSegment),ov=document.getElementById('leadOutreachOv');document.getElementById('leadOutreachTitle').textContent='Кампании · '+folder;outreachLeadId=rows.length?rows[0].id:null;if(ov)ov.classList.add('open');document.body.classList.add('outreach-open');renderLeadOutreach();}
function closeLeadOutreach(){if(outreachSending){toast('Изчакай изпращането да приключи','var(--yellow)');return;}var ov=document.getElementById('leadOutreachOv');if(ov)ov.classList.remove('open');document.body.classList.remove('outreach-open');}
function setOutreachSegment(segment){outreachSegment=segment;var rows=outreachRows(segment);outreachLeadId=rows.length?rows[0].id:null;renderLeadOutreach();}
function selectOutreachLead(id){outreachLeadId=id;renderLeadOutreach();}
function outreachTemplate(l){var place=l.address||l.category||'вашия район',category=l.category||'местния бизнес',nl=String.fromCharCode(10);return{subject:'Идеи за онлайн представянето на '+l.name,body:['Здравейте,','Казвам се Кирил и съм от Digital Eight.','Попаднах на '+l.name+', докато разглеждах '+place+'. Забелязах, че онлайн представянето ви може да се развие с по-ясен уебсайт и подходящо съдържание за социалните мрежи.','Бих искал да ви предложа кратка 20-минутна среща с начален анализ на бизнеса ви, за която не дължите такса. Можем да я проведем онлайн или на живо, според вашето предпочитание. Срещата не ви обвързва с поръчка.','Ако след анализа решите да обсъдим реализация, ще получите преференциални начални условия за избраната услуга, съобразена с '+category+'.','Ако темата е актуална, отговорете с онлайн или на живо и ще предложа удобни часове. Ако не е подходящо, просто ми кажете и няма да ви пиша отново.','Поздрави,'+nl+'Кирил | Digital Eight'+nl+'kiril@digitaleight.bg'+nl+'https://digitaleight.bg'].join(nl+nl)};}function outreachDraft(l){var base=outreachTemplate(l),saved=l.outreach||{};return{subject:saved.subject||base.subject,body:saved.body||base.body,status:saved.status||'new'};}
function outreachCheck(subject,body,l){var notes=[],score=100,links=(body.match(new RegExp('https?://','gi'))||[]).length,upper=(body.match(/[A-ZА-Я]{5,}/g)||[]).length,risky=['безплатно','гарантирано','последен шанс','купи сега','спешно','100%','промоция'];if(!subject.trim()){notes.push('Добави ясна тема.');score-=30;}if(subject.length>60){notes.push('Темата е над 60 символа.');score-=10;}if(body.indexOf(l.name)<0){notes.push('Добави името на бизнеса.');score-=20;}if(body.length<120){notes.push('Текстът е прекалено кратък.');score-=15;}if(body.length>1200){notes.push('Съкрати текста под 1200 символа.');score-=10;}if(links>1){notes.push('Остави максимум един линк.');score-=15;}if(upper>2){notes.push('Намали думите с главни букви.');score-=10;}risky.forEach(function(w){if((subject+' '+body).toLowerCase().indexOf(w)>=0){notes.push('Прегледай рекламната фраза „'+w+'“.');score-=8;}});if(!/няма да ви пиша|не желаете|отпиша/i.test(body)){notes.push('Добави лесен начин за отказ.');score-=15;}score=Math.max(0,Math.min(100,score));return{score:score,notes:notes,label:score>=90?'Готово за човешки преглед':score>=70?'Нужни са малки корекции':'Редактирай преди изпращане'};}function renderLeadOutreach(){var segments=document.getElementById('outreachSegments'),list=document.getElementById('outreachList'),composer=document.getElementById('outreachComposer');if(!segments||!list||!composer)return;var defs=[['email_no_site','Имейл · без сайт'],['contact_no_site','Контакт · без сайт'],['no_presence','Без сайт и socials'],['ready','Готови'],['sent','Изпратени'],['replied','Отговорили']];updateOutreachSendButton();segments.innerHTML='<label class="outreach-segment-picker"><span>Покажи</span><select class="fi" onchange="setOutreachSegment(this.value)">'+defs.map(function(x){return'<option value="'+x[0]+'" '+(outreachSegment===x[0]?'selected':'')+'>'+x[1]+' ('+outreachRows(x[0]).length+')</option>';}).join('')+'</select></label>';var rows=outreachRows(outreachSegment);list.innerHTML=rows.length?rows.map(function(l){return'<button class="outreachlead '+(l.id===outreachLeadId?'active':'')+'" onclick="selectOutreachLead('+JSON.stringify(l.id)+')"><span><strong>'+esc(l.name)+'</strong><small>'+esc(l.email||l.phone||'Без директен контакт')+'</small></span><i class="'+((l.outreach&&l.outreach.status)||'new')+'">'+outreachStatusLabel(l)+'</i></button>';}).join(''):'<div class="outreachempty"><b>Няма leads</b><span>Този smart сегмент няма резултати в папката.</span></div>';var l=leads.find(function(x){return x.id===outreachLeadId;});if(!l){composer.innerHTML='<div class="outreachwelcome"><span>SAFE OUTREACH</span><h3>Избери потенциален клиент</h3><p>Ще получиш персонализирана чернова и Inbox проверка преди изпращане.</p></div>';return;}var d=outreachDraft(l),check=outreachCheck(d.subject,d.body,l);composer.innerHTML='<div class="outreachleadhead"><div><span>ПОЛУЧАТЕЛ</span><h3>'+esc(l.name)+'</h3><a href="mailto:'+esc(l.email)+'">'+esc(l.email||'Само телефон')+'</a></div><div class="presencechips"><i class="'+(l.website?'has':'miss')+'">'+(l.website?'Има сайт':'Без сайт')+'</i><i class="'+(leadHasSocial(l)?'has':'miss')+'">'+(leadHasSocial(l)?'Има socials':'Без socials')+'</i></div></div>'+(l.outreach&&l.outreach.status==='replied'?'<div class="reply-received-card"><span>ПОЛУЧЕН ОТГОВОР</span><strong>'+esc(l.outreach.replySubject||'Без тема')+'</strong><small>'+esc(l.email)+' · '+(l.outreach.replyAt?new Date(l.outreach.replyAt).toLocaleString('bg-BG'):'получен')+'</small></div>':'')+'<label class="outreachfield"><span>Изпратена тема</span><input id="outreachSubject" value="'+esc(d.subject)+'" oninput="refreshOutreachCheck()"></label><label class="outreachfield grow"><span>Съобщение</span><textarea id="outreachBody" oninput="refreshOutreachCheck()">'+esc(d.body)+'</textarea></label><div class="outreachcheck" id="outreachCheck"></div><div class="outreachactions simplified"><button class="btn btnp" onclick="approveOutreachDraft()">Одобри текста</button><details class="lead-more"><summary class="btn btng">Още</summary><div class="lead-more-menu"><button onclick="saveOutreachDraft()">Запази чернова</button><button onclick="copyOutreachDraft()">Копирай текста</button><button onclick="markOutreachSent()">Отбележи като изпратен</button></div></details></div>';refreshOutreachCheck();}
function currentOutreachLead(){return leads.find(function(x){return x.id===outreachLeadId;});}
function getOutreachEditor(){return{subject:(document.getElementById('outreachSubject')||{}).value||'',body:(document.getElementById('outreachBody')||{}).value||''};}
function refreshOutreachCheck(){var l=currentOutreachLead(),box=document.getElementById('outreachCheck');if(!l||!box)return;var d=getOutreachEditor(),c=outreachCheck(d.subject,d.body,l);box.className='outreachcheck '+(c.score>=90?'good':c.score>=70?'warn':'bad');box.innerHTML='<div><b>'+c.score+'/100</b><span>'+c.label+'</span></div>'+(c.notes.length?'<ul>'+c.notes.slice(0,4).map(function(n){return'<li>'+esc(n)+'</li>';}).join('')+'</ul>':'<p>Персонализацията, дължината и линковете изглеждат добре.</p>');}
function storeOutreach(status){var l=currentOutreachLead();if(!l)return;var d=getOutreachEditor();l.outreach={subject:d.subject.trim(),body:d.body.trim(),status:status,updatedAt:new Date().toISOString(),sentAt:status==='sent'?new Date().toISOString():((l.outreach||{}).sentAt||'')};if(status==='sent')scheduleLeadFollowup(l);saveData();renderLeadOutreach();}
function saveOutreachDraft(){storeOutreach('draft');toast('✓ Черновата е запазена','var(--green)');}
function approveOutreachDraft(){var l=currentOutreachLead(),d=getOutreachEditor();if(!l)return;var c=outreachCheck(d.subject,d.body,l);if(c.score<70){toast('Редактирай рисковите места преди одобрение','var(--yellow)');return;}storeOutreach('ready');toast('✓ Текстът е готов за ръчен преглед','var(--green)');}
function markOutreachSent(){var l=currentOutreachLead();if(!l)return;if(!l.email){toast('Този lead няма имейл','var(--yellow)');return;}if(!l.outreach||l.outreach.status!=='ready'){toast('Първо прегледай и одобри текста','var(--yellow)');return;}if(!confirm('Потвърждаваш ли, че писмото е изпратено ръчно?'))return;storeOutreach('sent');toast('✓ Отбелязано като изпратено','var(--green)');}
function copyOutreachDraft(){var d=getOutreachEditor(),text='Тема: '+d.subject+'\n\n'+d.body;navigator.clipboard.writeText(text).then(function(){toast('✓ Черновата е копирана','var(--green)');}).catch(function(){toast('Неуспешно копиране','var(--red)');});}
// ── LEADS FILTER BUILDER ──
var leadAddons=[],leadPriorityRules=[],leadPriorityProfile='';
try{leadAddons=JSON.parse(localStorage.getItem('d8LeadAddons')||'[]');if(!Array.isArray(leadAddons))leadAddons=[];}catch(e){leadAddons=[];}
function renderLeadAddons(){document.querySelectorAll('.lead-addon').forEach(function(el){var on=leadAddons.indexOf(el.dataset.addon)>=0;el.classList.toggle('shown',on);var mark=document.getElementById('fa-'+el.dataset.addon);if(mark)mark.textContent=on?'✓':'＋';});renderLeadPriorityRules();}
var leadFilterReturnFocus=null;
function ensureLeadFilterPortal(){var menu=document.getElementById('leadFilterMenu'),backdrop=document.getElementById('leadFilterBackdrop');if(backdrop&&backdrop.parentNode!==document.body)document.body.appendChild(backdrop);if(menu&&menu.parentNode!==document.body)document.body.appendChild(menu);return{menu:menu,backdrop:backdrop};}
function openLeadFilterMenu(){var portal=ensureLeadFilterPortal(),menu=portal.menu,backdrop=portal.backdrop;if(!menu)return;leadFilterReturnFocus=document.activeElement;menu.classList.add('open');if(backdrop)backdrop.classList.add('open');document.body.classList.add('lead-filter-open');var close=menu.querySelector('.filterclose');if(close)setTimeout(function(){close.focus();},30);}
function closeLeadFilterMenu(){var portal=ensureLeadFilterPortal(),menu=portal.menu,backdrop=portal.backdrop;if(menu)menu.classList.remove('open');if(backdrop)backdrop.classList.remove('open');document.body.classList.remove('lead-filter-open');if(leadFilterReturnFocus&&document.contains(leadFilterReturnFocus))leadFilterReturnFocus.focus();leadFilterReturnFocus=null;}
function toggleLeadFilterMenu(e){if(e){e.preventDefault();e.stopPropagation();}var menu=document.getElementById('leadFilterMenu');if(menu&&menu.classList.contains('open'))closeLeadFilterMenu();else openLeadFilterMenu();}
function toggleLeadAddon(key){var i=leadAddons.indexOf(key);if(i>=0){if(!confirm('Премахни този филтър от панела?'))return;leadAddons.splice(i,1);var el=document.querySelector('.lead-addon[data-addon="'+key+'"]');if(el)el.value='';}else leadAddons.push(key);localStorage.setItem('d8LeadAddons',JSON.stringify(leadAddons));renderLeadAddons();renderLeads();}
function ensureLeadPriorities(){var profile=currentUser||'guest';if(leadPriorityProfile===profile)return;leadPriorityProfile=profile;try{var saved=JSON.parse(localStorage.getItem('d8LeadPriority:'+profile)||'null');leadPriorityRules=Array.isArray(userSettings.leadPriorityRules)?userSettings.leadPriorityRules.slice():(Array.isArray(saved)?saved:['no_site','low_reviews']);}catch(e){leadPriorityRules=['no_site','low_reviews'];}}
var LEAD_PRIORITY_LABELS={no_site:'Без сайт',low_reviews:'Малко ревюта',low_rating:'Ниска оценка',has_phone:'С телефон',has_email:'С имейл'};
function saveLeadPriorities(){localStorage.setItem('d8LeadPriority:'+(currentUser||'guest'),JSON.stringify(leadPriorityRules));userSettings.leadPriorityRules=leadPriorityRules.slice();saveData('profile');renderLeadPriorityRules();renderLeads();}
function toggleLeadPriority(key){ensureLeadPriorities();var i=leadPriorityRules.indexOf(key);if(i>=0){if(!confirm('Премахни това правило за приоритет?'))return;leadPriorityRules.splice(i,1);}else leadPriorityRules.push(key);saveLeadPriorities();}
function moveLeadPriority(key,delta){ensureLeadPriorities();var i=leadPriorityRules.indexOf(key),n=i+delta;if(i<0||n<0||n>=leadPriorityRules.length)return;var x=leadPriorityRules[i];leadPriorityRules[i]=leadPriorityRules[n];leadPriorityRules[n]=x;saveLeadPriorities();}
function removeLeadPriority(key){ensureLeadPriorities();if(!confirm('Премахни това правило за приоритет?'))return;leadPriorityRules=leadPriorityRules.filter(function(x){return x!==key;});saveLeadPriorities();}
function renderLeadPriorityRules(){ensureLeadPriorities();Object.keys(LEAD_PRIORITY_LABELS).forEach(function(key){var mark=document.getElementById('fp-'+key);if(mark)mark.textContent=leadPriorityRules.indexOf(key)>=0?'✓':'＋';});renderActiveLeadFilters();}
function leadPriorityCompare(a,b){ensureLeadPriorities();for(var i=0;i<leadPriorityRules.length;i++){var key=leadPriorityRules[i],d=0;if(key==='no_site')d=(a.website?1:0)-(b.website?1:0);else if(key==='low_reviews')d=parseReviewCount(a.reviews)-parseReviewCount(b.reviews);else if(key==='low_rating')d=(parseFloat(a.stars)||0)-(parseFloat(b.stars)||0);else if(key==='has_phone')d=(b.phone?1:0)-(a.phone?1:0);else if(key==='has_email')d=(b.email?1:0)-(a.email?1:0);if(d)return d;}return a.name.localeCompare(b.name,'bg');}
document.addEventListener('keydown',function(e){if(e.key!=='Escape')return;var folderEditor=document.getElementById('folderEditorOv');if(document.getElementById('leadOutreachOv')&&document.getElementById('leadOutreachOv').classList.contains('open'))closeLeadOutreach();else if(folderEditor&&folderEditor.classList.contains('open'))closeLeadFolderEditor();else if(document.getElementById('lbOv').classList.contains('open'))closeLB();else closeLeadFilterMenu();});

