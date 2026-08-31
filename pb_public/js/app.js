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
      coordinates: null,
      kenmerken: [],
      photos: {},
      kenmerkIds: {},
      removedKenmerkIds: [],
      removedPhotoIds: [],
    },
    editingLocationId: null,
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
    locationLatitude: document.getElementById("location-latitude"),
    locationLongitude: document.getElementById("location-longitude"),
    btnUseGps: document.getElementById("btn-use-gps"),
    coordsError: document.getElementById("coords-error"),
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
    editStep1: "Locatie bewerken",
    editStep2: "Foto's bewerken",
    list: "Locatielijst",
    detail: "Locatie",
  };

  const isEditing = () => !!state.editingLocationId;

  function showView(name) {
    state.view = name;
    Object.values(views).forEach((v) => v.classList.remove("active"));
    const key =
      name === "createStep1" || name === "createStep2" ? name : name;
    if (views[key]) views[key].classList.add("active");

    els.pageTitle.textContent =
      (isEditing() && (name === "createStep1" ? titles.editStep1 : name === "createStep2" ? titles.editStep2 : null)) ||
      titles[name] ||
      "Locatie Foto's";
    els.btnBack.classList.toggle("hidden", name === "home");

    if (name === "list") loadLocationList();
    if (name === "detail" && state.detailLocationId) loadLocationDetail(state.detailLocationId);
    if (name === "createStep2") updateCreateStep2Labels();
    if (name === "createStep1") updateCreateStep1Labels();
  }

  function updateCreateStep1Labels() {
    const submitBtn = els.formLocationInfo.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.textContent = isEditing()
        ? "Volgende: foto's bewerken"
        : "Volgende: foto's toevoegen";
    }
  }

  function updateCreateStep2Labels() {
    els.btnSaveLocation.textContent = isEditing() ? "Wijzigingen opslaan" : "Locatie opslaan";
    els.btnCancelCreate.textContent = isEditing() ? "Annuleren" : "Annuleren";
  }

  function goBack() {
    switch (state.view) {
      case "createStep1":
        if (isEditing()) {
          const locationId = state.editingLocationId;
          photosCleanup();
          resetCreate();
          state.detailLocationId = locationId;
          showView("detail");
        } else {
          resetCreate();
          showView("home");
        }
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
    state.create = {
      name: "",
      coordinates: null,
      kenmerken: [],
      photos: {},
      kenmerkIds: {},
      removedKenmerkIds: [],
      removedPhotoIds: [],
    };
    state.editingLocationId = null;
    els.locationName.value = "";
    setCoordinateInputs(null);
    els.kenmerkInput.value = "";
    els.kenmerkList.innerHTML = "";
    els.kenmerkError.classList.add("hidden");
    els.coordsError.classList.add("hidden");
    els.kenmerkPhotoSections.innerHTML = "";
    updateCreateStep1Labels();
    updateCreateStep2Labels();
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

  function fileFieldName(record, field) {
    if (!record || !record[field]) return "";
    const value = record[field];
    if (Array.isArray(value)) return value[0] || "";
    return String(value);
  }

  function fileUrl(record, field, thumb) {
    const filename = fileFieldName(record, field);
    if (!filename || !record.id) return "";
    return pb.files.getURL(record, filename, thumb ? { thumb } : undefined);
  }

  function relationId(value) {
    if (!value) return "";
    return typeof value === "string" ? value : value.id || "";
  }

  function formatCoordinate(value) {
    if (value === null || value === undefined || value === "") return "";
    const num = Number(value);
    if (!Number.isFinite(num)) return "";
    return num.toFixed(6);
  }

  function parseCoordinateInput(value) {
    const trimmed = String(value || "").trim().replace(",", ".");
    if (!trimmed) return null;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : NaN;
  }

  function readCoordinatesFromForm() {
    return {
      lat: parseCoordinateInput(els.locationLatitude.value),
      lon: parseCoordinateInput(els.locationLongitude.value),
    };
  }

  function setCoordinateInputs(coordinates) {
    const lat = coordinates && coordinates.lat !== undefined ? coordinates.lat : null;
    const lon = coordinates && coordinates.lon !== undefined ? coordinates.lon : null;
    els.locationLatitude.value = formatCoordinate(lat);
    els.locationLongitude.value = formatCoordinate(lon);
  }

  function validateCoordinates(lat, lon) {
    const hasLat = lat !== null;
    const hasLon = lon !== null;

    if (!hasLat && !hasLon) return null;
    if (hasLat !== hasLon) {
      return "Vul zowel breedtegraad als lengtegraad in, of laat beide leeg.";
    }
    if (Number.isNaN(lat) || lat < -90 || lat > 90) {
      return "Breedtegraad moet tussen -90 en 90 liggen.";
    }
    if (Number.isNaN(lon) || lon < -180 || lon > 180) {
      return "Lengtegraad moet tussen -180 en 180 liggen.";
    }
    return null;
  }

  function coordinatesFromRecord(record) {
    if (!record || !record.coordinates) return null;
    const lat = Number(record.coordinates.lat);
    const lon = Number(record.coordinates.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  }

  function buildLocationPayload() {
    const payload = { name: state.create.name };
    const coords = state.create.coordinates;
    payload.coordinates = coords ? { lat: coords.lat, lon: coords.lon } : null;
    return payload;
  }

  function syncCoordinatesFromForm() {
    const { lat, lon } = readCoordinatesFromForm();
    const error = validateCoordinates(lat, lon);
    if (error) return error;
    state.create.coordinates = lat !== null && lon !== null ? { lat, lon } : null;
    return null;
  }

  function mapsUrl(lat, lon) {
    return "https://www.google.com/maps?q=" + encodeURIComponent(lat + "," + lon);
  }

  function useCurrentGpsLocation() {
    if (!navigator.geolocation) {
      showToast("GPS wordt niet ondersteund op dit apparaat", "error");
      return;
    }

    const btn = els.btnUseGps;
    const label = btn.querySelector("span");
    const originalText = label ? label.textContent : "GPS";
    btn.disabled = true;
    if (label) label.textContent = "...";

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        };
        state.create.coordinates = coords;
        setCoordinateInputs(coords);
        els.coordsError.classList.add("hidden");
        showToast("GPS-coördinaten toegevoegd", "success");
        btn.disabled = false;
        if (label) label.textContent = originalText;
      },
      (error) => {
        let message = "Kon GPS-locatie niet ophalen";
        if (error.code === error.PERMISSION_DENIED) {
          message = "Geef toegang tot je locatie om GPS te gebruiken";
        } else if (error.code === error.TIMEOUT) {
          message = "GPS-locatie ophalen duurde te lang";
        }
        showToast(message, "error");
        btn.disabled = false;
        if (label) label.textContent = originalText;
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }

  const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"];
  const FILE_ACCEPT =
    "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif";
  const IMAGE_MIME_BY_EXT = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    heic: "image/heic",
    heif: "image/heif",
  };

  function fileExtension(name) {
    const parts = (name || "").toLowerCase().split(".");
    return parts.length > 1 ? parts.pop() : "";
  }

  function isImageFile(file) {
    if (!file) return false;
    if (file.type && file.type.startsWith("image/")) return true;
    return IMAGE_EXTENSIONS.includes(fileExtension(file.name));
  }

  function normalizeImageFile(file) {
    if (!isImageFile(file)) return null;

    const ext = fileExtension(file.name);
    const mime = file.type || IMAGE_MIME_BY_EXT[ext];
    if (!mime) return null;

    const name = file.name || "foto." + (ext || "jpg");
    if (file.type === mime) return file;

    return new File([file], name, { type: mime, lastModified: file.lastModified });
  }

  function uniqueId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "id-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
  }

  function findKenmerkSection(kenmerkName) {
    return els.kenmerkPhotoSections.querySelector(
      ".kenmerk-section[data-kenmerk-key=\"" + CSS.escape(kenmerkName) + "\"]"
    );
  }

  function createPhotoFileInput(options) {
    const input = document.createElement("input");
    input.type = "file";
    input.className = "upload-input";
    input.accept = options.capture ? "image/*" : FILE_ACCEPT;
    if (options.capture) input.setAttribute("capture", options.capture);
    if (options.multiple) input.multiple = true;
    return input;
  }

  function bindPhotoFileInput(input, kenmerkName) {
    input.addEventListener("change", () => {
      handleFiles(kenmerkName, input.files);
      input.value = "";
    });
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
        const existingId = state.create.kenmerkIds[removed];
        if (existingId) {
          state.create.removedKenmerkIds.push(existingId);
          delete state.create.kenmerkIds[removed];
        } else {
          (state.create.photos[removed] || []).forEach((photo) => {
            if (photo.recordId) state.create.removedPhotoIds.push(photo.recordId);
          });
        }
        (state.create.photos[removed] || []).forEach((photo) => {
          if (photo.preview && photo.file) URL.revokeObjectURL(photo.preview);
        });
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
      section.dataset.kenmerkKey = kenmerkName;

      const header = document.createElement("div");
      header.className = "kenmerk-section-header";

      const titleSpan = document.createElement("span");
      titleSpan.className = "kenmerk-section-title";
      titleSpan.textContent = kenmerkName;

      const countSpan = document.createElement("span");
      countSpan.className = "kenmerk-section-count";
      countSpan.dataset.countFor = kenmerkName;
      countSpan.textContent = "0 foto's";

      header.appendChild(titleSpan);
      header.appendChild(countSpan);

      const uploadZone = document.createElement("div");
      uploadZone.className = "upload-zone";

      const actions = document.createElement("div");
      actions.className = "upload-actions";

      const cameraAction = document.createElement("label");
      cameraAction.className = "upload-action upload-action-camera";
      cameraAction.innerHTML =
        "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\">" +
        "<path d=\"M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z\"/>" +
        "<circle cx=\"12\" cy=\"13\" r=\"4\"/>" +
        "</svg>" +
        "<span>Foto maken</span>";
      const cameraInput = createPhotoFileInput({ capture: "environment" });
      cameraAction.appendChild(cameraInput);
      bindPhotoFileInput(cameraInput, kenmerkName);

      const galleryAction = document.createElement("label");
      galleryAction.className = "upload-action upload-action-gallery";
      galleryAction.innerHTML =
        "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\">" +
        "<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\" ry=\"2\"/>" +
        "<circle cx=\"8.5\" cy=\"8.5\" r=\"1.5\"/>" +
        "<polyline points=\"21 15 16 10 5 21\"/>" +
        "</svg>" +
        "<span>Uit galerij</span>";
      const galleryInput = createPhotoFileInput({ multiple: true });
      galleryAction.appendChild(galleryInput);
      bindPhotoFileInput(galleryInput, kenmerkName);

      actions.appendChild(cameraAction);
      actions.appendChild(galleryAction);

      const hint = document.createElement("span");
      hint.className = "upload-hint";
      hint.textContent = "of sleep bestanden hier";

      uploadZone.appendChild(actions);
      uploadZone.appendChild(hint);

      const grid = document.createElement("div");
      grid.className = "photo-grid";
      grid.dataset.gridFor = kenmerkName;

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

      section.appendChild(header);
      section.appendChild(uploadZone);
      section.appendChild(grid);
      els.kenmerkPhotoSections.appendChild(section);

      renderPhotoGrid(kenmerkName);
    });
  }

  function handleFiles(kenmerkName, fileList) {
    const incoming = Array.from(fileList || []);
    const files = [];
    let skipped = 0;

    incoming.forEach((raw) => {
      const file = normalizeImageFile(raw);
      if (file) {
        files.push(file);
      } else {
        skipped++;
      }
    });

    if (!files.length) {
      if (incoming.length) {
        showToast("Geen geldige afbeeldingen geselecteerd (PNG, JPG, WebP, GIF)", "error");
      }
      return;
    }

    if (skipped) {
      showToast(skipped + " bestand(en) overgeslagen (geen geldige afbeelding)", "error");
    }

    if (!state.create.photos[kenmerkName]) state.create.photos[kenmerkName] = [];

    files.forEach((file) => {
      const id = uniqueId();
      const preview = URL.createObjectURL(file);
      state.create.photos[kenmerkName].push({ id, file, preview });
    });

    renderPhotoGrid(kenmerkName);
  }

  function renderPhotoGrid(kenmerkName) {
    const section = findKenmerkSection(kenmerkName);
    const grid = section
      ? section.querySelector("[data-grid-for=\"" + CSS.escape(kenmerkName) + "\"]")
      : null;
    const countEl = section
      ? section.querySelector("[data-count-for=\"" + CSS.escape(kenmerkName) + "\"]")
      : null;
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
          const removed = state.create.photos[kenmerkName][idx];
          if (removed.recordId) state.create.removedPhotoIds.push(removed.recordId);
          if (removed.preview && removed.file) URL.revokeObjectURL(removed.preview);
          state.create.photos[kenmerkName].splice(idx, 1);
          renderPhotoGrid(kenmerkName);
        }
      });

      grid.appendChild(thumb);
    });
  }

  async function saveLocation() {
    if (isEditing()) {
      await updateLocation();
      return;
    }

    const btn = els.btnSaveLocation;
    btn.disabled = true;
    btn.textContent = "Opslaan...";

    try {
      const location = await pb.collection("locations").create(buildLocationPayload());

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
          if (!photo.file) continue;
          await pb.collection("photos").create({
            image: photo.file,
            kenmerk: kenmerk.id,
            location: location.id,
          });
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
      updateCreateStep2Labels();
    }
  }

  async function updateLocation() {
    const locationId = state.editingLocationId;
    const btn = els.btnSaveLocation;
    btn.disabled = true;
    btn.textContent = "Opslaan...";

    try {
      await pb.collection("locations").update(locationId, buildLocationPayload());

      const uniqueRemovedKenmerkIds = [...new Set(state.create.removedKenmerkIds)];
      for (const id of uniqueRemovedKenmerkIds) {
        await pb.collection("kenmerken").delete(id);
      }

      const uniqueRemovedPhotoIds = [...new Set(state.create.removedPhotoIds)];
      for (const id of uniqueRemovedPhotoIds) {
        await pb.collection("photos").delete(id);
      }

      const kenmerkRecords = [];
      for (let i = 0; i < state.create.kenmerken.length; i++) {
        const name = state.create.kenmerken[i];
        const existingId = state.create.kenmerkIds[name];
        if (existingId) {
          await pb.collection("kenmerken").update(existingId, {
            name,
            sort_order: i,
          });
          kenmerkRecords.push({ name, id: existingId });
        } else {
          const record = await pb.collection("kenmerken").create({
            name,
            location: locationId,
            sort_order: i,
          });
          kenmerkRecords.push({ name, id: record.id });
        }
      }

      let uploadCount = 0;
      for (const kenmerk of kenmerkRecords) {
        const photos = state.create.photos[kenmerk.name] || [];
        for (const photo of photos) {
          if (!photo.file) continue;
          await pb.collection("photos").create({
            image: photo.file,
            kenmerk: kenmerk.id,
            location: locationId,
          });
          uploadCount++;
        }
      }

      photosCleanup();
      resetCreate();
      showToast(
        "Locatie bijgewerkt" + (uploadCount ? " met " + uploadCount + " nieuwe foto's" : ""),
        "success"
      );
      state.detailLocationId = locationId;
      showView("detail");
    } catch (err) {
      console.error(err);
      showToast("Opslaan mislukt: " + apiErrorMessage(err, "onbekende fout"), "error");
    } finally {
      btn.disabled = false;
      updateCreateStep2Labels();
    }
  }

  async function loadLocationForEdit(locationId) {
    try {
      const location = await pb.collection("locations").getOne(locationId);
      const kenmerken = await pb.collection("kenmerken").getFullList({
        filter: "location = \"" + locationId + "\"",
        sort: "sort_order",
      });
      const photos = await pb.collection("photos").getFullList({
        filter: "location = \"" + locationId + "\"",
      });

      resetCreate();
      state.editingLocationId = locationId;
      state.create.name = location.name;
      state.create.coordinates = coordinatesFromRecord(location);
      state.create.kenmerken = kenmerken.map((k) => k.name);
      kenmerken.forEach((k) => {
        state.create.kenmerkIds[k.name] = k.id;
        state.create.photos[k.name] = photos
          .filter((p) => relationId(p.kenmerk) === k.id)
          .map((p) => ({
            id: p.id,
            recordId: p.id,
            preview: fileUrl(p, "image", "400x400"),
          }));
      });

      els.locationName.value = location.name;
      setCoordinateInputs(state.create.coordinates);
      renderKenmerkChips();
      showView("createStep1");
    } catch (err) {
      console.error(err);
      showToast("Laden mislukt: " + apiErrorMessage(err, "onbekende fout"), "error");
    }
  }

  function photosCleanup() {
    Object.values(state.create.photos).forEach((arr) => {
      arr.forEach((p) => {
        if (p.preview && p.file) URL.revokeObjectURL(p.preview);
      });
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

      const coords = coordinatesFromRecord(location);
      let coordsHtml = "";
      if (coords) {
        const coordsLabel = formatCoordinate(coords.lat) + ", " + formatCoordinate(coords.lon);
        coordsHtml =
          "<p class=\"detail-coordinates\">" +
          "<a href=\"" + escapeHtml(mapsUrl(coords.lat, coords.lon)) + "\" target=\"_blank\" rel=\"noopener noreferrer\">" +
          escapeHtml(coordsLabel) +
          "</a></p>";
      }

      const header = document.createElement("div");
      header.className = "detail-header";
      header.innerHTML =
        "<h2>" + escapeHtml(location.name) + "</h2>" +
        coordsHtml +
        "<p class=\"detail-meta\">" +
        kenmerken.length + " kenmerk" + (kenmerken.length !== 1 ? "en" : "") +
        " · " + photos.length + " foto" + (photos.length !== 1 ? "'s" : "") +
        "</p>";

      const actions = document.createElement("div");
      actions.className = "detail-actions";
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn btn-primary";
      editBtn.textContent = "Bewerken";
      editBtn.addEventListener("click", () => loadLocationForEdit(locationId));
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "btn btn-secondary";
      deleteBtn.textContent = "Locatie verwijderen";
      deleteBtn.addEventListener("click", () => deleteLocation(locationId, location.name));
      actions.appendChild(editBtn);
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
            const thumbUrl = fileUrl(photo, "image", "100x100");
            const fullUrl = fileUrl(photo, "image");
            const item = document.createElement("div");
            item.className = "detail-photo";
            const img = document.createElement("img");
            img.alt = kenmerk.name;
            img.loading = "lazy";
            img.src = thumbUrl || fullUrl;
            if (thumbUrl && fullUrl && thumbUrl !== fullUrl) {
              img.addEventListener("error", function onThumbError() {
                img.removeEventListener("error", onThumbError);
                img.src = fullUrl;
              });
            }
            item.appendChild(img);
            item.addEventListener("click", () => openLightbox(fullUrl || thumbUrl, kenmerk.name));
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

  els.btnUseGps.addEventListener("click", useCurrentGpsLocation);

  els.formLocationInfo.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = els.locationName.value.trim();
    if (!name) {
      els.locationName.focus();
      return;
    }
    const coordError = syncCoordinatesFromForm();
    if (coordError) {
      els.coordsError.textContent = coordError;
      els.coordsError.classList.remove("hidden");
      return;
    }
    els.coordsError.classList.add("hidden");
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
    if (isEditing()) {
      const locationId = state.editingLocationId;
      photosCleanup();
      resetCreate();
      state.detailLocationId = locationId;
      showView("detail");
    } else {
      photosCleanup();
      resetCreate();
      showView("home");
    }
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
