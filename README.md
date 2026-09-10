# Lead-generation landing page → n8n

A static landing page whose enquiry form POSTs straight to an n8n webhook. No build
step, no backend, no dependencies — open `index.html` and it runs.

```
lead-gen-site/
├─ index.html                     the landing page + form
├─ css/styles.css
├─ js/config.js                   ← the only file you must edit
├─ js/app.js                      validation + webhook delivery
└─ n8n/lead-capture-workflow.json importable starter workflow
```

## 1. Point the form at your webhook

In n8n, add a **Webhook** node, set method `POST` and a path (e.g. `lead-form`), then
copy its **Production URL**. Paste it into `js/config.js`:

```js
webhookUrl: 'https://your-instance.app.n8n.cloud/webhook/lead-form',
```

That is the whole integration. Everything else in `config.js` is optional.

## 2. Turn on CORS in n8n (important)

The browser will block the request unless the webhook allows your site's origin.
On the Webhook node open **Options → Allowed Origins (CORS)** and enter `*`, or
your real domain once you have one.

If you skip this the form still works — `app.js` falls back to a `no-cors` POST, so
the lead reaches n8n — but the browser hides the response, so the page shows success
without being able to confirm it. Set the origin properly and you get real
confirmation plus real error messages.

## 3. Import the starter workflow (optional)

`n8n/lead-capture-workflow.json` → n8n → **Import from File**. It gives you:

| Node | What it does |
|---|---|
| Lead Webhook | receives the POST, CORS open |
| Validate & Score | rejects incomplete/spoofed posts, scores the lead `hot` / `warm` / `cold` |
| Respond 200 | answers the browser immediately, before the slow nodes run |
| Hot lead? | routes high scorers to a separate alert |
| Alert Sales ×2 | formatted internal email |
| Auto-reply to Lead | confirmation email to the enquirer |
| Log to Google Sheet | append row — **disabled by default**, enable and set your sheet ID |

The Gmail and Sheets nodes need your own credentials attached, and the placeholder
addresses (`sales@example.com`, `leads@example.com`) changed.

Scoring lives in the Code node: `budget × 2 + urgency + detail`, where urgency comes
from how soon they want the appointment and detail from how much they wrote. Tune the
thresholds there.

## 4. What gets sent

`Content-Type: application/json`, so in n8n the fields are on `{{ $json.body }}`.

```json
{
  "name": "Jane Okonkwo",
  "email": "jane@company.com",
  "phone": "+447700900000",
  "service": "AI & automation",
  "budget": "£5,000 – £15,000",
  "appointmentDate": "2026-09-18",
  "problem": "We get plenty of traffic but almost no enquiries…",

  "consent": true,
  "submittedAt": "2026-09-10T14:22:03.118Z",
  "timezone": "Europe/London",
  "pageUrl": "https://example.com/?utm_source=linkedin",
  "referrer": "https://www.linkedin.com/",
  "userAgent": "Mozilla/5.0 …",
  "language": "en-GB",
  "utm": { "utm_source": "linkedin" },
  "formId": "northgate-lead-form-v1"
}
```

The first seven keys are the fields from the brief. The rest is context worth having
when you route, score, or attribute the lead — UTM tags are picked up automatically
from the page URL, so `?utm_source=facebook` on your ad link arrives with the lead.

## 5. Configuration reference (`js/config.js`)

| Key | Default | Purpose |
|---|---|---|
| `webhookUrl` | placeholder | n8n Production webhook URL |
| `webhookToken` | `''` | shared secret sent as `X-Webhook-Token` and in the body |
| `timeoutMs` | `12000` | how long to wait before falling back |
| `minLeadDays` | `1` | earliest selectable appointment date |
| `maxLeadDays` | `120` | latest selectable appointment date |
| `redirectUrl` | `null` | send to a thank-you page instead of the inline panel |

`webhookToken` is visible to anyone who views source — it stops drive-by junk, not a
determined attacker. For real protection use n8n's **Header Auth** credential on the
webhook node. To check the token in the workflow, set `SHARED_TOKEN` at the top of the
Code node to the same value.

## Spam handling

A honeypot field (`company_website`) sits off-screen. Humans never see it; most bots
fill it. When it is filled the page shows the success panel and sends nothing, so the
bot believes it succeeded and stops retrying.

## Testing before you go live

1. Leave `webhookUrl` as the placeholder, open the page, fill the form and submit.
   The page tells you it is not connected and logs the exact payload to the console —
   useful for checking what n8n will receive.
2. Paste n8n's **Test URL** (`.../webhook-test/...`), click *Listen for test event*
   in n8n, then submit once. Test URLs accept a single request per listen.
3. Swap to the **Production URL** and activate the workflow.

A 404 from the webhook almost always means the workflow is not activated, or you are
using the Production URL while only the Test URL is listening.

## Hosting

Any static host — Netlify, Vercel, Cloudflare Pages, GitHub Pages, or plain S3.
Drag the folder in; there is nothing to build.

## Making it yours

- Brand name, colours and copy: `index.html` plus the tokens at the top of `css/styles.css`.
- Service list and budget bands: the two `<select>` blocks in `index.html`. Keep the
  option text in sync with `BUDGET_SCORE` in the n8n Code node if you change the bands.
- Contact details in the error messages: search `+44 20 7946 0000` in `js/app.js`.
