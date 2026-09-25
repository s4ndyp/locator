/**
 * Locatie Foto's — PocketBase frontend
 */
(function () {
  "use strict";

  const pb = new PocketBase(window.location.origin);
  const state = {
    view: "list",
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
    editEntry: null,
    detailLocationId: null,
    geolocationPermission: "unknown",
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
    btnFabNewLocation: document.getElementById("btn-fab-new-location"),
    btnLocationList: document.getElementById("btn-location-list"),
    btnEditLocation: document.getElementById("btn-edit-location"),
    btnDeleteLocation: document.getElementById("btn-delete-location"),
    btnEmptyNew: document.getElementById("btn-empty-new"),
    formLocationInfo: document.getElementById("form-location-info"),
    locationName: document.getElementById("location-name"),
    btnUseGps: document.getElementById("btn-use-gps"),
    coordsPermission: document.getElementById("coords-permission"),
    coordsPermissionText: document.getElementById("coords-permission-text"),
    btnRequestLocation: document.getElementById("btn-request-location"),
    coordsStatus: document.getElementById("coords-status"),
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
    lightboxTrack: document.getElementById("lightbox-track"),
    lightboxImg: document.getElementById("lightbox-img"),
    lightboxPrev: document.querySelector("#lightbox-track [data-slot='prev']"),
    lightboxNext: document.querySelector("#lightbox-track [data-slot='next']"),
    lightboxCaption: document.getElementById("lightbox-caption"),
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
  let geolocationPermissionListenerAttached = false;

  function showView(name) {
    if (name === "home") name = "list";
    state.view = name;
    Object.values(views).forEach((v) => v.classList.remove("active"));
    const key =
      name === "createStep1" || name === "createStep2" ? name : name;
    if (views[key]) views[key].classList.add("active");

    els.pageTitle.textContent =
      (isEditing() && (name === "createStep1" ? titles.editStep1 : name === "createStep2" ? titles.editStep2 : null)) ||
      titles[name] ||
      "Locatie Foto's";
    els.btnBack.classList.toggle("hidden", name === "home" || name === "list");
    els.btnFabNewLocation.classList.toggle("hidden", name !== "list");

    if (name === "list") loadLocationList();
    if (name === "detail" && state.detailLocationId) loadLocationDetail(state.detailLocationId);
    if (name === "createStep2") updateCreateStep2Labels();
    if (name === "createStep1") {
      updateCreateStep1Labels();
      updateLocationPermissionUI();
    }
  }

  function updateCreateStep1Labels() {
    const submitBtn = els.formLocationInfo.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.textContent = isEditing()
        ? "Volgende: foto's bewerken"
        : "Volgende: foto's toevoegen";
    }
    els.btnDeleteLocation.classList.toggle("hidden", !isEditing());
  }

  function updateCreateStep2Labels() {
    els.btnSaveLocation.textContent = isEditing() ? "Wijzigingen opslaan" : "Locatie opslaan";
    els.btnCancelCreate.textContent = isEditing() ? "Annuleren" : "Annuleren";
    els.btnEditLocation.classList.toggle("hidden", !isEditing());
  }

  function goBack() {
    switch (state.view) {
      case "createStep1":
        if (isEditing() && state.editEntry === "photos") {
          buildKenmerkPhotoSections();
          showView("createStep2");
        } else if (isEditing()) {
          const locationId = state.editingLocationId;
          photosCleanup();
          resetCreate();
          state.detailLocationId = locationId;
          showView("detail");
        } else {
          resetCreate();
          showView("list");
        }
        break;
      case "createStep2":
        if (isEditing() && state.editEntry === "photos") {
          photosCleanup();
          resetCreate();
          showView("list");
        } else {
          showView("createStep1");
        }
        break;
      case "detail":
        showView("list");
        break;
      default:
        showView("list");
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
    state.editEntry = null;
    els.locationName.value = "";
    showCoordinateStatus(null);
    els.kenmerkInput.value = "";
    els.kenmerkList.innerHTML = "";
    els.kenmerkError.classList.add("hidden");
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

  function showCoordinateStatus(coordinates) {
    if (!els.coordsStatus) return;
    if (!coordinates) {
      els.coordsStatus.textContent = "";
      els.coordsStatus.classList.add("hidden");
      return;
    }
    els.coordsStatus.textContent =
      formatCoordinate(coordinates.lat) + ", " + formatCoordinate(coordinates.lon);
    els.coordsStatus.classList.remove("hidden");
  }

  function coordinatesFromRecord(record) {
    if (!record || !record.coordinates) return null;
    return normalizeGpsCoords(record.coordinates.lat, record.coordinates.lon);
  }

  function normalizeGpsCoords(lat, lon) {
    const latitude = Number(lat);
    const longitude = Number(lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (latitude === 0 && longitude === 0) return null;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
    return { lat: latitude, lon: longitude };
  }

  function buildLocationPayload() {
    const payload = { name: state.create.name };
    const coords = state.create.coordinates;
    payload.coordinates = coords ? { lat: coords.lat, lon: coords.lon } : null;
    return payload;
  }

  function mapsUrl(lat, lon) {
    return "https://www.google.com/maps?q=" + encodeURIComponent(lat + "," + lon);
  }

  function osmEmbedUrl(lat, lon) {
    const delta = 0.008;
    const bbox = [
      lon - delta,
      lat - delta,
      lon + delta,
      lat + delta,
    ].join(",");
    return (
      "https://www.openstreetmap.org/export/embed.html?bbox=" +
      encodeURIComponent(bbox) +
      "&layer=mapnik&marker=" +
      encodeURIComponent(lat + "," + lon)
    );
  }

  function buildDetailMap(coords, options) {
    const opts = options || {};
    const compact = !!opts.compact;
    const linkSuffix = opts.linkSuffix || " · Open in Google Maps";

    const wrapper = document.createElement("div");
    wrapper.className = "detail-map" + (compact ? " detail-map-compact" : "");

    const iframe = document.createElement("iframe");
    iframe.src = osmEmbedUrl(coords.lat, coords.lon);
    iframe.title = opts.title || "Kaart van locatie";
    iframe.loading = "lazy";
    iframe.referrerPolicy = "no-referrer-when-downgrade";
    iframe.setAttribute("allowfullscreen", "");
    wrapper.appendChild(iframe);

    const coordsLabel = formatCoordinate(coords.lat) + ", " + formatCoordinate(coords.lon);
    const link = document.createElement("p");
    link.className = "detail-coordinates";
    link.innerHTML =
      "<a href=\"" + escapeHtml(mapsUrl(coords.lat, coords.lon)) + "\" target=\"_blank\" rel=\"noopener noreferrer\">" +
      escapeHtml(coordsLabel + linkSuffix) +
      "</a>";
    wrapper.appendChild(link);

    return wrapper;
  }

  async function createPhoto(photo, kenmerkId, locationId) {
    return pb.collection("photos").create({
      image: photo.file,
      kenmerk: kenmerkId,
      location: locationId,
    });
  }

  function sortPhotosByCreated(photoList) {
    return photoList.slice().sort((a, b) => String(a.created).localeCompare(String(b.created)));
  }

  function resetGpsButton(btn) {
    if (!btn) return;
    btn.disabled = false;
    const label = btn.querySelector("span");
    if (label) label.textContent = "GPS";
  }

  function setGpsButtonLoading(btn, loading) {
    if (!btn) return;
    btn.disabled = loading;
    const label = btn.querySelector("span");
    if (label) label.textContent = loading ? "..." : "GPS";
  }

  function applyGeolocationCoords(position) {
    const coords = {
      lat: position.coords.latitude,
      lon: position.coords.longitude,
    };
    state.create.coordinates = coords;
    showCoordinateStatus(coords);
    state.geolocationPermission = "granted";
    updateLocationPermissionUI();
    showToast("GPS-coördinaten toegevoegd", "success");
  }

  function geolocationErrorMessage(error) {
    if (!error) return "Kon GPS-locatie niet ophalen";
    if (error.code === error.PERMISSION_DENIED) {
      state.geolocationPermission = "denied";
      updateLocationPermissionUI();
      return "Locatietoegang geweigerd. Gebruik de knop hierboven of zet locatie aan in je browserinstellingen.";
    }
    if (error.code === error.TIMEOUT) {
      return "GPS-locatie ophalen duurde te lang. Probeer het opnieuw.";
    }
    if (error.code === error.POSITION_UNAVAILABLE) {
      return "GPS-signaal niet beschikbaar. Controleer of locatie op je telefoon aan staat.";
    }
    return "Kon GPS-locatie niet ophalen";
  }

  function requestGpsLocation(triggerBtn) {
    if (!window.isSecureContext) {
      state.geolocationPermission = "insecure";
      updateLocationPermissionUI();
      showToast("Locatie werkt alleen via HTTPS. Open de site met https://", "error");
      return;
    }

    if (!navigator.geolocation) {
      showToast("GPS wordt niet ondersteund op dit apparaat", "error");
      return;
    }

    setGpsButtonLoading(triggerBtn || els.btnUseGps, true);
    if (els.btnRequestLocation) els.btnRequestLocation.disabled = true;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        applyGeolocationCoords(position);
        resetGpsButton(triggerBtn || els.btnUseGps);
        if (els.btnRequestLocation) els.btnRequestLocation.disabled = false;
      },
      (error) => {
        showToast(geolocationErrorMessage(error), "error");
        resetGpsButton(triggerBtn || els.btnUseGps);
        if (els.btnRequestLocation) els.btnRequestLocation.disabled = false;
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    );
  }

  async function updateLocationPermissionUI() {
    const panel = els.coordsPermission;
    const text = els.coordsPermissionText;
    const requestBtn = els.btnRequestLocation;
    if (!panel || !text) return;

    if (!window.isSecureContext) {
      panel.classList.remove("hidden");
      text.textContent =
        "Je browser staat locatie alleen toe via een beveiligde verbinding (HTTPS). Open deze site met https:// in plaats van http://.";
      if (requestBtn) requestBtn.classList.add("hidden");
      if (els.btnUseGps) els.btnUseGps.disabled = true;
      return;
    }

    if (els.btnUseGps) els.btnUseGps.disabled = false;

    if (!navigator.geolocation) {
      panel.classList.add("hidden");
      return;
    }

    if (!navigator.permissions || !navigator.permissions.query) {
      panel.classList.remove("hidden");
      if (requestBtn) requestBtn.classList.remove("hidden");
      text.textContent =
        "Tik op Locatie toestaan. Je browser vraagt dan om toestemming om je GPS-coördinaten te gebruiken.";
      return;
    }

    try {
      const result = await navigator.permissions.query({ name: "geolocation" });
      state.geolocationPermission = result.state;

      if (!geolocationPermissionListenerAttached) {
        result.onchange = () => updateLocationPermissionUI();
        geolocationPermissionListenerAttached = true;
      }

      if (result.state === "granted") {
        panel.classList.add("hidden");
        return;
      }

      panel.classList.remove("hidden");

      if (result.state === "prompt") {
        if (requestBtn) requestBtn.classList.remove("hidden");
        text.textContent =
          "Tik op Locatie toestaan. Je browser toont dan een venster waarin je toegang tot je locatie kunt geven.";
        return;
      }

      if (requestBtn) requestBtn.classList.add("hidden");
      text.textContent =
        "Locatietoegang is geblokkeerd voor deze website. Open de instellingen van je browser, zoek deze site en zet locatie op Toestaan. Vernieuw daarna de pagina.";
    } catch (err) {
      panel.classList.remove("hidden");
      if (requestBtn) requestBtn.classList.remove("hidden");
      text.textContent =
        "Tik op Locatie toestaan. Je browser vraagt dan om toestemming om je GPS-coördinaten te gebruiken.";
    }
  }

  function useCurrentGpsLocation() {
    requestGpsLocation(els.btnUseGps);
  }

  const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"];
  const ALL_FILE_ACCEPT =
    "image/*,application/pdf,video/*,audio/*,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip";
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
    if (options.capture) {
      input.accept = "image/*";
      input.setAttribute("capture", options.capture);
    } else {
      input.accept = ALL_FILE_ACCEPT;
    }
    if (options.multiple) input.multiple = true;
    return input;
  }

  function bindPhotoFileInput(input, kenmerkName) {
    input.addEventListener("change", () => {
      handleFiles(kenmerkName, input.files);
      input.value = "";
    });
  }
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

      const addAction = document.createElement("label");
      addAction.className = "upload-action upload-action-add";
      addAction.innerHTML =
        "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">" +
        "<line x1=\"12\" y1=\"5\" x2=\"12\" y2=\"19\"/>" +
        "<line x1=\"5\" y1=\"12\" x2=\"19\" y2=\"12\"/>" +
        "</svg>" +
        "<span>Toevoegen</span>";
      const addInput = createPhotoFileInput({ multiple: true });
      addAction.appendChild(addInput);
      bindPhotoFileInput(addInput, kenmerkName);

      actions.appendChild(cameraAction);
      actions.appendChild(addAction);

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
    const pending = [];
    let skipped = 0;

    incoming.forEach((raw) => {
      const file = normalizeImageFile(raw);
      if (file) {
        pending.push({ raw, file });
      } else {
        skipped++;
      }
    });

    if (!pending.length) {
      if (incoming.length) {
        showToast("Geen geldige afbeeldingen geselecteerd (PNG, JPG, WebP, GIF)", "error");
      }
      return;
    }

    if (skipped) {
      showToast(skipped + " bestand(en) overgeslagen (geen geldige afbeelding)", "error");
    }

    if (!state.create.photos[kenmerkName]) state.create.photos[kenmerkName] = [];

    pending.forEach(({ file }) => {
      state.create.photos[kenmerkName].push({
        id: uniqueId(),
        file: file,
        preview: URL.createObjectURL(file),
      });
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
          await createPhoto(photo, kenmerk.id, location.id);
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
          await createPhoto(photo, kenmerk.id, locationId);
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

  async function loadLocationForEdit(locationId, options) {
    const openPhotos = !!(options && options.openPhotos);
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
      state.editEntry = openPhotos ? "photos" : "detail";
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
      showCoordinateStatus(state.create.coordinates);
      renderKenmerkChips();
      if (openPhotos) {
        buildKenmerkPhotoSections();
        showView("createStep2");
      } else {
        showView("createStep1");
      }
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

        bindLocationCardPress(card, {
          onTap: () => {
            state.detailLocationId = loc.id;
            showView("detail");
          },
          onLongPress: () => loadLocationForEdit(loc.id, { openPhotos: true }),
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

      if (coords) {
        els.detailContent.appendChild(buildDetailMap(coords));
      }

      if (kenmerken.length === 0) {
        const empty = document.createElement("p");
        empty.className = "form-hint";
        empty.style.textAlign = "center";
        empty.textContent = "Geen kenmerken voor deze locatie.";
        els.detailContent.appendChild(empty);
      }

      const gallery = [];

      for (const kenmerk of kenmerken) {
        const kenmerkPhotos = sortPhotosByCreated(
          photos.filter((p) => relationId(p.kenmerk) === kenmerk.id)
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
            const src = fullUrl || thumbUrl;
            if (src) {
              const index = gallery.length;
              gallery.push({ src: src, alt: kenmerk.name });
              item.addEventListener("click", () => openLightbox(gallery, index));
            }
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
      }

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
      photosCleanup();
      resetCreate();
      showToast("Locatie verwijderd", "success");
      state.detailLocationId = null;
      showView("list");
    } catch (err) {
      console.error(err);
      showToast("Verwijderen mislukt: " + apiErrorMessage(err, "onbekende fout"), "error");
    }
  }

  let lightboxPhotos = [];
  let lightboxIndex = 0;
  let lightboxDrag = null;
  let lightboxIgnoreClick = false;
  let lightboxTrackX = 0;
  let lightboxAnimating = false;
  let lightboxSettleDelta = 0;
  let lightboxSettleId = 0;

  function bindLocationCardPress(card, actions) {
    const duration = 500;
    let timer = null;
    let startX = 0;
    let startY = 0;
    let longFired = false;
    let ignoreClickUntil = 0;

    function clearTimer() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      card.classList.remove("is-holding");
    }

    card.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      longFired = false;
      startX = e.clientX;
      startY = e.clientY;
      card.classList.add("is-holding");
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        longFired = true;
        ignoreClickUntil = Date.now() + 800;
        card.classList.remove("is-holding");
        actions.onLongPress();
      }, duration);
    });

    card.addEventListener("pointermove", (e) => {
      if (!timer) return;
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > 12) clearTimer();
    });

    card.addEventListener("pointerup", clearTimer);
    card.addEventListener("pointercancel", clearTimer);
    card.addEventListener("pointerleave", () => {
      if (timer) clearTimer();
    });

    card.addEventListener("click", (e) => {
      if (longFired || Date.now() < ignoreClickUntil) {
        e.preventDefault();
        longFired = false;
        return;
      }
      actions.onTap();
    });

    card.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });
  }

  function lightboxPhotoAt(offset) {
    const index = lightboxIndex + offset;
    if (index < 0 || index >= lightboxPhotos.length) return null;
    return lightboxPhotos[index];
  }

  function lightboxSpan() {
    const gap = parseFloat(getComputedStyle(els.lightboxTrack).getPropertyValue("--lightbox-gap"));
    return (els.lightbox.clientWidth || window.innerWidth) + (Number.isFinite(gap) ? gap : 20);
  }

  function setLightboxSlide(img, photo) {
    if (!img) return;
    if (!photo || !photo.src) {
      img.classList.add("is-empty");
      img.removeAttribute("src");
      img.alt = "";
      return;
    }
    img.classList.remove("is-empty");
    if (img.getAttribute("src") !== photo.src) img.src = photo.src;
    img.alt = photo.alt || "";
  }

  function renderLightboxSlides() {
    setLightboxSlide(els.lightboxPrev, lightboxPhotoAt(-1));
    setLightboxSlide(els.lightboxImg, lightboxPhotoAt(0));
    setLightboxSlide(els.lightboxNext, lightboxPhotoAt(1));
    const photo = lightboxPhotoAt(0);
    if (els.lightboxCaption && photo) {
      const position = lightboxIndex + 1 + " / " + lightboxPhotos.length;
      els.lightboxCaption.textContent = photo.alt ? photo.alt + " · " + position : position;
    }
  }

  function lightboxMoveDuration(distance) {
    return Math.round(Math.min(340, Math.max(180, Math.abs(distance) * 0.45)));
  }

  function setLightboxTrack(x, animate) {
    const previous = lightboxTrackX;
    lightboxTrackX = x;
    if (!animate) {
      els.lightboxTrack.style.transition = "none";
    } else {
      els.lightboxTrack.style.transition =
        "transform " + lightboxMoveDuration(x - previous) + "ms cubic-bezier(0.22, 1, 0.36, 1)";
    }
    els.lightboxTrack.style.transform = "translate3d(" + Math.round(x) + "px, 0, 0)";
  }

  function finishLightboxSettle(id) {
    if (id !== lightboxSettleId) return;
    lightboxSettleId += 1;
    const delta = lightboxSettleDelta;
    lightboxSettleDelta = 0;
    lightboxAnimating = false;
    if (delta) lightboxIndex += delta;
    els.lightboxTrack.style.transition = "none";
    lightboxTrackX = 0;
    els.lightboxTrack.style.transform = "translate3d(0, 0, 0)";
    renderLightboxSlides();
  }

  function settleLightbox(x, delta) {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || Math.abs(x - lightboxTrackX) < 1) {
      lightboxSettleDelta = delta;
      lightboxSettleId += 1;
      finishLightboxSettle(lightboxSettleId);
      return;
    }
    lightboxAnimating = true;
    lightboxSettleDelta = delta;
    const id = ++lightboxSettleId;
    const ms = lightboxMoveDuration(x - lightboxTrackX);
    setLightboxTrack(x, true);
    window.setTimeout(() => finishLightboxSettle(id), ms + 40);
    els.lightboxTrack.addEventListener("transitionend", function onEnd(event) {
      if (event.target !== els.lightboxTrack || event.propertyName !== "transform") return;
      els.lightboxTrack.removeEventListener("transitionend", onEnd);
      finishLightboxSettle(id);
    });
  }

  function stepLightbox(delta) {
    if (lightboxAnimating || !delta) return false;
    const next = lightboxIndex + delta;
    if (next < 0 || next >= lightboxPhotos.length) return false;
    const distance = lightboxSpan();
    settleLightbox(delta > 0 ? -distance : distance, delta);
    return true;
  }

  function openLightbox(photos, index) {
    lightboxPhotos = photos || [];
    if (!lightboxPhotos.length) return;
    lightboxIndex = Math.max(0, Math.min(index || 0, lightboxPhotos.length - 1));
    lightboxDrag = null;
    lightboxAnimating = false;
    lightboxSettleDelta = 0;
    lightboxSettleId += 1;
    renderLightboxSlides();
    setLightboxTrack(0, false);
    els.lightbox.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    lightboxDrag = null;
    lightboxIgnoreClick = false;
    lightboxAnimating = false;
    lightboxSettleDelta = 0;
    lightboxSettleId += 1;
    setLightboxTrack(0, false);
    els.lightbox.classList.add("hidden");
    setLightboxSlide(els.lightboxPrev, null);
    setLightboxSlide(els.lightboxImg, null);
    setLightboxSlide(els.lightboxNext, null);
    if (els.lightboxCaption) els.lightboxCaption.textContent = "";
    document.body.style.overflow = "";
  }

  function onLightboxPointerDown(e) {
    if (els.lightbox.classList.contains("hidden") || lightboxAnimating) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.target.closest(".lightbox-close")) return;
    lightboxDrag = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      t: e.timeStamp,
      axis: "",
    };
  }

  function onLightboxPointerMove(e) {
    if (!lightboxDrag || e.pointerId !== lightboxDrag.id) return;
    const dx = e.clientX - lightboxDrag.x;
    const dy = e.clientY - lightboxDrag.y;
    if (!lightboxDrag.axis) {
      if (Math.hypot(dx, dy) < 8) return;
      lightboxDrag.axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
    }
    if (lightboxDrag.axis !== "x") return;
    const atStart = lightboxIndex <= 0 && dx > 0;
    const atEnd = lightboxIndex >= lightboxPhotos.length - 1 && dx < 0;
    setLightboxTrack(atStart || atEnd ? dx * 0.32 : dx, false);
  }

  function onLightboxPointerUp(e) {
    if (!lightboxDrag || e.pointerId !== lightboxDrag.id) return;
    const dx = e.clientX - lightboxDrag.x;
    const dy = e.clientY - lightboxDrag.y;
    const elapsed = Math.max(e.timeStamp - lightboxDrag.t, 16);
    const horizontal = lightboxDrag.axis === "x";
    lightboxDrag = null;
    if (!horizontal) {
      setLightboxTrack(0, false);
      return;
    }
    lightboxIgnoreClick = true;
    const span = lightboxSpan();
    const flicked = Math.abs(dx) > 18 && Math.abs(dx) / elapsed > 0.45 && Math.abs(dx) > Math.abs(dy);
    const passed = Math.abs(dx) > span * 0.18 && Math.abs(dx) > Math.abs(dy);
    const goNext = dx < 0 && lightboxIndex < lightboxPhotos.length - 1;
    const goPrev = dx > 0 && lightboxIndex > 0;
    if ((flicked || passed) && goNext) {
      settleLightbox(-span, 1);
      return;
    }
    if ((flicked || passed) && goPrev) {
      settleLightbox(span, -1);
      return;
    }
    settleLightbox(0, 0);
  }

  /* Events */
  els.btnBack.addEventListener("click", goBack);
  els.btnNewLocation.addEventListener("click", () => {
    resetCreate();
    showView("createStep1");
  });
  els.btnFabNewLocation.addEventListener("click", () => {
    resetCreate();
    showView("createStep1");
  });
  els.btnEditLocation.addEventListener("click", () => showView("createStep1"));
  els.btnDeleteLocation.addEventListener("click", () => {
    if (!state.editingLocationId) return;
    deleteLocation(state.editingLocationId, state.create.name || els.locationName.value.trim());
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
  els.btnRequestLocation.addEventListener("click", () => requestGpsLocation(els.btnRequestLocation));

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
    if (isEditing()) {
      const locationId = state.editingLocationId;
      const entry = state.editEntry;
      photosCleanup();
      resetCreate();
      if (entry === "photos") {
        showView("list");
      } else {
        state.detailLocationId = locationId;
        showView("detail");
      }
    } else {
      photosCleanup();
      resetCreate();
      showView("list");
    }
  });

  els.lightbox.querySelector(".lightbox-close").addEventListener("click", closeLightbox);
  els.lightbox.addEventListener("click", (e) => {
    if (lightboxIgnoreClick) {
      lightboxIgnoreClick = false;
      return;
    }
    if (e.target === els.lightbox) closeLightbox();
  });
  els.lightbox.addEventListener("pointerdown", onLightboxPointerDown);
  els.lightbox.addEventListener("pointermove", onLightboxPointerMove);
  els.lightbox.addEventListener("pointerup", onLightboxPointerUp);
  els.lightbox.addEventListener("pointercancel", () => {
    if (!lightboxDrag) return;
    lightboxDrag = null;
    settleLightbox(0, 0);
  });
  document.addEventListener("keydown", (e) => {
    if (els.lightbox.classList.contains("hidden")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") stepLightbox(-1);
    if (e.key === "ArrowRight") stepLightbox(1);
  });

  showView("list");
})();
