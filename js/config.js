/* ------------------------------------------------------------------
   Site configuration — this is the only file you need to edit.
   ------------------------------------------------------------------ */
window.SITE_CONFIG = (function () {

  /* ================================================================
     THE ONE SWITCH THAT MATTERS

     'test' → sends to the TEST webhook. n8n only listens after you
              click "Listen for test event" in the editor, and it
              accepts ONE submission per click. Nothing is emailed
              or saved. Use this while you are still building.

     'live' → sends to the PRODUCTION webhook. Requires the workflow
              to be switched Active in n8n. This is the real thing:
              alerts fire, auto-replies go out.

     To go live later, change the word below from 'test' to 'live'.
     That is the whole switch — nothing else needs touching.
     ================================================================ */
  var MODE = 'live';

  /* Your two n8n URLs. Same path, different prefix — that is the only
     difference between them. Copy these from the Webhook node in n8n. */
  var TEST_URL = 'https://rockit2021.app.n8n.cloud/webhook-test/leadgenration';
  var LIVE_URL = 'https://rockit2021.app.n8n.cloud/webhook/leadgenration';

  return {

    webhookUrl: (MODE === 'live') ? LIVE_URL : TEST_URL,

    /* Exposed so the page can warn you in the browser console when it is
       still pointed at the test webhook. */
    mode: MODE,

    /* Optional shared secret. If set, it is sent as the X-Webhook-Token header
       AND inside the payload, so you can reject anything else in n8n.
       Leave as '' to disable. Note: anything in front-end code is public — this
       stops casual junk, not a determined attacker. Use n8n Header Auth for real
       protection. */
    webhookToken: '',

    /* How long to wait for n8n before giving up (milliseconds). */
    timeoutMs: 12000,

    /* Earliest bookable appointment date, in days from today.
       1 = tomorrow. Weekends are still selectable; adjust if you need. */
    minLeadDays: 1,

    /* How far ahead people may book, in days. */
    maxLeadDays: 120,

    /* Where to send people after a successful submission.
       Leave as null to show the inline "Request received" panel instead. */
    redirectUrl: null
  };
})();
