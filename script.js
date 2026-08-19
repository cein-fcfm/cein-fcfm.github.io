/* =========================================================
   CEIN 2026 · Lógica de la página
   ========================================================= */

/* ---- Equipo CEIN 2026 ----
   Los datos llegan desde la hoja "Equipo" del Sheet (data.equipo).
   Si la API todavía no envía el equipo, se usa esta lista de respaldo. */
const TEAM_FALLBACK = [
  { nombre: "Isidora Zenteno",  cargo: "Presidencia" },
  { nombre: "Denisse Godoy",    cargo: "Coordinación" },
  { nombre: "Trinidad Peña",    cargo: "Coordinación" },
  { nombre: "Manuela González", cargo: "Proyectos y Extensión" },
  { nombre: "Maite del Río",    cargo: "GDD" },
  { nombre: "Javier Brito",     cargo: "Bienestar" },
  { nombre: "Alonso Anabalón",  cargo: "Docencia" },
  { nombre: "Javiera Vinaixa",  cargo: "Comunicaciones" },
  { nombre: "Dominic Gajardo",  cargo: "Comunicaciones" },
  { nombre: "José Tomás Muñoz", cargo: "Finanzas" },
  { nombre: "Tomás Báez",       cargo: "Vinculación" },
  { nombre: "Agustín Briceño",  cargo: "Comunidad" },
  { nombre: "Fernanda Young",   cargo: "Comunidad" },
  { nombre: "Benjamín González",cargo: "Deportes" },
];

const AVATAR_COLORS = ["av-red", "av-yellow", "av-green", "av-sky"];

