# MinhHTC-Assistant-Telegram
from: [github.com/nguyenngocphung2000](https://github.com/nguyenngocphung2000/BOTTelegram-QLCT)
# Hướng dẫn cài đặt và sử dụng Telegram Bot quản lý tài chính
---
## 1. Giới thiệu
Telegram bot giúp bạn quản lý tài chính cá nhân, lưu trữ dữ liệu trên Google Sheets và cung cấp báo cáo theo thời gian. 

Bạn có thể:
- Thêm giao dịch thu/chi.
- Xem báo cáo theo tuần, tháng.
- Xóa giao dịch gần nhất hoặc toàn bộ dữ liệu.

---

## 2. Cài đặt

### 2.1. Tạo Telegram Bot
1. Mở ứng dụng Telegram, tìm kiếm **BotFather**.
2. Gửi lệnh `/newbot` và làm theo hướng dẫn để tạo bot mới.
3. Sau khi hoàn tất, bạn sẽ nhận được **TOKEN** để kết nối bot.

### 2.2. Tạo Google Sheets
1. Truy cập Google Sheets và tạo một bảng tính mới.
2. Đổi tên sheet (ví dụ: Finance Data).
3. Tạo các cột(Không bắt buộc): **Thời gian**, **Loại**, **Số tiền**, **Mô tả**.
4.Lấy Sheet ID từ URL

  
	Ví dụ URL:

https://docs.google.com/spreadsheets/d/1A2B3C4D5E6F7G8H9I0J/edit#gid=0

 Sheet ID là phần:     **1A2B3C4D5E6F7G8H9I0J**

5. Lấy ADMIN ID (Để sử dụng tính năng add người có quyền dùng bot)
   
   Chính là dãy số id tài khoản Telegram của bạn, nếu có nhiều hơn 1 admin thì cách nhau bằng dấu phẩy và nằm trong ngoặc kép "
   
### 2.3. Triển khai Google Apps Script
1. Mở Google Sheets > Extensions > Apps Script.
2. Dán mã sau (nhớ xoá mã cũ đi):

```
const TOKEN = "YOUR_TELEGRAM_BOT_TOKEN";
const API_URL = `https://api.telegram.org/bot${TOKEN}`;
const SHEET_ID = "YOUR_SHEET_ID";

// Hàm tạo và quản lý sheet hàng tháng
function getOrCreateMonthlySheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const today = new Date();
  const sheetName = today.toLocaleString('en', { month: 'short' }).toUpperCase() + 
                    '-' + today.getFullYear();
  
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(["Thời gian", "Loại", "Số tiền", "Mô tả", "Phương thức thanh toán"]);
  }
  return sheet;
}

function doPost(e) {
  const { message } = JSON.parse(e.postData.contents);
  const chatId = message.chat.id;
  const text = message.text;

  if (text.startsWith("/start")) {
    sendWelcomeMessage(chatId);
  } else if (text.startsWith("/help")) {
    sendHelpMessage(chatId);
  } else if (text.startsWith("/report")) {
    handleReport(chatId, text);
  } else if (text.startsWith("/reset")) {
    resetSheet(chatId);
  } else if (text.startsWith("/undo")) {
    undoLast(chatId);
  } else {
    handleTransaction(chatId, text);
  }
}

function sendWelcomeMessage(chatId) {
  sendMessage(
    chatId,
    `Chào mừng bạn đến với ứng dụng quản lý tài chính cá nhân!\n\n` +
    `Tôi được tạo ra để giúp bạn ghi lại các giao dịch thu chi một cách dễ dàng.\n\n` +
    `Hãy nhập giao dịch của bạn theo cú pháp: <số tiền> <thu/chi> <phương thức> <mô tả>\n` +
    `Gõ /help để xem hướng dẫn sử dụng chi tiết.\n\n` +
    `Chúc bạn một ngày tốt lành! From MinhHTC with love ❤️`
  );
}

