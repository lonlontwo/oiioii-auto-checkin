# 🎁 OiiOii.ai 自動取便當系統

每天自動幫你領取 OiiOii.ai 的 **300 免費點數**！

支援兩種運行方式：
- 🖥️ **本地執行** - 在你的電腦上定時執行
- ☁️ **雲端執行** - 使用 GitHub Actions 全自動運行（推薦）

---

## 🚀 快速開始

### 步驟 1：安裝依賴
```bash
npm install
```

### 步驟 2：登入並導出 Cookies
```bash
npm run export-cookies
```
1. 瀏覽器會開啟 OiiOii.ai
2. 點擊 Google 登入，選擇你的帳號
3. 登入成功後，回到終端按 Enter
4. Cookies 會保存到 `cookies.json` 和 `cookies-base64.txt`

### 步驟 3：本地測試
```bash
npm run checkin-cloud
```
確認可以成功簽到。

---

## ☁️ 雲端自動執行（GitHub Actions）

### 1. 建立 GitHub 倉庫

將此專案上傳到 GitHub：
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/你的帳號/oiioii-auto-checkin.git
git push -u origin main
```

### 2. 設定 Secrets

1. 到 GitHub 倉庫頁面
2. 點擊 **Settings** → **Secrets and variables** → **Actions**
3. 點擊 **New repository secret**
4. 添加以下 Secrets：

| 名稱 | 說明 |
|------|------|
| `OIIOII_EMAIL` | OiiOii 登入帳號（Email） |
| `OIIOII_PASSWORD` | OiiOii 登入密碼 |
| `OIIOII_COOKIES` | （可選）`cookies-base64.txt` 的內容 |
| `SUPABASE_URL` | Supabase 專案 URL |
| `SUPABASE_KEY` | Supabase 匿名公開金鑰 |

### 3. 啟用 Actions

1. 到倉庫的 **Actions** 頁籤
2. 點擊 **I understand my workflows, go ahead and enable them**
3. 系統會每天 **台灣時間 09:00** 自動執行

### 4. 手動測試

1. 到 **Actions** 頁籤
2. 選擇 **OiiOii Daily Checkin**
3. 點擊 **Run workflow**

---

## 📁 檔案說明

| 檔案 | 用途 |
|------|------|
| `login.js` | 手動登入並保存瀏覽器 Session |
| `export-cookies.js` | 導出 Cookies 用於雲端執行 |
| `checkin.js` | 本地簽到腳本 |
| `checkin-cloud.js` | 雲端簽到腳本（GitHub Actions 用） |
| `.github/workflows/daily-checkin.yml` | GitHub Actions 設定 |
| `setup-schedule.bat` | Windows 本地排程設定 |
| `cookies.json` | 導出的 Cookies（不要上傳！） |
| `cookies-base64.txt` | Base64 編碼的 Cookies |

---

## ⏰ 修改執行時間

編輯 `.github/workflows/daily-checkin.yml`：

```yaml
schedule:
  - cron: '0 1 * * *'  # UTC 01:00 = 台灣 09:00
```

常用時間對照：
| 台灣時間 | UTC | Cron |
|---------|-----|------|
| 08:00 | 00:00 | `0 0 * * *` |
| 09:00 | 01:00 | `0 1 * * *` |
| 12:00 | 04:00 | `0 4 * * *` |
| 18:00 | 10:00 | `0 10 * * *` |

---

## ⚠️ 注意事項

1. **不要把 `cookies.json` 上傳到 GitHub**（已加入 .gitignore）
2. **Cookies 可能會過期**，如果簽到失敗，請重新執行 `npm run export-cookies`
3. **GitHub Actions 有免費額度限制**，每月 2000 分鐘，這個腳本每次約 1-2 分鐘

---

## 🔧 故障排除

### Cookies 過期
重新執行：
```bash
npm run export-cookies
```
然後更新 GitHub Secrets。

### 找不到簽到按鈕
檢查 GitHub Actions 的 Artifacts 下載截圖，確認頁面狀態。

### 權限問題
確保 GitHub Secrets 名稱為 `OIIOII_COOKIES`（全大寫）。

---

## 📊 查看執行結果

1. 到 GitHub 倉庫 → **Actions**
2. 點擊最近的 workflow run
3. 下載 **Artifacts** 查看截圖
