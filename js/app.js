// Инициализация IndexedDB (храним ссылки)
let db;
const request = indexedDB.open("Files_QR_DB", 2);

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

// ТВОИ ДАННЫЕ ИЗ CLOUDINARY
const CLOUD_NAME = "y4wl5det";
const UPLOAD_PRESET = "qrcodik";

// Нажатие на зону загрузки
uploadZone.addEventListener("click", () => fileInput.click());

// Обработка выбранного файла (ЛЮБОГО)
fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // Ограничение по размеру (до 10 МБ, чтобы бесплатный тариф не выдал ошибку)
  if (file.size > 10 * 1024 * 1024) {
    alert("Файл слишком большой! Максимум 10 МБ.");
    fileInput.value = "";
    return;
  }

  // Показываем индикатор загрузки
  uploadZone.innerHTML = `<div class="upload-icon">⏳</div><div class="upload-text">Загрузка в Cloudinary...</div>`;

  try {
    // Формируем данные для отправки
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);

    // Отправляем файл напрямую в Cloudinary
    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Ошибка сервера: ${response.status}`);
    }

    const result = await response.json();
    
    // Cloudinary возвращает прямую ссылку в поле secure_url
    const downloadUrl = result.secure_url;
    
    if (!downloadUrl) {
      throw new Error("Сервер не вернул ссылку на файл");
    }

    const id = Date.now().toString();
    
    // Сохраняем ссылку и имя файла в IndexedDB
    const transaction = db.transaction(["files"], "readwrite");
    const store = transaction.objectStore("files");
    store.put({ id: id, name: file.name, url: downloadUrl });

    transaction.oncomplete = () => {
      fileInput.value = "";
      // Возвращаем зону загрузки обратно
      uploadZone.innerHTML = `<div class="upload-icon">📤</div><div class="upload-text">Нажмите, чтобы выбрать файл</div>`;
      loadDocuments();
      alert("✅ Файл загружен! QR-код готов.");
    };

  } catch (error) {
    console.error("Ошибка загрузки:", error);
    alert("❌ Не удалось загрузить файл.\n\nПроверьте интернет или попробуйте файл поменьше.");
    
    // Возвращаем зону загрузки обратно
    uploadZone.innerHTML = `<div class="upload-icon">📤</div><div class="upload-text">Нажмите, чтобы выбрать файл</div>`;
  }
});

// Загрузка и отрисовка списка файлов
function loadDocuments() {
  const transaction = db.transaction(["files"], "readonly");
  const store = transaction.objectStore("files");
  const request = store.getAll();

  request.onsuccess = (e) => {
    const files = e.target.result;
    docsList.innerHTML = "";

    if (files.length === 0) {
      docsList.innerHTML = `<p style="color: #888; grid-column: 1/-1; text-align: center;">Пока нет файлов. Загрузите первый!</p>`;
      return;
    }

    files.forEach(file => {
      const card = document.createElement("div");
      card.className = "doc-card";
      
      // Определяем иконку по расширению
      let icon = "📄";
      if (file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) icon = "🖼️";
      else if (file.name.match(/\.(doc|docx)$/i)) icon = "📝";
      else if (file.name.match(/\.(xls|xlsx)$/i)) icon = "📊";
      else if (file.name.match(/\.(zip|rar|7z)$/i)) icon = "🗜️";
      else if (file.name.match(/\.(pdf)$/i)) icon = "📕";
      
      card.innerHTML = `
        <button class="delete-btn" onclick="deleteDoc('${file.id}', event)">✕</button>
        <div class="doc-icon">${icon}</div>
        <div class="doc-name">${file.name}</div>
      `;
      card.addEventListener("click", () => showQR(file));
      docsList.appendChild(card);
    });
  };
}

// Удаление документа (только из списка, в Cloudinary он останется)
window.deleteDoc = (id, event) => {
  event.stopPropagation();
  if (!confirm("Удалить этот файл из списка?")) return;

  const transaction = db.transaction(["files"], "readwrite");
  const store = transaction.objectStore("files");
  store.delete(id);

  transaction.oncomplete = () => loadDocuments();
};

// Показ QR-кода
function showQR(file) {
  qrContainer.innerHTML = "";
  new QRCode(qrContainer, {
    text: file.url,
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
  link.download = "QR_файл.png";
  link.click();
};
