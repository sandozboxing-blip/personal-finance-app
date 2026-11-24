(function(){
'use strict';
var nav=document.getElementById('mobileNav');if(!nav)return;
var marker=document.createElement('div');marker.className='mobile-nav-indicator';marker.setAttribute('aria-hidden','true');nav.prepend(marker);
var frame=0;
function update(){if(frame)return;frame=requestAnimationFrame(function(){frame=0;var active=nav.querySelector('button.active');if(!active||!nav.getClientRects().length)return;var area=nav.getBoundingClientRect(),rect=active.getBoundingClientRect();marker.style.opacity='1';marker.style.width=Math.max(0,rect.width-4)+'px';marker.style.height=rect.height+'px';marker.style.transform='translate('+(rect.left-area.left+2)+'px,'+(rect.top-area.top)+'px)';nav.querySelectorAll('button[data-page]').forEach(function(button){if(button===active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});});}
nav.addEventListener('d8:mobile-nav',update);window.addEventListener('d8:layout',update);window.addEventListener('resize',update,{passive:true});
if(window.ResizeObserver)new ResizeObserver(update).observe(nav);
var viewportFrame=0;
function viewportUpdate(){if(viewportFrame)return;viewportFrame=requestAnimationFrame(function(){viewportFrame=0;var viewport=window.visualViewport;document.body.classList.toggle('keyboard-open',!!viewport&&innerHeight-viewport.height-viewport.offsetTop>150);update();});}
if(window.visualViewport){visualViewport.addEventListener('resize',viewportUpdate,{passive:true});visualViewport.addEventListener('scroll',viewportUpdate,{passive:true});}
update();
})();