function sendHelpMessage(chatId) {
  sendMessage(
    chatId,
    `Hướng dẫn sử dụng:\n\n` +
    `1. Thêm giao dịch:\n   Nhập theo cú pháp: <số tiền> <thu/chi> <phương thức> <mô tả>\n` +
    `   Phương thức thanh toán: tienmat, qrbank, momo, credit\n\n` +
    `2. Xem báo cáo:\n` +
    `   - /report: Báo cáo tổng.\n` +
    `   - /report today: Báo cáo ngày hôm nay.\n` +
    `   - /report mm/yyyy: Báo cáo tháng.\n` +
    `   - /report dd/mm/yyyy: Báo cáo tuần.\n` +
    `   - Thêm "az" hoặc "za" sau lệnh để sắp xếp.\n\n` +
    `3. Các lệnh khác:\n` +
    `   - /help: Hiển thị hướng dẫn sử dụng\n` +
    `   - /undo: Hủy giao dịch gần nhất\n` +
    `   - /reset: Xóa toàn bộ dữ liệu\n\n` +
    `Ví dụ:\n` +
    `100k thu tienmat lương\n` +
    `50k chi momo cafe\n` +
    `2tr chi credit mua sắm\n` +
    `Bot chỉ nhận diện số tiền có đơn vị là nghìn hoặc triệu. Ví dụ: 100k = 100.000 vnđ, 2tr = 2.000.000 vnđ.\n` +
    `Nếu như bạn có giao dịch 2 triệu và số lẻ đằng sau, vui lòng điền theo dạng 2xxxk. vd: 2 triệu 500 = 2500k\n` +
    `Chú ý: Để tránh lỗi, hãy nhập mô tả giao dịch không chứa ký tự đặc biệt.`
  );
}

function handleTransaction(chatId, text) {
  try {
    const parts = text.split(" ");
    if (parts.length < 4) {
      sendMessage(chatId, "Lỗi: Nhập đúng cú pháp <số tiền> <thu/chi> <phương thức> <mô tả>.");
      return;
    }

    const amount = parts[0];
    const type = parts[1].toLowerCase();
    const paymentMethod = parts[2].toLowerCase();
    const desc = parts.slice(3).join(" ");

    // Enhanced amount validation
    const parsedAmount = parseAmount(amount);
    if (!isValidAmount(amount) || !["thu", "chi"].includes(type)) {
      sendMessage(chatId, "Lỗi: Số tiền hoặc loại giao dịch không hợp lệ.");
      return;
    }
    
    // Add maximum amount validation (e.g., 1 billion VND)
    if (parsedAmount > 1000000000) {
      sendMessage(chatId, "Lỗi: Số tiền vượt quá giới hạn cho phép (1 tỷ VND).");
      return;
    }

    if (!isValidPaymentMethod(paymentMethod)) {
      sendMessage(chatId, "Lỗi: Phương thức thanh toán phải là: tienmat, qrbank, momo, hoặc credit");
      return;
    }

    const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);
    const sheet = getOrCreateMonthlySheet();
    
    if (!sheet) {
      sendMessage(chatId, "Lỗi: Không thể truy cập bảng tính. Vui lòng thử lại sau.");
      return;
    }

    sheet.appendRow([
      new Date(),
      type,
      parsedAmount,
      desc,
      normalizedPaymentMethod
    ]);

    sendMessage(
      chatId, 
      `Đã thêm giao dịch:\nSố tiền: ${formatCurrency(parsedAmount)}\nLoại: ${type}\nPhương thức: ${normalizedPaymentMethod}\nMô tả: ${desc}`
    );
  } catch (error) {
    console.error("Error in handleTransaction:", error);
    sendMessage(chatId, "Có lỗi xảy ra khi xử lý giao dịch. Vui lòng thử lại sau.");
  }
}

function handleReport(chatId, text) {
  const dateRegex = /\d{2}\/\d{4}|\d{2}\/\d{2}\/\d{4}/;
  const dateParam = text.match(dateRegex)?.[0];
  let filter = "all";
  let sortOrder = null;

  if (text.includes("today")) {
    filter = "today";
  } else if (dateParam) {
    filter = dateParam.length === 7 ? "month" : "week";
  }

  if (text.includes("az")) {
    sortOrder = "az";
  } else if (text.includes("za")) {
    sortOrder = "za";
  }

  generateReport(chatId, filter, dateParam, sortOrder);
}

