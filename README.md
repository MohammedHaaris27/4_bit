
# 🛡️ PAN & Aadhaar Shield

> A Chrome Extension that scans files for sensitive Indian identity documents **before** they are uploaded — and gives you full control to Allow or Deny.

![Version](https://img.shields.io/badge/version-2.0.0-c8f23a?style=flat-square)
![Manifest](https://img.shields.io/badge/manifest-v3-blue?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![Platform](https://img.shields.io/badge/platform-Chrome%20%2F%20Brave-orange?style=flat-square)

---

## 📌 What It Does

Most people unknowingly upload Aadhaar cards, PAN cards, and Driving Licenses to unverified websites. **PAN & Aadhaar Shield** intercepts every file upload attempt, scans the file using OCR and pattern detection, tells you exactly what sensitive data was found and at which line — then asks you whether to proceed or block the upload entirely.

---

## 🗂️ File Structure

```
extension/
├── manifest.json          ← Chrome extension config (Manifest V3)
├── content-script.js      ← Core logic: intercept, scan, modal, allow/deny
├── popup.html             ← Extension popup UI
├── tesseract.min.js       ← Tesseract.js OCR engine (client-side)
├── worker.min.js          ← Tesseract background worker
├── package.json           ← Node package info (pan-aadhaar-ocr v1.0.2)
└── package-lock.json      ← Dependency lock file
```

---

## ⚙️ How It Works

```
User selects a file
        ↓
Extension immediately clears the input (upload frozen)
        ↓
Scanning modal appears
        ↓
  ┌─────────────────────────────────┐
  │  1. Filename keyword check      │  ← instant, all file types
  │  2. OCR scan (images only)      │  ← Tesseract.js, client-side
  │  3. Text read (txt/csv/json)    │  ← FileReader API
  │  4. Regex on each line          │  ← finds match + line number
  └─────────────────────────────────┘
        ↓
Result modal shown with findings
        ↓
    ┌───────┐       ┌───────┐
    │ DENY  │       │ ALLOW │
    └───────┘       └───────┘
     Input            Files reassigned
     stays            back to input,
     empty            upload proceeds
```

---

## 🔍 Detection Logic

### Regex Patterns

| Document | Pattern |
|---|---|
| PAN Card | `[A-Z]{5}[0-9]{4}[A-Z]` |
| Aadhaar Card | `\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b` |
| Driving License | `[A-Z]{2}[\s\-]?\d{2}[\s\-]?[A-Z]{0,2}[\s\-]?\d{4,7}` |

### Filename Keywords

```
aadhaar, aadhar, pan, pancard, driving, license,
uid, uidai, identity, idcard, voter, passport
```

### Scan Methods

| File Type | Method |
|---|---|
| Images (jpg, png, webp…) | Tesseract.js OCR → split into lines → regex |
| Text files (txt, csv, json, md…) | FileReader → split into lines → regex |
| Any file | Filename keyword check (always runs first) |

All regex runs line by line so the extension can report **exactly which line** the sensitive data was found on.

---

## 🖥️ Extension Flow

1. **Intercept** — A `change` event listener is attached to every `input[type="file"]` on the page. MutationObserver catches dynamically added inputs too (works on React, Vue, Angular sites).

2. **Freeze** — The file input is cleared immediately using `DataTransfer`, so the upload cannot proceed without your permission.

3. **Scan** — The file is scanned fully on-device. No data leaves your browser during scanning.

4. **Alert** — A modal shows you each finding with document type, line number, and matched value. Example:
   ```
   ⚠ PAN Card found at line 4: ABCDE1234F
   ⚠ Aadhaar Card found at line 7: 1234 5678 9012
   ```

5. **Decide** —
   - 🚫 **Deny** → input stays empty, file is never uploaded, toast confirms block
   - ✅ **Allow** → files are reassigned back to the input, upload proceeds normally

---

## 🚀 Installation

> No build step required. Load directly into Chrome.

### Step 1 — Download Tesseract files

Save these two files into your extension folder:

- `tesseract.min.js` → `https://unpkg.com/tesseract.js@4.1.2/dist/tesseract.min.js`
- `worker.min.js` → `https://unpkg.com/tesseract.js@4.1.2/dist/worker.min.js`

### Step 2 — Load into Chrome

1. Open `chrome://extensions`
2. Enable **Developer Mode** (top right toggle)
3. Click **Load unpacked**
4. Select your `extension/` folder

### Step 3 — Test it

Go to any website with a file upload (Gmail, WhatsApp Web, Google Drive, any form). Pick an image named `aadhaar.jpg` or any image containing a PAN/Aadhaar number — the scan modal will appear.

---

## 🧪 Test Cases

| Test | Expected Result |
|---|---|
| Upload image named `aadhaar.jpg` | ⚠ Suspicious filename detected |
| Upload image containing PAN number | ⚠ PAN Card found at line X |
| Upload image containing Aadhaar digits | ⚠ Aadhaar Card found at line X |
| Upload a clean photo | ✓ No sensitive data detected |
| Click Deny | Input cleared, toast: Upload blocked |
| Click Allow | File proceeds to upload normally |

---

## 🔒 Privacy

- **100% client-side** — all scanning happens inside your browser
- **No data is sent anywhere** during the scan
- **No storage used** — extension holds no logs, no history
- **No tracking** — zero analytics or external requests

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| Chrome Manifest V3 | Extension framework |
| Tesseract.js v4 | Client-side OCR for image scanning |
| Regex | Pattern detection for PAN / Aadhaar / DL |
| FileReader API | Reading text file contents |
| DataTransfer API | Intercepting and reassigning file inputs |
| MutationObserver | Watching dynamically added file inputs |

---

## 👨‍💻 Built By

**Mohammed Haaris** — 2nd Semester CSE Student, Vidyavardhaka College of Engineering (VVCE), Mysuru

- GitHub: [@MohammedHaaris27](https://github.com/MohammedHaaris27)

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

> Built as a civic tech project to protect Indian users from accidentally sharing sensitive identity documents online.
