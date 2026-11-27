/* Keep the foreground task focused, including nested email/reply dialogs. */
(function(){
 'use strict';
 var selector='.ov,.individual-email-ov,.reply-inbox-ov',watched=new WeakSet(),stack=[],returns=new WeakMap(),active=null;
 var app=document.getElementById('app'),nav=document.getElementById('mobileNav');
 function panel(root){return root.querySelector('.modal,.lbm,.manual-lead-modal,.individual-email-modal,.reply-inbox-modal,.outreachmodal,.foldereditor')||root;}
 function focusPanel(root){var target=panel(root);if(!target.hasAttribute('tabindex'))target.setAttribute('tabindex','-1');target.focus({preventScroll:true});}
 function update(){
  var previous=active;
  stack=stack.filter(function(root){return root.isConnected&&root.classList.contains('open');});
  active=document.body.classList.contains('panel-authenticated')?stack[stack.length-1]||null:null;
  if(app)app.inert=!!active;if(nav)nav.inert=!!active;
  document.body.classList.toggle('panel-dialog-open',!!active);
  stack.forEach(function(root){root.inert=!!active&&root!==active;});
  if(active&&active!==previous&&!active.contains(document.activeElement))focusPanel(active);
  if(previous&&previous!==active){
   var target=returns.get(previous);
   if(target&&target.isConnected&&!target.closest('[inert]')&&target.getClientRects().length)target.focus({preventScroll:true});
   else if(active)focusPanel(active);
   if(stack.indexOf(previous)<0)previous.inert=false;
  }
 }
 function change(root){
  if(root.classList.contains('open')){
   if(stack.indexOf(root)<0){returns.set(root,document.activeElement);stack.push(root);}
   if(!root.hasAttribute('role'))root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');
  }
  update();
 }
 var observer=new MutationObserver(function(records){records.forEach(function(record){change(record.target);});});
 function watch(root){if(watched.has(root))return;watched.add(root);observer.observe(root,{attributes:true,attributeFilter:['class']});if(root.classList.contains('open'))change(root);}
 document.querySelectorAll(selector).forEach(watch);
 new MutationObserver(function(records){records.forEach(function(record){record.addedNodes.forEach(function(node){if(node.nodeType===1&&node.matches(selector))watch(node);});});}).observe(document.body,{childList:true});
 new MutationObserver(update).observe(document.body,{attributes:true,attributeFilter:['class']});
 document.addEventListener('keydown',function(event){
  if(event.key!=='Tab'||!active)return;
  var popup=document.getElementById('customControlPopover');if(popup&&!popup.hidden)return;
  var targets=Array.from(active.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')).filter(function(element){return element.tabIndex>=0&&!element.matches(':disabled')&&!element.closest('[aria-hidden=true],[inert]')&&element.getClientRects().length;});
  var first=targets[0],last=targets[targets.length-1],focused=document.activeElement;
  if(!first){event.preventDefault();focusPanel(active);return;}
  if(event.shiftKey&&(focused===first||!targets.includes(focused))){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&(focused===last||!targets.includes(focused))){event.preventDefault();first.focus();}
 });
})();

/* The grip follows a drag, resists at its upper edge, and can dismiss the sheet. */
(function(){
 'use strict';
 var preference=matchMedia('(prefers-reduced-motion: reduce)'),drag=null,settling=new WeakMap();
 function animated(){return !preference.matches&&!document.body.classList.contains('reduce-motion');}
 function settle(sheet,offset){
  sheet.style.removeProperty('translate');
  if(!animated()||!sheet.animate)return;
  var animation=sheet.animate([{translate:'0 '+offset+'px'},{translate:'0 '+(-offset*.06)+'px',offset:.75},{translate:'0 0'}],{duration:240,easing:'cubic-bezier(.16,1,.3,1)'});
  settling.set(sheet,animation);
 }
 document.querySelectorAll('.mobile-more-handle').forEach(function(handle){
  handle.setAttribute('aria-hidden','true');
  handle.addEventListener('pointerdown',function(event){
   if(event.button!==0)return;var sheet=handle.parentElement;if(!sheet.classList.contains('open'))return;
   var animation=settling.get(sheet),base=animation&&animation.playState==='running'&&animated()?parseFloat(getComputedStyle(sheet).translate.split(/\s+/)[1])||0:0;
   if(animation)animation.cancel();if(base)sheet.style.translate='0 '+base+'px';
   drag={handle:handle,sheet:sheet,id:event.pointerId,start:event.clientY,base:base,offset:base,height:sheet.clientHeight};handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove',function(event){
   if(!drag||event.pointerId!==drag.id)return;
   var delta=event.clientY-drag.start;
   var offset=delta<0?-Math.min(24,(-delta*.3)/(1+(-delta)/drag.height)):Math.min(160,delta*.75);
   drag.offset=Math.max(-24,Math.min(160,drag.base+offset));
   if(animated())drag.sheet.style.translate='0 '+drag.offset+'px';
  });
  function finish(event){
   if(!drag||event.pointerId!==drag.id)return;var current=drag;drag=null;
   if(event.type==='pointerup'&&event.clientY-current.start>90){current.sheet.style.removeProperty('translate');closeMobileSheets();}
   else settle(current.sheet,current.offset);
  }
  handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);handle.addEventListener('lostpointercapture',finish);
 });
 function reset(){if(drag){drag.sheet.style.removeProperty('translate');drag=null;}}
 window.addEventListener('resize',reset,{passive:true});
 function reduce(){if(animated())return;reset();document.querySelectorAll('.mobile-more-sheet,.mobile-client-sheet,.mobile-task-sheet').forEach(function(sheet){var animation=settling.get(sheet);if(animation)animation.cancel();});}
 if(preference.addEventListener)preference.addEventListener('change',reduce);
 new MutationObserver(reduce).observe(document.body,{attributes:true,attributeFilter:['class']});
})();
