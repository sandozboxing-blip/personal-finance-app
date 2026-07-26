/* OneSignal Web SDK v16 wrapper. Stable release observed during integration: 160608. */
(function(){
  'use strict';
  var APP_ID='258501b4-c99d-4ed1-92d3-3ce01d5c6242';
  var sdk=null,initialized=false,pendingUser='',subscriptionObserver=null,verifiedShown=false;
  function realSubscriptionId(id){return typeof id==='string'&&id.length>0&&id.indexOf('local-')!==0;}
  function status(text,state){var el=document.getElementById('pushStatus');if(el){el.textContent=text;el.dataset.state=state||'';}}
  function showVerification(){
    if(verifiedShown||localStorage.getItem('d8OneSignalVerified:'+APP_ID)==='1')return;
    verifiedShown=true;localStorage.setItem('d8OneSignalVerified:'+APP_ID,'1');
    var overlay=document.createElement('div');overlay.className='ov open onesignalverify';overlay.innerHTML='<div class="modal onesignalverifybox"><div class="mhdr"><h3>Your OneSignal SDK integration is complete!</h3></div><div class="mbody"><p>You can now send Push Notifications &amp; In-App Messages through OneSignal. Tap below to enable push notifications.</p></div><div class="mfoot"><button class="btn btnp" type="button">Got it</button></div></div>';
    overlay.querySelector('button').addEventListener('click',function(){overlay.remove();requestPermission();});document.body.appendChild(overlay);
  }
  function evaluateSubscription(){if(!sdk)return;var push=sdk.User&&sdk.User.PushSubscription,id=push&&push.id;if(realSubscriptionId(id)){status('Телефонът е свързан','ready');showVerification();}else if(push&&push.optedIn)status('Регистрирам телефона…','loading');else status('Известията не са включени','off');}
  async function identify(user){pendingUser=String(user||'').trim();if(!initialized||!pendingUser)return;try{await sdk.login(pendingUser);evaluateSubscription();}catch(e){status('Грешка при свързване','error');}}
  async function requestPermission(){
    if(!initialized||!sdk){status('OneSignal още се зарежда','loading');return false;}
    try{var allowed=await sdk.Notifications.requestPermission();if(allowed&&pendingUser)await sdk.login(pendingUser);evaluateSubscription();return !!allowed;}catch(e){status('Разрешението не е дадено','error');return false;}
  }
  async function unlink(){pendingUser='';if(initialized&&sdk)try{await sdk.logout();}catch(e){}status('Известията не са включени','off');}
  function init(){
    window.OneSignalDeferred=window.OneSignalDeferred||[];
    window.OneSignalDeferred.push(async function(OneSignal){
      sdk=OneSignal;try{
        OneSignal.Debug.setLogLevel('warn');
        await OneSignal.init({appId:APP_ID,serviceWorkerPath:'OneSignalSDKWorker.js',serviceWorkerParam:{scope:'/'},notifyButton:{enable:false},welcomeNotification:{disable:true}});
        initialized=true;
        subscriptionObserver=function(){evaluateSubscription();};
        OneSignal.User.PushSubscription.addEventListener('change',subscriptionObserver);
        if(pendingUser)await OneSignal.login(pendingUser);
        evaluateSubscription();
      }catch(e){status('OneSignal не можа да се стартира','error');}
    });
  }
  window.D8OneSignal={init:init,login:identify,logout:unlink,requestPermission:requestPermission,getAppId:function(){return APP_ID;},getSubscriptionId:function(){return sdk&&sdk.User&&sdk.User.PushSubscription?sdk.User.PushSubscription.id:null;},refresh:evaluateSubscription};
  window.enablePhoneNotifications=function(){return window.D8OneSignal.requestPermission();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();