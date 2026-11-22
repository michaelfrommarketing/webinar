/*
 * Webinar registration → GoHighLevel inbound webhook.
 *
 * Paste the webhook URL from your GHL workflow's "Inbound Webhook" trigger below.
 * See GHL-SETUP.md for the full setup.
 */
var GHL_WEBHOOK_URL = "PASTE_YOUR_GHL_INBOUND_WEBHOOK_URL_HERE";

(function () {
  var form = document.getElementById("register-form");
  var wrap = document.getElementById("form-wrap");
  var done = document.getElementById("form-done");
  var errorEl = document.getElementById("form-error");
  var button = form.querySelector('button[type="submit"]');
  var buttonLabel = button.textContent;

  // Capture UTM / click IDs from the landing URL so GHL can attribute the signup.
  var params = new URLSearchParams(window.location.search);
  var TRACKING_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid", "li_fat_id"];

  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  function setBusy(busy) {
    button.disabled = busy;
    button.textContent = busy ? "Saving your spot…" : buttonLabel;
    button.style.opacity = busy ? "0.7" : "";
    button.style.cursor = busy ? "progress" : "";
  }

  function buildPayload() {
    var data = new FormData(form);
    var payload = {
      first_name: (data.get("first_name") || "").trim(),
      last_name: (data.get("last_name") || "").trim(),
      email: (data.get("email") || "").trim(),
      phone: (data.get("phone") || "").trim(),
      state: data.get("state") || "",
      who_runs_ads: data.get("who_runs_ads") || "",
      monthly_spend: data.get("monthly_spend") || "",
      source: "Webinar landing page",
      page_url: window.location.href,
      referrer: document.referrer || "",
      submitted_at: new Date().toISOString()
    };
    TRACKING_KEYS.forEach(function (key) {
      payload[key] = params.get(key) || "";
    });
    return payload;
  }

  function send(payload) {
    // First try a normal JSON POST. If the browser blocks it (CORS), fall back to a
    // form-encoded "no-cors" POST, which always reaches the webhook but can't be read back.
    return fetch(GHL_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (!res.ok) throw new Error("Webhook responded " + res.status);
    }, function () {
      return fetch(GHL_WEBHOOK_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(payload).toString()
      });
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    errorEl.hidden = true;

    // Honeypot: real people never fill this hidden field.
    if (form.elements.company_website && form.elements.company_website.value) {
      wrap.hidden = true;
      done.hidden = false;
      return;
    }

    if (!/^https:\/\//.test(GHL_WEBHOOK_URL)) {
      console.error("register.js: GHL_WEBHOOK_URL is not set.");
      showError("Registration isn't switched on yet. Please email us and we'll save your spot.");
      return;
    }

    setBusy(true);
    send(buildPayload())
      .then(function () {
        wrap.hidden = true;
        done.hidden = false;
        done.scrollIntoView({ behavior: "smooth", block: "center" });
        if (window.dataLayer) window.dataLayer.push({ event: "webinar_registration" });
        if (window.fbq) window.fbq("track", "CompleteRegistration");
      })
      .catch(function (err) {
        console.error(err);
        showError("Something went wrong saving your spot. Please try again in a moment.");
      })
      .then(function () {
        setBusy(false);
      });
  });
})();
