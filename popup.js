// ---------- Tabs ----------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
  });
});

// ---------- Storage helpers ----------
const getProfile = () =>
  new Promise((resolve) => chrome.storage.local.get(["profile"], (r) => resolve(r.profile || {})));
const setProfile = (profile) =>
  new Promise((resolve) => chrome.storage.local.set({ profile }, resolve));

const getAnswers = () =>
  new Promise((resolve) => chrome.storage.local.get(["answers"], (r) => resolve(r.answers || [])));
const setAnswers = (answers) =>
  new Promise((resolve) => chrome.storage.local.set({ answers }, resolve));

// ---------- Profile form ----------
const profileForm = document.getElementById("profileForm");

async function loadProfileIntoForm() {
  const profile = await getProfile();
  for (const el of profileForm.elements) {
    if (!el.name) continue;
    if (profile[el.name] !== undefined) el.value = profile[el.name];
  }
}

profileForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const profile = {};
  for (const el of profileForm.elements) {
    if (!el.name) continue;
    profile[el.name] = el.value.trim();
  }
  await setProfile(profile);
  const flash = document.getElementById("profileSaved");
  flash.textContent = "Saved";
  setTimeout(() => (flash.textContent = ""), 1500);
});

// ---------- Answer bank ----------
const qaForm = document.getElementById("qaForm");
const qaList = document.getElementById("qaList");

async function renderAnswers() {
  const answers = await getAnswers();
  qaList.innerHTML = "";
  answers.forEach((qa, idx) => {
    const li = document.createElement("li");
    li.className = "qa-item";
    li.innerHTML = `
      <div class="q"></div>
      <div class="a"></div>
      <button class="remove-qa" type="button">Remove</button>
    `;
    li.querySelector(".q").textContent = qa.question;
    li.querySelector(".a").textContent = qa.answer;
    li.querySelector(".remove-qa").addEventListener("click", async () => {
      const current = await getAnswers();
      current.splice(idx, 1);
      await setAnswers(current);
      renderAnswers();
    });
    qaList.appendChild(li);
  });
}

qaForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = document.getElementById("qaQuestion").value.trim();
  const answer = document.getElementById("qaAnswer").value.trim();
  if (!question || !answer) return;
  const answers = await getAnswers();
  answers.push({ question, answer });
  await setAnswers(answers);
  qaForm.reset();
  renderAnswers();
});

// ---------- Fill Page ----------
const fillBtn = document.getElementById("fillBtn");
const fillStatus = document.getElementById("fillStatus");
const fillReport = document.getElementById("fillReport");

fillBtn.addEventListener("click", async () => {
  fillStatus.textContent = "Reading the page…";
  fillStatus.className = "status";
  fillReport.innerHTML = "";

  const [profile, answers] = await Promise.all([getProfile(), getAnswers()]);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    fillStatus.textContent = "Could not find the active tab.";
    fillStatus.className = "status warn";
    return;
  }

  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fillFormOnPage,
      args: [profile, answers],
    });

    if (!result || result.total === 0) {
      fillStatus.textContent = "No form fields found on this page.";
      fillStatus.className = "status warn";
      return;
    }

    fillStatus.textContent = `Filled ${result.filled} of ${result.total} fields. Review before you submit.`;
    fillStatus.className = "status ok";

    result.report.forEach((entry) => {
      const li = document.createElement("li");
      li.className = entry.filled ? "filled" : "skipped";
      li.innerHTML = `<span class="tag">${entry.filled ? "Filled" : "Skipped"}</span><span>${entry.label}</span>`;
      fillReport.appendChild(li);
    });
  } catch (err) {
    fillStatus.textContent = "Couldn't run on this page (some sites block extensions, e.g. chrome:// pages).";
    fillStatus.className = "status warn";
  }
});

