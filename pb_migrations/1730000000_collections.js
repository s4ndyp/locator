/// <reference path="../pb_data/types.d.ts" />
migrate(
  (db) => {
    const dao = new Dao(db);

  const locations = new Collection({
    name: "locations",
    type: "base",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
    fields: [
      {
        id: "fld_loc_name",
        name: "name",
        type: "text",
        required: true,
        presentable: true,
        options: { min: 1, max: 200, pattern: "" },
      },
    ],
    indexes: [],
  });

  dao.saveCollection(locations);

  const kenmerken = new Collection({
    name: "kenmerken",
    type: "base",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
    fields: [
      {
        id: "fld_ken_name",
        name: "name",
        type: "text",
        required: true,
        presentable: true,
        options: { min: 1, max: 200, pattern: "" },
      },
      {
        id: "fld_ken_location",
        name: "location",
        type: "relation",
        required: true,
        options: {
          collectionId: locations.id,
          cascadeDelete: true,
          minSelect: null,
          maxSelect: 1,
          displayFields: ["name"],
        },
      },
      {
        id: "fld_ken_sort",
        name: "sort_order",
        type: "number",
        required: false,
        options: { min: null, max: null, noDecimal: true },
      },
    ],
    indexes: [],
  });

  dao.saveCollection(kenmerken);

  const photos = new Collection({
    name: "photos",
    type: "base",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
    fields: [
      {
        id: "fld_photo_image",
        name: "image",
        type: "file",
        required: true,
        options: {
          maxSelect: 1,
          maxSize: 10485760,
          mimeTypes: [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
            "image/heic",
            "image/heif",
          ],
          thumbs: ["100x100", "400x400"],
        },
      },
      {
        id: "fld_photo_kenmerk",
        name: "kenmerk",
        type: "relation",
        required: true,
        options: {
          collectionId: kenmerken.id,
          cascadeDelete: true,
          minSelect: null,
          maxSelect: 1,
          displayFields: ["name"],
        },
      },
      {
        id: "fld_photo_location",
        name: "location",
        type: "relation",
        required: true,
        options: {
          collectionId: locations.id,
          cascadeDelete: true,
          minSelect: null,
          maxSelect: 1,
          displayFields: ["name"],
        },
      },
    ],
    indexes: [],
  });

  dao.saveCollection(photos);
  },
  (db) => {
    const dao = new Dao(db);

    const photos = dao.findCollectionByNameOrId("photos");
    if (photos) dao.deleteCollection(photos);

    const kenmerken = dao.findCollectionByNameOrId("kenmerken");
    if (kenmerken) dao.deleteCollection(kenmerken);

    const locations = dao.findCollectionByNameOrId("locations");
    if (locations) dao.deleteCollection(locations);
  }
);
