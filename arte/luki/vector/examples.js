// Ejemplos de control: importar el SVG inline o cargarlo como <object>.
const capa = (svg, id) => svg.getElementById(id);
export function saludar(svg) { capa(svg, 'luki-arm-right')?.animate([{transform:'rotate(0deg)'},{transform:'rotate(-20deg)'},{transform:'rotate(0deg)'}], {duration:900, iterations:3}); }
export function respirar(svg) { capa(svg, 'luki-body')?.animate([{transform:'scale(1)'},{transform:'scale(1.025)'},{transform:'scale(1)'}], {duration:3500, iterations:Infinity, easing:'ease-in-out'}); }
export function bailar(svg) { capa(svg, 'luki-root')?.animate([{transform:'rotate(-3deg) translateY(0)'},{transform:'rotate(3deg) translateY(-8px)'},{transform:'rotate(-3deg) translateY(0)'}], {duration:1100, iterations:4, easing:'ease-in-out'}); }
export function parpadear(svg) { ['luki-eyelid-left','luki-eyelid-right'].forEach((id,i) => capa(svg,id)?.animate([{transform:'scaleY(1)'},{transform:'scaleY(.08)'},{transform:'scaleY(1)'}], {duration:180, delay:i*35})); }
