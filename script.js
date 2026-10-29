(() => {
  "use strict";

  /* ==========================================
     DEARDAYS — CONFIGURATION
     ========================================== */

  const KEYS = {
    entries: "deardays_entries_v1",
    theme: "deardays_theme_v1",
    photos: "deardays_photo_memories_v1",
    settings: "deardays_custom_settings_v1"
  };

  const DB_NAME = "DearDaysMusicDB";
  const DB_VERSION = 2;
  const MUSIC_STORE = "tracks";
  const MEDIA_STORE = "media";

  const $ = (id) => document.getElementById(id);

  let entries = loadArray(KEYS.entries);
  let photos = loadArray(KEYS.photos);
  let selectedDateFilter = "";
  let calendarMonth = new Date();
  let toastTimer = null;

  let currentMusicURL = null;
  let mediaObjectURLs = new Map();

  let recorder = null;
  let recorderStream = null;
  let recorderChunks = [];

  /* ==========================================
     GENERAL HELPERS
     ========================================== */

  function today() {
    const date = new Date();

    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function currentTime() {
    const date = new Date();

    return [
      String(date.getHours()).padStart(2, "0"),
      String(date.getMinutes()).padStart(2, "0")
    ].join(":");
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function loadArray(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("Could not load local data:", key, error);
      return [];
    }
  }

  function saveData(key, data, notify = true) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error("Could not save data:", key, error);

      if (notify) {
        showToast(
          "Browser storage full ho sakti hai. Kuch purana data remove karo."
        );
      }

      return false;
    }
  }

  function showToast(message) {
    const toast = $("toast");

    if (!toast) {
      window.alert(message);
      return;
    }

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2800);
  }

  function textElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    element.textContent = String(text ?? "");
    return element;
  }

  function formatDate(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return "Date not set";
    }

    const [year, month, day] = value.split("-").map(Number);

    return new Date(year, month - 1, day).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function formatMonth(date) {
    return date.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric"
    });
  }

  function localDateFromParts(year, month, day) {
    return [
      year,
      String(month).padStart(2, "0"),
      String(day).padStart(2, "0")
    ].join("-");
  }

  /* ==========================================
     PART 1 — SEPARATE PAGE NAVIGATION
     ========================================== */

  const routeMap = {
    "#home": "home",
    "#top": "home",
    "#write": "diary",
    "#calendar": "calendar",
    "#memories": "memories",
    "#music": "music",
    "#about": "about"
  };

  function getPageFromHash(hash) {
    return routeMap[hash] || "home";
  }

  function showPage(page) {
    document.querySelectorAll(".route-page").forEach((section) => {
      section.classList.toggle("active", section.dataset.page === page);
    });

    document.querySelectorAll("[data-route]").forEach((link) => {
      const isActive = link.dataset.route === page;

      link.classList.toggle("active", isActive);

      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function navigateToPage(hash, preferredPage = "") {
    const page = preferredPage || getPageFromHash(hash);

    if (window.location.hash !== hash) {
      window.location.hash = hash;
    }

    showPage(page);

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]');

    if (!link) return;

    const hash = link.getAttribute("href");

    if (!Object.prototype.hasOwnProperty.call(routeMap, hash)) {
      return;
    }

    event.preventDefault();

    navigateToPage(hash, link.dataset.route || "");
  });

  window.addEventListener("hashchange", () => {
    showPage(getPageFromHash(window.location.hash));

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  });

  /* ==========================================
     PART 2 — THEMES AND CUSTOMIZATION
     ========================================== */

  const themeToggle = $("themeToggle");
  const themePreset = $("themePreset");
  const fontChoice = $("fontChoice");
  const backgroundChoice = $("backgroundChoice");

  function readSettings() {
    try {
      const settings = JSON.parse(
        localStorage.getItem(KEYS.settings) || "{}"
      );

      return settings && typeof settings === "object" ? settings : {};
    } catch (error) {
      return {};
    }
  }

  function applySettings(settings) {
    const allowedThemes = ["classic", "blush", "sage", "lavender"];
    const allowedFonts = ["classic", "hand", "clean"];
    const allowedBackgrounds = ["paper", "grid", "plain"];

    const theme = allowedThemes.includes(settings.theme)
      ? settings.theme
      : "classic";

    const font = allowedFonts.includes(settings.font)
      ? settings.font
      : "classic";

    const background = allowedBackgrounds.includes(settings.background)
      ? settings.background
      : "paper";

    document.body.classList.remove(
      "theme-blush",
      "theme-sage",
      "theme-lavender",
      "font-hand",
      "font-clean",
      "bg-grid",
      "bg-plain"
    );

    if (theme !== "classic") {
      document.body.classList.add(`theme-${theme}`);
    }

    if (font !== "classic") {
      document.body.classList.add(`font-${font}`);
    }

    if (background !== "paper") {
      document.body.classList.add(`bg-${background}`);
    }

    if (themePreset) themePreset.value = theme;
    if (fontChoice) fontChoice.value = font;
    if (backgroundChoice) backgroundChoice.value = background;
  }

  function saveSettings() {
    const settings = {
      theme: themePreset?.value || "classic",
      font: fontChoice?.value || "classic",
      background: backgroundChoice?.value || "paper"
    };

    try {
      localStorage.setItem(KEYS.settings, JSON.stringify(settings));
    } catch (error) {
      showToast("Settings abhi ke session ke liye apply hongi.");
    }
  }

  applySettings(readSettings());

  let savedDarkMode = "light";

  try {
    savedDarkMode = localStorage.getItem(KEYS.theme) || "light";
  } catch (error) {
    // Dark mode can still work for the current visit.
  }

  function applyDarkMode(dark) {
    document.body.classList.toggle("dark", dark);

    if (themeToggle) {
      themeToggle.textContent = dark ? "☀" : "☾";
      themeToggle.setAttribute(
        "aria-label",
        dark ? "Switch to light theme" : "Switch to dark theme"
      );
    }
  }

  applyDarkMode(savedDarkMode === "dark");

  themeToggle?.addEventListener("click", () => {
    const dark = !document.body.classList.contains("dark");

    applyDarkMode(dark);

    try {
      localStorage.setItem(KEYS.theme, dark ? "dark" : "light");
    } catch (error) {
      showToast("Theme abhi ke session ke liye change hui hai.");
    }
  });

  [themePreset, fontChoice, backgroundChoice].forEach((control) => {
    control?.addEventListener("change", () => {
      saveSettings();
      applySettings(readSettings());
      showToast("Your diary style has been updated ♡");
    });
  });

  /* ==========================================
     PART 3 — DIARY ENTRIES
     ========================================== */

  const entryForm = $("entryForm");
  const entryId = $("entryId");
  const titleInput = $("entryTitle");
  const dateInput = $("entryDate");
  const timeInput = $("entryTime");
  const moodInput = $("entryMood");
  const textInput = $("entryText");

  const entriesList = $("entriesList");
  const emptyState = $("emptyState");
  const searchInput = $("searchInput");
  const moodFilter = $("moodFilter");
  const favoritesOnly = $("favoritesOnly");
  const cancelEdit = $("cancelEdit");
  const formHeading = $("formHeading");
  const saveButton = $("saveButton");

  if (dateInput) dateInput.value = today();
  if (timeInput) timeInput.value = currentTime();

  function updateStats() {
    const entryCount = $("entryCount");
    const favouriteCount = $("favouriteCount");
    const todayMood = $("todayMood");

    if (entryCount) {
      entryCount.textContent = String(entries.length);
    }

    if (favouriteCount) {
      favouriteCount.textContent = String(
        entries.filter((item) => item.favorite).length
      );
    }

    const todaysEntries = entries
      .filter((item) => item.date === today())
      .sort((a, b) =>
        String(b.time || "").localeCompare(String(a.time || ""))
      );

    if (todayMood) {
      todayMood.textContent = todaysEntries.length
        ? todaysEntries[0].mood || "Not set"
        : "Not yet";
    }
  }

  function resetEntryForm() {
    if (!entryForm) return;

    entryForm.reset();

    if (entryId) entryId.value = "";
    if (dateInput) dateInput.value = today();
    if (timeInput) timeInput.value = currentTime();

    if (formHeading) {
      formHeading.innerHTML = 'A page for today <span>✎</span>';
    }

    if (saveButton) {
      saveButton.textContent = "Save this page ♡";
    }

    cancelEdit?.classList.add("hidden");
  }

  function getVisibleEntries() {
    const query = (searchInput?.value || "").trim().toLowerCase();
    const mood = moodFilter?.value || "all";
    const favorites = Boolean(favoritesOnly?.checked);

    return entries
      .filter((entry) => {
        const searchable = [
          entry.title || "",
          entry.content || "",
          entry.mood || ""
        ].join(" ").toLowerCase();

        if (!searchable.includes(query)) return false;
        if (mood !== "all" && entry.mood !== mood) return false;
        if (favorites && !entry.favorite) return false;

        if (
          selectedDateFilter &&
          entry.date !== selectedDateFilter
        ) {
          return false;
        }

        return true;
      })
      .sort((a, b) =>
        String(b.date || "").localeCompare(String(a.date || "")) ||
        String(b.time || "").localeCompare(String(a.time || "")) ||
        String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))
      );
  }

  function renderEntries() {
    if (!entriesList || !emptyState || !searchInput) return;

    entriesList.replaceChildren();

    const visibleEntries = getVisibleEntries();

    visibleEntries.forEach((entry) => {
      const card = document.createElement("article");
      card.className = "entry-card";

      card.appendChild(
        textElement("div", "entry-date", formatDate(entry.date))
      );

      const heading = textElement(
        "h3",
        "",
        entry.title || "Untitled memory"
      );

      heading.appendChild(
        textElement("span", "entry-time", entry.time || "")
      );

      card.append(
        heading,
        textElement(
          "span",
          "entry-mood",
          entry.mood || "😊 Happy"
        ),
        textElement("p", "entry-content", entry.content || "")
      );

      const actions = textElement("div", "entry-actions", "");

      const edit = textElement("button", "small-action", "✎ Edit");
      edit.type = "button";
      edit.dataset.action = "edit";
      edit.dataset.id = entry.id;

      const remove = textElement("button", "small-action", "⌫ Delete");
      remove.type = "button";
      remove.dataset.action = "delete";
      remove.dataset.id = entry.id;

      const favourite = textElement(
        "button",
        `small-action fav${entry.favorite ? " is-fav" : ""}`,
        entry.favorite ? "♥" : "♡"
      );

      favourite.type = "button";
      favourite.dataset.action = "favorite";
      favourite.dataset.id = entry.id;
      favourite.title = entry.favorite
        ? "Remove from favourites"
        : "Add to favourites";
      favourite.setAttribute("aria-label", favourite.title);

      actions.append(edit, remove, favourite);
      card.appendChild(actions);
      entriesList.appendChild(card);
    });

    const hasResults = visibleEntries.length > 0;
    emptyState.classList.toggle("hidden", hasResults);

    const emptyHeading = emptyState.querySelector("h3");
    const emptyText = emptyState.querySelector("p");
    const emptyLink = emptyState.querySelector("a");

    if (!hasResults) {
      if (emptyHeading) {
        emptyHeading.textContent = entries.length
          ? "No memories found"
          : "Your story starts here";
      }

      if (emptyText) {
        emptyText.textContent = entries.length
          ? "Try changing your search, mood, favourites or calendar date."
          : "Write your first diary entry and watch your collection grow.";
      }

      if (emptyLink) {
        emptyLink.classList.toggle("hidden", entries.length > 0);
      }
    }

    updateStats();
    renderCalendar();
    renderMoodHistory();
  }

  if (
    entryForm && entryId && titleInput && dateInput &&
    timeInput && moodInput && textInput && entriesList &&
    emptyState && searchInput
  ) {
    entryForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const title = titleInput.value.trim();
      const content = textInput.value.trim();

      if (!title || !content || !dateInput.value || !timeInput.value) {
        showToast("Title, date, time aur thoughts bharo.");
        return;
      }

      const previousEntries = entries.map((item) => ({ ...item }));
      const now = new Date().toISOString();
      const editingId = entryId.value;

      if (editingId) {
        const index = entries.findIndex((item) => item.id === editingId);

        if (index < 0) {
          showToast("Entry nahi mili. Please dobara try karo.");
          resetEntryForm();
          return;
        }

        entries[index] = {
          ...entries[index],
          title,
          content,
          date: dateInput.value,
          time: timeInput.value,
          mood: moodInput.value,
          updatedAt: now
        };
      } else {
        entries.push({
          id: makeId(),
          title,
          content,
          date: dateInput.value,
          time: timeInput.value,
          mood: moodInput.value,
          favorite: false,
          createdAt: now,
          updatedAt: now
        });
      }

      if (saveData(KEYS.entries, entries)) {
        resetEntryForm();
        renderEntries();

        showToast(
          editingId ? "Diary entry updated ♡" : "Memory saved ♡"
        );
      } else {
        entries = previousEntries;
      }
    });

    entriesList.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;

      const entry = entries.find((item) => item.id === button.dataset.id);
      if (!entry) return;

      const action = button.dataset.action;

      if (action === "edit") {
        entryId.value = entry.id;
        titleInput.value = entry.title || "";
        dateInput.value = entry.date || today();
        timeInput.value = entry.time || currentTime();
        moodInput.value = entry.mood || "😊 Happy";
        textInput.value = entry.content || "";

        if (formHeading) {
          formHeading.innerHTML = 'Edit this memory <span>✎</span>';
        }

        if (saveButton) {
          saveButton.textContent = "Update this page ♡";
        }

        cancelEdit?.classList.remove("hidden");

        navigateToPage("#write", "diary");

        setTimeout(() => {
          $("write")?.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });

          titleInput.focus({ preventScroll: true });
        }, 60);

      } else if (action === "delete") {
        if (!confirm(`Delete "${entry.title}"? This cannot be undone.`)) {
          return;
        }

        const previous = entries.map((item) => ({ ...item }));

        entries = entries.filter((item) => item.id !== entry.id);

        if (!saveData(KEYS.entries, entries)) {
          entries = previous;
          return;
        }

        if (entryId.value === entry.id) {
          resetEntryForm();
        }

        renderEntries();
        showToast("Diary entry deleted.");

      } else if (action === "favorite") {
        const previous = entry.favorite;
        entry.favorite = !entry.favorite;

        if (!saveData(KEYS.entries, entries)) {
          entry.favorite = previous;
          return;
        }

        renderEntries();

        showToast(
          entry.favorite
            ? "Added to favourites ♥"
            : "Removed from favourites"
        );
      }
    });

    cancelEdit?.addEventListener("click", () => {
      resetEntryForm();
      showToast("Edit cancelled.");
    });

    searchInput.addEventListener("input", renderEntries);
    moodFilter?.addEventListener("change", renderEntries);
    favoritesOnly?.addEventListener("change", renderEntries);

    $("resetFilters")?.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      if (moodFilter) moodFilter.value = "all";
      if (favoritesOnly) favoritesOnly.checked = false;

      selectedDateFilter = "";

      renderEntries();
      showToast("Filters cleared.");
    });
  }

  /* ==========================================
     PART 4 — CALENDAR
     ========================================== */

  const calendarTitle = $("calendarTitle");
  const calendarDays = $("calendarDays");
  const calendarSelection = $("calendarSelection");

  function renderCalendar() {
    if (!calendarTitle || !calendarDays) return;

    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    calendarTitle.textContent = formatMonth(calendarMonth);
    calendarDays.replaceChildren();

    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    for (let index = 0; index < firstDay; index++) {
      const blank = document.createElement("button");

      blank.type = "button";
      blank.className = "calendar-day";
      blank.disabled = true;
      blank.setAttribute("aria-hidden", "true");

      calendarDays.appendChild(blank);
    }

    for (let day = 1; day <= totalDays; day++) {
      const dateString = localDateFromParts(year, month + 1, day);
      const dayEntries = entries.filter(
        (entry) => entry.date === dateString
      );

      const button = textElement("button", "calendar-day", day);
      button.type = "button";
      button.dataset.date = dateString;

      if (dayEntries.length) {
        button.classList.add("has-entries");
      }

      if (dateString === today()) {
        button.classList.add("today");
      }

      if (dateString === selectedDateFilter) {
        button.classList.add("selected");
      }

      button.setAttribute(
        "aria-label",
        `${formatDate(dateString)}${
          dayEntries.length
            ? `, ${dayEntries.length} diary entries`
            : ""
        }`
      );

      button.addEventListener("click", () => {
        selectedDateFilter = dateString;

        if (calendarSelection) {
          calendarSelection.textContent =
            `Showing: ${formatDate(dateString)}`;
        }

        renderCalendar();
        renderEntries();
      });

      calendarDays.appendChild(button);
    }

    if (calendarSelection) {
      calendarSelection.textContent = selectedDateFilter
        ? `Showing: ${formatDate(selectedDateFilter)}`
        : "Showing all dates";
    }
  }

  $("prevMonth")?.addEventListener("click", () => {
    calendarMonth = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth() - 1,
      1
    );

    renderCalendar();
  });

  $("nextMonth")?.addEventListener("click", () => {
    calendarMonth = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth() + 1,
      1
    );

    renderCalendar();
  });

  $("clearDateFilter")?.addEventListener("click", () => {
    selectedDateFilter = "";
    renderCalendar();
    renderEntries();
    showToast("Showing diary entries from all dates.");
  });

  $("viewSelectedEntries")?.addEventListener("click", () => {
    navigateToPage("#write", "diary");
  });

  /* ==========================================
     PART 5 — MOOD HISTORY
     ========================================== */

  function renderMoodHistory() {
    const container = $("moodHistory");
    if (!container) return;

    container.replaceChildren();

    const sorted = [...entries]
      .sort((a, b) =>
        String(b.date || "").localeCompare(String(a.date || "")) ||
        String(b.time || "").localeCompare(String(a.time || ""))
      )
      .slice(0, 12);

    if (!sorted.length) {
      container.appendChild(
        textElement(
          "p",
          "privacy-note",
          "Your saved moods will appear here."
        )
      );

      return;
    }

    sorted.forEach((entry) => {
      const card = textElement("article", "mood-history-card", "");

      card.append(
        textElement("strong", "", formatDate(entry.date)),
        textElement("span", "", entry.mood || "Mood not set"),
        textElement("p", "", entry.title || "Untitled memory")
      );

      container.appendChild(card);
    });
  }

  /* ==========================================
     PART 6 — INDEXEDDB FOR MUSIC AND MEDIA
     ========================================== */

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error("This browser does not support IndexedDB."));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(MUSIC_STORE)) {
          db.createObjectStore(MUSIC_STORE, { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains(MEDIA_STORE)) {
          db.createObjectStore(MEDIA_STORE, { keyPath: "id" });
        }
      };

      request.onsuccess = () => {
        const db = request.result;

        db.onversionchange = () => db.close();

        resolve(db);
      };

      request.onerror = () => {
        reject(request.error || new Error("Could not open local database."));
      };

      request.onblocked = () => {
        console.warn("Database update is blocked by another open tab.");
      };
    });
  }

  async function dbPut(storeName, value) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      let transaction;

      try {
        transaction = db.transaction(storeName, "readwrite");
        transaction.objectStore(storeName).put(value);
      } catch (error) {
        db.close();
        reject(error);
        return;
      }

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };

      transaction.onerror = () => {
        const error = transaction.error;
        db.close();
        reject(error || new Error("Could not save this file."));
      };

      transaction.onabort = () => {
        const error = transaction.error;
        db.close();
        reject(error || new Error("Saving was cancelled."));
      };
    });
  }

  async function dbGet(storeName, id) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      let result = null;

      try {
        const transaction = db.transaction(storeName, "readonly");
        const request = transaction.objectStore(storeName).get(id);

        request.onsuccess = () => {
          result = request.result || null;
        };

        transaction.oncomplete = () => {
          db.close();
          resolve(result);
        };

        transaction.onerror = () => {
          const error = transaction.error;
          db.close();
          reject(error || new Error("Could not read saved data."));
        };
      } catch (error) {
        db.close();
        reject(error);
      }
    });
  }

  async function dbGetAll(storeName) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      let result = [];

      try {
        const transaction = db.transaction(storeName, "readonly");
        const request = transaction.objectStore(storeName).getAll();

        request.onsuccess = () => {
          result = request.result || [];
        };

        transaction.oncomplete = () => {
          db.close();
          resolve(result);
        };

        transaction.onerror = () => {
          const error = transaction.error;
          db.close();
          reject(error || new Error("Could not read saved media."));
        };
      } catch (error) {
        db.close();
        reject(error);
      }
    });
  }

  async function dbDelete(storeName, id) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(storeName, "readwrite");

        transaction.objectStore(storeName).delete(id);

        transaction.oncomplete = () => {
          db.close();
          resolve();
        };

        transaction.onerror = () => {
          const error = transaction.error;
          db.close();
          reject(error || new Error("Could not delete this item."));
        };

        transaction.onabort = () => {
          const error = transaction.error;
          db.close();
          reject(error || new Error("Deleting was cancelled."));
        };
      } catch (error) {
        db.close();
        reject(error);
      }
    });
  }

  /* ==========================================
     PART 7 — PHOTO MEMORIES
     ========================================== */

  const photoForm = $("photoForm");
  const photoFile = $("photoFile");
  const photoCaption = $("photoCaption");
  const photoDate = $("photoDate");
  const photoGallery = $("photoGallery");
  const photoEmpty = $("photoEmpty");

  if (photoDate) {
    photoDate.value = today();
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onerror = () => {
        reject(new Error("Could not read photo."));
      };

      reader.onload = () => {
        const image = new Image();

        image.onerror = () => {
          reject(new Error("Invalid image."));
        };

        image.onload = () => {
          const maxSide = 1000;

          const scale = Math.min(
            1,
            maxSide / Math.max(image.width, image.height)
          );

          const canvas = document.createElement("canvas");

          canvas.width = Math.max(
            1,
            Math.round(image.width * scale)
          );

          canvas.height = Math.max(
            1,
            Math.round(image.height * scale)
          );

          const context = canvas.getContext("2d");

          if (!context) {
            reject(new Error("Could not process image."));
            return;
          }

          context.drawImage(
            image,
            0,
            0,
            canvas.width,
            canvas.height
          );

          try {
            resolve(canvas.toDataURL("image/jpeg", 0.75));
          } catch (error) {
            reject(error);
          }
        };

        image.src = reader.result;
      };

      reader.readAsDataURL(file);
    });
  }

  function renderPhotos() {
    if (!photoGallery || !photoEmpty) return;

    photoGallery.replaceChildren();

    photos.forEach((photo) => {
      if (!photo || !photo.image) return;

      const card = textElement("article", "photo-card", "");

      const image = document.createElement("img");
      image.src = photo.image;
      image.alt = photo.caption || "Photo memory";
      image.loading = "lazy";

      const heading = textElement(
        "h3",
        "",
        photo.caption || "Little memory"
      );

      const date = document.createElement("time");
      date.dateTime = photo.date || "";
      date.textContent = formatDate(photo.date);

      const remove = textElement(
        "button",
        "photo-remove",
        "Remove memory"
      );

      remove.type = "button";

      remove.addEventListener("click", () => {
        if (!confirm(`Remove "${photo.caption}"?`)) return;

        const previous = photos;
        photos = photos.filter((item) => item.id !== photo.id);

        if (saveData(KEYS.photos, photos)) {
          renderPhotos();
          showToast("Photo memory removed.");
        } else {
          photos = previous;
        }
      });

      card.append(image, heading, date, remove);
      photoGallery.appendChild(card);
    });

    photoEmpty.hidden = photos.some((photo) => photo && photo.image);
  }

  if (photoForm && photoFile && photoCaption && photoDate) {
    photoForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const file = photoFile.files?.[0];
      const caption = photoCaption.value.trim();
      const date = photoDate.value;

      if (!file || !caption || !date) {
        showToast("Photo, caption aur date bharo.");
        return;
      }

      if (!file.type.startsWith("image/")) {
        showToast("Choose a valid image.");
        return;
      }

      if (file.size > 12 * 1024 * 1024) {
        showToast("12 MB se chhoti photo choose karo.");
        return;
      }

      const submitButton = photoForm.querySelector(
        'button[type="submit"]'
      );

      const oldText = submitButton.textContent;

      submitButton.disabled = true;
      submitButton.textContent = "Saving...";

      try {
        const imageData = await compressImage(file);
        const previous = photos;

        photos = [
          {
            id: makeId(),
            caption,
            date,
            image: imageData
          },
          ...photos
        ];

        if (saveData(KEYS.photos, photos, false)) {
          renderPhotos();

          photoForm.reset();
          photoDate.value = today();

          showToast("Photo memory saved ♡");
        } else {
          photos = previous;

          showToast(
            "Storage full ho sakti hai. Kuch purani photos remove karo."
          );
        }
      } catch (error) {
        console.error(error);
        showToast("Photo save nahi hui. Doosri photo try karo.");
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = oldText;
      }
    });
  }

  /* ==========================================
     PART 8 — VIDEO AND VOICE MEMORY GALLERIES
     ========================================== */

  const videoForm = $("videoForm");
  const videoFile = $("videoFile");
  const videoCaption = $("videoCaption");
  const videoDate = $("videoDate");
  const videoGallery = $("videoGallery");

  const voiceGallery = $("voiceGallery");
  const videoEmpty = $("videoEmpty");
  const voiceEmpty = $("voiceEmpty");

  if (videoDate) {
    videoDate.value = today();
  }

  function clearMediaObjectURLs() {
    for (const url of mediaObjectURLs.values()) {
      URL.revokeObjectURL(url);
    }

    mediaObjectURLs.clear();
  }

  function createStoredMediaCard(item) {
    const card = textElement("article", "media-card", "");

    const objectURL = URL.createObjectURL(item.blob);
    mediaObjectURLs.set(item.id, objectURL);

    if (item.kind === "video") {
      const video = document.createElement("video");

      video.src = objectURL;
      video.controls = true;
      video.preload = "metadata";
      video.playsInline = true;
      video.setAttribute(
        "aria-label",
        item.caption || "Saved video memory"
      );

      card.appendChild(video);
    } else if (item.kind === "voice") {
      const audio = document.createElement("audio");

      audio.src = objectURL;
      audio.controls = true;
      audio.preload = "metadata";
      audio.style.width = "100%";

      card.appendChild(audio);
    }

    card.append(
      textElement("h3", "", item.caption || "Memory")
    );

    const date = document.createElement("time");
    date.dateTime = item.date || "";
    date.textContent = formatDate(item.date);

    card.appendChild(date);

    const remove = textElement(
      "button",
      "photo-remove",
      "Remove memory"
    );

    remove.type = "button";

    remove.addEventListener("click", async () => {
      if (!confirm(`Remove "${item.caption || "this memory"}"?`)) {
        return;
      }

      try {
        await dbDelete(MEDIA_STORE, item.id);
        await renderStoredMedia();
        showToast("Media memory removed.");
      } catch (error) {
        console.error(error);
        showToast("Could not delete this memory.");
      }
    });

    card.appendChild(remove);

    return card;
  }

  async function renderStoredMedia() {
    if (!videoGallery || !voiceGallery) return;

    clearMediaObjectURLs();

    videoGallery.replaceChildren();
    voiceGallery.replaceChildren();

    try {
      const saved = await dbGetAll(MEDIA_STORE);

      const videoItems = saved.filter(
        (item) => item.kind === "video"
      );

      const voiceItems = saved.filter(
        (item) => item.kind === "voice"
      );

      videoItems.forEach((item) => {
        videoGallery.appendChild(createStoredMediaCard(item));
      });

      voiceItems.forEach((item) => {
        voiceGallery.appendChild(createStoredMediaCard(item));
      });

      if (videoEmpty) {
        videoEmpty.hidden = videoItems.length > 0;
      }

      if (voiceEmpty) {
        voiceEmpty.hidden = voiceItems.length > 0;
      }
    } catch (error) {
      console.error(error);
      showToast("Saved media could not be loaded.");
    }
  }

  if (videoForm && videoFile && videoCaption && videoDate) {
    videoForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const file = videoFile.files?.[0];
      const caption = videoCaption.value.trim();
      const date = videoDate.value;

      if (!file || !caption || !date) {
        showToast("Video, caption aur date bharo.");
        return;
      }

      if (!file.type.startsWith("video/")) {
        showToast("Choose a valid video file.");
        return;
      }

      if (file.size > 50 * 1024 * 1024) {
        showToast("Please choose a video smaller than 50 MB.");
        return;
      }

      const button = $("saveVideoButton");
      const oldText = button.textContent;

      button.disabled = true;
      button.textContent = "Saving video...";

      try {
        await dbPut(MEDIA_STORE, {
          id: makeId(),
          kind: "video",
          caption,
          date,
          name: file.name,
          type: file.type,
          blob: file
        });

        await renderStoredMedia();

        videoForm.reset();
        videoDate.value = today();

        showToast("Video memory saved ♡");
      } catch (error) {
        console.error(error);

        showToast(
          "Video could not be saved. Browser storage may be full."
        );
      } finally {
        button.disabled = false;
        button.textContent = oldText;
      }
    });
  }

  /* ==========================================
     PART 9 — VOICE RECORDING
     ========================================== */

  const startRecording = $("startRecording");
  const stopRecording = $("stopRecording");
  const voiceStatus = $("voiceStatus");

  function stopMicrophoneTracks() {
    if (recorderStream) {
      recorderStream.getTracks().forEach((track) => track.stop());
      recorderStream = null;
    }
  }

  if (startRecording && stopRecording && voiceStatus) {
    startRecording.addEventListener("click", async () => {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        !window.MediaRecorder
      ) {
        showToast(
          "Voice recording is not supported in this browser."
        );
        return;
      }

      startRecording.disabled = true;
      voiceStatus.textContent = "Requesting microphone permission...";

      try {
        recorderStream = await navigator.mediaDevices.getUserMedia({
          audio: true
        });

        const options = {};

        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          options.mimeType = "audio/webm;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/webm")) {
          options.mimeType = "audio/webm";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          options.mimeType = "audio/mp4";
        }

        recorder = new MediaRecorder(recorderStream, options);
        recorderChunks = [];

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recorderChunks.push(event.data);
          }
        };

        recorder.onstop = async () => {
          stopMicrophoneTracks();

          const blob = new Blob(recorderChunks, {
            type: recorder.mimeType || "audio/webm"
          });

          if (!blob.size) {
            voiceStatus.textContent = "No audio was recorded.";
            startRecording.disabled = false;
            stopRecording.disabled = true;
            return;
          }

          try {
            await dbPut(MEDIA_STORE, {
              id: makeId(),
              kind: "voice",
              caption: `Voice memory · ${currentTime()}`,
              date: today(),
              name: `Voice memory ${currentTime()}`,
              type: blob.type,
              blob
            });

            await renderStoredMedia();

            voiceStatus.textContent =
              "Voice memory saved successfully ♡";

            showToast("Voice memory saved ♡");
          } catch (error) {
            console.error(error);

            voiceStatus.textContent =
              "Could not save the recording.";

            showToast(
              "Recording save nahi hui. Browser storage check karo."
            );
          } finally {
            startRecording.disabled = false;
            stopRecording.disabled = true;
            recorder = null;
            recorderChunks = [];
          }
        };

        recorder.onerror = () => {
          stopMicrophoneTracks();

          startRecording.disabled = false;
          stopRecording.disabled = true;

          voiceStatus.textContent =
            "Recording error. Please try again.";
        };

        recorder.start();

        voiceStatus.textContent =
          "Recording... press Stop & save when finished.";

        startRecording.disabled = true;
        stopRecording.disabled = false;
      } catch (error) {
        console.error(error);

        stopMicrophoneTracks();

        startRecording.disabled = false;
        stopRecording.disabled = true;

        voiceStatus.textContent =
          "Microphone permission was not granted or is unavailable.";
      }
    });

    stopRecording.addEventListener("click", () => {
      if (recorder && recorder.state === "recording") {
        stopRecording.disabled = true;
        voiceStatus.textContent = "Saving your voice memory...";
        recorder.stop();
      }
    });
  }

  /* ==========================================
     PART 10 — MUSIC PLAYER
     Stores the selected song in IndexedDB
     ========================================== */

  const musicFile = $("musicFile");
  const musicAudio = $("musicAudio");
  const musicPlay = $("musicPlay");
  const musicStop = $("musicStop");
  const musicChoose = $("musicChoose");
  const musicRecord = $("musicRecord");
  const musicTrackName = $("musicTrackName");

  function setMusicSource(blob, name) {
    if (!musicAudio) return;

    musicAudio.pause();

    if (currentMusicURL) {
      URL.revokeObjectURL(currentMusicURL);
    }

    currentMusicURL = URL.createObjectURL(blob);
    musicAudio.src = currentMusicURL;

    if (musicTrackName) {
      musicTrackName.textContent = name || "Your favourite song";
    }

    musicAudio.load();
    updateMusicPlayer();
  }

  function updateMusicPlayer() {
    if (!musicAudio || !musicPlay || !musicRecord) return;

    const playing = !musicAudio.paused && !musicAudio.ended;

    musicPlay.textContent = playing ? "Ⅱ" : "▶";

    musicPlay.setAttribute(
      "aria-label",
      playing ? "Pause music" : "Play music"
    );

    musicRecord.classList.toggle("spinning", playing);
  }

  async function restoreMusic() {
    try {
      const song = await dbGet(MUSIC_STORE, "current-song");

      if (song?.blob) {
        setMusicSource(song.blob, song.name);
      }
    } catch (error) {
      console.error("Could not restore music:", error);
    }
  }

  if (
    musicFile && musicAudio && musicPlay && musicStop &&
    musicChoose && musicRecord && musicTrackName
  ) {
    musicChoose.addEventListener("click", () => {
      musicFile.value = "";
      musicFile.click();
    });

    musicFile.addEventListener("change", async () => {
      const file = musicFile.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("audio/")) {
        showToast("Please select an audio file.");
        musicFile.value = "";
        return;
      }

      musicChoose.disabled = true;
      musicPlay.disabled = true;
      musicTrackName.textContent = "Saving song...";

      try {
        await dbPut(MUSIC_STORE, {
          id: "current-song",
          name: file.name,
          type: file.type || "audio/mpeg",
          blob: file,
          savedAt: new Date().toISOString()
        });

        setMusicSource(file, file.name);

        try {
          await musicAudio.play();
          showToast("Song saved and playing ♡");
        } catch (error) {
          showToast("Song saved! Press Play to listen.");
        }
      } catch (error) {
        console.error(error);

        musicTrackName.textContent = "Could not save song";

        showToast(
          "Song could not be saved. Browser storage may be full."
        );
      } finally {
        musicChoose.disabled = false;
        musicPlay.disabled = false;
        musicFile.value = "";
        updateMusicPlayer();
      }
    });

    musicPlay.addEventListener("click", async () => {
      if (!musicAudio.src) {
        musicFile.click();
        return;
      }

      try {
        if (musicAudio.paused) {
          await musicAudio.play();
        } else {
          musicAudio.pause();
        }
      } catch (error) {
        showToast("Music play nahi hua. Dobara try karo.");
      }

      updateMusicPlayer();
    });

    musicStop.addEventListener("click", () => {
      musicAudio.pause();

      if (musicAudio.src) {
        try {
          musicAudio.currentTime = 0;
        } catch (error) {
          // The audio may still be loading.
        }
      }

      updateMusicPlayer();
    });

    musicAudio.addEventListener("play", updateMusicPlayer);
    musicAudio.addEventListener("pause", updateMusicPlayer);
    musicAudio.addEventListener("ended", updateMusicPlayer);

    musicAudio.addEventListener("error", () => {
      showToast("This audio file could not be played.");
      updateMusicPlayer();
    });

    restoreMusic();
  }

  /* ==========================================
     PART 11 — INITIAL RENDER
     ========================================== */

  showPage(getPageFromHash(window.location.hash));

  renderEntries();
  renderCalendar();
  renderMoodHistory();
  renderPhotos();
  renderStoredMedia();
  updateStats();

  /* ==========================================
     PART 12 — CLEANUP
     ========================================== */

  window.addEventListener("beforeunload", () => {
    if (currentMusicURL) {
      URL.revokeObjectURL(currentMusicURL);
    }

    clearMediaObjectURLs();
    stopMicrophoneTracks();
  });

})();