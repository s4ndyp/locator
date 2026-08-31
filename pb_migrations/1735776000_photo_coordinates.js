migrate(
  (app) => {
    const photos = app.findCollectionByNameOrId("photos");
    if (!photos) return;

    photos.fields.add(
      new GeoPointField({
        name: "coordinates",
        required: false,
      })
    );

    app.save(photos);
  },
  (app) => {
    const photos = app.findCollectionByNameOrId("photos");
    if (!photos) return;

    photos.fields.removeByName("coordinates");
    app.save(photos);
  }
);