function initials(name) {
  return String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/* Normaliza una fila de la hoja "Equipo" a un objeto uniforme.
   Acepta tanto las claves del Sheet ("Nombre", "URL Imagen"...) como
   variantes en camelCase por si el backend las transforma. */
function normalizeMember(m) {
  const g = (...keys) => {
    for (const k of keys) {
      if (m[k] !== undefined && m[k] !== null && String(m[k]).trim() !== "") return m[k];
    }
    return "";
  };
  return {
    mostrar: g("Mostrar", "mostrar", "Visible", "visible"),
    orden: Number(g("Orden", "orden") || 0),
    imageUrl: g("URL Imagen", "imageUrl", "urlImagen", "foto", "photo"),
    nombre: g("Nombre", "nombre", "name"),
    cargo: g("Cargo", "cargo", "role"),
    textoContacto: g("Texto Contacto", "textoContacto", "contactoTexto"),
    urlContacto: g("URL Contacto", "urlContacto", "contactoUrl"),
  };
}

/* Filtra por "Mostrar" = SI y ordena por "Orden" (si vienen esos campos) */
function prepareTeam(list) {
  const yes = (v) => ["si", "sí", "true", "1", "x", "yes"].includes(String(v).trim().toLowerCase());
  const hasMostrar = list.some((m) => String(m.mostrar).trim() !== "");
  const filtered = hasMostrar ? list.filter((m) => yes(m.mostrar)) : list;
  const hasOrden = filtered.some((m) => m.orden > 0);
  if (hasOrden) filtered.sort((a, b) => (a.orden || 9999) - (b.orden || 9999));
  return filtered;
}

function renderTeam(members) {
  const grid = document.getElementById("team-grid");
  if (!grid) return;

  const source = Array.isArray(members) && members.length ? members : TEAM_FALLBACK;
  const list = prepareTeam(source.map(normalizeMember));

  if (!list.length) {
    grid.innerHTML = `
      <div class="resources-error">
        <span class="re-icon" aria-hidden="true">👥</span>
        <p>Pronto conocerás al equipo CEIN 2026.</p>
      </div>`;
    return;
  }

  grid.innerHTML = list
    .map((m, i) => {
      const colorClass = AVATAR_COLORS[i % AVATAR_COLORS.length];
      const nombre = escapeHtml(m.nombre);
      const cargo = escapeHtml(m.cargo);
      const photo = m.imageUrl
        ? `<img src="${encodeURI(m.imageUrl)}" alt="Foto de ${nombre}, ${cargo}" loading="lazy" onerror="this.remove()" />`
        : "";
      const contact = m.urlContacto
        ? `<a class="member-contact" href="${encodeURI(m.urlContacto)}" target="_blank" rel="noopener">${escapeHtml(m.textoContacto || "Contacto")} →</a>`
        : "";

      return `
        <article class="member-card reveal">
          <div class="member-photo ${colorClass}">
            ${photo}
            <span aria-hidden="true">${initials(m.nombre)}</span>
          </div>
          <div class="member-body">
            <h3 class="member-name">${nombre}</h3>
            <span class="member-role">${cargo}</span>
            ${contact}
          </div>
        </article>`;
    })
    .join("");

  initReveal();
}

/* =========================================================
   Contenido dinámico · API única (Google Apps Script)
   El endpoint devuelve un objeto: { recursos: [...], noticias: [...] }
   Un solo fetch alimenta las dos secciones.
   ========================================================= */
const CONTENT_API =
  "https://script.google.com/macros/s/AKfycbz3C78WzkwOdKQDcawL5GRQclY9rPlDZ4orv9Sf2eikARb3Ulc8yTWaQ3suU_nL-6S0/exec";

// Colores institucionales en orden cíclico: Rojo, Celeste, Verde, Amarillo
const RESOURCE_ACCENTS = ["accent-red", "accent-sky", "accent-green", "accent-yellow"];

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ---- Estado: cargando (skeletons) ---- */
function renderResourcesLoading(grid, count = 6) {
  grid.setAttribute("aria-busy", "true");
  grid.innerHTML = Array.from({ length: count })
    .map(
      () => `
      <div class="resource-card skeleton-card" aria-hidden="true">
        <span class="sk sk-icon"></span>
        <span class="sk sk-line sk-title"></span>
        <span class="sk sk-line"></span>
        <span class="sk sk-line sk-short"></span>
        <span class="sk sk-line sk-cta"></span>
      </div>`
    )
    .join("");
}

/* ---- Estado: error ---- */
function renderResourcesError(grid) {
  grid.setAttribute("aria-busy", "false");
  grid.innerHTML = `
    <div class="resources-error" role="alert">
      <span class="re-icon" aria-hidden="true">⚠️</span>
      <p>No pudimos cargar los recursos en este momento.</p>
      <button type="button" class="btn btn--ghost" id="resources-retry">Reintentar</button>
    </div>`;
  const retry = document.getElementById("resources-retry");
  if (retry) retry.addEventListener("click", loadContent);
}

/* ---- Estado: con datos ---- */
function renderResources(grid, items) {
  grid.setAttribute("aria-busy", "false");

  if (!Array.isArray(items) || items.length === 0) {
    grid.innerHTML = `
      <div class="resources-error">
        <span class="re-icon" aria-hidden="true">📭</span>
        <p>Aún no hay recursos publicados. ¡Vuelve pronto!</p>
      </div>`;
    return;
  }

  grid.innerHTML = items
    .map((item, index) => {
      const accent = RESOURCE_ACCENTS[index % 4]; // color cíclico por índice
      const titulo = escapeHtml(item.titulo);
      const descripcion = escapeHtml(item.descripcion);
      const cta = escapeHtml(item.textoCta || "Acceder");
      const url = encodeURI(item.urlDestino || "#");
      // Si la imagen falla al cargar, se oculta su contenedor automáticamente
      const media = item.imageUrl
        ? `<span class="rc-media" aria-hidden="true"><img src="${encodeURI(item.imageUrl)}" alt="" loading="lazy" onerror="this.closest('.rc-media').remove()" /></span>`
        : "";

      return `
        <a class="resource-card reveal ${accent}" href="${url}" target="_blank" rel="noopener">
          ${media}
          <h3 class="rc-title">${titulo}</h3>
          <p class="rc-desc">${descripcion}</p>
          <span class="rc-link">${cta} →</span>
        </a>`;
    })
    .join("");

  initReveal(); // anima las tarjetas recién insertadas
}


/* =========================================================
   Últimas Noticias · Renderizado
   Los datos llegan desde la API única (data.noticias) vía loadContent().
   Campos esperados: id, imageUrl, fecha, titulo, resumen, urlDestino
   ========================================================= */
// Mismos colores institucionales y orden cíclico que en recursos
const NEWS_ACCENTS = ["accent-red", "accent-sky", "accent-green", "accent-yellow"];

function formatNewsDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d)) return escapeHtml(value); // si no es fecha válida, muestra el texto tal cual
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
}

