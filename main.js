//Copyright (c) 2024 nguyenngocphung2000 and modified by htcminh

const TOKEN = "BOT_TELEGRAM_TOKEN";
const API_URL = `https://api.telegram.org/bot${TOKEN}`;
const SHEET_ID = "SHEET_ID";

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
    `   Phương thức thanh toán: tienmat, qrbank, momo, credit\n` +
    `   Ví dụ: 10tr thu qrbank lương\n` +
    `           2tr chi credit mua quần áo
                3k  chi tienmat trà đá
                40k chi momo ăn trưa\n\n`+ 
    `2. Xem báo cáo:\n` +
    `   - /report: Báo cáo tổng.\n` +
    `   - /report today: Báo cáo ngày hôm nay.\n` +
    `   - /report mm/yyyy: Báo cáo tháng.\n` +
    `   - /report dd/mm/yyyy: Báo cáo tuần.\n` +
    `   - Thêm "az" hoặc "za" sau lệnh để sắp xếp thứ tự giao dịch theo số tiền lớn dần hoặc bé dần.\n\n` +
    `3. Các lệnh khác:\n` +
    `   - /help: Hiển thị hướng dẫn sử dụng\n` +
    `   - /undo: Hủy giao dịch gần nhất\n` +
    `   - /reset: Xóa toàn bộ dữ liệu\n\n` +
    `Lưu ý:\n` +
    `Bot chỉ nhận diện số tiền có đơn vị là nghìn hoặc triệu. Ví dụ: 1k = 1000 vnđ, 1tr = 1.000.000 vnđ.\n` +
    `Vui lòng làm tròn số tiền đến hàng nghìn. Ví dụ: 1999 vnđ = 2000 vnđ\n` +
    `Nếu như bạn có giao dịch 2 triệu và số lẻ đằng sau, vui lòng điền theo dạng 2xxxk. Ví dụ: 2 triệu 500 = 2500k\n` +
    `Để tránh lỗi, hãy nhập mô tả giao dịch không chứa ký tự đặc biệt.\n` +
    `Đối với các giao dịch bằng Credit, số tiền đó sẽ chưa được tính vào chi tiêu của tháng, nhưng vẫn sẽ có thông tin trong bảng.\nChỉ đến khi bạn có giao dịch "thanh toán sao kê" thì khi ấy số tiền mới được tính vào tổng chi.\nĐiều này sẽ giúp bạn tránh bị tính trùng chi phí khi dùng thẻ tín dụng!\n\n`
  );
}

function handleTransaction(chatId, text) {
  const parts = text.split(" ");
  if (parts.length < 4) { // Cần ít nhất: số tiền, loại, phương thức, mô tả
    sendMessage(chatId, "Lỗi: Nhập đúng cú pháp <số tiền> <thu/chi> <phương thức> <mô tả>.");
    return;
  }

  const amount = parts[0];
  const type = parts[1].toLowerCase();
  const paymentMethod = parts[2].toLowerCase();
  const desc = parts.slice(3).join(" ");

  if (!isValidAmount(amount) || !["thu", "chi"].includes(type)) {
    sendMessage(chatId, "Lỗi: Số tiền hoặc loại giao dịch không hợp lệ.");
    return;
  }

  if (!isValidPaymentMethod(paymentMethod)) {
    sendMessage(chatId, "Lỗi: Phương thức thanh toán phải là: tienmat, qrbank, momo, hoặc credit");
    return;
  }

  // Chuẩn hóa phương thức thanh toán
  const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);

  const sheet = getOrCreateMonthlySheet();
  sheet.appendRow([
    new Date(),
    type,
    parseAmount(amount),
    desc,
    normalizedPaymentMethod
  ]);

  sendMessage(
    chatId, 
    `Đã thêm giao dịch:\nSố tiền: ${amount}\nLoại: ${type}\nPhương thức: ${normalizedPaymentMethod}\nMô tả: ${desc}`
  );
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

  const now = parseDate(filter, dateParam);
  const filteredData = allData.filter(([date]) => {
    // Chuyển đổi date string thành Date object nếu cần
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
  return /^[0-9]+(k|tr)?$/.test(amount);
}

function parseAmount(amount) {
  return parseFloat(amount.replace("tr", "000000").replace("k", "000")) || 0;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
}

function sendMessage(chatId, text) {
  UrlFetchApp.fetch(`${API_URL}/sendMessage`, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ chat_id: chatId, text }),
  });
}