function generateReport(chatId, filter, dateParam, sortOrder) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheets = ss.getSheets();
  let allData = [];
  
  // Tập hợp dữ liệu từ tất cả các sheet
  sheets.forEach(sheet => {
    const data = sheet.getDataRange().getValues();
// Kiểm tra header của sheet
    const header = data[0];
    if (isValidSheetHeader(header)) {
// Chỉ lấy dữ liệu từ các sheet có cấu trúc đúng
      allData = allData.concat(data.slice(1));
    }
  });

  if (!allData.length) {
    sendMessage(chatId, "Không có dữ liệu.");
    return;
  }
  
  // Nếu báo cáo tổng ("/report" chỉ có lệnh báo cáo) thì nhóm theo từng tháng
  if (filter === "all") {
    let monthlyBalances = {};
    allData.forEach(row => {
      try {
        let [date, type, amount] = row;
        const dt = date instanceof Date ? date : new Date(date);
        let month = ("0" + (dt.getMonth() + 1)).slice(-2);
        let year = dt.getFullYear();
        let key = `${month}/${year}`;
        if (!monthlyBalances[key]) monthlyBalances[key] = 0;
        amount = typeof amount === 'number' ? amount : parseFloat(amount);
        if (String(type).toLowerCase() === "thu") {
          monthlyBalances[key] += amount;
        } else if (String(type).toLowerCase() === "chi") {
          monthlyBalances[key] -= amount;
        }
      } catch (error) {
        console.error("Error processing row:", error, row);
      }
    });
    
    const sortedMonths = Object.keys(monthlyBalances).sort((a, b) => {
      const [monthA, yearA] = a.split("/").map(Number);
      const [monthB, yearB] = b.split("/").map(Number);
      return new Date(yearA, monthA - 1) - new Date(yearB, monthB - 1);
    });

    let reportLines = [];
    sortedMonths.forEach(key => {
      reportLines.push(`Tháng ${key}: cân đối chi tiêu ${formatCurrency(monthlyBalances[key])}`);
    });
    
    const overallBalance = sortedMonths.reduce((acc, key) => acc + monthlyBalances[key], 0);
    reportLines.push(`Tổng cân đối chi tiêu hiện tại: ${formatCurrency(overallBalance)}`);
    
    sendMessage(chatId, reportLines.join("\n"));
    return;
  }
  
  // Các trường hợp báo cáo theo ngày, tuần, tháng - giữ nguyên logic cũ
  const now = parseDate(filter, dateParam);
  const filteredData = allData.filter(([date]) => {
    const dateObj = date instanceof Date ? date : new Date(date);
    return isValidDate(dateObj, filter, now);
  });

  if (sortOrder) {
    filteredData.sort((a, b) => {
      const amountA = a[2];
      const amountB = b[2];
      return sortOrder === "az" ? amountA - amountB : amountB - amountA;
    });
  }

  const { incomeTransactions, expenseTransactions, income, expense } = processTransactions(filteredData);

  if (!filteredData.length) {
    sendMessage(chatId, `Không có giao dịch cho ${getRangeDescription(filter)}.`);
    return;
  }

  const dateInfo = getDateInfo(filter, now);
  const report = generateReportText(filter, dateInfo, income, expense, incomeTransactions, expenseTransactions);
  sendMessage(chatId, report);
}

function processTransactions(filteredData) {
  const incomeTransactions = [];
  const expenseTransactions = [];
  let [income, expense] = [0, 0];

  filteredData.forEach(row => {
    try {
      let [date, type, amount, desc, paymentMethod] = row;
      
      // Chuẩn hóa dữ liệu
      type = String(type).toLowerCase().trim();
      amount = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/[^\d.-]/g, ''));
      desc = String(desc || "").trim();
      paymentMethod = String(paymentMethod || "Không xác định").trim();

      // Kiểm tra tính hợp lệ của dữ liệu
      if (!amount || isNaN(amount)) return;
      if (!["thu", "chi"].includes(type)) return;

      const formattedReportDate = new Date(date).toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour12: false,
      });

      const transaction = `${formatCurrency(amount)}: ${desc || "Không có mô tả"} (${paymentMethod}) (${formattedReportDate})`;
      
      const isCredit = paymentMethod.toLowerCase().includes("credit");
      const isPayment = desc.toLowerCase().includes("thanh toán sao kê");

      if (type === "thu") {
        income += amount;
        incomeTransactions.push(`+ ${transaction}`);
      } else if (type === "chi") {
        if (!isCredit || isPayment) {
          expense += amount;
        }
        expenseTransactions.push(`- ${transaction}`);
      }
    } catch (error) {
      console.error("Lỗi xử lý giao dịch:", error, row);
    }
  });

  return { incomeTransactions, expenseTransactions, income, expense };
}

// Thêm hàm mới để kiểm tra cấu trúc header của sheet
function isValidSheetHeader(header) {
  const requiredColumns = ["Thời gian", "Loại", "Số tiền", "Mô tả"];
  return requiredColumns.every(col => 
    header.some(h => String(h).toLowerCase().includes(col.toLowerCase()))
  );
}

function getRangeDescription(filter) {
  if (filter === "week") return "tuần";
  if (filter === "month") return "tháng";
  if (filter === "today") return "ngày hôm nay";
  return "tổng";
}

function getDateInfo(filter, now) {
  if (filter === "week") {
    return ` (tuần từ ${now.startOfWeek.toLocaleDateString("vi-VN")} đến ${now.endOfWeek.toLocaleDateString("vi-VN")})`;
  }
  if (filter === "today") {
    return ` (${new Date().toLocaleDateString("vi-VN")})`;
  }
  return "";
}

