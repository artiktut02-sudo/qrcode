// Инициализация IndexedDB
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

const fileInput = document.getElementById("file-input");
const uploadZone = document.getElementById("upload-zone");
const docsList = document.getElementById("documents-list");
const qrModal = document.getElementById("qr-modal");
const modalTitle = document.getElementById("modal-title");
const qrContainer = document.getElementById("qrcode");

// ТВОИ ДАННЫЕ ИЗ CLOUDINARY (без API Key)
const CLOUD_NAME = "y4wl5det";
const UPLOAD_PRESET = "qrcodik";

uploadZone.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // Лимит 10 МБ (на бесплатном тарифе Cloudinary)
  if (file.size > 10 * 1024 * 1024) {
    alert("Файл слишком большой! Максимум 10 МБ.\n\nВаш файл: " + (file.size / (1024 * 1024)).toFixed(1) + " МБ");
    fileInput.value = "";
    return;
  }

  uploadZone.innerHTML = `<div class="upload-icon">⏳</div><div class="upload-text">Загрузка в Cloudinary...</div>`;

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    // Строка с api_key УДАЛЕНА

    // Используем auto/upload для любых файлов
    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error?.message || `Ошибка сервера: ${response.status}`);
    }

    const downloadUrl = result.secure_url;
    const id = Date.now().toString();
    
    const transaction = db.transaction(["files"], "readwrite");
    const store = transaction.objectStore("files");
    store.put({ id: id, name: file.name, url: downloadUrl });

    transaction.oncomplete = () => {
      fileInput.value = "";
      uploadZone.innerHTML = `<div class="upload-icon">📤</div><div class="upload-text">Нажмите, чтобы выбрать файл</div>`;
      loadDocuments();
      alert("✅ Файл загружен! QR-код готов.");
    };

  } catch (error) {
    console.error("Ошибка:", error);
    alert("❌ Не удалось загрузить файл.\n\nПричина: " + error.message);
    uploadZone.innerHTML = `<div class="upload-icon">📤</div><div class="upload-text">Нажмите, чтобы выбрать файл</div>`;
  }
});

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

window.deleteDoc = (id, event) => {
  event.stopPropagation();
  if (!confirm("Удалить этот файл из списка?")) return;

  const transaction = db.transaction(["files"], "readwrite");
  const store = transaction.objectStore("files");
  store.delete(id);

  transaction.oncomplete = () => loadDocuments();
};

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

window.closeModal = () => {
  qrModal.classList.add("hidden");
  qrContainer.innerHTML = "";
};

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