/* ---- Estado: cargando (skeletons) ---- */
function renderNewsLoading(grid, count = 3) {
  grid.setAttribute("aria-busy", "true");
  grid.innerHTML = Array.from({ length: count })
    .map(
      () => `
      <div class="news-card skeleton-card" aria-hidden="true">
        <span class="sk sk-news-media"></span>
        <span class="news-body">
          <span class="sk sk-line sk-short"></span>
          <span class="sk sk-line sk-title"></span>
          <span class="sk sk-line"></span>
          <span class="sk sk-line sk-short"></span>
          <span class="sk sk-line sk-cta"></span>
        </span>
      </div>`
    )
    .join("");
}

/* ---- Estado: error ---- */
function renderNewsError(grid) {
  grid.setAttribute("aria-busy", "false");
  grid.innerHTML = `
    <div class="resources-error" role="alert">
      <span class="re-icon" aria-hidden="true">⚠️</span>
      <p>No pudimos cargar las noticias en este momento.</p>
      <button type="button" class="btn btn--ghost" id="news-retry">Reintentar</button>
    </div>`;
  const retry = document.getElementById("news-retry");
  if (retry) retry.addEventListener("click", loadContent);
}

/* ---- Estado: con datos ---- */
function renderNews(grid, items) {
  grid.setAttribute("aria-busy", "false");

  if (!Array.isArray(items) || items.length === 0) {
    grid.innerHTML = `
      <div class="resources-error">
        <span class="re-icon" aria-hidden="true">📰</span>
        <p>Aún no hay noticias publicadas. ¡Vuelve pronto!</p>
      </div>`;
    // Sin noticias: oculta flechas y puntos del carrusel
    if (newsTimer) clearInterval(newsTimer);
    const prev = document.getElementById("news-prev");
    const next = document.getElementById("news-next");
    const dots = document.getElementById("news-dots");
    if (prev) prev.hidden = true;
    if (next) next.hidden = true;
    if (dots) { dots.innerHTML = ""; dots.style.display = "none"; }
    return;
  }

  grid.innerHTML = items
    .map((item, index) => {
      const accent = NEWS_ACCENTS[index % 4]; // color cíclico por índice
      const titulo = escapeHtml(item.titulo);
      const resumen = escapeHtml(item.resumen);
      const fecha = formatNewsDate(item.fecha);
      const url = encodeURI(item.urlDestino || "#");
      const media = item.imageUrl
        ? `<img src="${encodeURI(item.imageUrl)}" alt="" loading="lazy" onerror="this.style.display='none'" />`
        : "";

      return `
        <article class="news-card ${accent}">
          <a class="news-media" href="${url}" target="_blank" rel="noopener" aria-hidden="true" tabindex="-1">
            ${media}
          </a>
          <div class="news-body">
            ${fecha ? `<span class="news-date">${fecha}</span>` : ""}
            <h3 class="news-title"><a href="${url}" target="_blank" rel="noopener">${titulo}</a></h3>
            <p class="news-summary">${resumen}</p>
            <a class="news-link" href="${url}" target="_blank" rel="noopener">Leer más →</a>
          </div>
        </article>`;
    })
    .join("");

  initNewsCarousel(items.length); // activa el carrusel y la auto-rotación
}

/* ---- Carrusel de noticias (flechas, puntos y auto-rotación) ---- */
let newsTimer = null;