function generateReportText(filter, dateInfo, income, expense, incomeTransactions, expenseTransactions) {
  return [
    `Báo cáo ${filter === "all" ? "tổng" : filter}${dateInfo}:`,
    `Tổng thu: ${formatCurrency(income)}`,
    `Tổng chi: ${formatCurrency(expense)}`,
    `Cân đối: ${formatCurrency(income - expense)}`,
    "",
    "Giao dịch thu nhập cụ thể:",
    incomeTransactions.length ? incomeTransactions.join("\n") : "Không có giao dịch thu nhập.",
    "",
    "Giao dịch chi tiêu cụ thể:",
    expenseTransactions.length ? expenseTransactions.join("\n") : "Không có giao dịch chi tiêu.",
  ].join("\n");
}

function isValidDate(date, filter, now) {
  if (filter === "today") {
    return date.toDateString() === new Date().toDateString();
  }
  if (filter === "month") {
    return (
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  }
  if (filter === "week") {
    const { startOfWeek, endOfWeek } = now;
    return date >= startOfWeek && date <= endOfWeek;
  }
  return true;
}

// Hàm mới để kiểm tra phương thức thanh toán hợp lệ
function isValidPaymentMethod(method) {
  const validMethods = ["tienmat", "qrbank", "momo", "credit"];
  return validMethods.includes(method.toLowerCase());
}

// Hàm mới để chuẩn hóa phương thức thanh toán
function normalizePaymentMethod(method) {
  const methodMap = {
    "tienmat": "Tiền mặt",
    "qrbank": "QR Bank",
    "momo": "Momo",
    "credit": "Credit"
  };
  return methodMap[method.toLowerCase()] || method;
}

// Các hàm phụ trợ khác giữ nguyên
function parseDate(filter, dateParam) {
  if (!dateParam) return new Date();
  const parts = dateParam.split("/");
  if (filter === "month" && parts.length === 2) {
    return new Date(parts[1], parts[0] - 1);
  }
  if (filter === "week" && parts.length === 3) {
    const date = new Date(parts[2], parts[1] - 1, parts[0]);
    const dayOfWeek = date.getDay() || 7;
    date.startOfWeek = new Date(date);
    date.startOfWeek.setDate(date.getDate() - dayOfWeek + 1);
    date.endOfWeek = new Date(date.startOfWeek);
    date.endOfWeek.setDate(date.startOfWeek.getDate() + 6);
    return date;
  }
  return new Date();
}

function resetSheet(chatId) {
  const sheet = getOrCreateMonthlySheet();
  sheet.clear();
  sheet.appendRow(["Thời gian", "Loại", "Số tiền", "Mô tả", "Phương thức thanh toán"]);
  sendMessage(chatId, "Đã xóa toàn bộ dữ liệu.");
}

function undoLast(chatId) {
  const sheet = getOrCreateMonthlySheet();
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRow(lastRow);
    sendMessage(chatId, "Đã xóa giao dịch gần nhất.");
  } else {
    sendMessage(chatId, "Không có giao dịch nào để xóa.");
  }
}

function isValidAmount(amount) {
  // Enhanced amount validation
  if (!amount || typeof amount !== 'string') return false;
  
  // Check format
  if (!/^[1-9][0-9]*(k|tr)?$/.test(amount)) return false;
  
  // Parse and validate amount
  const parsedAmount = parseAmount(amount);
  return parsedAmount > 0 && parsedAmount <= 1000000000; // Max 1 billion VND
}

function parseAmount(amount) {
  try {
    const cleanAmount = amount.toLowerCase().trim();
    if (cleanAmount.endsWith('tr')) {
      return parseFloat(cleanAmount.replace('tr', '')) * 1000000;
    } else if (cleanAmount.endsWith('k')) {
      return parseFloat(cleanAmount.replace('k', '')) * 1000;
    }
    return parseFloat(amount);
  } catch (error) {
    console.error("Error parsing amount:", error);
    return 0;
  }
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
}

function sendMessage(chatId, text) {
  const MAX_MESSAGE_LENGTH = 4096;
  if (text.length <= MAX_MESSAGE_LENGTH) {
    UrlFetchApp.fetch(`${API_URL}/sendMessage`, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ chat_id: chatId, text }),
    });
  } else {
    const parts = splitMessage(text, MAX_MESSAGE_LENGTH);
    parts.forEach(part => {
      UrlFetchApp.fetch(`${API_URL}/sendMessage`, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({ chat_id: chatId, text: part }),
      });
    });
  }
}

