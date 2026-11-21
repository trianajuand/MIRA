# MIRA – prototipo

Comunicador por parpadeo voluntario. Aplicación web que corre completa en el navegador, sin instalación ni servidor propio.

## Estructura del código

| Archivo | Responsabilidad |
|---|---|
| `index.html` | Estructura de la página |
| `css/styles.css` | Estilos de la interfaz |
| `js/util.js` | Funciones de apoyo (mediana, distancia de edición, normalización de texto) |
| `js/config.js` | Configuración, distribuciones del teclado, frases y estado compartido |
| `js/audio.js` | Tonos de confirmación y síntesis de voz |
| `js/registro.js` | Registro de eventos, resultados y exportación a CSV |
| `js/teclado.js` | Teclado en pantalla, acciones de cada casilla y barrido fila–columna |
| `js/detector.js` | Máquina de estados del parpadeo, cámara, cálculo del EAR y calibración |
| `js/pruebas.js` | Pruebas de validación A, B y C |
| `js/main.js` | Gráfica, indicadores, bucle principal y eventos de la interfaz |
| `iniciar.bat` | Arranca un servidor local y abre el navegador (Windows) |
| `docs/protocolo_validacion.md` | Guion de sesión, criterios de éxito y límites de la validación |
| `docs/declaracion_ia.md` | Declaración de uso de inteligencia artificial generativa |

Los scripts se cargan en ese orden desde `index.html` y comparten el estado definido en `config.js`.

## Qué incluye

- **Principal:** calibración individual y detección del parpadeo voluntario por duración del cierre (EAR sobre MediaPipe Face Landmarker).
- **Complementaria 1:** teclado de barrido fila–columna ordenado por frecuencia del español, con Borrar y salida por voz.
- **Complementaria 2:** frases rápidas («Tengo dolor», «Necesito ayuda», «Sí», «No»…).
- **Instrumento de validación:** pruebas A, B y C con exportación a CSV.

Fuera de alcance: predicción de palabras, aprendizaje de uso, versión de escritorio, pruebas con pacientes.

## Cómo ejecutarlo

La cámara solo funciona desde `localhost` o desde un sitio HTTPS; no abran el archivo con doble clic.

**En un computador propio (Windows)**

Doble clic en `iniciar.bat`. Abre el navegador en `http://localhost:8765` y deja una ventana negra abierta, que debe seguir abierta mientras se usa. Requiere Python instalado.

De forma manual, desde esta carpeta:

```bash
python -m http.server 8765
```

Luego abrir `http://localhost:8765` en Chrome o Edge.

**Para compartir con participantes:** subir la carpeta completa (`index.html`, `css/` y `js/`) a un repositorio de GitHub y activar GitHub Pages (Settings → Pages → rama `main`). El enlace resultante es HTTPS.

La primera vez se descarga el modelo facial (unos 4 MB), así que se necesita internet en ese momento. El video se procesa en el computador: no se graba ni se envía.

## Uso

1. **Activar cámara** y aceptar el permiso. Rostro a 40–70 cm, luz de frente, sin contraluz.
2. **Calibrar:** 15 s con ojos abiertos; al tono grave, cerrar los ojos hasta oír el tono agudo.
3. El barrido inicia solo. Para elegir, mantener los ojos cerrados hasta oír el tono (500 ms por defecto). Primero se elige la fila y luego la casilla.
4. Si se eligió una fila por error, basta esperar dos vueltas y el barrido regresa a las filas.

En **Ajustes** se cambian el tiempo de cierre, la velocidad del barrido, la duración de la calibración y la distribución del teclado (por frecuencia de uso o alfabético). La distribución usada queda en la columna `teclado` del CSV, para comparar ambas con el mismo mensaje.

**Modo simulado** (Ajustes): la barra espaciadora hace de párpado. Sirve para ensayar la interfaz y como respaldo si la cámara falla en la sustentación. Sus resultados quedan marcados como `simulado`.

## Protocolo de validación sugerido

Por cada participante, escribir su código (P01, P02…) en la pestaña **Pruebas**. No registrar nombres.

| Hipótesis | Prueba | Qué reportar |
|---|---|---|
| H3 (calibración por un cuidador) | Pedir a una persona ajena al equipo que active la cámara y calibre sin ayuda. Cada intento queda registrado. | Tasa de éxito, duración, número de intentos |
| H1 (falsos positivos) | **A. Reposo**, 3 minutos | Falsos positivos por minuto, parpadeos espontáneos descartados |
| H1 (sensibilidad) | **B. Cierres pautados**, 20 cierres | Detectados / pedidos, falsos positivos |
| H2 y utilidad cotidiana | **C. Mensaje cotidiano** con MIRA y luego con el tablero de cartón, mismos mensajes | Segundos por mensaje y palabras por minuto, MIRA frente a tablero |

Para la prueba C conviene usar al menos una frase rápida («Tengo dolor») y una palabra deletreada («AGUA»), después de 3–5 minutos de práctica.

Al terminar, **Exportar resultados (CSV)**. El archivo usa punto y coma y abre directo en Excel. Los resultados se guardan en el navegador hasta que se borren; exporten antes de cambiar de computador.

## Limitaciones conocidas

- Las pruebas son con personas sin discapacidad que simulan el uso; no equivalen a una validación con pacientes.
- La detección se degrada con contraluz, poca luz y reflejos en los lentes.
- El umbral se fija una vez en la calibración; si la persona cambia de postura o de luz, hay que recalibrar.
- La voz depende de las voces en español instaladas en el sistema.
- Las selecciones hechas con el ratón durante la prueba C quedan marcadas como `clic` y no deben contarse como parpadeo.

## Tecnologías

MediaPipe Tasks Vision 0.10.14 (Face Landmarker), Web Speech API (voz), Web Audio API (tonos), JavaScript sin dependencias adicionales.
