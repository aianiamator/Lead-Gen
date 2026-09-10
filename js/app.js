/* ------------------------------------------------------------------
   Lead form → n8n webhook
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  var CFG = window.SITE_CONFIG || {};

  var form        = document.getElementById('leadForm');
  var submitBtn   = document.getElementById('submitBtn');
  var statusEl    = document.getElementById('formStatus');
  var successPane = document.getElementById('successPanel');
  var resetBtn    = document.getElementById('resetBtn');
  var dateInput   = document.getElementById('appointmentDate');
  var problemEl   = document.getElementById('problem');
  var countEl     = document.getElementById('problemCount');
  var yearEl      = document.getElementById('year');

  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------- Date bounds ---------- */
  function isoDay(offsetDays) {
    var d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  }
  if (dateInput) {
    dateInput.min = isoDay(CFG.minLeadDays == null ? 1 : CFG.minLeadDays);
    dateInput.max = isoDay(CFG.maxLeadDays == null ? 120 : CFG.maxLeadDays);
  }

  /* ---------- Character counter ---------- */
  if (problemEl && countEl) {
    problemEl.addEventListener('input', function () {
      countEl.textContent = String(problemEl.value.length);
    });
  }

  /* ---------- Validation ---------- */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

  var RULES = {
    name: function (v) {
      if (!v.trim()) return 'Please enter your name.';
      if (v.trim().length < 2) return 'That name looks too short.';
      return '';
    },
    email: function (v) {
      if (!v.trim()) return 'Please enter your email address.';
      if (!EMAIL_RE.test(v.trim())) return 'That email address does not look right.';
      return '';
    },
    phone: function (v) {
      var digits = v.replace(/\D/g, '');
      if (!v.trim()) return 'Please enter a phone number.';
      if (digits.length < 7 || digits.length > 15) return 'Please enter a valid phone number.';
      return '';
    },
    service: function (v) { return v ? '' : 'Please choose the service you need.'; },
    budget:  function (v) { return v ? '' : 'Please select a budget range.'; },
    appointmentDate: function (v) {
      if (!v) return 'Please pick a preferred date.';
      if (dateInput && dateInput.min && v < dateInput.min) return 'Please choose a date from ' + dateInput.min + ' onwards.';
      if (dateInput && dateInput.max && v > dateInput.max) return 'That date is too far ahead.';
      return '';
    },
    problem: function (v) {
      if (!v.trim()) return 'Tell us briefly what you need solved.';
      if (v.trim().length < 15) return 'A little more detail helps us prepare (15+ characters).';
      return '';
    }
  };

  function fieldWrap(el) { return el.closest('.field'); }

  function showError(el, message) {
    var wrap = fieldWrap(el);
    if (!wrap) return;
    var msg = wrap.querySelector('[data-error-for="' + el.id + '"]');
    if (message) {
      wrap.classList.add('invalid');
      if (msg) msg.textContent = message;
      el.setAttribute('aria-invalid', 'true');
    } else {
      wrap.classList.remove('invalid');
      if (msg) msg.textContent = '';
      el.removeAttribute('aria-invalid');
    }
  }

  function validateField(el) {
    var rule = RULES[el.id];
    if (!rule) return true;
    var err = rule(el.value);
    showError(el, err);
    return !err;
  }

  function validateConsent() {
    var box = document.getElementById('consent');
    var ok = box.checked;
    showError(box, ok ? '' : 'Please tick this box so we can contact you.');
    return ok;
  }

  Object.keys(RULES).forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('blur', function () { validateField(el); });
    el.addEventListener('input', function () {
      if (fieldWrap(el) && fieldWrap(el).classList.contains('invalid')) validateField(el);
    });
    el.addEventListener('change', function () { validateField(el); });
  });
  document.getElementById('consent').addEventListener('change', validateConsent);

  /* ---------- Payload ---------- */
  function utmParams() {
    var q = new URLSearchParams(window.location.search);
    var out = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid']
      .forEach(function (k) { if (q.get(k)) out[k] = q.get(k); });
    return out;
  }

  function buildPayload() {
    var val = function (id) { return (document.getElementById(id).value || '').trim(); };
    return {
      /* The seven questions */
      name:            val('name'),
      email:           val('email').toLowerCase(),
      phone:           val('phone'),
      service:         val('service'),
      budget:          val('budget'),
      appointmentDate: val('appointmentDate'),
      problem:         val('problem'),

      /* Context n8n can route or score on */
      consent:      document.getElementById('consent').checked,
      submittedAt:  new Date().toISOString(),
      timezone:     Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      pageUrl:      window.location.href,
      referrer:     document.referrer || 'direct',
      userAgent:    navigator.userAgent,
      language:     navigator.language || '',
      utm:          utmParams(),
      formId:       'northgate-lead-form-v1',
      token:        CFG.webhookToken || undefined
    };
  }

  /* ---------- Delivery ---------- */
  function setSending(on) {
    submitBtn.disabled = on;
    submitBtn.classList.toggle('is-sending', on);
    submitBtn.querySelector('.btn-label').textContent = on ? 'Sending…' : 'Request my consultation';
  }

  function setStatus(message, level) {
    /* level: true / 'error' = red, 'warn' = amber, falsy = neutral. */
    var isErr  = (level === true || level === 'error');
    var isWarn = (level === 'warn');
    statusEl.textContent = message || '';
    statusEl.classList.toggle('show', !!message);
    statusEl.classList.toggle('err', isErr);
    statusEl.classList.toggle('warn', isWarn);
  }

  function postJson(payload) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, CFG.timeoutMs || 12000);
    var headers = { 'Content-Type': 'application/json' };
    if (CFG.webhookToken) headers['X-Webhook-Token'] = CFG.webhookToken;

    return fetch(CFG.webhookUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
      keepalive: true
    }).finally(function () { clearTimeout(timer); });
  }

  /* Last-resort send used only when the browser blocks the normal request
     (CORS not enabled on the n8n webhook). The request still reaches n8n, but
     the browser refuses to let us read the response — so we cannot confirm it. */
  function postOpaque(payload) {
    return fetch(CFG.webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(payload),
      keepalive: true
    });
  }

  function looksUnconfigured() {
    var u = CFG.webhookUrl || '';
    return !u || u.indexOf('YOUR-N8N-INSTANCE') !== -1;
  }

  /* ---------- Submit ---------- */
  form.addEventListener('submit', function (e) {
    e.preventDefault();

    /* Honeypot: silently pretend to succeed so bots stop retrying. */
    if (document.getElementById('company_website').value) {
      showSuccess(buildPayload());
      return;
    }

    var ok = true;
    var firstBad = null;
    Object.keys(RULES).forEach(function (id) {
      var el = document.getElementById(id);
      if (!validateField(el)) { ok = false; if (!firstBad) firstBad = el; }
    });
    if (!validateConsent()) {
      ok = false;
      if (!firstBad) firstBad = document.getElementById('consent');
    }

    if (!ok) {
      setStatus('Please fix the highlighted fields above.', true);
      if (firstBad) {
        firstBad.focus({ preventScroll: true });
        firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    if (looksUnconfigured()) {
      setStatus('This form is not connected yet — add your n8n webhook URL in js/config.js.', true);
      console.warn('[lead-form] webhookUrl is still the placeholder. Payload that would have been sent:', buildPayload());
      return;
    }

    var payload = buildPayload();
    setStatus('');
    setSending(true);

    postJson(payload)
      .then(function (res) {
        if (res.ok) return showSuccess(payload);
        /* n8n reachable but unhappy — surface the real reason. */
        return res.text().catch(function () { return ''; }).then(function (body) {
          console.error('[lead-form] n8n responded', res.status, body);
          setSending(false);
          setStatus(
            res.status === 404
              ? 'The form endpoint could not be found. Please call us on +44 20 7946 0000.'
              : 'Something went wrong on our side (error ' + res.status + '). Please try again, or call +44 20 7946 0000.',
            true
          );
        });
      })
      .catch(function (err) {
        /* AbortError = timeout, TypeError = network failure or CORS block. */
        console.warn('[lead-form] direct POST failed:', err && err.name, err && err.message);
        return postOpaque(payload)
          .then(function () {
            /* A no-cors request resolves even when the server returns 404 or 500 —
               the response is opaque, so we genuinely cannot tell delivery from
               failure. Never show the green success panel here: that would tell a
               customer their enquiry arrived when it may have gone nowhere. */
            console.warn('[lead-form] sent via no-cors fallback — delivery could NOT be confirmed.');
            setSending(false);
            setStatus(
              'We sent your request but could not get confirmation back. If you do not ' +
              'hear from us within one business day, please call +44 20 7946 0000 or ' +
              'email hello@example.com.',
              'warn'
            );
          })
          .catch(function (err2) {
            console.error('[lead-form] fallback POST also failed:', err2);
            setSending(false);
            setStatus('We could not send your request. Please check your connection and try again, or email hello@example.com.', true);
          });
      });
  });

  /* ---------- Success ---------- */
  function prettyDate(iso) {
    if (!iso) return 'appointment';
    var parts = iso.split('-');
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (isNaN(d)) return iso;
    return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function showSuccess(payload) {
    if (CFG.redirectUrl) {
      window.location.href = CFG.redirectUrl;
      return;
    }
    setSending(false);
    setStatus('');

    successPane.querySelector('.js-name').textContent  = payload.name.split(' ')[0] || 'there';
    successPane.querySelector('.js-email').textContent = payload.email;
    successPane.querySelector('.js-date').textContent  = prettyDate(payload.appointmentDate);

    form.hidden = true;
    successPane.hidden = false;
    successPane.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  resetBtn.addEventListener('click', function () {
    form.reset();
    if (countEl) countEl.textContent = '0';
    document.querySelectorAll('.field.invalid').forEach(function (el) { el.classList.remove('invalid'); });
    successPane.hidden = true;
    form.hidden = false;
    document.getElementById('name').focus();
  });

})();