function splitMessage(text, maxLength) {
  const parts = [];
  while (text.length > maxLength) {
    let part = text.slice(0, maxLength);
    const lastNewLineIndex = part.lastIndexOf('\n');
    if (lastNewLineIndex > -1) {
      part = text.slice(0, lastNewLineIndex + 1);
    }
    parts.push(part);
    text = text.slice(part.length);
  }
  parts.push(text);
  return parts;
}


```

 ### 2.4 Thay thế:
   - `YOUR_TELEGRAM_BOT_TOKEN` bằng token bot Telegram.
   - `YOUR_SHEET_ID` bằng ID Google Sheets.
   - `ADMIN_IDS` là các id tài khoản telegram mà bạn muốn làm admin.

 ### 2.5 Triển khai (Sau khi dán mã code và thay thế các giá trị)
 
 **Deploy** → **New deployment** → **Web app**

 Hoặc
 
  **Triển khai** -> **Tuỳ chọn triển khai mới** 
   - **Chọn loại**: Ứng dụng web
   - **Thực thi bằng tên**: Tôi  
   - **Người có quyền truy cập**: Bất kỳ ai
   -  Sau đó nhấn triển khai và cấp quyền  
 #### Lấy **Web App URL** sau khi triển khai(copy cả đoạn link nhé).

### 2.6 Cấu Hình Webhook**

Truy cập URL sau để kết nối webhook:

```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=<WEB_APP_URL>
```

**Ví dụ:**  
```
https://api.telegram.org/bot123456789:ABCdefGhIJKlmNoPQRstuVWxyZ/setWebhook?url=https://script.google.com/macros/s/AKfycbxEXAMPLE/exec
```

---

---

## 3. Sử dụng

### 3.1. Bắt đầu sử dụng bot
Gửi lệnh `/start` để nhận hướng dẫn cơ bản.

### 3.2. Thêm giao dịch
Nhập giao dịch theo cú pháp:
```
<số tiền> <thu/chi> <mô tả>
```

### 3.3. Xem báo cáo
- **Báo cáo tổng:** `/report`
- **Báo cáo tháng:** `/report 01/2025`
- **Báo cáo tuần:** `/report 04/01/2025`
- **Sắp xếp tăng/giảm:** Thêm `az` (tăng) hoặc `za` (giảm).
  - Ví dụ: `/report az`, `/report 01/2025 za`.

  
#### Ví dụ chi tiết:
1. Xem toàn bộ giao dịch, sắp xếp tăng dần: `/report az`
2. Báo cáo chi tiêu tháng 1 năm 2025: `/report 01/2025`
3. Báo cáo tuần chứa ngày 04/01/2025: `/report 04/01/2025 za`.

### 3.4. Xóa giao dịch
- **Xóa giao dịch gần nhất:** Gửi lệnh `/undo`.
- **Xóa toàn bộ dữ liệu:** Gửi lệnh `/reset`.

---

## 4. Ví dụ cụ thể

### Thêm giao dịch
- Thu nhập: `13058k thu Tiền thưởng cuối năm`
- Chi tiêu: `69k chi mua dầu ăn`

### Báo cáo chi tiết
1. Báo cáo tổng, sắp xếp theo thứ tự giảm dần:
   ```
   /report za
   ```
   Kết quả:
   ```
   Báo cáo tổng:
   Tổng thu: 1,000,000 VND
   Tổng chi: 300,000 VND
   Cân đối: 700,000 VND

   Giao dịch thu nhập cụ thể:
   + 1,000,000 VND: Tiền thưởng cuối năm (01/01/2025 10:00)

   Giao dịch chi tiêu cụ thể:
   - 300,000 VND: Mua thực phẩm (01/01/2025 14:00)
   ```

2. Báo cáo tháng 1/2025:
   ```
   /report 01/2025
   ```

---

## 5. Lưu ý

*Quy ước: 1k = 1000VND, 1tr = 1000000VND*

*Không nhập 5tr2 hoặc lẻ, nếu lẻ thì nhập 5215k*

*Google Sheets không được xóa hoặc thay đổi ID.*
 
*Tài khoản Gmail cần cấp quyền cho Google Sheets khi cài Webhook.*
 
*Đảm bảo bot Telegram đã được kết nối đúng Webhook.*
- **Webhook không hoạt động:** Kiểm tra lại TOKEN và URL, Lúc nhấn triển khai đã cấp quyền chưa.
- **Không lưu dữ liệu:** Kiểm tra Sheet ID và quyền truy cập.

***Đóng góp ý tưởng hoặc cần tư vấn liên hệ: t.me/kou_kitamura***

---
