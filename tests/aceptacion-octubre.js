/* Prueba de aceptación: compara el motor con los resultados esperados de octubre 2026 (sección 9 de la especificación).
 * Uso:
 *   npm install xlsx                     (solo la primera vez)
 *   node tests/aceptacion-octubre.js "Indicadores_SGU_vs_Pais_28-10-2026.xlsx"
 * El archivo de datos NO se guarda en el repositorio (tiene datos de clientes).
 */
const path = require('path');
const E = require(path.join(__dirname, '..', 'public', 'js', 'engine.js'));
function filas(arch) {
  if (/\.json$/i.test(arch)) return null;
  const XLSX = require('xlsx');
  const wb = XLSX.readFile(arch, { cellDates: false });
  return wb.SheetNames.map(n => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null, blankrows: false }));
}
function cargar(loader, hojas) { for (const h of hojas) { try { return loader(h); } catch (e) { /* siguiente hoja */ } } throw new Error('No se encontró la hoja'); }
const args = process.argv.slice(2);
if (!args.length) { console.log('Indique el Excel de octubre (o glpi.json tip.json).'); process.exit(1); }
let g, t;
const hojas = filas(args[0]);
if (hojas) { g = cargar(E.loadGLPI, hojas); t = cargar(E.loadTipif, hojas); }
else { g = E.loadGLPI(require(path.resolve(args[0]))); t = E.loadTipif(require(path.resolve(args[1]))); }
const R=E.compute(g,t,{corte:E.serialFromParts(2026,10,28,10,0,0)});
let pass=0,fail=0;
function chk(name,got,exp){ const ok=String(got)===String(exp); ok?pass++:fail++; console.log((ok?'OK  ':'FAIL')+' '+name+' → '+got+(ok?'':'   (esperado '+exp+')')); }
const G=R.g, L=['pia','otras','sgu','pais'];
chk('GLPI período',R.volumen.glpi,11485);
chk('Volúmenes SGU/PIA/otras/país',[G.sgu.creados,G.pia.creados,G.otras.creados,G.pais.creados].join('/'),'223/61/162/11262');
chk('Tip SGU oct',R.fijos.fcr.den,140); chk('Tip SA fuera',R.controles.tipFuera.sa,97);
chk('IR',`${E.pct(R.fijos.ir.pct)} ${R.fijos.ir.num}/${R.fijos.ir.den}`,'85% 275/323');
chk('FCR',`${E.pct(R.fijos.fcr.pct)} ${R.fijos.fcr.n}/${R.fijos.fcr.den}`,'44% 62/140');
chk('Productividad',[R.fijos.productividad.casos,R.fijos.productividad.abonados,R.fijos.productividad.escalados].join('/'),'140/120/61');
chk('Estatus',R.fijos.estatus,38);
const exp={creSol:['61/57','162/118','223/175','11262/10434'],prom:['4 días 11 h','3 días 21 h','4 días 2 h','2 días 13 h'],moda:['3 días 6 h','1 h','1 h','0 h'],
 semana:['78% 7/9','39% 27/70','43% 34/79','68% 2033/2973'],reinc:['2/4','10/22','22/46','960/2053'],ups:['0·0','1·1','1·1','14·8'],mismo:['33% 3/9','9% 6/70','11% 9/79','26% 768/2973']};
