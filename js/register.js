/*
 * Webinar registration → GoHighLevel inbound webhook.
 *
 * Paste the webhook URL from your GHL workflow's "Inbound Webhook" trigger below.
 * See GHL-SETUP.md for the full setup.
 */
var GHL_WEBHOOK_URL = "https://services.leadconnectorhq.com/hooks/E5IrRJ3JpBr6PkyQNSgi/webhook-trigger/997464f5-f49a-4389-bec8-b452594022da";

// Where people go after a successful registration.
var CONFIRMATION_URL = "https://lp.michaelfrommarketing.com.au/webinar-confirmation";

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

  // Meta: one ID shared by the browser pixel and the GHL Conversions API event, so Meta counts the registration once.
  var EVENT_ID = "reg-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);

  function readCookie(name) {
    var m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : "";
  }

  function metaClickId() {
    var fbc = readCookie("_fbc");
    if (fbc) return fbc;
    var fbclid = params.get("fbclid");
    return fbclid ? "fb.1." + Date.now() + "." + fbclid : "";
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
      event_id: EVENT_ID,
      fbp: readCookie("_fbp"),
      fbc: metaClickId(),
      user_agent: navigator.userAgent,
      submitted_at: new Date().toISOString()
    };
    TRACKING_KEYS.forEach(function (key) {
      payload[key] = params.get(key) || "";
    });
    return payload;
  }

  // Meta Conversions API needs customer details normalised and SHA-256 hashed.
  // GHL can't hash, so we do it here and GHL passes the hashes straight to Meta.
  function sha256(value) {
    if (!value || !window.crypto || !crypto.subtle) return Promise.resolve("");
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) {
        return ("0" + b.toString(16)).slice(-2);
      }).join("");
    });
  }

  function normPhone(raw) {
    var d = (raw || "").replace(/\D/g, "");
    if (!d) return "";
    if (d.indexOf("61") === 0) return d;
    if (d.charAt(0) === "0") return "61" + d.slice(1);
    return "61" + d;
  }

  function normText(raw) {
    return (raw || "").toLowerCase().replace(/[^a-z]/g, "");
  }

  function addMetaHashes(payload) {
    var fields = {
      meta_em: (payload.email || "").toLowerCase().trim(),
      meta_ph: normPhone(payload.phone),
      meta_fn: normText(payload.first_name),
      meta_ln: normText(payload.last_name),
      meta_st: normText(payload.state),
      meta_country: "au"
    };
    var keys = Object.keys(fields);
    return Promise.all(keys.map(function (k) { return sha256(fields[k]); })).then(function (hashes) {
      keys.forEach(function (k, i) { payload[k] = hashes[i]; });
      payload.event_time = Math.floor(Date.now() / 1000);
      return payload;
    }, function () { return payload; });
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

    var redirecting = false;
    setBusy(true);
    addMetaHashes(buildPayload())
      .then(send)
      .then(function () {
        if (window.dataLayer) window.dataLayer.push({ event: "webinar_registration" });
        if (window.fbq) window.fbq("track", "CompleteRegistration", {}, { eventID: EVENT_ID });
        if (CONFIRMATION_URL) {
          // Short pause so any tracking pixels can fire before the page changes.
          redirecting = true;
          button.textContent = "You're in. Taking you there…";
          setTimeout(function () { window.location.href = CONFIRMATION_URL; }, 400);
          return;
        }
        wrap.hidden = true;
        done.hidden = false;
        done.scrollIntoView({ behavior: "smooth", block: "center" });
      })
      .catch(function (err) {
        console.error(err);
        showError("Something went wrong saving your spot. Please try again in a moment.");
      })
      .then(function () {
        if (!redirecting) setBusy(false);
      });
  });
})();
