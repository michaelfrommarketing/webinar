# Connecting the registration form to GoHighLevel

The form on `index.html` posts each registration to a GoHighLevel **Inbound Webhook**. That starts a workflow, which creates the contact and sends the confirmation email. One URL needs pasting in, and that's the only code change.

## 1. Create the workflow in GHL

1. **Automation → Workflows → Create Workflow → Start from scratch.**
2. **Add New Trigger → Inbound Webhook.** Copy the webhook URL it shows you.
3. Paste that URL into `js/register.js`, replacing `PASTE_YOUR_GHL_INBOUND_WEBHOOK_URL_HERE`.
4. Publish the site (or run it locally), submit one test registration, then click **Fetch Sample Request** on the trigger in GHL. GHL needs this sample before it can map the fields.

## 2. Map the fields (Create/Update Contact action)

Add a **Create Contact** (or **Create/Update Contact**) action and map:

| Webhook field   | GHL contact field                          |
|-----------------|--------------------------------------------|
| `first_name`    | First Name                                 |
| `last_name`     | Last Name                                  |
| `email`         | Email                                      |
| `phone`         | Phone                                      |
| `state`         | State                                      |
| `who_runs_ads`  | Custom field: *Who runs your ads*          |
| `monthly_spend` | Custom field: *Monthly spend on paid ads* (Under $4K / $4K - $10K / $10K - $20K / Over $20K) |

Every request also sends `source`, `page_url`, `referrer`, `submitted_at` and any UTM/click IDs from the landing URL (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `gclid`, `fbclid`, `li_fat_id`). Map these too if you want attribution.

Create any custom fields you don't have yet under **Settings → Custom Fields** before mapping.

## 3. Finish the workflow

Suggested steps after the contact action:

- **Add Tag:** `webinar-registered`. There's one session: Tuesday 15 December 2026, 10am to 11am AEDT.
- **Send Email:** the confirmation email. The page promises it includes **the calendar link and the worksheet**.
- Reminder emails/SMS before the session (Wait until date → Send).
- Optionally add the contact to an opportunity pipeline.

## Notes

- **Spam:** the form has a hidden honeypot field. Bots that fill it in see the success message, but nothing gets sent.
- **CORS:** the script first sends JSON. If the browser blocks that, it falls back to a form-encoded request that always reaches GHL. The success message only shows once the request has gone out. If submissions aren't arriving, check the workflow's **Execution Logs**.
- **Until the URL is set,** submitting shows an inline message saying registration isn't switched on yet, so nobody gets a false confirmation.
- **Tracking:** if Google Tag Manager or the Meta Pixel is on the page, a successful registration also fires `webinar_registration` (dataLayer) and `CompleteRegistration` (Pixel).
- **Copy:** the page still has `[START TIME] AEDT` placeholders, and the "Book Melbourne", "Book Sydney" and "Terms and privacy" links still point to `#`.
