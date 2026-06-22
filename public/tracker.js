// ─── Analytics Tracker ──────────────────────────────
(function() {
  // Generate a random session ID if not exists
  let sessionId = localStorage.getItem('fsfl_session_id');
  if (!sessionId) {
    sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('fsfl_session_id', sessionId);
  }

  // Determine current page
  let page = 'Ana Sayfa';
  if (window.location.pathname.includes('3d.html')) page = '3D Sanal Tur';
  else if (window.location.pathname.includes('admin.html')) page = 'Admin Paneli';

  // Get simple device info
  const ua = navigator.userAgent;
  let device = 'Masaüstü';
  if (/Android/i.test(ua)) device = 'Android Telefon/Tablet';
  else if (/iPhone|iPad|iPod/i.test(ua)) device = 'iPhone/iPad';
  else if (/Macintosh/i.test(ua)) device = 'Mac';
  else if (/Windows/i.test(ua)) device = 'Windows PC';

  // Actions queue
  let pendingActions = [];

  // Expose global tracker function
  window.fsflTrackAction = function(action) {
    pendingActions.push(action);
    sendHeartbeat(); // send immediately on action
  };

  function sendHeartbeat() {
    const data = {
      sessionId: sessionId,
      page: page,
      actions: pendingActions,
      deviceInfo: device
    };

    // Send using fetch
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      // keepalive ensures the request finishes even if user closes the tab
      keepalive: true 
    }).catch(e => console.error('Tracking error:', e));

    // Clear sent actions
    pendingActions = [];
  }

  // Send initial heartbeat
  sendHeartbeat();

  // Send heartbeat every 30 seconds
  setInterval(sendHeartbeat, 30 * 1000);

  // Send heartbeat when user leaves the page
  window.addEventListener('beforeunload', () => {
    window.fsflTrackAction('Sayfadan ayrıldı/sekmeyi kapattı');
  });

})();
