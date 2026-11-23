/* Finish Carpenter Pro — public video page for the iPhone app.
 * Why it exists: inside an iPhone app, pages load from an internal capacitor:// address, and YouTube now refuses
 * embedded videos that don't come from a normal web address (Error 153). The app shows its videos through this
 * page instead, so YouTube sees a normal website. Android and the website use YouTube directly.
 *
 * What it does: loads YouTube's official IFrame Player (privacy-enhanced youtube-nocookie.com host) for one video
 * ID from the address (?v=ID&start=SECONDS&autoplay=1). It accepts play / pause / seek / change-video commands only
 * from the Finish Carpenter Pro app, and tells the app the player's state and time. Nothing is stored or tracked.
 */
(function () {
  'use strict';
  var APP_ORIGINS = ['capacitor://localhost', 'ionic://localhost', 'https://localhost'];
  var ID_RE = /^[A-Za-z0-9_-]{11}$/;
  var q = new URLSearchParams(location.search);
  var id = q.get('v') || '';
  var start = Math.max(0, parseInt(q.get('start') || '0', 10) || 0);
  var autoplay = q.get('autoplay') === '1';
  var box = document.getElementById('p');
  var player = null, timer = null;

  function post(msg) {
    if (window.parent === window) return; // opened on its own: nobody to tell
    msg.fcpVideo = 1;
    // Only the app's own addresses can receive these messages (any other parent page gets nothing).
    APP_ORIGINS.forEach(function (o) { try { window.parent.postMessage(msg, o); } catch (e) { /* not this one */ } });
  }
  function now() { try { return player ? player.getCurrentTime() : 0; } catch (e) { return 0; } }

  if (!ID_RE.test(id)) {
    box.innerHTML = '<div class="msg">This video link isn\'t valid.</div>';
    post({ ev: 'error', code: 2 });
    return;
  }

  window.onYouTubeIframeAPIReady = function () {
    player = new YT.Player('p', {
      host: 'https://www.youtube-nocookie.com',
      videoId: id,
      playerVars: { rel: 0, playsinline: 1, start: start, autoplay: autoplay ? 1 : 0 },
      events: {
        onReady: function () {
          var d = 0; try { d = player.getDuration(); } catch (e) { /* unknown yet */ }
          post({ ev: 'ready', duration: d, time: now() });
          if (autoplay) { try { player.playVideo(); } catch (e) { /* the viewer taps play */ } }
        },
        onStateChange: function (e) {
          post({ ev: 'state', state: e.data, time: now() });
          clearInterval(timer);
          if (e.data === 1) timer = setInterval(function () { post({ ev: 'time', time: now() }); }, 250);
        },
        onError: function (e) { post({ ev: 'error', code: e.data }); }
      }
    });
  };

  window.addEventListener('message', function (e) {
    if (APP_ORIGINS.indexOf(e.origin) < 0 || e.source !== window.parent || !player) return;
    var d = e.data || {};
    if (!d.fcpVideo || typeof d.cmd !== 'string') return;
    var a = Array.isArray(d.args) ? d.args : [];
    try {
      if (d.cmd === 'playVideo') player.playVideo();
      else if (d.cmd === 'pauseVideo') player.pauseVideo();
      else if (d.cmd === 'seekTo') player.seekTo(Math.max(0, Number(a[0]) || 0), true);
      else if (d.cmd === 'loadVideoById' && a[0] && ID_RE.test(String(a[0].videoId))) player.loadVideoById({ videoId: a[0].videoId, startSeconds: Math.max(0, Number(a[0].startSeconds) || 0) });
    } catch (err) { /* player not ready for that yet */ }
  });

  var s = document.createElement('script');
  s.src = 'https://www.youtube.com/iframe_api';
  s.onerror = function () { box.innerHTML = '<div class="msg">YouTube couldn\'t load. Check the internet connection.</div>'; post({ ev: 'error', code: -2 }); };
  document.head.appendChild(s);
})();
