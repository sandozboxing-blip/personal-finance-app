/* Delegated feedback also covers controls created after loading or filtering. */
(function () {
  'use strict';
  var reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  var sidebar=document.getElementById('sidebar');
  var nav=sidebar&&sidebar.querySelector('.sbnav');
  if(sidebar&&nav){
    sidebar.querySelectorAll('.sbi').forEach(function(button){
      var label='';
      Array.from(button.childNodes).forEach(function(node){
        if(node.nodeType===3&&node.textContent.trim()){
          label=node.textContent.trim();
          var span=document.createElement('span');span.className='nav-label';span.textContent=label;node.replaceWith(span);
        }
      });
      button.setAttribute('aria-label',label||button.textContent.trim());
      button.title=label||button.textContent.trim();
    });
    var toggle=document.createElement('button');toggle.type='button';toggle.className='glass-nav-toggle';toggle.id='glassNavToggle';
    toggle.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="4"/><path d="M9 4v16M13 9l3 3-3 3"/></svg>';
    function setCompact(compact){
      document.body.classList.toggle('nav-compact',compact);
      toggle.setAttribute('aria-expanded',String(!compact));toggle.setAttribute('aria-controls','sidebar');
      toggle.setAttribute('aria-label',compact?'Разгъни менюто':'Прибери менюто');toggle.title=toggle.getAttribute('aria-label');
    }
    try{setCompact(localStorage.getItem('d8NavCompact')==='1');}catch(e){setCompact(false);}
    toggle.addEventListener('click',function(){var compact=!document.body.classList.contains('nav-compact');setCompact(compact);try{localStorage.setItem('d8NavCompact',compact?'1':'0');}catch(e){}});
    sidebar.querySelector('.sbr').appendChild(toggle);
    var marker=document.createElement('div');marker.className='glass-nav-marker';marker.setAttribute('aria-hidden','true');nav.prepend(marker);
    var pendingFrame=0;
    function updateMarker(){
      cancelAnimationFrame(pendingFrame);pendingFrame=requestAnimationFrame(function(){
        var active=nav.querySelector('.sbi.active');if(!active){marker.style.opacity='0';return;}
        marker.style.opacity='1';marker.style.width=active.offsetWidth+'px';marker.style.height=active.offsetHeight+'px';
        marker.style.transform='translate('+active.offsetLeft+'px,'+active.offsetTop+'px)';
        nav.querySelectorAll('.sbi').forEach(function(button){if(button===active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
      });
    }
    var observer=new MutationObserver(updateMarker);nav.querySelectorAll('.sbi').forEach(function(button){observer.observe(button,{attributes:true,attributeFilter:['class']});});
    if(window.ResizeObserver)new ResizeObserver(updateMarker).observe(nav);
    window.addEventListener('resize',updateMarker,{passive:true});updateMarker();
  }
  document.addEventListener('pointerdown',function(event){
    if(event.button!==0||reduceMotion.matches||document.body.classList.contains('reduce-motion'))return;
    var target=event.target.closest('button:not(:disabled),summary,.ccard');if(!target||target.getAttribute('aria-disabled')==='true')return;
    var rect=target.getBoundingClientRect();if(!rect.width||!rect.height||!target.animate)return;
    var flash=document.createElement('span');flash.className='glass-click-flash';flash.setAttribute('aria-hidden','true');
    var size=Math.min(88,Math.max(rect.width,rect.height));
    flash.style.left=event.clientX+'px';flash.style.top=event.clientY+'px';flash.style.width=size+'px';flash.style.height=size+'px';flash.style.margin=(-size/2)+'px';
    document.body.appendChild(flash);
    var animation=flash.animate([{opacity:0.8,transform:'scale(.25)'},{opacity:0,transform:'scale(1.15)'}],{duration:380,easing:'cubic-bezier(.22,1,.36,1)'});
    animation.onfinish=function(){flash.remove();};animation.oncancel=function(){flash.remove();};
  },{passive:true});
})();
