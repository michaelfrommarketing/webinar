/**
 * Bad lead cost calculator. Recalculates on every input change.
 * The only thing sent anywhere is one Meta Pixel event (CalculatorComplete, with the yearly total)
 * once someone has filled in every main field. The numbers they type are never sent.
 */
(function () {
  var form = document.getElementById("calc-form");
  if (!form) return;

  var money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
  var whole = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 });
  var oneDp = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 1 });

  function $(id) { return document.getElementById(id); }

  // Reads a field, ignoring the commas added for display; empty or invalid counts as 0.
  function num(id) {
    if (!$(id)) return 0;
    var v = parseFloat($(id).value.replace(/,/g, ""));
    return isFinite(v) && v > 0 ? v : 0;
  }

  // Formats a field as the person types (10000 -> 10,000), keeping the cursor in place.
  // Fields with inputmode="decimal" keep one decimal point; the rest take whole numbers only.
  function formatField(el, e) {
    var allowDot = el.inputMode === "decimal";
    var keep = allowDot ? /[0-9.]/ : /[0-9]/;
    var raw = el.value;
    var caret = el.selectionStart == null ? raw.length : el.selectionStart;

    // Backspace over a comma would only delete the comma, which reformatting puts straight back.
    // Delete the digit before it instead.
    var prev = el.dataset.prev || "";
    if (e && e.inputType === "deleteContentBackward" && raw.replace(/,/g, "") === prev.replace(/,/g, "") && caret > 0) {
      raw = raw.slice(0, caret - 1) + raw.slice(caret);
      caret -= 1;
    }

    var keptBefore = 0;
    for (var i = 0; i < caret; i++) if (keep.test(raw[i])) keptBefore++;

    var clean = "";
    var seenDot = false;
    for (var j = 0; j < raw.length; j++) {
      var ch = raw[j];
      if (!keep.test(ch)) continue;
      if (ch === ".") { if (seenDot) continue; seenDot = true; }
      clean += ch;
    }
    var parts = clean.split(".");
    var out = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (parts.length > 1 ? "." + parts[1] : "");

    el.value = out;
    el.dataset.prev = out;
    var pos = 0, seen = 0;
    while (pos < out.length && seen < keptBefore) { if (keep.test(out[pos])) seen++; pos++; }
    if (document.activeElement === el) el.setSelectionRange(pos, pos);
  }
  function pct(id) { return Math.min(num(id), 100) / 100; }
  function set(id, text) { var el = $(id); if (el) el.textContent = text; }
  // The embedded version on index.html leaves some of these out.
  function hide(id, hidden) { var el = $(id); if (el) el.hidden = hidden; }

  // Meta Pixel: fire CalculatorComplete once per visit, when every main field has a value
  // and the person has stopped typing for two seconds (so a half-typed salary isn't sent).
  var MAIN_FIELDS = ["ad-spend", "agency", "leads", "good", "call-mins", "salary"];
  var tracked = false, trackTimer = null;
  function trackComplete(yearly) {
    if (tracked) return;
    clearTimeout(trackTimer);
    var filled = MAIN_FIELDS.every(function (id) { return $(id) && $(id).value.trim() !== ""; });
    if (!filled || !(yearly > 0)) return;
    trackTimer = setTimeout(function () {
      if (tracked || !window.fbq) return;
      tracked = true;
      window.fbq("trackCustom", "CalculatorComplete", {
        value: Math.round(yearly),
        currency: "AUD",
        content_name: "Bad lead calculator",
        page: location.pathname === "/" ? "home" : "calculator"
      });
    }, 2000);
  }

  function calculate() {
    var adSpend = num("ad-spend");
    var agency = num("agency");
    var leads = Math.round(num("leads"));
    var goodRaw = Math.round(num("good"));
    var good = Math.min(goodRaw, leads);
    hide("good-warn", goodRaw <= leads || leads === 0);

    var bad = leads - good;
    var badShare = leads > 0 ? bad / leads : 0;

    // Marketing cost that went on bad leads, in proportion to their share of all leads.
    var wastedAds = adSpend * badShare;
    var wastedAgency = agency * badShare;

    // Sales time: every bad lead takes up the same amount of time.
    var calls = bad;
    var hours = bad * num("call-mins") / 60;

    // Salary package (including super) over a full year: 38 hours a week x 52 weeks = 1,976 hours.
    var hourly = num("salary") / 1976;
    var wastedTime = hours * hourly;

    var monthly = wastedAds + wastedAgency + wastedTime;
    var yearly = monthly * 12;

    // Until something is entered, prompt for numbers instead of showing "$0 every month".
    var started = monthly > 0;
    hide("r-month-line", !started);
    hide("r-empty", started);

    trackComplete(yearly);

    set("r-year", money.format(yearly));
    set("r-month", money.format(monthly));
    set("m-year", money.format(yearly));
    set("r-ads", money.format(wastedAds));
    set("r-agency", money.format(wastedAgency));
    set("r-time", money.format(wastedTime));
    set("r-ads-sub", leads > 0
      ? whole.format(bad) + " of your " + whole.format(leads) + " leads (" + whole.format(badShare * 100) + "%) aren't a good fit."
      : "Add your monthly leads to see this.");
    set("r-agency-sub", leads > 0 && agency > 0
      ? whole.format(badShare * 100) + "% of your " + money.format(agency) + " marketing team cost goes on bad leads."
      : "The share of your marketing team cost that goes on bad leads.");
    set("r-time-sub", oneDp.format(hours) + " hours a month at " + money.format(hourly) + " an hour.");

    var marketing = adSpend + agency;
    set("r-cpl", leads > 0 ? money.format(marketing / leads) : "–");
    set("r-cpgl", good > 0 ? money.format(marketing / good) : "–");

    // Stacked bar widths.
    var parts = { "b-ads": wastedAds, "b-agency": wastedAgency, "b-time": wastedTime };
    Object.keys(parts).forEach(function (id) {
      if ($(id)) $(id).style.width = monthly > 0 ? (parts[id] / monthly * 100) + "%" : "0";
    });

    // Optional: revenue if the wasted calls had been with good-fit leads.
    var deal = num("deal");
    var close = pct("close");
    if (deal > 0 && close > 0) {
      var deals = calls * close;
      set("r-opp", money.format(deals * deal * 12));
      set("r-opp-sub", "That's about " + oneDp.format(deals) + " extra deals a month if your " + oneDp.format(calls) +
        " calls with bad leads had been with good ones. This estimate isn't included in the total above.");
    } else {
      set("r-opp", "Add your deal value");
      set("r-opp-sub", "Fill in section 04 to see what those calls could be worth with buyers on the other end. This estimate isn't included in the total above.");
    }
  }

  form.addEventListener("input", function (e) {
    if (e.target && e.target.tagName === "INPUT") formatField(e.target, e);
    calculate();
  });
  form.addEventListener("submit", function (e) { e.preventDefault(); });
  calculate();

  // Mobile: show the bottom result bar only while the inputs are on screen and the
  // full results panel isn't, so it doesn't follow people around the rest of the page.
  var bar = $("mbar");
  if (bar && $("results") && "IntersectionObserver" in window) {
    var formVisible = false, resultsVisible = false;
    var update = function () { bar.classList.toggle("is-hidden", resultsVisible || !formVisible); };
    new IntersectionObserver(function (entries) {
      resultsVisible = entries[0].isIntersecting; update();
    }, { threshold: 0.15 }).observe($("results"));
    new IntersectionObserver(function (entries) {
      formVisible = entries[0].isIntersecting; update();
    }).observe(form);
  }
})();
