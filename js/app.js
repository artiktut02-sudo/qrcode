// Инициализация IndexedDB (теперь храним ССЫЛКИ, а не файлы)
let db;
const request = indexedDB.open("PDF_QR_DB", 2); // Версия 2, так как структура изменилась

request.onupgradeneeded = (e) => {
  db = e.target.result;
  if (!db.objectStoreNames.contains("files")) {
    db.createObjectStore("files", { keyPath: "id" });
  }
};

request.onsuccess = (e) => {
  db = e.target.result;
  loadDocuments();
};

request.onerror = (e) => {
  console.error("Ошибка БД", e);
  alert("Ошибка при инициализации хранилища");
};

// Элементы DOM
const fileInput = document.getElementById("file-input");
const uploadZone = document.getElementById("upload-zone");
const docsList = document.getElementById("documents-list");
const qrModal = document.getElementById("qr-modal");
const modalTitle = document.getElementById("modal-title");
const qrContainer = document.getElementById("qrcode");

// Нажатие на зону загрузки
uploadZone.addEventListener("click", () => fileInput.click());

// Обработка выбранного файла
fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (file.type !== "application/pdf") {
    alert("Пожалуйста, выберите файл в формате PDF");
    return;
  }

  // Показываем индикатор загрузки
  uploadZone.innerHTML = `<div class="upload-icon">⏳</div><div class="upload-text">Загрузка на сервер...</div>`;

  try {
    // Отправляем файл на tmpfile.link
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('https://tmpfile.link/api/upload', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Ошибка сервера: ${response.status}`);
    }

    const result = await response.json();
    
    // В ответе должна быть ссылка downloadLink
    const downloadUrl = result.downloadLink;
    
    if (!downloadUrl) {
      throw new Error("Сервер не вернул ссылку на файл");
    }

    const id = Date.now().toString();
    
    // Сохраняем ССЫЛКУ в IndexedDB
    const transaction = db.transaction(["files"], "readwrite");
    const store = transaction.objectStore("files");
    store.put({ id: id, name: file.name, url: downloadUrl });

    transaction.oncomplete = () => {
      fileInput.value = "";
      // Возвращаем зону загрузки обратно
      uploadZone.innerHTML = `<div class="upload-icon">📤</div><div class="upload-text">Нажмите, чтобы загрузить PDF</div>`;
      loadDocuments();
      alert("✅ Документ загружен! Теперь QR-код будет работать у всех.");
    };

  } catch (error) {
    console.error("Ошибка загрузки:", error);
    alert("❌ Не удалось загрузить файл. Возможно, сервис временно недоступен или блокирует браузер.\n\nПопробуйте позже или используйте другой способ.");
    // Возвращаем зону загрузки обратно
    uploadZone.innerHTML = `<div class="upload-icon">📤</div><div class="upload-text">Нажмите, чтобы загрузить PDF</div>`;
  }
});

// Загрузка и отрисовка списка документов
function loadDocuments() {
  const transaction = db.transaction(["files"], "readonly");
  const store = transaction.objectStore("files");
  const request = store.getAll();

  request.onsuccess = (e) => {
    const files = e.target.result;
    docsList.innerHTML = "";

    if (files.length === 0) {
      docsList.innerHTML = `<p style="color: #888; grid-column: 1/-1; text-align: center;">Пока нет документов. Загрузите первый PDF!</p>`;
      return;
    }

    files.forEach(file => {
      const card = document.createElement("div");
      card.className = "doc-card";
      card.innerHTML = `
        <button class="delete-btn" onclick="deleteDoc('${file.id}', event)">✕</button>
        <div class="doc-icon">📄</div>
        <div class="doc-name">${file.name}</div>
      `;
      card.addEventListener("click", () => showQR(file));
      docsList.appendChild(card);
    });
  };
}

// Удаление документа
window.deleteDoc = (id, event) => {
  event.stopPropagation();
  if (!confirm("Удалить этот документ из списка?")) return;

  const transaction = db.transaction(["files"], "readwrite");
  const store = transaction.objectStore("files");
  store.delete(id);

  transaction.oncomplete = () => loadDocuments();
};

// Показ QR-кода (используем сохранённую ссылку)
function showQR(file) {
  qrContainer.innerHTML = "";
  new QRCode(qrContainer, {
    text: file.url, // Берем ссылку из базы
    width: 200,
    height: 200,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });

  modalTitle.textContent = file.name;
  qrModal.classList.remove("hidden");
}

// Закрытие модалки
window.closeModal = () => {
  qrModal.classList.add("hidden");
  qrContainer.innerHTML = "";
};

// Скачивание QR-кода
window.downloadQR = () => {
  const canvas = qrContainer.querySelector("canvas");
  const img = qrContainer.querySelector("img");
  
  const link = document.createElement("a");
  if (canvas) {
    link.href = canvas.toDataURL("image/png");
  } else if (img) {
    link.href = img.src;
  } else {
    return;
  }
  link.download = "QR_документ.png";
  link.click();
};
