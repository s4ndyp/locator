migrate(
  (app) => {
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
          name: "name",
          type: "text",
          required: true,
          presentable: true,
          min: 1,
          max: 200,
        },
      ],
      indexes: [],
    });

    app.save(locations);

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
          name: "name",
          type: "text",
          required: true,
          presentable: true,
          min: 1,
          max: 200,
        },
        {
          name: "location",
          type: "relation",
          required: true,
          collectionId: locations.id,
          cascadeDelete: true,
          maxSelect: 1,
          displayFields: ["name"],
        },
        {
          name: "sort_order",
          type: "number",
          required: false,
          noDecimal: true,
        },
      ],
      indexes: [],
    });

    app.save(kenmerken);

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
          name: "image",
          type: "file",
          required: true,
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
        {
          name: "kenmerk",
          type: "relation",
          required: true,
          collectionId: kenmerken.id,
          cascadeDelete: true,
          maxSelect: 1,
          displayFields: ["name"],
        },
        {
          name: "location",
          type: "relation",
          required: true,
          collectionId: locations.id,
          cascadeDelete: true,
          maxSelect: 1,
          displayFields: ["name"],
        },
      ],
      indexes: [],
    });

    app.save(photos);
  },
  (app) => {
    const photos = app.findCollectionByNameOrId("photos");
    if (photos) app.delete(photos);

    const kenmerken = app.findCollectionByNameOrId("kenmerken");
    if (kenmerken) app.delete(kenmerken);

    const locations = app.findCollectionByNameOrId("locations");
    if (locations) app.delete(locations);
  }
);
