/* eslint-disable */
/* wordgen.js — generación de los anexos Word del Modo 2 con docx-js.
   Corre igual en Node (verificación) y en el navegador (paritas).
   La imagen del embudo se pasa como Uint8Array (canvas en browser, placeholder en Node). */
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, AlignmentType, ImageRun } from "docx";

  const ARIAL = "Arial";
  const NAVY = "1F4E79", CELESTE = "B4C6E7";

  /* ---------- formato de números (idéntico al pipeline LATAM) ---------- */
  function fmtNum(v){ if(v===null||v===undefined||isNaN(v)) return "-";
    return Number(v).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function fmtPct(v){ if(v===null||v===undefined||isNaN(v)) return "-";
    return (Number(v)*100).toFixed(2).replace('.',',')+'%'; }
  const hp = pt => pt*2; // half-points

  /* ---------- helpers de celda ---------- */
  function run(text, {bold=false, size=8, color=null}={}){
    return new TextRun({ text: text==null?"":String(text), bold, size:hp(size), font:ARIAL, color:color||undefined });
  }
  function para(text, {bold=false, size=8, align=AlignmentType.LEFT, color=null}={}){
    return new Paragraph({ alignment:align, spacing:{after:0,before:0},
      children:[ run(text,{bold,size,color}) ] });
  }
  function bord(top,bottom){ // top/bottom: 'single'|'double'|null
    const mk = s => s ? {style:(s==='double'?BorderStyle.DOUBLE:BorderStyle.SINGLE), size:4, color:"auto"}
                      : {style:BorderStyle.NONE};
    return { top:mk(top), bottom:mk(bottom), left:{style:BorderStyle.NONE},
             right:{style:BorderStyle.NONE}, insideHorizontal:{style:BorderStyle.NONE},
             insideVertical:{style:BorderStyle.NONE} };
  }
  function cell(children, {span=1, fill=null, borders=null, widthPct=null, align=AlignmentType.LEFT}={}){
    const opts = { children: Array.isArray(children)?children:[children] };
    if(span>1) opts.columnSpan = span;
    if(fill) opts.shading = { fill, type:ShadingType.CLEAR, color:"auto" };
    if(borders) opts.borders = borders;
    if(widthPct!=null) opts.width = { size:widthPct, type:WidthType.PERCENTAGE };
    return new TableCell(opts);
  }
  function tbl(rows, {grid=false, widthPct=100}={}){
    const o = { rows, width:{size:widthPct, type:WidthType.PERCENTAGE} };
    if(grid) o.borders = undefined; // Table Grid se emula con bordes por celda cuando hace falta
    return new Table(o);
  }
  const MARGINS = { top:1417, bottom:1417, left:1701, right:1701 }; // 2.5cm / 3cm en twips

  function doc(children){
    return new Document({ sections:[{ properties:{ page:{ margin:MARGINS } }, children }] });
  }

  /* ================= 1. ESTADOS FINANCIEROS DE COMPARABLES ================= */
  function estadosFinancieros(dataByRic, pliByRic, aceptadasRics, yearsDesc, opt={}){
    const yearsFin = yearsDesc.slice(0,3);
    const NA = "n.a.";
    const F = {V:"Revenue from Goods & Services",C:"Cost of Revenues - Total",
      S:"Selling General & Administrative Expenses - Total",AR:"AccountsReceivable",
      AP:"AccountsPayable",INV:"Inventories"};
    const children = [];
    let iEmp = 0;
    const dataRow = (v,{bold=false,isPct=false,label,borders=null})=>{
      const cells=[ cell(para(label,{bold,size:8}), {widthPct:46, borders}) ];
      v.forEach(val=>{
        const txt = (val==null||isNaN(val)) ? NA : (isPct?fmtPct(val):fmtNum(val));
        cells.push(cell(para(txt,{bold,size:8,align:AlignmentType.RIGHT}),{widthPct:18,borders}));
      });
      return new TableRow({children:cells});
    };
    const emptyRow=(top,bottom,ncol)=> new TableRow({children:
      Array.from({length:ncol},()=>cell(para(""),{borders:bord(top,bottom)}))});
    const titleRow=(label,top,bottom,ncol)=> new TableRow({children:
      [cell(para(label,{bold:true}),{borders:bord(top,bottom)})].concat(
        Array.from({length:ncol-1},()=>cell(para(""),{borders:bord(top,bottom)})))});

    aceptadasRics.forEach(ric=>{
      const dr = dataByRic[ric]; if(!dr) return;
      const anios = yearsFin.filter(y=>{ const v=dr[y]&&dr[y].V; return v!=null && !isNaN(v); }).sort((a,b)=>a-b);
      if(!anios.length) return;
      const ncol = 1+anios.length;
      const g = k => anios.map(y=> (dr[y]? dr[y][k] : NaN));
      const ventas=g('V'), cogs=g('C'), sga=g('S');
      const ub = ventas.map((v,i)=> (v==null||isNaN(v)||cogs[i]==null||isNaN(cogs[i]))?NaN:v-cogs[i]);
      const uo = ventas.map((v,i)=> (v==null||isNaN(v)||cogs[i]==null||isNaN(cogs[i])||sga[i]==null||isNaN(sga[i]))?NaN:v-cogs[i]-sga[i]);
      const nombre = (dr.nombre||ric).toUpperCase();

      if(iEmp>0) children.push(new Paragraph({children:[new TextRun("")]})); // separador
      const rows=[];
      rows.push(new TableRow({children:[ cell(para(nombre,{bold:true}),{span:ncol,borders:bord('single',null)}) ]}));
      rows.push(emptyRow(null,'double',ncol)); // separador bajo el nombre
      // header fechas
      const hcells=[ cell(para("Fin del Ejercicio Fiscal",{bold:true}),{widthPct:46}) ];
      anios.forEach(y=> hcells.push(cell(para("31/12/"+String(y).slice(-2),{bold:true,align:AlignmentType.CENTER}),{widthPct:18})));
      rows.push(new TableRow({children:hcells}));
      rows.push(titleRow("Del Estado de Resultados",'single','single',ncol));
      rows.push(dataRow(ventas,{label:"Ventas"}));
      rows.push(dataRow(cogs,{label:"Costo Directo"}));
      rows.push(dataRow(ub,{label:"Resultado Bruto",bold:true}));
      rows.push(dataRow(sga,{label:"Gastos Operativos"}));
      rows.push(dataRow(uo,{label:"Resultado Operativo",bold:true}));
      // indicador de rentabilidad (no ajustado) del PLI principal
      const pr = pliByRic[ric];
      if(pr && opt.pliNombre){
        rows.push(emptyRow(null,'single',ncol));
        rows.push(titleRow("Indicadores de Rentabilidad",'single','single',ncol));
        const vpli = anios.map(y=> pr[opt.pliNombre] ? pr[opt.pliNombre][y] : NaN);
        rows.push(dataRow(vpli,{label:opt.pliNombre,isPct:true}));
      }
      children.push(tbl(rows));
      iEmp++;
    });
    if(!children.length) children.push(para("Sin empresas aceptadas."));
    return doc(children);
  }

  /* ================= 2. TESTED PARTY ================= */
  function testedParty(tp, opt={}){
    const { nombre="PARTE ANALIZADA", pliNombre="", pliValor=NaN,
            esServicios=false, hacerAjuste=false, years=[] } = opt;
    const yearsAsc = years.slice().sort((a,b)=>a-b);
    const yLast = yearsAsc[yearsAsc.length-1];
    const t = y => tp[y]||{};
    const V=t(yLast).V, C=t(yLast).C, S=t(yLast).S;
    const ub = (V==null||isNaN(V)||C==null||isNaN(C))?NaN:V-C;
    const uo = (isNaN(ub)||S==null||isNaN(S))?NaN:ub-S;
    const avg = k => { const xs=yearsAsc.map(y=>t(y)[k]).filter(x=>x!=null&&!isNaN(x)); return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:NaN; };
    const ccAvg=avg('AR'), cpAvg=avg('AP'), invAvg=avg('INV');
    const NCOL = (hacerAjuste && yearsAsc.length)? 1+yearsAsc.length : 2;
    const rows=[];
    const single=(label,val,{bold=false,isPct=false,top=null,bottom=null}={})=>{
      const cells=[ cell(para(label,{bold}),{borders:bord(top,bottom)}) ];
      for(let j=1;j<NCOL-1;j++) cells.push(cell(para(""),{borders:bord(top,bottom)}));
      const txt=(val==null||isNaN(val))?"":(isPct?fmtPct(val):fmtNum(val));
      cells.push(cell(para(txt,{bold,align:AlignmentType.RIGHT}),{borders:bord(top,bottom)}));
      rows.push(new TableRow({children:cells}));
    };
    const multi=(label,dict,{bold=false,isPct=false}={})=>{
      const cells=[ cell(para(label,{bold})) ];
      yearsAsc.forEach(y=>{ const val=dict?dict[y]:NaN; const txt=(val==null||isNaN(val))?"":(isPct?fmtPct(val):fmtNum(val));
        cells.push(cell(para(txt,{bold,align:AlignmentType.RIGHT}))); });
      rows.push(new TableRow({children:cells}));
    };
    const title=(label,top,bottom)=>{ const cells=[cell(para(label,{bold:true}),{borders:bord(top,bottom)})];
      for(let j=1;j<NCOL;j++) cells.push(cell(para(""),{borders:bord(top,bottom)}));
      rows.push(new TableRow({children:cells})); };
    const empty=(top,bottom)=> rows.push(new TableRow({children:
      Array.from({length:NCOL},()=>cell(para(""),{borders:bord(top,bottom)}))}));

    rows.push(new TableRow({children:[cell(para(nombre.toUpperCase(),{bold:true}),{span:NCOL,borders:bord('single',null)})]}));
    rows.push(new TableRow({children:[cell(para("(cifras expresadas en $)"),{span:NCOL,borders:bord(null,'single')})]}));
    // header años
    const hc=[cell(para("Fin del Ejercicio Fiscal",{bold:true}),{borders:bord(null,'single')})];
    if(hacerAjuste && yearsAsc.length){ yearsAsc.forEach(y=> hc.push(cell(para("31/12/"+String(y).slice(-4),{bold:true,align:AlignmentType.RIGHT}),{borders:bord(null,'single')}))); }
    else { for(let j=1;j<NCOL-1;j++) hc.push(cell(para(""),{borders:bord(null,'single')}));
      hc.push(cell(para("31/12/"+String(yLast).slice(-2),{bold:true,align:AlignmentType.RIGHT}),{borders:bord(null,'single')})); }
    rows.push(new TableRow({children:hc}));

    title("Del Estado de Resultados",'single','single');
    single("Ventas",V);
    single("Costo Directo",C);
    single("Resultado Bruto",ub,{bold:true});
    single("Gastos Operativos",S);
    single("Resultado Operativo",uo,{bold:true});

    if(hacerAjuste && yearsAsc.length){
      empty(null,'single'); title("Activos Relevantes",null,'single');
      multi("Cuentas a Cobrar", Object.fromEntries(yearsAsc.map(y=>[y,t(y).AR])));
      if(!esServicios) multi("Inventarios", Object.fromEntries(yearsAsc.map(y=>[y,t(y).INV])));
      empty(null,'single'); title("Pasivos Relevantes",null,'single');
      multi("Cuentas a pagar", Object.fromEntries(yearsAsc.map(y=>[y,t(y).AP])));
      empty(null,'single'); title("Promedios de Activos y Pasivos Relevantes",null,'single');
      single("Cuentas a Cobrar",ccAvg);
      if(!esServicios) single("Inventarios",invAvg);
      single("Cuentas a pagar",cpAvg);
      empty(null,'single'); title("Porcentaje sobre Ventas",null,'single');
      single("Cuentas a Cobrar", (V&&!isNaN(V))?ccAvg/V:NaN, {isPct:true});
      if(!esServicios) single("Inventarios",(V&&!isNaN(V))?invAvg/V:NaN,{isPct:true});
      single("Cuentas a pagar",(V&&!isNaN(V))?cpAvg/V:NaN,{isPct:true});
    }
    empty(null,'single'); title("Indicadores de Rentabilidad",'single','single');
    single(pliNombre,pliValor,{isPct:true});
    rows.push(new TableRow({children:[cell(para("Fuente: Estados Contables Auditados de la Compañía"),{span:NCOL,borders:bord('single',null)})]}));
    return doc([ tbl(rows) ]);
  }

  /* ================= 3. DESCRIPCIÓN DE ACEPTADAS ================= */
  function descripcion(mrRows){
    const acc = mrRows.filter(r=> ["si","sí","s","yes"].includes(String(r["Aceptada (Si/No)"]||"").trim().toLowerCase()));
    const rows=[];
    acc.forEach(r=>{
      const nombre = String(r["Empresa"] ?? r["RIC"] ?? "");
      let desc = r["Descripcion de Negocio"]; desc = (desc==null||String(desc).toLowerCase()==="nan")?"":String(desc);
      rows.push(new TableRow({children:[ cell(para(nombre,{bold:true,size:10}),{fill:CELESTE,borders:bord('single','single')}) ]}));
      rows.push(new TableRow({children:[ cell(para(desc,{size:9}),{borders:bord(null,'single')}) ]}));
    });
    if(!rows.length) return doc([para("Sin empresas aceptadas.")]);
    return doc([ tbl(rows,{grid:true}) ]);
  }

  /* ================= 4. LISTADO DE ACEPTADAS ================= */
  function listado(mrRows){
    const acc = mrRows.filter(r=> ["si","sí","s","yes"].includes(String(r["Aceptada (Si/No)"]||"").trim().toLowerCase()));
    const rows=[ new TableRow({children:[
      cell(para("Compañía",{bold:true,size:10,color:"FFFFFF"}),{fill:NAVY,widthPct:75,borders:bord('single','single')}),
      cell(para("RIC",{bold:true,size:10,color:"FFFFFF"}),{fill:NAVY,widthPct:25,borders:bord('single','single')}) ]}) ];
    acc.forEach((r,i)=>{
      const fill = (i%2===1)?CELESTE:null;
      rows.push(new TableRow({children:[
        cell(para(String(r["Empresa"]??r["RIC"]??""),{size:9}),{fill,widthPct:75,borders:bord(null,'single')}),
        cell(para(String(r["RIC"]??""),{size:9}),{fill,widthPct:25,borders:bord(null,'single')}) ]}));
    });
    if(acc.length===0) return doc([para("Sin empresas aceptadas.")]);
    return doc([ tbl(rows,{grid:true}) ]);
  }

  /* ================= 5. RECHAZOS (+ embudo) ================= */
  function construirEmbudo(analisis, mrRows){
    if(!analisis || !analisis.length) return [];
    const cols = Object.keys(analisis[0]);
    const pasa = (r,c)=> String(r[c]||"").trim().toUpperCase()==="PASA";
    const total = analisis.length;
    const stages=[["Universo evaluado", total]];
    let mask = analisis.map(()=>true);
    const applyStage=(col,label)=>{ mask = analisis.map((r,i)=> mask[i] && pasa(r,col));
      stages.push([label, mask.filter(Boolean).length]); };
    if(cols.includes("Subsidiaria")) applyStage("Subsidiaria","Empresas independientes");
    const infoCol = cols.find(c=> c.includes("nformacion Insuficiente")||c.includes("nformación Insuficiente"));
    if(infoCol) applyStage(infoCol,"Con información suficiente");
    const brutoCol = cols.find(c=> c.includes("Resultado Bruto"));
    if(brutoCol) applyStage(brutoCol,"Sin pérdidas brutas recurrentes");
    const intensCols = cols.filter(c=> c.includes(">") && c.includes("%"));
    if(intensCols.length){ intensCols.forEach(c=>{ mask = analisis.map((r,i)=> mask[i] && pasa(r,c)); });
      stages.push(["Pasan filtros de intensidad", mask.filter(Boolean).length]); }
    let nAcc=0;
    if(mrRows){ nAcc = mrRows.filter(r=> ["si","sí","s","yes"].includes(String(r["Aceptada (Si/No)"]||"").trim().toLowerCase())).length; }
    stages.push(["Aceptadas (revisión cualitativa)", nAcc]);
    return stages;
  }
  function limpiarTexto(v){ if(v==null) return ""; const s=String(v).trim();
    return ["nan","none","<na>","null"].includes(s.toLowerCase())?"":s; }
  function limpiarRazon(v){ let s=limpiarTexto(v); const low=s.toLowerCase();
    if(low.startsWith("no -")) return s.slice(4).trim();
    if(low.startsWith("no-")) return s.slice(3).trim();
    if(low==="no") return "Rechazada en revisión cualitativa";
    return s; }

  function rechazos(analisis, mrRows, embudoPng){
    const children=[];
    const stages = construirEmbudo(analisis, mrRows);
    if(stages.length>=2 && embudoPng){
      children.push(new Paragraph({children:[run("PROCESO DE SELECCIÓN DE COMPARABLES",{bold:true,size:12})]}));
      children.push(new Paragraph({alignment:AlignmentType.CENTER, children:[
        new ImageRun({ data:embudoPng, transformation:{ width:567, height:Math.round(567*(0.74*stages.length+0.8)/9) } }) ]}));
      const uni=stages[0][1], fin=stages[stages.length-1][1];
      const nt = `De un universo de ${uni.toLocaleString('es-AR')} empresas evaluadas se seleccionaron ${fin.toLocaleString('es-AR')} comparables tras aplicar los filtros cuantitativos y la revisión cualitativa.`;
      children.push(new Paragraph({children:[new TextRun({text:nt,italics:true,size:hp(9),font:ARIAL})]}));
      children.push(new Paragraph({children:[new TextRun("")]}));
    }
    // Tabla 1: rechazos cuantitativos
    children.push(new Paragraph({children:[run("EMPRESAS RECHAZADAS POR FILTROS CUANTITATIVOS",{bold:true,size:12})]}));
    children.push(new Paragraph({children:[new TextRun("")]}));
    const rech = (analisis||[]).filter(r=> String(r["Resultado"]||"").trim().toUpperCase()==="NO PASA");
    const hdr = t => cell(para(t,{bold:true,size:10,color:"FFFFFF"}),{fill:NAVY,borders:bord('single','single')});
    if(rech.length){
      const rows=[ new TableRow({children:[hdr("Empresa"),hdr("RIC"),hdr("Razón de Rechazo")]}) ];
      rech.forEach(r=>{
        const nombre=limpiarTexto(r["Empresa"]), ric=limpiarTexto(r["RIC"]);
        rows.push(new TableRow({children:[
          cell(para(nombre||ric,{size:9}),{widthPct:42,borders:bord(null,'single')}),
          cell(para(ric,{size:9}),{widthPct:17,borders:bord(null,'single')}),
          cell(para(limpiarRazon(r["Razon de Rechazo"]),{size:9}),{widthPct:41,borders:bord(null,'single')}) ]}));
      });
      children.push(tbl(rows,{grid:true}));
    } else {
      children.push(para("No hubo rechazos por filtros cuantitativos."));
    }
    return doc(children);
  }

  /* ---------- empaquetado ---------- */
  async function toBlob(document){ return await Packer.toBlob(document); }
  async function toBuffer(document){ return await Packer.toBuffer(document); }

export { fmtNum, fmtPct, estadosFinancieros, testedParty, descripcion, listado, rechazos, construirEmbudo, toBlob, toBuffer };