function initNewsCarousel(count) {
  const track = document.getElementById("news-grid");
  const prev = document.getElementById("news-prev");
  const next = document.getElementById("news-next");
  const dotsWrap = document.getElementById("news-dots");
  if (!track) return;

  if (newsTimer) clearInterval(newsTimer);
  if (dotsWrap) dotsWrap.innerHTML = "";

  const cards = track.querySelectorAll(".news-card");
  // Cuántas tarjetas se ven a la vez (según el ancho disponible)
  const perView = Math.max(1, Math.round(track.clientWidth / (cards[0]?.offsetWidth || 1)));
  const needsCarousel = count > perView;

  // Muestra/oculta flechas
  if (prev) prev.hidden = !needsCarousel;
  if (next) next.hidden = !needsCarousel;
  if (dotsWrap) dotsWrap.style.display = needsCarousel ? "flex" : "none";

  if (!needsCarousel) return;

  const pages = Math.max(1, count - perView + 1);
  const stepWidth = () => (cards[0]?.offsetWidth || 0) + 26; // ancho tarjeta + gap (1.6rem ≈ 26px)

  // Construye los puntos (uno por posición)
  const dots = [];
  if (dotsWrap) {
    for (let i = 0; i < pages; i++) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.setAttribute("role", "tab");
      dot.setAttribute("aria-label", `Ir a noticia ${i + 1}`);
      dot.addEventListener("click", () => goTo(i));
      dotsWrap.appendChild(dot);
      dots.push(dot);
    }
  }

  let index = 0;
  const clamp = (i) => (i + pages) % pages; // rota de forma circular

  function syncDots() {
    dots.forEach((d, i) => d.classList.toggle("is-active", i === index));
  }
  function goTo(i) {
    index = clamp(i);
    track.scrollTo({ left: index * stepWidth(), behavior: "smooth" });
    syncDots();
  }
  function nextSlide() { goTo(index + 1); }
  function prevSlide() { goTo(index - 1); }

  if (next) next.onclick = () => { nextSlide(); restart(); };
  if (prev) prev.onclick = () => { prevSlide(); restart(); };

  // Sincroniza los puntos si el usuario desliza manualmente
  let scrollRaf;
  track.onscroll = () => {
    cancelAnimationFrame(scrollRaf);
    scrollRaf = requestAnimationFrame(() => {
      index = clamp(Math.round(track.scrollLeft / stepWidth()));
      syncDots();
    });
  };

  // Auto-rotación cada 5 s; se pausa al pasar el mouse o enfocar
  function start() { newsTimer = setInterval(nextSlide, 5000); }
  function stop() { clearInterval(newsTimer); }
  function restart() { stop(); start(); }

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduce) {
    start();
    track.addEventListener("mouseenter", stop);
    track.addEventListener("mouseleave", start);
    track.addEventListener("focusin", stop);
    track.addEventListener("focusout", start);
  }

  syncDots();
}

/* =========================================================
   Carga unificada · un solo fetch para Recursos + Noticias
   La API responde { recursos: [...], noticias: [...] }.
   El loading y el manejo de error cubren ambas secciones a la vez.
   ========================================================= */
async function loadContent() {
  const resourcesGrid = document.getElementById("resources-grid");
  const newsGrid = document.getElementById("news-grid");
  if (!resourcesGrid && !newsGrid) return;

  // Estado de carga simultáneo en ambas secciones
  if (resourcesGrid) renderResourcesLoading(resourcesGrid);
  if (newsGrid) renderNewsLoading(newsGrid);

  try {
    // cache-buster + no-store: evita que el navegador sirva una respuesta vieja de la API
    const url = CONTENT_API + (CONTENT_API.includes("?") ? "&" : "?") + "cb=" + Date.now();
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Extrae cada arreglo del objeto único
    const recursos = Array.isArray(data?.recursos) ? data.recursos : [];
    const noticias = Array.isArray(data?.noticias) ? data.noticias : [];
    const equipo = Array.isArray(data?.equipo) ? data.equipo : [];

    if (resourcesGrid) renderResources(resourcesGrid, recursos);
    if (newsGrid) renderNews(newsGrid, noticias);
    if (equipo.length) renderTeam(equipo); // si la hoja "Equipo" ya viene, reemplaza el respaldo
  } catch (err) {
    console.error("Error al cargar el contenido:", err);
    // El error cubre ambas secciones, ya que dependen del mismo fetch
    if (resourcesGrid) renderResourcesError(resourcesGrid);
    if (newsGrid) renderNewsError(newsGrid);
  }
}

/* ---- Menú móvil ---- */
function initNav() {
  const toggle = document.querySelector(".nav-toggle");
  const menu = document.getElementById("nav-menu");
  if (!toggle || !menu) return;

  toggle.addEventListener("click", () => {
    const open = menu.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
  });

  // Cerrar al hacer clic en un enlace
  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      menu.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

/* ---- Animación al hacer scroll ---- */
function initReveal() {
  const items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window) || !items.length) {
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  items.forEach((el) => io.observe(el));
}

/* ---- Init ---- */
document.addEventListener("DOMContentLoaded", () => {
  renderTeam();
  initNav();
  loadContent();   // un solo fetch alimenta Recursos y Noticias
  initReveal();

  // Recalcula el carrusel (tarjetas por vista) al cambiar el tamaño
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const track = document.getElementById("news-grid");
      const cards = track ? track.querySelectorAll(".news-card").length : 0;
      if (cards) initNewsCarousel(cards);
    }, 200);
  });

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
});
