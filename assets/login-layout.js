/* Keep the login in the visible viewport during pinch zoom and keyboard resize. */
(function(){
 'use strict';
 var login=document.getElementById('lw'),viewport=window.visualViewport;
 if(!login||!viewport)return;
 var frame=0,last={};
 function update(){
  if(frame)return;
  frame=requestAnimationFrame(function(){
   frame=0;if(login.classList.contains('hidden'))return;
   var values={width:viewport.width,height:viewport.height,left:viewport.offsetLeft,top:viewport.offsetTop};
   Object.keys(values).forEach(function(key){
    var value=values[key].toFixed(2)+'px';
    if(last[key]!==value){login.style.setProperty('--login-'+key,value);last[key]=value;}
   });
  });
 }
 viewport.addEventListener('resize',update,{passive:true});
 viewport.addEventListener('scroll',update,{passive:true});
 window.addEventListener('resize',update,{passive:true});
 new MutationObserver(update).observe(login,{attributes:true,attributeFilter:['class']});
 update();
})();
