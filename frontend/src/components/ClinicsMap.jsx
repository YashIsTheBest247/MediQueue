import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function pin(color) {
  return L.divIcon({
    className: "mq-pin-wrap",
    html: `<span class="mq-pin" style="--c:${color}"></span>`,
    iconSize: [26, 36],
    iconAnchor: [13, 34],
    popupAnchor: [0, -32],
  });
}

const userIcon = L.divIcon({
  className: "mq-userdot-wrap",
  html: `<span class="mq-userdot"></span>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const CLINIC_ICON = pin("#1b9aaa");
const POI_ICON = pin("#9aa7ab");

function Recenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, 13);
  }, [center, map]);
  return null;
}

export default function ClinicsMap({ clinics, onView, t }) {
  const [pos, setPos] = useState(null);
  const [geoErr, setGeoErr] = useState("");
  const [pois, setPois] = useState([]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoErr(t("Geolocation is not supported by your browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => setPos([p.coords.latitude, p.coords.longitude]),
      () =>
        setGeoErr(
          t("Location access denied. Allow it to see clinics near you.")
        ),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [t]);

  useEffect(() => {
    if (!pos) return;
    const [lat, lng] = pos;
    const q = `[out:json][timeout:20];(node["amenity"~"hospital|clinic|doctors"](around:6000,${lat},${lng});way["amenity"~"hospital|clinic|doctors"](around:6000,${lat},${lng}););out center 60;`;
    let active = true;
    fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(q),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        const items = (d.elements || [])
          .map((e) => {
            const la = e.lat ?? e.center?.lat;
            const lo = e.lon ?? e.center?.lon;
            if (la == null || lo == null) return null;
            return {
              id: e.id,
              lat: la,
              lng: lo,
              name: e.tags?.name || t("Unnamed facility"),
              kind: e.tags?.amenity || "facility",
            };
          })
          .filter(Boolean);
        setPois(items);
      })
      .catch(() => active && setPois([]));
    return () => {
      active = false;
    };
  }, [pos, t]);

  const registered = useMemo(
    () =>
      (clinics || []).filter(
        (c) => typeof c.lat === "number" && typeof c.lng === "number"
      ),
    [clinics]
  );

  if (geoErr && !pos) return <div className="map-msg">{geoErr}</div>;
  if (!pos) return <div className="map-msg">{t("Locating you…")}</div>;

  return (
    <div className="map-wrap">
      <MapContainer center={pos} zoom={13} className="leaflet-map" scrollWheelZoom>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <Recenter center={pos} />

        <Marker position={pos} icon={userIcon}>
          <Popup>{t("You are here")}</Popup>
        </Marker>

        {registered.map((c) => (
          <Marker key={"r" + c.id} position={[c.lat, c.lng]} icon={CLINIC_ICON}>
            <Popup>
              <div className="map-pop">
                <strong>{c.name}</strong>
                <span className="mp-badge ok">{t("Registered")}</span>
                <div className="mp-stats">
                  <span>
                    {t("Now serving")}: {c.current_token ?? "—"}
                  </span>
                  <span>
                    {t("Waiting")}: {c.waiting}
                  </span>
                  <span>
                    {t("Est. wait")}: {c.estimated_wait} min
                  </span>
                </div>
                <button
                  className="btn btn-primary mp-join"
                  onClick={() => onView(c)}
                >
                  {t("View live status")}
                </button>
              </div>
            </Popup>
          </Marker>
        ))}

        {pois.map((p) => (
          <Marker key={"p" + p.id} position={[p.lat, p.lng]} icon={POI_ICON}>
            <Popup>
              <div className="map-pop">
                <strong>{p.name}</strong>
                <span className="mp-badge no">{t("Not on MediQueue")}</span>
                <div className="mp-stats">
                  <span>{t("No live queue — not registered yet.")}</span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