// ---------------------------------------------------------------
// This function is injected into the ACTIVE TAB only, and only when
// the user clicks "Fill this page's form". It must be self-contained
// (no closures over outer variables) because chrome.scripting runs it
// in the page's isolated world.
//
// What it deliberately does NOT do:
//  - does not navigate anywhere
//  - does not search or click "Apply"
//  - does not click Submit / Next / Continue
//  - does not run unless the user just clicked the button
// ---------------------------------------------------------------
function fillFormOnPage(profile, answers) {
  function setNativeValue(el, value) {
    const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function labelFor(el) {
    if (el.id) {
      const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lab && lab.textContent.trim()) return lab.textContent.trim();
    }
    const parentLabel = el.closest("label");
    if (parentLabel && parentLabel.textContent.trim()) return parentLabel.textContent.trim();
    if (el.getAttribute("aria-label")) return el.getAttribute("aria-label").trim();
    const describedBy = el.getAttribute("aria-describedby");
    if (describedBy) {
      const d = document.getElementById(describedBy);
      if (d && d.textContent.trim()) return d.textContent.trim();
    }
    // walk up a few ancestors looking for the nearest preceding text block
    let node = el;
    for (let i = 0; i < 4 && node; i++) {
      node = node.parentElement;
      if (!node) break;
      const heading = node.querySelector("label, legend, .label, [class*='label']");
      if (heading && heading.textContent.trim() && heading.textContent.trim().length < 200) {
        return heading.textContent.trim();
      }
    }
    return el.placeholder || el.name || el.id || "Unlabeled field";
  }

  const FIELD_MAP = [
    [/first\s*name/i, "first_name"],
    [/last\s*name|surname/i, "last_name"],
    [/full\s*name|^name$/i, "full_name"],
    [/e-?mail/i, "email"],
    [/phone\s*(country|code)/i, "phone_country_code"],
    [/phone|mobile|contact number/i, "phone"],
    [/city/i, "city"],
    [/state|province|division/i, "state"],
    [/country/i, "country"],
    [/linked ?in/i, "linkedin_url"],
    [/git ?hub/i, "github_url"],
    [/portfolio|website|personal site/i, "portfolio_url"],
    [/headline|professional title/i, "headline"],
    [/summary|about you/i, "summary"],
    [/years?.*experience|experience.*years?/i, "total_years_experience"],
    [/current\s*title|job\s*title/i, "current_title"],
    [/current\s*(employer|company)/i, "current_company"],
    [/highest\s*degree|education level/i, "highest_degree"],
    [/field of study|major/i, "field_of_study"],
    [/university|college|school/i, "university"],
    [/graduation year/i, "graduation_year"],
    [/skills/i, "skills"],
    [/certification/i, "certifications"],
    [/language/i, "languages"],
    [/work authoriz|authorized to work|legally authorized/i, "work_authorization"],
    [/visa|sponsorship/i, "requires_visa_sponsorship"],
    [/relocat/i, "willing_to_relocate"],
    [/notice period/i, "notice_period_days"],
    [/current (salary|ctc)/i, "current_ctc"],
    [/expected (salary|ctc)/i, "expected_ctc"],
  ];

  function bestProfileKey(label) {
    for (const [pattern, key] of FIELD_MAP) {
      if (pattern.test(label)) return key;
    }
    return null;
  }

  function bestAnswerMatch(label) {
    if (!answers || !answers.length) return null;
    const labelWords = label.toLowerCase().match(/[a-z0-9]+/g) || [];
    let best = null;
    let bestScore = 0;
    for (const qa of answers) {
      const qWords = qa.question.toLowerCase().match(/[a-z0-9]+/g) || [];
      const overlap = qWords.filter((w) => labelWords.includes(w) && w.length > 2).length;
      const score = overlap / Math.max(qWords.length, 1);
      if (score > bestScore) {
        bestScore = score;
        best = qa;
      }
    }
    return bestScore >= 0.4 ? best : null;
  }

  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }

  const fields = Array.from(
    document.querySelectorAll(
      "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=file]):not([type=checkbox]):not([type=radio]), textarea, select"
    )
  ).filter(isVisible);

  const report = [];
  let filled = 0;

  for (const el of fields) {
    if (el.disabled || el.readOnly) continue;
    const label = labelFor(el);
    const key = bestProfileKey(label);
    let value = key ? profile[key] : null;

    if (!value && (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && !key))) {
      const match = bestAnswerMatch(label);
      if (match) value = match.answer;
    }

    if (value) {
      if (el.tagName === "SELECT") {
        const opt = Array.from(el.options).find(
          (o) => o.textContent.trim().toLowerCase() === String(value).trim().toLowerCase()
        );
        if (opt) {
          el.value = opt.value;
          el.dispatchEvent(new Event("change", { bubbles: true }));
          filled++;
          report.push({ label, filled: true });
          continue;
        }
      } else {
        setNativeValue(el, String(value));
        el.style.outline = "2px solid #1a7f4b";
        filled++;
        report.push({ label, filled: true });
        continue;
      }
    }

    el.style.outline = "2px solid #b3661a";
    report.push({ label, filled: false });
  }

  return { total: fields.length, filled, report };
}

// ---------- Init ----------
loadProfileIntoForm();
renderAnswers();
