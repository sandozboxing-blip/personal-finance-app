(function(){
'use strict';
var paths={
 dashboard:'<rect x="3" y="3" width="7" height="8" rx="2.2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="3" y="15" width="7" height="6" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2.2"/>',
 income:'<path d="M4 9.5h13a3 3 0 0 1 3 3V19a2 2 0 0 1-2 2H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h6"/><path d="M16 15.5h4M15 7l3-3 3 3M18 4v7"/>',
 profit:'<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v5c0 1.7 2.7 3 6 3M3 12v5c0 1.7 2.7 3 6 3M15 7v3M14 19l3-3 3 3M17 16v6"/>',
 expenses:'<path d="M7 3.5h10a2 2 0 0 1 2 2v15l-3-1.8-4 1.8-4-1.8-3 1.8v-15a2 2 0 0 1 2-2Z"/><path d="M14.5 8.5c-.5-.6-1.2-1-2-1-1.9 0-3 1.8-3 4s1.1 4 3 4c.8 0 1.5-.3 2-1M7.5 10h5M7.5 12.5h4"/>',
 smm:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20v-1a6 6 0 0 1 12 0v1M17 5a3.2 3.2 0 0 1 0 6M18 15a5 5 0 0 1 3 4v1"/>',
 web:'<rect x="2.5" y="4" width="19" height="16" rx="4"/><path d="M2.5 9h19M6 6.5h.1M9 6.5h.1M10 12.5 7.5 15 10 17.5M14 12.5l2.5 2.5-2.5 2.5"/>',
 leads:'<circle cx="10" cy="10" r="6.5"/><path d="m15 15 5.5 5.5M7.5 10h5M10 7.5v5"/>',
 reports:'<path d="M4 3.5v14a3 3 0 0 0 3 3h14M8 15l4-5 4 2 5-7"/><path d="M17 5h4v4"/>',
 tasks:'<rect x="3" y="5" width="18" height="16" rx="4"/><path d="M7.5 3v4M16.5 3v4M3 11h18M8 15h.1M12 15h.1M16 15h.1M8 18h.1M12 18h.1"/>',
 work:'<rect x="3.5" y="4" width="17" height="17" rx="3.5"/><path d="M8 4V2.5h8V4M7.5 10l1.5 1.5 3-3M7.5 16l1.5 1.5 3-3M15 10h2M15 16h2"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.08-1l2-1.55-2-3.46-2.4.97a7 7 0 0 0-1.72-1L14.45 3h-4.9L9.2 5.96a7 7 0 0 0-1.72 1l-2.4-.97-2 3.46 2 1.55A7 7 0 0 0 5 12c0 .34.03.67.08 1l-2 1.55 2 3.46 2.4-.97a7 7 0 0 0 1.72 1l.35 2.96h4.9l.35-2.96a7 7 0 0 0 1.72-1l2.4.97 2-3.46-2-1.55c.05-.33.08-.66.08-1z"/>',
 more:'<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
 moon:'<path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z"/>'
};
function svg(name){return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">'+(paths[name]||paths.dashboard)+'</svg>';}
window.d8Icon=svg;
document.querySelectorAll('.sbi').forEach(function(button){var match=(button.getAttribute('onclick')||'').match(/goPage\('([^']+)'/);var icon=button.querySelector('.ic');if(match&&icon){icon.innerHTML=svg(match[1]==='dash'?'dashboard':match[1]);icon.style.color='';}});
var mobile={'mobileClientsButton':'smm','mobileLeadAdd':'leads','mobileTasksButton':'work','mobileMoreButton':'more'};
Object.keys(mobile).forEach(function(id){var icon=document.querySelector('#'+id+' .nav-icon-wrap');if(icon){icon.innerHTML=svg(mobile[id]);icon.firstChild.classList.add('nav-icon');}});
var home=document.querySelector('.nav-home .nav-icon-wrap');if(home){home.innerHTML=svg('dashboard');home.firstChild.classList.add('nav-icon');}
document.querySelectorAll('.mobile-more-grid button,.mobile-client-options button').forEach(function(button){var m=(button.getAttribute('onclick')||'').match(/'([^']+)'/),old=button.querySelector('svg');if(m&&old)old.outerHTML=svg(m[1]==='dash'?'dashboard':m[1]);});
var top=document.querySelector('.topbar');if(top){var toggle=document.createElement('button');toggle.type='button';toggle.className='theme-toggle';toggle.id='themeToggle';toggle.setAttribute('data-theme-toggle','');top.insertBefore(toggle,document.getElementById('syncStatus'));}
function applyTheme(theme){document.documentElement.dataset.theme=theme;document.querySelectorAll('[data-theme-toggle]').forEach(function(button){var previous=button.querySelector('svg');previous=previous&&previous.cloneNode(true);button.innerHTML='<i class="theme-icon-slot" aria-hidden="true">'+svg(theme==='dark'?'sun':'moon')+'</i><span>'+(theme==='dark'?'Светла':'Тъмна')+'</span>';if(window.d8SwapIcon)window.d8SwapIcon(button.querySelector('.theme-icon-slot'),previous);button.setAttribute('aria-label',theme==='dark'?'Включи светлата тема':'Включи тъмната тема');button.setAttribute('aria-pressed',String(theme==='dark'));});var meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=theme==='dark'?'#110c19':'#eee8df';}
document.addEventListener('click',function(event){document.querySelectorAll('details.quick-create[open],details.lead-more[open]').forEach(function(details){if(!details.contains(event.target)||event.target.closest('.quick-create-menu button,.lead-more-menu button'))details.open=false;});});
document.addEventListener('keydown',function(event){if(event.key==='Escape')document.querySelectorAll('details.quick-create[open],details.lead-more[open]').forEach(function(details){details.open=false;var summary=details.querySelector('summary');if(summary)summary.focus();});});
applyTheme(document.documentElement.dataset.theme||'light');
document.querySelectorAll('[data-theme-toggle]').forEach(function(button){button.addEventListener('click',function(){var theme=document.documentElement.dataset.theme==='dark'?'light':'dark';applyTheme(theme);try{localStorage.setItem('d8Theme',theme);}catch(e){}window.dispatchEvent(new Event('d8:layout'));});});
})();
