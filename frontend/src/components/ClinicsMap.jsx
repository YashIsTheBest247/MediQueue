import { useCallback, useEffect, useMemo, useState } from "react";
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

function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, 16, { duration: 0.8 });
  }, [target, map]);
  return null;
}

const DEFAULT_CENTER = [20.5937, 78.9629];

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

async function fetchPois(lat, lng, signal, label) {
  const q =
    `[out:json][timeout:25];(` +
    `node["amenity"~"hospital|clinic|doctors"](around:6000,${lat},${lng});` +
    `way["amenity"~"hospital|clinic|doctors"](around:6000,${lat},${lng});` +
    `);out center 60;`;
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(q),
        signal,
      });
      if (!r.ok) continue;
      const d = await r.json();
      return (d.elements || [])
        .map((e) => {
          const la = e.lat ?? e.center?.lat;
          const lo = e.lon ?? e.center?.lon;
          if (la == null || lo == null) return null;
          return {
            id: e.id,
            lat: la,
            lng: lo,
            name: e.tags?.name || label,
            kind: e.tags?.amenity || "facility",
          };
        })
        .filter(Boolean);
    } catch (err) {
      if (signal.aborted) throw err;
    }
  }
  throw new Error("overpass unavailable");
}

export default function ClinicsMap({ clinics, onView, onRegister, t }) {
  const [pos, setPos] = useState(null);
  const [geoErr, setGeoErr] = useState("");
  const [locating, setLocating] = useState(false);
  const [pois, setPois] = useState([]);
  const [poiStatus, setPoiStatus] = useState("");
  const [search, setSearch] = useState("");
  const [focus, setFocus] = useState(null);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoErr(t("Geolocation isn't supported — showing registered clinics."));
      return;
    }
    setGeoErr("");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos([p.coords.latitude, p.coords.longitude]);
        setLocating(false);
      },
      () => {
        setGeoErr(
          t("Location is off — showing registered clinics. Enable it to see nearby ones.")
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [t]);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  const registered = useMemo(
    () =>
      (clinics || []).filter(
        (c) => typeof c.lat === "number" && typeof c.lng === "number"
      ),
    [clinics]
  );

  const fallbackCenter = useMemo(() => {
    if (registered.length) {
      const la = registered.reduce((s, c) => s + c.lat, 0) / registered.length;
      const lo = registered.reduce((s, c) => s + c.lng, 0) / registered.length;
      return [la, lo];
    }
    return DEFAULT_CENTER;
  }, [registered]);

  const hasRegistered = registered.length > 0;
  const plat = pos ? pos[0] : hasRegistered ? fallbackCenter[0] : null;
  const plng = pos ? pos[1] : hasRegistered ? fallbackCenter[1] : null;

  useEffect(() => {
    if (plat == null || plng == null) {
      setPois([]);
      setPoiStatus("");
      return;
    }
    const ctrl = new AbortController();
    setPoiStatus("loading");
    fetchPois(plat, plng, ctrl.signal, t("Unnamed facility"))
      .then((items) => {
        setPois(items);
        setPoiStatus(items.length ? "" : "empty");
      })
      .catch(() => {
        if (!ctrl.signal.aborted) {
          setPois([]);
          setPoiStatus("error");
        }
      });
    return () => ctrl.abort();
  }, [plat, plng, t]);

  const center = pos || fallbackCenter;

  const results = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    const fromClinics = registered.map((c) => ({
      key: "r" + c.id,
      name: c.name,
      lat: c.lat,
      lng: c.lng,
      tag: c.verified ? t("Verified") : t("Pending"),
    }));
    const fromPois = pois.map((p) => ({
      key: "p" + p.id,
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      tag: t("Nearby"),
    }));
    return [...fromClinics, ...fromPois]
      .filter((x) => x.name.toLowerCase().includes(term))
      .slice(0, 8);
  }, [search, registered, pois, t]);

  return (
    <div className="map-wrap">
      {(poiStatus === "loading" || poiStatus === "error") && (
        <div className={"map-poi-status " + poiStatus}>
          {poiStatus === "loading"
            ? t("Loading nearby places…")
            : t("Couldn't load nearby places — registered clinics still shown.")}
        </div>
      )}
      {!pos && (
        <div className="map-geo-banner">
          <span>
            {geoErr ||
              (locating ? t("Locating you…") : t("Showing registered clinics."))}
          </span>
          <button
            type="button"
            className="map-geo-btn"
            onClick={requestLocation}
            disabled={locating}
          >
            {locating ? t("Locating…") : t("Enable location")}
          </button>
        </div>
      )}
      <div className="map-search">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("Search a clinic or hospital…")}
        />
        {results.length > 0 && (
          <div className="map-results">
            {results.map((r) => (
              <button
                key={r.key}
                onClick={() => {
                  setFocus([r.lat, r.lng]);
                  setSearch("");
                }}
              >
                <span>{r.name}</span>
                <small>{r.tag}</small>
              </button>
            ))}
          </div>
        )}
      </div>

      <MapContainer center={center} zoom={pos ? 13 : 11} className="leaflet-map" scrollWheelZoom>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <Recenter center={pos} />
        <FlyTo target={focus} />

        {pos && (
          <Marker position={pos} icon={userIcon}>
            <Popup>{t("You are here")}</Popup>
          </Marker>
        )}

        {registered.map((c) => (
          <Marker key={"r" + c.id} position={[c.lat, c.lng]} icon={CLINIC_ICON}>
            <Popup>
              <div className="map-pop">
                <strong>{c.name}</strong>
                <span className={"mp-badge " + (c.verified ? "ok" : "pending")}>
                  {c.verified ? t("Verified") : t("Pending verification")}
                </span>
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
                <button
                  className="btn btn-primary mp-join"
                  onClick={() => onRegister(p)}
                >
                  {t("Register this clinic")}
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
