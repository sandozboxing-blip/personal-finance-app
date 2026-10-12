(function(){
'use strict';
var editing=null;
function today(){return financeTodayIso();}
function amount(e){return Number(e.amount)||0;}
window.expensePayments=function(e,through){
 var dates=[],start=e.start,end=through||today();if(!start||start>end)return dates;if(e.end&&e.end<end)end=e.end;
 if(e.type==='once'){if(start<=end)dates.push(start);return dates;}
 var step=e.type==='yearly'?12:1;
 for(var i=0;i<12000;i+=step){var d=addMonths(start,i),date=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');if(date>end)break;dates.push(date);}return dates;
};
window.expenseMonthly=function(e){return e.type!=='once'&&e.start<=today()&&(!e.end||e.end>=today())?amount(e)/(e.type==='yearly'?12:1):0;};
function refresh(){saveData('shared');renderExpenses();renderDash();if(window.renderReports)renderReports();}
window.renderExpenses=function(){
 var host=document.getElementById('expensesContent');if(!host)return;
 host.innerHTML='<section class="dashpanel"><div class="dashpanelhead"><div><h3>Разходи</h3><span>Еднократни плащания и абонаменти · EUR</span></div><button class="btn btng" id="newExpense">+ Добави разход</button></div><div class="dashpanelbody"><p>Абонаментите се отчитат автоматично от началната дата до днес или до крайната дата. Годишните се включват в месечния бюджет като 1/12 от сумата.</p><form id="expenseForm" hidden style="margin:20px 0"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px"><label>Име<input class="linp" name="name" required maxlength="120"></label><label>Сума (€)<input class="linp" name="amount" type="number" min="0.01" step="0.01" required></label><label>Тип<select class="linp" name="type"><option value="once">Еднократен</option><option value="monthly">Месечен абонамент</option><option value="yearly">Годишен абонамент</option></select></label><label>Начална дата<input class="linp" name="start" type="date" required></label><label>Крайна дата (по избор)<input class="linp" name="end" type="date"></label><label>Бележка<input class="linp" name="note" maxlength="500"></label></div><p><button class="btn btng" type="submit">Запази</button> <button class="btn" type="button" id="cancelExpense">Отказ</button></p></form><div id="expenseList"></div></div></section>';
 var list=document.getElementById('expenseList');if(!expenses.length)list.textContent='Все още няма добавени разходи.';
 expenses.slice().sort(function(a,b){return b.start.localeCompare(a.start);}).forEach(function(e){var row=document.createElement('div');row.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:18px 0;border-bottom:1px solid var(--border)';var info=document.createElement('div');info.style.flex='1';info.innerHTML='<strong>'+esc(e.name)+'</strong><p>'+amount(e).toLocaleString('bg-BG',{minimumFractionDigits:2})+' € · '+({once:'Еднократен',monthly:'Месечен',yearly:'Годишен'}[e.type]||'')+' · '+esc(e.start)+(e.end?' → '+esc(e.end):'')+'</p><small>'+esc(e.note||'')+'</small>';row.appendChild(info);['Редактирай','Изтрий'].forEach(function(label,i){var b=document.createElement('button');b.className='btn btnsm';b.textContent=label;b.onclick=function(){if(!i)open(e);else if(confirm('Да изтрия „'+e.name+'“?')){expenses=expenses.filter(function(x){return x.id!==e.id;});refresh();}};row.appendChild(b);});list.appendChild(row);});
 document.getElementById('newExpense').onclick=function(){open();};document.getElementById('cancelExpense').onclick=function(){editing=null;document.getElementById('expenseForm').hidden=true;};
 document.getElementById('expenseForm').onsubmit=function(ev){ev.preventDefault();var f=ev.target,v=Object.fromEntries(new FormData(f));if(v.end&&v.end<v.start){f.elements.end.setCustomValidity('Крайната дата трябва да е след началната.');f.elements.end.reportValidity();return;}v.amount=Number(v.amount);v.name=v.name.trim();if(!v.name||!Number.isFinite(v.amount)||v.amount<=0)return;v.id=editing||('expense-'+Date.now()+'-'+Math.random().toString(36).slice(2));if(editing)expenses=expenses.map(function(e){return e.id===editing?v:e;});else expenses.push(v);editing=null;refresh();};document.getElementById('expenseForm').elements.end.oninput=function(){this.setCustomValidity('');};
};
function open(e){var f=document.getElementById('expenseForm');f.reset();editing=e?e.id:null;['name','amount','type','start','end','note'].forEach(function(k){f.elements[k].value=e?e[k]||'':(k==='start'?today():k==='type'?'once':'');});f.elements.end.setCustomValidity('');f.hidden=false;f.elements.name.focus();}
})();
