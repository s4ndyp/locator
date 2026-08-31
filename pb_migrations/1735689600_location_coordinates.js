migrate(
  (app) => {
    const locations = app.findCollectionByNameOrId("locations");
    if (!locations) return;

    locations.fields.add(
      new GeoPointField({
        name: "coordinates",
        required: false,
      })
    );

    app.save(locations);
  },
  (app) => {
    const locations = app.findCollectionByNameOrId("locations");
    if (!locations) return;

    locations.fields.removeByName("coordinates");
    app.save(locations);
  }
);
