/**
 * Locatie Foto's — PocketBase frontend
 */
(function () {
  "use strict";

  const pb = new PocketBase(window.location.origin);

  const state = {
    view: "home",
    create: {
      name: "",
      kenmerken: [],
      photos: {},
    },
    detailLocationId: null,
  };

  const views = {
    home: document.getElementById("view-home"),
    createStep1: document.getElementById("view-create-step1"),
    createStep2: document.getElementById("view-create-step2"),
    list: document.getElementById("view-list"),
    detail: document.getElementById("view-detail"),
  };

  const els = {
    pageTitle: document.getElementById("page-title"),
    btnBack: document.getElementById("btn-back"),
    btnNewLocation: document.getElementById("btn-new-location"),
    btnLocationList: document.getElementById("btn-location-list"),
    btnEmptyNew: document.getElementById("btn-empty-new"),
    formLocationInfo: document.getElementById("form-location-info"),
    locationName: document.getElementById("location-name"),
    kenmerkInput: document.getElementById("kenmerk-input"),
    btnAddKenmerk: document.getElementById("btn-add-kenmerk"),
    kenmerkList: document.getElementById("kenmerk-list"),
    kenmerkError: document.getElementById("kenmerk-error"),
    createLocationName: document.getElementById("create-location-name"),
    kenmerkPhotoSections: document.getElementById("kenmerk-photo-sections"),
    btnSaveLocation: document.getElementById("btn-save-location"),
    btnCancelCreate: document.getElementById("btn-cancel-create"),
    locationList: document.getElementById("location-list"),
    listEmpty: document.getElementById("list-empty"),
    listLoading: document.getElementById("list-loading"),
    detailContent: document.getElementById("detail-content"),
    detailLoading: document.getElementById("detail-loading"),
    toast: document.getElementById("toast"),
    lightbox: document.getElementById("lightbox"),
    lightboxImg: document.getElementById("lightbox-img"),
  };

  const titles = {
    home: "Locatie Foto's",
    createStep1: "Nieuwe locatie",
    createStep2: "Foto's toevoegen",
    list: "Locatielijst",
    detail: "Locatie",
  };

  function showView(name) {
    state.view = name;
    Object.values(views).forEach((v) => v.classList.remove("active"));
    const key =
      name === "createStep1" || name === "createStep2" ? name : name;
    if (views[key]) views[key].classList.add("active");

    els.pageTitle.textContent = titles[name] || "Locatie Foto's";
    els.btnBack.classList.toggle("hidden", name === "home");

    if (name === "list") loadLocationList();
    if (name === "detail" && state.detailLocationId) loadLocationDetail(state.detailLocationId);
  }

  function goBack() {
    switch (state.view) {
      case "createStep1":
        resetCreate();
        showView("home");
        break;
      case "createStep2":
        showView("createStep1");
        break;
      case "list":
        showView("home");
        break;
      case "detail":
        showView("list");
        break;
      default:
        showView("home");
    }
  }

  function resetCreate() {
    state.create = { name: "", kenmerken: [], photos: {} };
    els.locationName.value = "";
    els.kenmerkInput.value = "";
    els.kenmerkList.innerHTML = "";
    els.kenmerkError.classList.add("hidden");
    els.kenmerkPhotoSections.innerHTML = "";
  }

  function showToast(message, type = "info") {
    els.toast.textContent = message;
    els.toast.className = "toast " + type;
    els.toast.classList.remove("hidden");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      els.toast.classList.add("hidden");
    }, 3200);
  }

  function apiErrorMessage(err, fallback) {
    if (!err) return fallback;
    const data = err.response && err.response.data;
    if (data && typeof data === "object") {
      const parts = Object.entries(data).map(([field, info]) => {
        if (info && typeof info === "object" && info.message) {
          return field + ": " + info.message;
        }
        return field + ": " + String(info);
      });
      if (parts.length) return parts.join("; ");
    }
    return err.message || fallback;
  }

  function fileUrl(record, field, thumb) {
    if (!record || !record[field]) return "";
    return pb.files.getURL(record, field, thumb ? { thumb } : undefined);
  }

  function relationId(value) {
    if (!value) return "";
    return typeof value === "string" ? value : value.id || "";
  }

  /* Kenmerken chips (step 1) */
  function renderKenmerkChips() {
    els.kenmerkList.innerHTML = "";
    state.create.kenmerken.forEach((name, index) => {
      const li = document.createElement("li");
      li.className = "kenmerk-chip";
      li.innerHTML =
        "<span>" + escapeHtml(name) + "</span>" +
        "<button type=\"button\" aria-label=\"Verwijderen\" data-index=\"" + index + "\">×</button>";
      li.querySelector("button").addEventListener("click", () => {
        const removed = state.create.kenmerken[index];
        state.create.kenmerken.splice(index, 1);
        delete state.create.photos[removed];
        renderKenmerkChips();
      });
      els.kenmerkList.appendChild(li);
    });
  }

  function addKenmerk() {
    const value = els.kenmerkInput.value.trim();
    if (!value) return;
    if (state.create.kenmerken.some((k) => k.toLowerCase() === value.toLowerCase())) {
      showToast("Dit kenmerk bestaat al", "error");
      return;
    }
    state.create.kenmerken.push(value);
    state.create.photos[value] = [];
    els.kenmerkInput.value = "";
    els.kenmerkError.classList.add("hidden");
    renderKenmerkChips();
    els.kenmerkInput.focus();
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /* Step 2: foto secties */
  function buildKenmerkPhotoSections() {
    els.createLocationName.textContent = state.create.name;
    els.kenmerkPhotoSections.innerHTML = "";

    state.create.kenmerken.forEach((kenmerkName) => {
      const section = document.createElement("div");
      section.className = "kenmerk-section";
      section.dataset.kenmerk = kenmerkName;

      const header = document.createElement("div");
      header.className = "kenmerk-section-header";
      header.innerHTML =
        "<span class=\"kenmerk-section-title\">" + escapeHtml(kenmerkName) + "</span>" +
        "<span class=\"kenmerk-section-count\" data-count-for=\"" + escapeHtml(kenmerkName) + "\">0 foto's</span>";

      const uploadZone = document.createElement("div");
      uploadZone.className = "upload-zone";
      uploadZone.innerHTML =
        "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\">" +
        "<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\" ry=\"2\"/>" +
        "<circle cx=\"8.5\" cy=\"8.5\" r=\"1.5\"/>" +
        "<polyline points=\"21 15 16 10 5 21\"/>" +
        "</svg>" +
        "<p>Foto's toevoegen</p>" +
        "<span>Tik of sleep bestanden hier</span>";

      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.multiple = true;
      uploadZone.appendChild(input);

      const grid = document.createElement("div");
      grid.className = "photo-grid";
      grid.dataset.gridFor = kenmerkName;

      uploadZone.addEventListener("click", () => input.click());
      uploadZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        uploadZone.classList.add("dragover");
      });
      uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("dragover"));
      uploadZone.addEventListener("drop", (e) => {
        e.preventDefault();
        uploadZone.classList.remove("dragover");
        handleFiles(kenmerkName, e.dataTransfer.files);
      });
      input.addEventListener("change", () => {
        handleFiles(kenmerkName, input.files);
        input.value = "";
      });

      section.appendChild(header);
      section.appendChild(uploadZone);
      section.appendChild(grid);
      els.kenmerkPhotoSections.appendChild(section);

      renderPhotoGrid(kenmerkName);
    });
  }

  function handleFiles(kenmerkName, fileList) {
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;

    if (!state.create.photos[kenmerkName]) state.create.photos[kenmerkName] = [];

    files.forEach((file) => {
      const id = crypto.randomUUID();
      const preview = URL.createObjectURL(file);
      state.create.photos[kenmerkName].push({ id, file, preview });
    });

    renderPhotoGrid(kenmerkName);
  }

  function renderPhotoGrid(kenmerkName) {
    const grid = els.kenmerkPhotoSections.querySelector(
      "[data-grid-for=\"" + CSS.escape(kenmerkName) + "\"]"
    );
    const countEl = els.kenmerkPhotoSections.querySelector(
      "[data-count-for=\"" + CSS.escape(kenmerkName) + "\"]"
    );
    const photos = state.create.photos[kenmerkName] || [];

    if (countEl) {
      countEl.textContent = photos.length + " foto" + (photos.length !== 1 ? "'s" : "");
    }

    if (!grid) return;
    grid.innerHTML = "";

    photos.forEach((photo) => {
      const thumb = document.createElement("div");
      thumb.className = "photo-thumb";
      thumb.innerHTML =
        "<img src=\"" + photo.preview + "\" alt=\"\" />" +
        "<button type=\"button\" class=\"remove-photo\" aria-label=\"Verwijder foto\" data-id=\"" + photo.id + "\">" +
        "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">" +
        "<line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/><line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/>" +
        "</svg></button>";

      thumb.querySelector(".remove-photo").addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = state.create.photos[kenmerkName].findIndex((p) => p.id === photo.id);
        if (idx >= 0) {
          URL.revokeObjectURL(state.create.photos[kenmerkName][idx].preview);
          state.create.photos[kenmerkName].splice(idx, 1);
          renderPhotoGrid(kenmerkName);
        }
      });

      grid.appendChild(thumb);
    });
  }

  async function saveLocation() {
    const btn = els.btnSaveLocation;
    btn.disabled = true;
    btn.textContent = "Opslaan...";

    try {
      const location = await pb.collection("locations").create({
        name: state.create.name,
      });

      const kenmerkRecords = [];
      for (let i = 0; i < state.create.kenmerken.length; i++) {
        const name = state.create.kenmerken[i];
        const record = await pb.collection("kenmerken").create({
          name,
          location: location.id,
          sort_order: i,
        });
        kenmerkRecords.push({ name, id: record.id });
      }

      let uploadCount = 0;
      for (const kenmerk of kenmerkRecords) {
        const photos = state.create.photos[kenmerk.name] || [];
        for (const photo of photos) {
          const formData = new FormData();
          formData.append("image", photo.file);
          formData.append("kenmerk", kenmerk.id);
          formData.append("location", location.id);
          await pb.collection("photos").create(formData);
          uploadCount++;
        }
      }

      photosCleanup();
      resetCreate();
      showToast(
        "Locatie opgeslagen" + (uploadCount ? " met " + uploadCount + " foto's" : ""),
        "success"
      );
      state.detailLocationId = location.id;
      showView("detail");
    } catch (err) {
      console.error(err);
      showToast("Opslaan mislukt: " + apiErrorMessage(err, "onbekende fout"), "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Locatie opslaan";
    }
  }

  function photosCleanup() {
    Object.values(state.create.photos).forEach((arr) => {
      arr.forEach((p) => URL.revokeObjectURL(p.preview));
    });
  }

  /* Locatielijst */
  async function loadLocationList() {
    els.listLoading.classList.remove("hidden");
    els.listEmpty.classList.add("hidden");
    els.locationList.innerHTML = "";

    try {
      const locations = await pb.collection("locations").getFullList({
        sort: "-id",
      });

      els.listLoading.classList.add("hidden");

      if (!locations.length) {
        els.listEmpty.classList.remove("hidden");
        return;
      }

      for (const loc of locations) {
        const kenmerken = await pb.collection("kenmerken").getFullList({
          filter: "location = \"" + loc.id + "\"",
        });
        const photos = await pb.collection("photos").getFullList({
          filter: "location = \"" + loc.id + "\"",
        });

        const card = document.createElement("button");
        card.type = "button";
        card.className = "location-card";
        card.innerHTML =
          "<div class=\"location-card-icon\">" +
          "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">" +
          "<path d=\"M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z\"/>" +
          "</svg></div>" +
          "<div class=\"location-card-body\">" +
          "<p class=\"location-card-name\">" + escapeHtml(loc.name) + "</p>" +
          "<p class=\"location-card-meta\">" +
          kenmerken.length + " kenmerk" + (kenmerken.length !== 1 ? "en" : "") +
          " · " + photos.length + " foto" + (photos.length !== 1 ? "'s" : "") +
          "</p></div>" +
          "<div class=\"location-card-arrow\">" +
          "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">" +
          "<polyline points=\"9 18 15 12 9 6\"/>" +
          "</svg></div>";

        card.addEventListener("click", () => {
          state.detailLocationId = loc.id;
          showView("detail");
        });

        els.locationList.appendChild(card);
      }
    } catch (err) {
      console.error(err);
      els.listLoading.classList.add("hidden");
      showToast("Laden mislukt: " + apiErrorMessage(err, "onbekende fout"), "error");
    }
  }

  /* Locatie detail */
  async function loadLocationDetail(locationId) {
    els.detailLoading.classList.remove("hidden");
    els.detailContent.innerHTML = "";
    els.detailContent.classList.add("hidden");

    try {
      const location = await pb.collection("locations").getOne(locationId);
      const kenmerken = await pb.collection("kenmerken").getFullList({
        filter: "location = \"" + locationId + "\"",
        sort: "sort_order",
      });
      const photos = await pb.collection("photos").getFullList({
        filter: "location = \"" + locationId + "\"",
      });

      els.pageTitle.textContent = location.name;

      const header = document.createElement("div");
      header.className = "detail-header";
      header.innerHTML =
        "<h2>" + escapeHtml(location.name) + "</h2>" +
        "<p class=\"detail-meta\">" +
        kenmerken.length + " kenmerk" + (kenmerken.length !== 1 ? "en" : "") +
        " · " + photos.length + " foto" + (photos.length !== 1 ? "'s" : "") +
        "</p>";

      const actions = document.createElement("div");
      actions.className = "detail-actions";
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "btn btn-secondary";
      deleteBtn.textContent = "Locatie verwijderen";
      deleteBtn.addEventListener("click", () => deleteLocation(locationId, location.name));
      actions.appendChild(deleteBtn);

      els.detailContent.appendChild(header);

      if (kenmerken.length === 0) {
        const empty = document.createElement("p");
        empty.className = "form-hint";
        empty.style.textAlign = "center";
        empty.textContent = "Geen kenmerken voor deze locatie.";
        els.detailContent.appendChild(empty);
      }

      kenmerken.forEach((kenmerk) => {
        const kenmerkPhotos = photos.filter(
          (p) => relationId(p.kenmerk) === kenmerk.id
        );

        const block = document.createElement("div");
        block.className = "detail-kenmerk";
        block.innerHTML =
          "<h3>" + escapeHtml(kenmerk.name) +
          " <span>" + kenmerkPhotos.length + "</span></h3>";

        if (kenmerkPhotos.length > 0) {
          const grid = document.createElement("div");
          grid.className = "detail-photo-grid";

          kenmerkPhotos.forEach((photo) => {
            const url = fileUrl(photo, "image", "400x400");
            const fullUrl = fileUrl(photo, "image");
            const item = document.createElement("div");
            item.className = "detail-photo";
            item.innerHTML = "<img src=\"" + url + "\" alt=\"\" loading=\"lazy\" />";
            item.addEventListener("click", () => openLightbox(fullUrl, kenmerk.name));
            grid.appendChild(item);
          });

          block.appendChild(grid);
        } else {
          const noPhotos = document.createElement("p");
          noPhotos.className = "form-hint";
          noPhotos.textContent = "Geen foto's voor dit kenmerk.";
          block.appendChild(noPhotos);
        }

        els.detailContent.appendChild(block);
      });

      els.detailContent.appendChild(actions);
      els.detailLoading.classList.add("hidden");
      els.detailContent.classList.remove("hidden");
    } catch (err) {
      console.error(err);
      els.detailLoading.classList.add("hidden");
      showToast("Laden mislukt: " + apiErrorMessage(err, "onbekende fout"), "error");
      showView("list");
    }
  }

  async function deleteLocation(locationId, name) {
    if (!confirm("Weet je zeker dat je \"" + name + "\" wilt verwijderen? Alle foto's worden ook verwijderd.")) {
      return;
    }

    try {
      await pb.collection("locations").delete(locationId);
      showToast("Locatie verwijderd", "success");
      state.detailLocationId = null;
      showView("list");
    } catch (err) {
      console.error(err);
      showToast("Verwijderen mislukt: " + apiErrorMessage(err, "onbekende fout"), "error");
    }
  }

  function openLightbox(src, alt) {
    els.lightboxImg.src = src;
    els.lightboxImg.alt = alt || "";
    els.lightbox.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    els.lightbox.classList.add("hidden");
    els.lightboxImg.src = "";
    document.body.style.overflow = "";
  }

  /* Events */
  els.btnBack.addEventListener("click", goBack);
  els.btnNewLocation.addEventListener("click", () => {
    resetCreate();
    showView("createStep1");
  });
  els.btnLocationList.addEventListener("click", () => showView("list"));
  els.btnEmptyNew.addEventListener("click", () => {
    resetCreate();
    showView("createStep1");
  });

  els.btnAddKenmerk.addEventListener("click", addKenmerk);
  els.kenmerkInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addKenmerk();
    }
  });

  els.formLocationInfo.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = els.locationName.value.trim();
    if (!name) {
      els.locationName.focus();
      return;
    }
    if (state.create.kenmerken.length === 0) {
      els.kenmerkError.classList.remove("hidden");
      return;
    }
    state.create.name = name;
    buildKenmerkPhotoSections();
    showView("createStep2");
  });

  els.btnSaveLocation.addEventListener("click", saveLocation);
  els.btnCancelCreate.addEventListener("click", () => {
    photosCleanup();
    resetCreate();
    showView("home");
  });

  els.lightbox.querySelector(".lightbox-close").addEventListener("click", closeLightbox);
  els.lightbox.addEventListener("click", (e) => {
    if (e.target === els.lightbox) closeLightbox();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.lightbox.classList.contains("hidden")) closeLightbox();
  });

  showView("home");
})();
