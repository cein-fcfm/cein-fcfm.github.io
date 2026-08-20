/* =========================================================
   Reserva Sharktank · lógica de la página
   Lee la disponibilidad del día actual y crea reservas.
   TODA la validación crítica se repite en el servidor
   (Apps Script); esto es solo la capa de interfaz.
   ========================================================= */

const SHARK_API =
  "https://script.google.com/macros/s/AKfycbz3C78WzkwOdKQDcawL5GRQclY9rPlDZ4orv9Sf2eikARb3Ulc8yTWaQ3suU_nL-6S0/exec";

const MAX_SLOTS = 6; // 3 horas = 6 bloques de 30 minutos

let slots = [];              // [{hora, estado}] del día actual
const seleccion = new Set(); // índices seleccionados
let enviando = false;

/* ---------- Validación de RUT chileno (módulo 11) ---------- */
function limpiaRut(r) {
  return String(r || "").replace(/[.\-\s]/g, "").toUpperCase();
}
function rutValido(r) {
  const s = limpiaRut(r);
  if (!/^\d{7,8}[0-9K]$/.test(s)) return false;
  const cuerpo = s.slice(0, -1);
  const dv = s.slice(-1);
  let suma = 0, mul = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const res = 11 - (suma % 11);
  const dvCalc = res === 11 ? "0" : res === 10 ? "K" : String(res);
  return dvCalc === dv;
}
function formateaRut(r) {
  const s = limpiaRut(r);
  if (s.length < 2) return s;
  const cuerpo = s.slice(0, -1);
  const dv = s.slice(-1);
  return cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "-" + dv;
}
// Formatea en vivo mientras se escribe: solo números y K (K solo al final)
function formateaRutVivo(raw) {
  let s = String(raw).toUpperCase().replace(/[^0-9K]/g, ""); // solo dígitos y K
  s = s.replace(/K(?=.)/g, "");                               // K únicamente al final
  s = s.slice(0, 9);                                          // máx 8 dígitos + dígito verificador
  if (s.length < 2) return s;
  const cuerpo = s.slice(0, -1);
  const dv = s.slice(-1);
  return cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "-" + dv;
}

/* ---------- Utilidades de UI ---------- */
const $ = (id) => document.getElementById(id);
function setDia(txt) { $("shark-dia").textContent = txt; }

// Aviso persistente (vive fuera de #shark-content, no se borra al recargar la grilla)
function flash(tipo, html) {
  const el = $("shark-flash");
  if (!el) return;
  el.className = "resultado" + (tipo ? " " + tipo : "");
  el.innerHTML = html || "";
}
function limpiarFlash() { flash("", ""); }

function msg(icon, texto) {
  $("shark-content").innerHTML =
    `<div class="shark-msg"><span class="big" aria-hidden="true">${icon}</span><p>${texto}</p></div>`;
}

