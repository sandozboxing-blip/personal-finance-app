/* Reflow the desktop shell to the visible width, including trackpad pinch zoom. */
(function(){
 'use strict';
 var app=document.getElementById('app'),viewport=window.visualViewport;
 if(!app||!viewport)return;
 var frame=0,last={};
 function update(){
  if(frame)return;
  frame=requestAnimationFrame(function(){
   frame=0;if(!app.classList.contains('on')||innerWidth<=1000)return;
   var values={width:viewport.width,height:viewport.height,left:viewport.offsetLeft,top:viewport.offsetTop};
   Object.keys(values).forEach(function(key){
    var value=values[key].toFixed(2)+'px';
    if(last[key]!==value){document.documentElement.style.setProperty('--panel-'+key,value);last[key]=value;}
   });
  });
 }
 viewport.addEventListener('resize',update,{passive:true});
 viewport.addEventListener('scroll',update,{passive:true});
 window.addEventListener('resize',update,{passive:true});
 new MutationObserver(update).observe(app,{attributes:true,attributeFilter:['class']});
 update();
})();
