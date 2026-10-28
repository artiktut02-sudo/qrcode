// Инициализация IndexedDB
let db;
const request = indexedDB.open("PDF_QR_DB", 1);

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
fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (file.type !== "application/pdf") {
    alert("Пожалуйста, выберите файл в формате PDF");
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const arrayBuffer = event.target.result;
    const blob = new Blob([arrayBuffer], { type: "application/pdf" });
    const id = Date.now().toString();
    
    // Сохраняем в IndexedDB
    const transaction = db.transaction(["files"], "readwrite");
    const store = transaction.objectStore("files");
    store.put({ id: id, name: file.name, data: blob });

    transaction.oncomplete = () => {
      fileInput.value = ""; // Очищаем input
      loadDocuments();
    };
  };
  reader.readAsArrayBuffer(file);
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
  event.stopPropagation(); // Чтобы не открывался QR
  if (!confirm("Удалить этот документ?")) return;

  const transaction = db.transaction(["files"], "readwrite");
  const store = transaction.objectStore("files");
  store.delete(id);

  transaction.oncomplete = () => loadDocuments();
};

// Показ QR-кода
function showQR(file) {
  // 1. Создаем временную ссылку на файл
  const url = URL.createObjectURL(file.data);
  
  // 2. Очищаем контейнер и генерируем QR
  qrContainer.innerHTML = "";
  new QRCode(qrContainer, {
    text: url,
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

// Скачивание QR-кода как картинки
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