L.forEach((k,i)=>{const x=G[k];
 chk(k+' creados/sol',x.creados+'/'+x.solucionados,exp.creSol[i]);
 chk(k+' promedio',E.fmtD(x.prom),exp.prom[i]);
 chk(k+' moda',x.moda===null?'-':E.fmtD(x.moda),exp.moda[i]);
 chk(k+' cerrados misma semana',`${E.pct(x.semana.pct)} ${x.semana.cerradosMisma}/${x.semana.abiertos}`,exp.semana[i]);
 chk(k+' reincidencia',x.reinc.abonados+'/'+x.reinc.tickets,exp.reinc[i]);
 chk(k+' upgrades·sva',x.upgrades.n+'·'+x.sva.n,exp.ups[i]);
 chk(k+' mismo día',`${E.pct(x.gestion.pct)} ${x.gestion.mismoDia}/${x.gestion.abiertos}`,exp.mismo[i]);
});
const C=R.comparativos;
chk('PIA vs SGU',C.pia_otras.valor+' a favor de '+R.etiquetas[C.pia_otras.ganador],'13 horas a favor de SGU otras unidades');
chk('SGU vs país',C.sgu_pais.valor+' a favor de '+R.etiquetas[C.sgu_pais.ganador],'1 día 13 horas a favor de País');
chk('PIA vs país',C.pia_pais.valor+' a favor de '+R.etiquetas[C.pia_pais.ganador],'1 día 22 horas a favor de País');
const otro=R.tiempoCategoria.find(r=>r.otro); chk('Otro país',otro.pais.texto,'M: 0 h / P: 3 días 5 h');
const wifi=R.productividad.find(r=>r.label==='FTTH > Cambio de clave WiFi'); chk('WiFi país',wifi.pais.creados+'/'+wifi.pais.solucionados,'803/739');
chk('Homologadas',R.controles.homologadas.length,39);
const J=G.sgu.jornada.filas;
chk('Ventana',R.ventana.desde+'-'+R.ventana.hasta,'20/10/2026-27/10/2026');
chk('Día 20/10',J[0].dia,'Martes');
chk('SGU abiertos',J.map(f=>f.abiertos).join(','),'11,6,10,11,4,6,7,24');
chk('SGU resueltos',J.map(f=>f.resueltos).join(','),'11,15,14,15,1,1,6,14');
chk('SGU pend acum',J.map(f=>f.pendAcc).join(','),'11,14,17,20,23,28,31,41');
chk('Gestión SGU',[G.sgu.gestion.abiertos,G.sgu.gestion.resueltos,G.sgu.gestion.cerrados].join('/'),'79/77/74');
chk('Gestión país',[G.pais.gestion.abiertos,G.pais.gestion.resueltos,G.pais.gestion.cerrados].join('/'),'2973/3404/3370');
const paul=R.reincidencia.detalle.find(d=>d.cuenta==='169827'); chk('Paul Torres',paul?paul.nombre.slice(0,12)+' '+paul.tickets.length:'no','PAUL ALBERTO 4');
chk('Rony no aparece',R.reincidencia.detalle.some(d=>/CHACON/.test(d.nombre)),false);
const pc=R.reincidencia.porCategoria; chk('Reinc categorías',['Sin conexión','Ajuste de facturación','Configuración de equipo','Cambio de clave WiFi','Intermitencias','Cambio de plan','Reembolso','Configuración de canales','Visita técnica'].map(k=>pc[k]||0).join(','),'18,11,5,4,3,2,1,1,1');
chk('PIA cambios de plan',G.pia.upgrades.cambiosPlan+'/'+G.pia.upgrades.bajas,'3/3');
chk('SGU upgrade id',G.sgu.upgrades.glpi.join(','),'338 159');
chk('País upgrades desglose',`${G.pais.upgrades.tip} tip + ${G.pais.upgrades.glpi.length} glpi - ${G.pais.upgrades.repetidos}`,'6 tip + 9 glpi - 1');
chk('País SVA desglose',`${G.pais.sva.tip}+${G.pais.sva.glpi.join(',')}`,'7+342 686');
chk('SGU SVA',G.sgu.sva.glpi.join(','),'344 040');
chk('Posible duplicado 333644/649',R.controles.posiblesDuplicados.some(p=>p.ids.join()==='333 644,333 649'),true);
chk('PIA fuera SGU',R.controles.piaFueraSGU.map(x=>x.id).join(','),'340 933');
chk('Totales coinciden',R.controles.totales.every(x=>x.ok),true);
console.log(`\n${pass} OK, ${fail} FAIL`);
process.exitCode = fail ? 1 : 0;
console.log('upgrades país GLPI:',G.pais.upgrades.glpi.join(' | '),' reversiones:',G.pais.upgrades.reversiones.join(','));
console.log('indefinidos:',R.controles.planIndefinido.length);
