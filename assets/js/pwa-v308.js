(function(){
  'use strict';

  function setModeClass(){
    var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
    document.documentElement.classList.toggle('thepool-standalone-app', !!standalone);
  }

  setModeClass();
  if(window.matchMedia){
    var mq = window.matchMedia('(display-mode: standalone)');
    if(mq && typeof mq.addEventListener === 'function') mq.addEventListener('change', setModeClass);
  }

  if('serviceWorker' in navigator && location.protocol === 'https:'){
    window.addEventListener('load', function(){
      navigator.serviceWorker.register('/service-worker.js', { scope: '/' }).catch(function(err){
        console.warn('thePool service worker registration failed:', err);
      });
    }, { once:true });
  }
})();
