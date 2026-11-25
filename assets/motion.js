(function(){
 'use strict';
 var preference=window.matchMedia('(prefers-reduced-motion: reduce)');
 var running=new Map();
 function enabled(){return !preference.matches&&!document.body.classList.contains('reduce-motion');}
 function expressive(){return enabled()&&document.body.dataset.motionStyle==='expressive';}
 function stop(){running.forEach(function(animation){animation.cancel();});running.clear();}
 function stopElement(element){var animation=running.get(element);if(animation){animation.cancel();running.delete(element);}}
 function feedback(element,frames,duration,delay){
  if(!element||!element.animate||!enabled())return;
  var previous=running.get(element);if(previous)previous.cancel();
  var animation=element.animate(frames,{duration:duration,delay:delay||0,easing:'cubic-bezier(.16,1,.3,1)'});
  running.set(element,animation);
  function done(){if(running.get(element)===animation)running.delete(element);}
  animation.onfinish=done;animation.oncancel=done;
 }
 window.addEventListener('d8:page',function(event){
  stop();
  feedback(document.getElementById('pgtitle'),[{opacity:.4},{opacity:1}],160);
  var page=document.getElementById('pg'+event.detail.page);
  if(page)feedback(page.querySelector('.dashhero,.ptbar,.taskhero,.leads-toolbar'),[{opacity:.5},{opacity:1}],180);
  if(page&&expressive()){
   // At most six surfaces, under 300ms in total. Never animate an entire long list.
   Array.from(page.querySelectorAll('.dc,.sc,.ccard,.leadfoldercard,.report-kpi,.settings-card,.worktask')).slice(0,6).forEach(function(card,index){
    feedback(card,[{opacity:.5},{opacity:1}],140,index*28);
   });
  }
 });
 window.addEventListener('d8:saved',function(){
  feedback(document.querySelector('#syncStatus>i'),[{transform:'scale(1)',opacity:.65},{transform:'scale(1.35)',opacity:1,offset:.4},{transform:'scale(1)',opacity:1}],240);
 });
 function motionPreference(){if(!enabled())stop();}
 if(preference.addEventListener)preference.addEventListener('change',motionPreference);
 new MutationObserver(motionPreference).observe(document.body,{attributes:true,attributeFilter:['class']});
 document.addEventListener('visibilitychange',function(){if(document.hidden)stop();});

 // Store only the latest intentional activation; no pointer-move loop or card measurements.
 var origin=null;
 document.addEventListener('click',function(event){
  if(!expressive()||!event.target.closest)return;
  var target=event.target.closest('button,summary,.ccard,.leadfoldercard,.leadmobilecard,.lead-mobile-card,tr');
  if(!target)return;
  var x=event.clientX,y=event.clientY;
  if(!event.detail){var rect=target.getBoundingClientRect();x=rect.left+rect.width/2;y=rect.top+rect.height/2;}
  origin={x:x,y:y,time:performance.now()};
 },true);
 var panelSelector='.modal,.lbm,.manual-lead-modal,.individual-email-modal,.reply-inbox-modal,.outreachmodal,.foldereditor';
 var overlaySelector='.ov,.individual-email-ov,.reply-inbox-ov';
 function enter(overlay){
  if(!expressive())return;
  var panel=overlay.querySelector(panelSelector);if(!panel)return;
  var rect=panel.getBoundingClientRect();if(!rect.width||!rect.height)return;
  var anchor=origin&&performance.now()-origin.time<800?origin:{x:innerWidth/2,y:innerHeight*.35};origin=null;
  var x=Math.max(0,Math.min(rect.width,anchor.x-rect.left));
  var y=Math.max(0,Math.min(rect.height,anchor.y-rect.top));
  var transformOrigin=x+'px '+y+'px';
  var dx=Math.max(-20,Math.min(20,(anchor.x-(rect.left+rect.width/2))*.06));
  var dy=Math.max(-16,Math.min(16,(anchor.y-(rect.top+rect.height/2))*.06));
  feedback(panel,[{opacity:.45,transform:'translate('+dx+'px,'+dy+'px) scale(.985)',transformOrigin:transformOrigin},{opacity:1,transform:'none',transformOrigin:transformOrigin}],240);
 }
 var watched=new WeakSet();
 var overlays=new MutationObserver(function(records){records.forEach(function(record){
  var overlay=record.target;
  if(!overlay.classList.contains('open'))stopElement(overlay.querySelector(panelSelector));
  else if(!/(^|\s)open(\s|$)/.test(record.oldValue||''))enter(overlay);
 });});
 function watch(overlay){if(watched.has(overlay))return;watched.add(overlay);overlays.observe(overlay,{attributes:true,attributeFilter:['class'],attributeOldValue:true});if(overlay.classList.contains('open'))enter(overlay);}
 document.querySelectorAll(overlaySelector).forEach(watch);
 // Email and reply dialogs are mounted directly on body only when first used.
 new MutationObserver(function(records){records.forEach(function(record){record.addedNodes.forEach(function(node){if(node.nodeType===1&&node.matches(overlaySelector))watch(node);});});}).observe(document.body,{childList:true});

 document.querySelectorAll('[data-motion-icon]').forEach(function(element){if(window.d8Icon)element.innerHTML=window.d8Icon(element.dataset.motionIcon);});
 window.d8MotionPreview=function(){
  var sample=document.getElementById('motionPreview');if(!sample)return;
  sample.querySelectorAll('.motion-preview-tile').forEach(function(tile,index){
   stopElement(tile);stopElement(tile.querySelector('svg'));
   feedback(tile,[{opacity:.45},{opacity:1}],expressive()?140:160,expressive()?index*35:0);
   if(expressive())feedback(tile.querySelector('svg'),[{transform:'translateY(4px) scale(.88)'},{transform:'translateY(0) scale(1)'}],180,index*35+20);
  });
 };
 window.addEventListener('d8:motion-style',function(){stop();if(document.getElementById('pgsettings').classList.contains('active'))window.d8MotionPreview();});
})();
