// Visitor tracker + EmailJS notifier (replace SERVICE_ID/TEMPLATE_ID/USER_ID)
(function(){
  const ADMIN_EMAIL = 'raviambersariya1@gmail.com';
  const SERVICE_ID = 'REPLACE_WITH_SERVICE_ID';    // e.g. 'service_xxx'
  const TEMPLATE_ID = 'REPLACE_WITH_TEMPLATE_ID';  // e.g. 'template_xxx'
  const USER_ID = 'REPLACE_WITH_USER_ID';          // EmailJS public key / user id
  const STORAGE_PREFIX = 'zippee_visitor_';
  const SEND_ON_EVERY_VISIT = true; // set false to send only for first-time visitors

  const id = n => document.getElementById(n);

  function uid() {
    return 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,9);
  }

  function todayKey(date = new Date()){
    const y = date.getFullYear(), m = (date.getMonth()+1).toString().padStart(2,'0'), d = date.getDate().toString().padStart(2,'0');
    return `${STORAGE_PREFIX}visits_${y}-${m}-${d}`;
  }

  function incrementDailyVisits() {
    const key = todayKey();
    const cur = parseInt(localStorage.getItem(key) || '0', 10);
    localStorage.setItem(key, (cur + 1).toString());
    return cur + 1;
  }

  function markUniqueUser() {
    let visitorId = localStorage.getItem(`${STORAGE_PREFIX}id`);
    let isNew = false;
    if (!visitorId) {
      visitorId = uid();
      localStorage.setItem(`${STORAGE_PREFIX}id`, visitorId);
      const totalKey = `${STORAGE_PREFIX}total_users`;
      const cur = parseInt(localStorage.getItem(totalKey) || '0', 10);
      localStorage.setItem(totalKey, (cur + 1).toString());
      isNew = true;
    }
    localStorage.setItem(`${STORAGE_PREFIX}last_visit`, new Date().toISOString());
    return { visitorId, isNew };
  }

  function getTotals() {
    const total = parseInt(localStorage.getItem(`${STORAGE_PREFIX}total_users`) || '0', 10);
    const today = parseInt(localStorage.getItem(todayKey()) || '0', 10);
    const last = localStorage.getItem(`${STORAGE_PREFIX}last_visit`) || '';
    return { total, today, last };
  }

  // Use EmailJS REST API to send email (client-side)
  function sendEmailJS(templateParams) {
    if (!SERVICE_ID || !TEMPLATE_ID || !USER_ID || SERVICE_ID.indexOf('REPLACE')!==-1) {
      // fallback: open mail client (user must send)
      const subject = encodeURIComponent(`Zippee visit: ${templateParams.type}`);
      const body = encodeURIComponent(JSON.stringify(templateParams, null, 2));
      window.open(`mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`, '_blank');
      return Promise.resolve({ fallback: true });
    }

    const payload = {
      service_id: SERVICE_ID,
      template_id: TEMPLATE_ID,
      user_id: USER_ID,
      template_params: templateParams
    };

    return fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(res => {
      if (!res.ok) throw new Error('EmailJS send failed');
      return res.json().catch(()=>({ ok: true }));
    });
  }

  function prepareAndSend(payload) {
    // template params must match template variables you created in EmailJS
    const templateParams = {
      to_email: ADMIN_EMAIL,
      visitor_id: payload.visitorId,
      is_new: payload.isNew ? 'YES' : 'NO',
      total_users: payload.totalUsers,
      today_visits: payload.todayVisits,
      url: payload.url,
      timestamp: payload.timestamp,
      type: payload.type
    };

    sendEmailJS(templateParams)
      .then(() => { /* success, silent */ })
      .catch(e => { console.error('Email send error', e); });
  }

  function updateUI() {
    const t = getTotals();
    if (id('totalUsers')) id('totalUsers').textContent = t.total;
    if (id('todayVisits')) id('todayVisits').textContent = t.today;
    if (id('lastVisit')) id('lastVisit').textContent = t.last ? (new Date(t.last)).toLocaleString() : '--';
  }

  document.addEventListener('DOMContentLoaded', function(){
    const { visitorId, isNew } = markUniqueUser();
    const todayCount = incrementDailyVisits();
    updateUI();

    const payload = {
      type: isNew ? 'new_user' : 'visit',
      visitorId,
      isNew,
      totalUsers: parseInt(localStorage.getItem(`${STORAGE_PREFIX}total_users`) || '0', 10),
      todayVisits: todayCount,
      url: location.href,
      timestamp: new Date().toISOString()
    };

    // Decide when to send: every visit or only new users
    if (SEND_ON_EVERY_VISIT || isNew) {
      prepareAndSend(payload);
    }

    const btn = id('notifyBtn');
    if (btn) {
      btn.addEventListener('click', function(){
        const testPayload = Object.assign({}, payload, { type: 'manual_test' });
        prepareAndSend(testPayload);
        alert('Notification triggered (uses EmailJS or opens mail client if not configured).');
      });
    }
  });

  // Expose for debugging
  window.ZippeeVisitor = { getTotals, sendEmailJS };
})();