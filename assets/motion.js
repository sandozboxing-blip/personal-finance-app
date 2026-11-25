(function(){
 'use strict';
 var preference=window.matchMedia('(prefers-reduced-motion: reduce)');
 var running=new Map();
 function enabled(){return !preference.matches&&!document.body.classList.contains('reduce-motion');}
 function stop(){running.forEach(function(animation){animation.cancel();});running.clear();}
 function feedback(element,frames,duration){
  if(!element||!element.animate||!enabled())return;
  var previous=running.get(element);if(previous)previous.cancel();
  var animation=element.animate(frames,{duration:duration,easing:'cubic-bezier(.16,1,.3,1)'});
  running.set(element,animation);
  function done(){if(running.get(element)===animation)running.delete(element);}
  animation.onfinish=done;animation.oncancel=done;
 }
 window.addEventListener('d8:page',function(event){
  stop();
  feedback(document.getElementById('pgtitle'),[{opacity:.4},{opacity:1}],160);
  var page=document.getElementById('pg'+event.detail.page);
  if(page)feedback(page.querySelector('.dashhero,.ptbar,.taskhero,.leads-toolbar'),[{opacity:.5},{opacity:1}],180);
 });
 window.addEventListener('d8:saved',function(){
  feedback(document.querySelector('#syncStatus>i'),[{transform:'scale(1)',opacity:.65},{transform:'scale(1.35)',opacity:1,offset:.4},{transform:'scale(1)',opacity:1}],240);
 });
 function motionPreference(){if(!enabled())stop();}
 if(preference.addEventListener)preference.addEventListener('change',motionPreference);
 new MutationObserver(motionPreference).observe(document.body,{attributes:true,attributeFilter:['class']});
 document.addEventListener('visibilitychange',function(){if(document.hidden)stop();});
})();
