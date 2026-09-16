# Job Application Autofill Helper

A small browser extension that fills job application forms from a profile
and answer bank you save once — on the page **you** opened, only when
**you** click Fill. It doesn't search LinkedIn, doesn't open postings,
doesn't click Apply, and doesn't click Submit. Think "password manager
autofill," not "job-application bot."

## Why this exists, and why it works this way

Tools that drive a browser through LinkedIn's search → apply → submit flow
without a human in the loop run into LinkedIn's User Agreement and can get
accounts restricted. This tool sidesteps that entirely by never automating
navigation or submission — it's a content-filling assistant that acts only
on the tab you're already looking at, the same category of tool as a
browser's built-in autofill or a password manager.

## What it does

- Stores your profile (name, contact info, experience, education, links,
  work-authorization details, etc.) locally in the browser — never sent
  anywhere.
- Stores an **answer bank** of question → answer pairs for the free-text
  questions that repeat across applications ("Why do you want to work
  here?").
- On demand, scans the visible form fields on the current tab, matches
  them to your profile or answer bank by label text, and fills them.
- Outlines each field green (filled) or orange (needs your input) so you
  can review everything before you submit — submission is always your
  click, not the extension's.

## What it deliberately does not do

- Does not search or browse job postings for you.
- Does not open or navigate to any page on its own.
- Does not click Apply, Next, Continue, or Submit.
- Does not run unless you click "Fill this page's form" in the popup.
- Does not send your data anywhere — everything lives in
  `chrome.storage.local` on your device.

## Installing on PC (Chrome, Edge, Brave, or any Chromium browser)

1. Download or clone this repository.
2. Go to `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select this folder.
5. Pin the extension from the puzzle-piece icon for quick access.

## Installing on Android

Manifest V3 extensions need a Chromium engine that supports extensions,
which stock Chrome for Android does not currently expose. Two browsers
that do:

**Kiwi Browser** (Chromium-based, supports Chrome extensions):
1. Install Kiwi Browser from the Play Store.
2. Open Kiwi → Menu (⋮) → **Extensions**.
3. Turn on **Developer mode**.
4. Tap **Load unpacked**, and point it at this folder (you'll need the
   repo downloaded to your device — e.g. via a Files app after
   downloading the ZIP from GitHub and extracting it).

**Firefox for Android** (supports a curated set of extensions; loading
this one unpacked requires `about:debugging` → *This Firefox* → *Load
Temporary Add-on*, which only lasts the session — Kiwi is the more
practical option for regular use).

## Using it

1. Open the extension popup and fill in the **Profile** tab once.
2. Add a few common questions and your answers in the **Answer Bank** tab.
3. Browse to a job posting and open the application form yourself.
4. Click the extension icon → **Fill this page's form**.
5. Review every field — especially anything outlined orange — then submit
   the form yourself, on the site, as you normally would.

## Contributing

Pull requests welcome, especially for improving field-label matching on
specific job boards (Workday, Greenhouse, Lever, LinkedIn, etc.) — that
logic lives in the `FIELD_MAP` array and `labelFor()` function inside
`popup.js`.

## License

MIT — see `LICENSE`.