/* ---------- Carga de disponibilidad ---------- */
async function cargar() {
  $("shark-content").innerHTML = `
    <div class="shark-skeleton" aria-hidden="true">
      ${Array.from({ length: 6 }).map(() => '<span class="sk"></span>').join("")}
    </div>`;

  try {
    const res = await fetch(SHARK_API + "?tipo=sharktank&cb=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const d = await res.json();

    setDia(d.dia ? d.dia : "—");

    // Fin de semana o día no hábil
    if (!d.esDiaHabil) {
      msg("🗓️", "Hoy no hay reservas disponibles. La sala se reserva de lunes a viernes.");
      return;
    }
    // Reservas deshabilitadas
    if (!d.habilitada) {
      msg("🚫", "No hay horas disponibles en este momento.");
      return;
    }
    slots = Array.isArray(d.slots) ? d.slots : [];
    const hayLibres = slots.some((s) => s.estado === "libre");
    if (!slots.length || !hayLibres) {
      msg("😕", "No hay horas disponibles para hoy. Vuelve a intentarlo más tarde.");
      return;
    }
    seleccion.clear();
    renderReserva();
  } catch (err) {
    console.error("Error al cargar disponibilidad:", err);
    msg("⚠️", "No pudimos cargar los horarios. Revisa tu conexión e intenta de nuevo.");
    $("shark-content").insertAdjacentHTML(
      "beforeend",
      '<div style="text-align:center"><button class="btn btn--ghost" onclick="cargar()">Reintentar</button></div>'
    );
  }
}

/* ---------- Render de la grilla + formulario ---------- */
function renderReserva() {
  // Solo se muestran las horas libres. Se conserva el índice original
  // (data-i) para que el control de "consecutivos" siga siendo correcto:
  // dos horas libres separadas por una ocupada NO son consecutivas.
  const slotsHtml = slots
    .map((s, i) => ({ s, i }))
    .filter((o) => o.s.estado === "libre")
    .map((o) => `<button type="button" class="slot" data-i="${o.i}">${o.s.hora}</button>`)
    .join("");

  $("shark-content").innerHTML = `
    <p style="font-size:.85rem;color:var(--ink-soft);margin:0 0 .8rem;">Cada bloque equivale a <strong>30 minutos</strong>. Selecciona bloques consecutivos (máx. 3 horas).</p>
    <div class="slots-wrap" id="slots-wrap">${slotsHtml}</div>
    <div class="leyenda">
      <span><span class="dot libre"></span> Libre</span>
      <span><span class="dot sel"></span> Seleccionado</span>
    </div>
    <div class="sel-info" id="sel-info"></div>

    <div class="form-datos">
      <div>
        <label for="nombre">Nombre completo *</label>
        <input type="text" id="nombre" placeholder="Tu nombre" autocomplete="name" />
        <div class="campo-error" id="err-nombre"></div>
      </div>
      <div>
        <label for="rut">RUT *</label>
        <input type="text" id="rut" placeholder="12.345.678-9" inputmode="text" />
        <div class="campo-error" id="err-rut"></div>
      </div>
    </div>

    <button type="button" class="btn btn--primary btn-reservar" id="btn-reservar" disabled>Reservar</button>`;

  // Eventos de los slots
  $("slots-wrap").querySelectorAll(".slot:not(:disabled)").forEach((b) => {
    b.addEventListener("click", () => toggleSlot(Number(b.dataset.i), b));
  });

  // Validación de RUT en vivo
  const rutInput = $("rut");
  rutInput.addEventListener("input", () => {
    rutInput.value = formateaRutVivo(rutInput.value); // filtra y da formato al escribir
    validarCampos();
  });
  rutInput.addEventListener("blur", validarCampos);
  $("nombre").addEventListener("input", validarCampos);

  $("btn-reservar").addEventListener("click", enviarReserva);
  actualizarSeleccion();
}

/* ---------- Selección de horarios (consecutivos, máx 3h) ---------- */
function toggleSlot(i, btn) {
  if (seleccion.has(i)) seleccion.delete(i);
  else seleccion.add(i);
  btn.classList.toggle("selected", seleccion.has(i));
  actualizarSeleccion();
}

function estadoSeleccion() {
  const idx = [...seleccion].sort((a, b) => a - b);
  if (idx.length === 0) return { ok: false, vacio: true, msg: "" };
  if (idx.length > MAX_SLOTS)
    return { ok: false, msg: "Máximo 3 horas (6 bloques) por reserva." };
  for (let k = 1; k < idx.length; k++) {
    if (idx[k] !== idx[k - 1] + 1)
      return { ok: false, msg: "Los horarios deben ser consecutivos." };
  }
  const desde = slots[idx[0]].hora;
  const horas = (idx.length * 0.5).toString().replace(".5", "½").replace("0½", "½");
  return { ok: true, msg: `Seleccionado: ${idx.length} bloque(s) · ${horas} h · desde las ${desde}` };
}

function actualizarSeleccion() {
  const info = $("sel-info");
  const st = estadoSeleccion();
  info.textContent = st.msg;
  info.classList.toggle("err", !st.ok && !st.vacio);
  validarCampos();
}

/* ---------- Validación general (habilita el botón) ---------- */
function validarCampos() {
  const nombre = $("nombre") ? $("nombre").value.trim() : "";
  const rut = $("rut") ? $("rut").value.trim() : "";
  const st = estadoSeleccion();

  const errNombre = $("err-nombre");
  const errRut = $("err-rut");
  const rutInput = $("rut");

  if (errNombre) errNombre.textContent = "";
  if (errRut) errRut.textContent = "";
  if (rutInput) rutInput.classList.remove("invalid");

  const rutOk = rut === "" || rutValido(rut);
  if (rut !== "" && !rutOk) {
    if (errRut) errRut.textContent = "RUT no válido.";
    if (rutInput) rutInput.classList.add("invalid");
  }

  const btn = $("btn-reservar");
  if (btn) btn.disabled = !(st.ok && nombre.length > 0 && rut.length > 0 && rutOk && !enviando);
}

/* ---------- Envío de la reserva ---------- */
async function enviarReserva() {
  const nombre = $("nombre").value.trim();
  const rut = $("rut").value.trim();
  const st = estadoSeleccion();
  limpiarFlash();

  // Validaciones finales en cliente (el servidor las repite)
  if (!nombre) { $("err-nombre").textContent = "Ingresa tu nombre."; return; }
  if (!rutValido(rut)) { $("err-rut").textContent = "RUT no válido."; return; }
  if (!st.ok) { $("sel-info").textContent = st.msg || "Selecciona tus horarios."; return; }

  const idx = [...seleccion].sort((a, b) => a - b);
  const horas = idx.map((i) => slots[i].hora);

  enviando = true;
  const btn = $("btn-reservar");
  btn.disabled = true;
  btn.textContent = "Reservando…";

  try {
    // text/plain evita el preflight CORS con Apps Script
    const res = await fetch(SHARK_API, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ nombre, rut, horas }),
    });
    const data = await res.json();

    if (data.ok) {
      await cargar(); // recarga la disponibilidad (reconstruye la grilla)
      // El aviso vive fuera de la grilla, así que persiste tras recargar
      flash(
        "ok",
        `✅ <strong>¡Reserva confirmada!</strong> ${nombre}, tienes la Sharktank el ${data.dia} en: ${horas.join(", ")}. ¡Te esperamos! 🦈`
      );
    } else {
      flash("fail", "⚠️ " + (data.error || "No se pudo completar la reserva."));
    }
  } catch (err) {
    console.error("Error al reservar:", err);
    flash("fail", "⚠️ Error de conexión. Intenta nuevamente.");
  } finally {
    enviando = false;
    if ($("btn-reservar")) {
      $("btn-reservar").textContent = "Reservar";
      validarCampos();
    }
  }
}

document.addEventListener("DOMContentLoaded", cargar);
