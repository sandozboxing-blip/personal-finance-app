/* Styled proxies retain the original form fields, values and application handlers. */
(function(){
'use strict';
var records=new WeakMap(),active=null,popup=document.createElement('div');
var selector='select,input[type=date],input[type=time]';
popup.id='customControlPopover';popup.className='custom-popover';popup.hidden=true;document.body.appendChild(popup);
var chevron='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4"/></svg>';
var calendar='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="16" rx="4"/><path d="M8 3v4M16 3v4M4 11h16M8 15h.1M12 15h.1M16 15h.1"/></svg>';
var clock='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
function pad(n){return String(n).padStart(2,'0');}
function iso(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function date(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v||''))return null;var a=v.split('-').map(Number),d=new Date(a[0],a[1]-1,a[2]);return iso(d)===v?d:null;}
function labelFor(source){var title=source.getAttribute('aria-label')||source.title;if(title)return title;var labels=source.labels;if(labels&&labels.length){var copy=labels[0].cloneNode(true);copy.querySelectorAll('.custom-control-trigger,input,select').forEach(function(el){el.remove();});return copy.textContent.trim().slice(0,100);}var field=source.closest('.fg'),label=field&&field.querySelector('.flbl');if(label)return label.textContent.trim();var names={smmF:'Статус на SMM клиентите',webF:'Статус на проектите',wtClient:'Свързан клиент',wtAssignee:'Изпълнител',wtPriority:'Приоритет',wtDue:'Крайна дата',tmPriority:'Приоритет',tmRepeat:'Повторение',tmTime:'Час на събитието'};return names[source.id]||'Избери стойност';}
function button(text,action,cls){var b=document.createElement('button');b.type='button';b.className=cls||'custom-option';b.textContent=text;b.addEventListener('click',action);return b;}
function fire(source){source.dispatchEvent(new Event('input',{bubbles:true}));source.dispatchEvent(new Event('change',{bubbles:true}));}
function choose(value){var source=active.source;source.value=value;fire(source);close(true);}
function sync(record){
 var source=record.source,trigger=record.trigger,text;
 if(!source.isConnected||!trigger.isConnected)return;
 if(source.tagName==='SELECT'){var option=source.options[source.selectedIndex];text=option?option.textContent:'Избери…';}
 else if(source.type==='date'){var d=date(source.value);text=d?d.toLocaleDateString('bg-BG',{day:'2-digit',month:'long',year:'numeric'}):'Избери дата';}
 else text=source.value||'Избери час';
 if(record.text.textContent!==text)record.text.textContent=text;
 trigger.disabled=source.disabled||source.readOnly;
 trigger.classList.toggle('is-placeholder',!source.value);
 trigger.setAttribute('aria-label',labelFor(source)+': '+text);
 trigger.style.display=source.style.display==='none'||source.hidden?'none':'';
}
function syncLayout(record){var style=getComputedStyle(record.source);record.trigger.style.gridColumn=style.gridColumn;record.trigger.style.alignSelf=style.alignSelf;}
function enhance(source){
 if(records.has(source)||(source.tagName==='SELECT'&&(source.multiple||source.size>1)))return;
 var trigger=document.createElement('button');trigger.type='button';trigger.className=source.className+' custom-control-trigger';trigger.dataset.source=source.id||source.name||'';
 trigger.style.cssText=source.style.cssText;trigger.setAttribute('aria-haspopup',source.tagName==='SELECT'?'listbox':'dialog');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls',popup.id);
 var text=document.createElement('span');text.className='custom-control-text';trigger.appendChild(text);
 var icon=document.createElement('span');icon.className='custom-control-icon';icon.innerHTML=source.tagName==='SELECT'?chevron:source.type==='date'?calendar:clock;trigger.appendChild(icon);
 source.classList.add('custom-native');source.setAttribute('tabindex','-1');source.setAttribute('aria-hidden','true');source.insertAdjacentElement('afterend',trigger);
 var record={source:source,trigger:trigger,text:text};records.set(source,record);
 var prototype=source.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;
 ['value'].concat(source.tagName==='SELECT'?['selectedIndex']:[]).forEach(function(key){var descriptor=Object.getOwnPropertyDescriptor(prototype,key);if(descriptor&&descriptor.configurable)Object.defineProperty(source,key,{configurable:true,get:function(){return descriptor.get.call(this);},set:function(value){descriptor.set.call(this,value);sync(record);}});});
 source.addEventListener('change',function(){sync(record);});source.addEventListener('input',function(){sync(record);});
 source.addEventListener('focus',function(){trigger.focus();});
 source.addEventListener('invalid',function(event){event.preventDefault();trigger.setAttribute('aria-invalid','true');trigger.title=source.validationMessage;trigger.focus();});
 trigger.addEventListener('click',function(){if(active&&active.source===source){close(true);return;}open(record);});
 trigger.addEventListener('keydown',function(event){if(['ArrowDown','ArrowUp','Enter',' '].indexOf(event.key)>=0){event.preventDefault();open(record);}});
 sync(record);syncLayout(record);
}
function position(){
 if(!active)return;var rect=active.trigger.getBoundingClientRect(),width=Math.min(innerWidth-24,active.source.tagName==='SELECT'?Math.max(rect.width,260):336);
 active.anchorLeft=rect.left;active.anchorTop=rect.top;
 popup.style.width=width+'px';popup.style.left=Math.max(12,Math.min(innerWidth-width-12,rect.left))+'px';
 popup.style.maxHeight=Math.max(150,Math.min(500,innerHeight-24))+'px';
 var height=Math.min(popup.scrollHeight,parseFloat(popup.style.maxHeight)),bottom=innerHeight-rect.bottom-20,above=rect.top-20,top;
 if(bottom>=height)top=rect.bottom+8;
 else if(above>=height)top=rect.top-height-8;
 else top=Math.max(12,Math.min(innerHeight-height-12,rect.bottom+8));
 popup.style.top=top+'px';popup.classList.toggle('opens-above',top<rect.top);
}
function close(focus){if(!active)return;var previous=active;active=null;popup.hidden=true;popup.replaceChildren();previous.trigger.setAttribute('aria-expanded','false');if(focus&&previous.trigger.isConnected)previous.trigger.focus();}
function open(record){
 if(record.source.disabled||record.source.readOnly)return;close(false);active=record;popup.replaceChildren();popup.hidden=false;record.trigger.setAttribute('aria-expanded','true');record.trigger.removeAttribute('aria-invalid');
 if(record.source.tagName==='SELECT')renderSelect('');else if(record.source.type==='date'){var d=date(record.source.value)||new Date();if(record.source.min&&iso(d)<record.source.min)d=date(record.source.min)||d;if(record.source.max&&iso(d)>record.source.max)d=date(record.source.max)||d;active.month=new Date(d.getFullYear(),d.getMonth(),1);active.focusDate=iso(d);renderCalendar();}else renderTime();
 position();requestAnimationFrame(function(){if(!active)return;var focus=popup.querySelector('.custom-search')||popup.querySelector('.calendar-day[tabindex="0"]:not(:disabled)')||popup.querySelector('[role="option"][aria-selected="true"]:not(:disabled)')||popup.querySelector('button:not(:disabled),input');if(focus){focus.focus({preventScroll:true});var bounds=focus.getBoundingClientRect(),box=popup.getBoundingClientRect();if(bounds.bottom>box.bottom||bounds.top<box.top)popup.scrollTop=Math.max(0,focus.offsetTop-popup.clientHeight/2);}});
}
function renderSelect(filter){
 var source=active.source;popup.setAttribute('role','listbox');popup.setAttribute('aria-label',labelFor(source));
 if(!filter&&source.options.length>8){var search=document.createElement('input');search.className='custom-search';search.type='search';search.placeholder='Търси в списъка…';search.setAttribute('aria-label','Търси в опциите');search.addEventListener('input',function(){renderOptions(search.value);position();});popup.appendChild(search);}
 var list=document.createElement('div');list.className='custom-options';popup.appendChild(list);renderOptions(filter);
}
function renderOptions(query){var list=popup.querySelector('.custom-options');list.replaceChildren();var source=active.source,found=0;
 Array.from(source.options).forEach(function(option){if(option.hidden||!option.textContent.toLocaleLowerCase('bg').includes(query.toLocaleLowerCase('bg')))return;found++;var b=button(option.textContent,function(){choose(option.value);});b.setAttribute('role','option');b.setAttribute('aria-selected',String(option.selected));b.disabled=option.disabled||(option.parentElement.tagName==='OPTGROUP'&&option.parentElement.disabled);if(option.selected)b.classList.add('is-selected');list.appendChild(b);});
 if(!found){var empty=document.createElement('p');empty.className='custom-empty';empty.textContent='Няма съвпадения';list.appendChild(empty);}
}
function allowed(value){return(!active.source.min||value>=active.source.min)&&(!active.source.max||value<=active.source.max);}
function changeMonth(delta){active.month=new Date(active.month.getFullYear(),active.month.getMonth()+delta,1);renderCalendar();position();popup.querySelector('.calendar-heading').focus();}
function renderCalendar(){
 popup.replaceChildren();popup.setAttribute('role','dialog');popup.setAttribute('aria-label','Избери дата');
 var month=active.month,header=document.createElement('div');header.className='custom-calendar-header';
 var previous=button('‹',function(){changeMonth(-1);},'calendar-arrow');previous.setAttribute('aria-label','Предишен месец');header.appendChild(previous);
 var heading=button(month.toLocaleDateString('bg-BG',{month:'long',year:'numeric'}),renderMonthChooser,'calendar-heading');header.appendChild(heading);
 var next=button('›',function(){changeMonth(1);},'calendar-arrow');next.setAttribute('aria-label','Следващ месец');header.appendChild(next);popup.appendChild(header);
 var weekdays=document.createElement('div');weekdays.className='custom-calendar-week';['Пн','Вт','Ср','Чт','Пт','Сб','Нд'].forEach(function(day){var el=document.createElement('span');el.textContent=day;weekdays.appendChild(el);});popup.appendChild(weekdays);
 var grid=document.createElement('div');grid.className='custom-calendar-grid';grid.setAttribute('role','grid');grid.setAttribute('aria-label',month.toLocaleDateString('bg-BG',{month:'long',year:'numeric'}));
 var start=new Date(month);start.setDate(1-(start.getDay()+6)%7);var today=iso(new Date());
 var calendarRow;for(var i=0;i<42;i++){if(i%7===0){calendarRow=document.createElement('div');calendarRow.className='custom-calendar-row';calendarRow.setAttribute('role','row');grid.appendChild(calendarRow);}(function(d){var value=iso(d),b=button(d.getDate(),function(){choose(value);},'calendar-day');b.dataset.date=value;b.setAttribute('role','gridcell');b.setAttribute('aria-label',d.toLocaleDateString('bg-BG',{day:'numeric',month:'long',year:'numeric'}));b.setAttribute('aria-selected',String(value===active.source.value));b.tabIndex=value===active.focusDate?0:-1;b.disabled=!allowed(value);if(d.getMonth()!==month.getMonth())b.classList.add('outside-month');if(value===today)b.setAttribute('aria-current','date');if(value===active.source.value)b.classList.add('is-selected');calendarRow.appendChild(b);})(new Date(start.getFullYear(),start.getMonth(),start.getDate()+i));}
 popup.appendChild(grid);footer(true);
}
function renderMonthChooser(){
 popup.replaceChildren();var year=active.month.getFullYear(),header=document.createElement('div');header.className='custom-calendar-header';
 header.appendChild(button('‹',function(){active.month.setFullYear(year-1);renderMonthChooser();position();},'calendar-arrow'));
 var title=document.createElement('strong');title.textContent=year;header.appendChild(title);header.appendChild(button('›',function(){active.month.setFullYear(year+1);renderMonthChooser();position();},'calendar-arrow'));popup.appendChild(header);
 var months=document.createElement('div');months.className='custom-months';for(var m=0;m<12;m++){(function(n){var b=button(new Date(2026,n,1).toLocaleDateString('bg-BG',{month:'short'}),function(){active.month=new Date(year,n,1);renderCalendar();position();},'custom-option');months.appendChild(b);})(m);}popup.appendChild(months);
 popup.appendChild(button('Обратно към дните',function(){renderCalendar();position();},'calendar-heading'));position();
}
function footer(isDate){var row=document.createElement('div');row.className='custom-control-footer';if(isDate){var today=iso(new Date()),b=button('Днес',function(){choose(today);},'custom-secondary');b.disabled=!allowed(today);row.appendChild(b);}var clear=button('Изчисти',function(){choose('');},'custom-secondary');clear.disabled=active.source.required;row.appendChild(clear);popup.appendChild(row);}
function renderTime(){
 popup.setAttribute('role','dialog');popup.setAttribute('aria-label','Избери час');var title=document.createElement('h3');title.textContent='Избери час';popup.appendChild(title);var parts=(active.source.value||'09:00').split(':').map(Number),row=document.createElement('div');row.className='custom-time-fields';
 ['Час','Минути'].forEach(function(label,i){var field=document.createElement('label');field.textContent=label;var input=document.createElement('input');input.type='number';input.min='0';input.max=i?'59':'23';input.step='1';input.value=pad(parts[i]);input.className='custom-time-number';input.setAttribute('aria-label',label);field.appendChild(input);row.appendChild(field);});popup.appendChild(row);
 var quick=document.createElement('div');quick.className='custom-time-quick';['09:00','10:00','12:00','14:00','16:00','18:00'].forEach(function(time){var choice=button(time,function(){choose(time);},'custom-secondary');choice.disabled=!!((active.source.min&&time<active.source.min)||(active.source.max&&time>active.source.max));quick.appendChild(choice);});popup.appendChild(quick);
 var apply=button('Потвърди часа',function(){var inputs=popup.querySelectorAll('.custom-time-number');if(!Array.from(inputs).every(function(input){return input.value!==''&&input.reportValidity();}))return;var value=pad(Number(inputs[0].value))+':'+pad(Number(inputs[1].value));if((active.source.min&&value<active.source.min)||(active.source.max&&value>active.source.max)){inputs[0].setCustomValidity('Часът е извън позволения диапазон.');inputs[0].reportValidity();return;}choose(value);},'btn btnp custom-time-apply');popup.appendChild(apply);footer(false);
}
popup.addEventListener('input',function(event){if(event.target.classList.contains('custom-time-number'))popup.querySelectorAll('.custom-time-number').forEach(function(input){input.setCustomValidity('');});});
popup.addEventListener('keydown',function(event){
 if(!active)return;var options=Array.from(popup.querySelectorAll('[role=option]:not(:disabled)')),index=options.indexOf(document.activeElement);
 if(options.length&&['ArrowDown','ArrowUp','Home','End'].includes(event.key)&&(!event.target.classList.contains('custom-search')||event.key==='ArrowDown'||event.key==='ArrowUp')){event.preventDefault();var next=event.key==='Home'?0:event.key==='End'?options.length-1:index<0?(event.key==='ArrowDown'?0:options.length-1):(index+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;options[next].focus();}
 else if(event.target.dataset.date&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key)){
  event.preventDefault();var d=date(event.target.dataset.date);if(event.key==='PageUp'||event.key==='PageDown'){var day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+(event.key==='PageDown'?1:-1));d.setDate(Math.min(day,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()));}else{var offset={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7,Home:-(d.getDay()+6)%7,End:6-(d.getDay()+6)%7}[event.key];d.setDate(d.getDate()+offset);}var value=iso(d);if(!allowed(value))return;active.month=new Date(d.getFullYear(),d.getMonth(),1);active.focusDate=value;renderCalendar();position();var cell=popup.querySelector('[data-date="'+value+'"]');if(cell)cell.focus();
 }
});
document.addEventListener('keydown',function(event){if(!active)return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close(true);}else if(event.key==='Tab'){var stops=Array.from(popup.querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex="0"]')).filter(function(el){return el.tabIndex>=0;});if(active.source.tagName==='SELECT'||(event.shiftKey&&document.activeElement===stops[0])||(!event.shiftKey&&document.activeElement===stops[stops.length-1]))close(true);}},true);
document.addEventListener('pointerdown',function(event){if(active&&!popup.contains(event.target)&&!active.trigger.contains(event.target))close(false);},true);
document.addEventListener('scroll',function(event){
 if(!active||event.target===popup||popup.contains(event.target))return;
 // Activation can deliver a queued scroll event after the popup has opened.
 // Dismiss only when its anchor actually moved, not for that earlier scroll.
 var rect=active.trigger.getBoundingClientRect();
 if(Math.abs(rect.left-active.anchorLeft)>1||Math.abs(rect.top-active.anchorTop)>1)close(false);
},true);
window.addEventListener('resize',function(){close(false);});
/* Only inspect changed fields/subtrees. Animation and badge mutations must not
   schedule a document-wide scan or force synchronous layout reads. */
var pending=new Map(),frame=0;
function queue(source,layout){if(!source.isConnected)return;pending.set(source,!!layout||pending.get(source)===true);}
function collect(root,layout){
 if(!root||root.nodeType!==1||root.closest('.custom-popover,.custom-control-trigger,.glass-nav-marker,.glass-click-flash'))return;
 if(root.matches(selector))queue(root,layout);
 root.querySelectorAll(selector).forEach(function(source){queue(source,layout);});
}
function flush(){
 frame=0;var work=Array.from(pending);pending.clear();
 work.forEach(function(item){var source=item[0];if(!source.isConnected)return;if(!records.has(source))enhance(source);else{sync(records.get(source));if(item[1])syncLayout(records.get(source));}});
 if(active&&(!active.source.isConnected||!active.trigger.getClientRects().length))close(false);
}
function schedule(){if(!frame&&pending.size)frame=requestAnimationFrame(flush);}
function scan(root){collect(root||document.body,true);flush();}
document.addEventListener('reset',function(event){requestAnimationFrame(function(){scan(event.target);});},true);
new MutationObserver(function(changes){
 changes.forEach(function(change){
  var target=change.target.nodeType===1?change.target:change.target.parentElement;
  if(!target||target.closest('.custom-popover,.custom-control-trigger,.glass-nav-marker,.glass-click-flash'))return;
  if(change.type==='attributes'){
   if(target.matches(selector))queue(target,change.attributeName==='style');
   else if(change.attributeName==='hidden'||change.attributeName==='style'||change.attributeName==='data-event-type')collect(target,true);
  }else{
   var select=target.closest('select');if(select)queue(select,false);
   change.addedNodes.forEach(function(node){collect(node,true);});
  }
 });
 if(active&&!active.source.isConnected)close(false);schedule();
}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','hidden','style','min','max','required','data-event-type']});
window.addEventListener('resize',function(){collect(document.body,true);schedule();},{passive:true});
scan();window.d8RefreshControls=scan;
})();
