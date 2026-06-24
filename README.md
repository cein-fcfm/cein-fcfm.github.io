# CEIN 2026 — Sitio web oficial

Página web del **Centro de Estudiantes de Ingeniería Civil Industrial** de la
Universidad de Chile (FCFM). Construida con HTML, CSS y JavaScript puro: no
necesita instalación ni build, se abre directo en el navegador.

## Estructura

```
cein/
├── index.html        # Estructura de la página (Hero, Recursos, Equipo, Footer)
├── styles.css        # Estilos + paleta del logo (rojo, amarillo, verde, celeste)
├── script.js         # Render del equipo, menú móvil y animaciones
├── assets/
│   └── equipo/       # Coloca aquí las fotos del equipo (opcional)
└── README.md
```

## Cómo verlo

Abre `index.html` con doble clic, o levanta un servidor local:

```bash
cd cein
python3 -m http.server 5500
# luego visita http://localhost:5500
```

## Cómo personalizar

### 1. Enlaces de recursos
En `index.html`, sección `#recursos`, cada tarjeta es un `<a href="#">`.
Reemplaza el `#` por la URL real del formulario / Drive / UCursos correspondiente.

### 2. Equipo
Edita el arreglo `TEAM` en `script.js`. Para mostrar una foto real, pon la ruta
en `photo`, por ejemplo:

```js
{ name: "Isidora Zenteno", role: "Presidencia", photo: "assets/equipo/isidora.jpg" },
```

Si `photo` queda vacío, se muestra automáticamente un avatar con las iniciales.
Tamaño recomendado de fotos: cuadradas (ej. 600×600 px).

### 3. Redes y contacto
Actualiza los enlaces de Instagram, LinkedIn y el correo en el Hero
(`index.html`) y en el footer. El correo está como `cein@ing.uchile.cl`
(cámbialo si corresponde).

### 4. Colores
Todos los colores de marca están centralizados en `:root` dentro de `styles.css`
(`--red`, `--yellow`, `--green`, `--sky`). Cámbialos ahí y se actualiza todo el sitio.

## Notas

- Responsivo (móvil, tablet, escritorio) con menú hamburguesa.
- Accesible: navegación por teclado, `aria-label`, respeta `prefers-reduced-motion`.
- Sin dependencias externas salvo las tipografías de Google Fonts (Poppins / Inter).
