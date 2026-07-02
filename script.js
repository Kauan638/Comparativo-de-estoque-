// =====================================
// VARIÁVEIS GLOBAIS
// =====================================

let dadosPosicoes = [];
let dadosDiferenca = [];
let dadosValores = [];
let resultado = [];

// =====================================
// INICIALIZAÇÃO — NOME DOS ARQUIVOS
// =====================================

document
.getElementById("arquivoPosicoes")
?.addEventListener("change", function(){

    const arquivo = this.files[0];

    document
    .getElementById("nomePosicoes")
    .innerText =
    arquivo
    ? arquivo.name
    : "Nenhum arquivo selecionado";

});

document
.getElementById("arquivoDiferenca")
?.addEventListener("change", function(){

    const arquivo = this.files[0];

    document
    .getElementById("nomeDiferenca")
    .innerText =
    arquivo
    ? arquivo.name
    : "Nenhum arquivo selecionado";

});

document
.getElementById("arquivoValores")
?.addEventListener("change", function(){

    const arquivo = this.files[0];

    document
    .getElementById("nomeValores")
    .innerText =
    arquivo
    ? arquivo.name
    : "Nenhum arquivo selecionado";

});

// =====================================
// LOADING
// =====================================

function mostrarLoading(){

    document
    .getElementById("loading")
    .style.display = "flex";

}

function ocultarLoading(){

    document
    .getElementById("loading")
    .style.display = "none";

}

// =====================================
// PROCESSAMENTO PRINCIPAL
// =====================================

async function processar(){

    try{

        mostrarLoading();

        const arquivoPosicoes =
        document
        .getElementById("arquivoPosicoes")
        .files[0];

        const arquivoDiferenca =
        document
        .getElementById("arquivoDiferenca")
        .files[0];

        const arquivoValores =
        document
        .getElementById("arquivoValores")
        ?.files[0];

        if(
            !arquivoPosicoes ||
            !arquivoDiferenca
        ){

            alert(
                "Selecione ao menos os arquivos de Posição de Endereços e Diferença de Estoque."
            );

            ocultarLoading();

            return;

        }

        dadosPosicoes =
        await lerTXT(arquivoPosicoes);

        dadosDiferenca =
        await lerTXT(arquivoDiferenca);

        dadosValores =
        arquivoValores
        ? await lerTXT(arquivoValores)
        : [];

        console.log(
            "Posições carregadas:",
            dadosPosicoes.length,
            Object.keys(dadosPosicoes[0] || {})
        );

        console.log(
            "Diferença carregada:",
            dadosDiferenca.length,
            Object.keys(dadosDiferenca[0] || {})
        );

        console.log(
            "Valores carregados:",
            dadosValores.length,
            Object.keys(dadosValores[0] || {})
        );

        gerarComparativo();

        ocultarLoading();

    }

    catch(erro){

        console.error(erro);

        ocultarLoading();

        alert(
            "Erro ao processar arquivos:\n\n" +
            erro.message +
            "\n\n(detalhe técnico no console, F12)"
        );

    }

}

// =====================================
// LEITURA TXT/CSV (mesmo padrão do
// Gerador de Abastecimento — arquivos
// exportados nesse formato costumam
// vir em ISO-8859-1, com acentos)
// =====================================

function lerTXT(arquivo){

    return new Promise((resolve,reject)=>{

        Papa.parse(
            arquivo,
            {

                header:true,

                delimiter:";",

                skipEmptyLines:true,

                encoding:"ISO-8859-1",

                complete:r=>{

                    resolve(r.data);

                },

                error:erro=>{

                    reject(erro);

                }

            }

        );

    });

}

// =====================================
// HELPERS
// =====================================

function normalizarCodigo(valor){

    return String(valor ?? "")
    .replace(",00","")
    .replace(".00","")
    .trim();

}

// converte número em formato PT-BR
// ("1.234,56" ou "7,4200") pra Number.
// retorna null se não der pra converter

function parseNumeroPtBR(valor){

    if(valor === null || valor === undefined){

        return null;

    }

    const limpo = String(valor).trim();

    if(limpo === ""){

        return null;

    }

    const normalizado =
    limpo
    .replace(/\./g,"")
    .replace(",",".");

    const numero = Number(normalizado);

    return isNaN(numero) ? null : numero;

}

// tenta achar, num objeto de dados, a
// coluna certa a partir de uma lista de
// nomes possíveis (evita quebrar se o
// arquivo vier com cabeçalho levemente
// diferente no futuro)

function detectarColuna(objeto, candidatos){

    if(!objeto){

        return null;

    }

    const chaves = Object.keys(objeto);

    for(const candidato of candidatos){

        const exato =
        chaves.find(
            k => k.toLowerCase().trim() === candidato.toLowerCase()
        );

        if(exato){

            return exato;

        }

    }

    for(const candidato of candidatos){

        const parcial =
        chaves.find(
            k => k.toLowerCase().includes(candidato.toLowerCase())
        );

        if(parcial){

            return parcial;

        }

    }

    return null;

}

// =====================================
// GERAR COMPARATIVO
// =====================================

function gerarComparativo(){

    resultado = [];

    if(!dadosDiferenca.length){

        alert(
            "O arquivo de diferença de estoque está vazio."
        );

        return;

    }

    const colSku =
    detectarColuna(
        dadosDiferenca[0],
        ["seqproduto","codigo","código","sku","cod"]
    );

    const colDescricao =
    detectarColuna(
        dadosDiferenca[0],
        ["desccompleta","descricao","descrição","produto"]
    );

    const colDiferenca =
    detectarColuna(
        dadosDiferenca[0],
        ["dif_estoque","diferenca","diferença"]
    );

    const colStatus =
    detectarColuna(
        dadosDiferenca[0],
        ["status"]
    );

    if(!colSku){

        alert(
            "Não consegui identificar a coluna do código do produto no arquivo de diferença. Abra o console (F12) e me mande os nomes das colunas que aparecem lá."
        );

        console.log(
            "Colunas disponíveis:",
            Object.keys(dadosDiferenca[0])
        );

        return;

    }

    // =====================================
    // MAPAS DE APANHA E PULMÃO
    // (uma única passada pelas posições,
    // sem laço aninhado — arquivo pode
    // ter centenas de milhares de linhas)
    // =====================================

    // =====================================
    // MAPA DE VALOR POR UNIDADE
    // (arquivo "Análise ABC do Estoque":
    // Código Produto -> Cto Bruto Unitário)
    // =====================================

    const colCodigoValor =
    detectarColuna(
        dadosValores[0],
        ["código produto","codigo produto","código","codigo"]
    );

    const colValorUnitario =
    detectarColuna(
        dadosValores[0],
        ["cto bruto unitário","custo bruto unitário","cto bruto unitario","custo bruto unitario"]
    );

    const mapaValores = Object.create(null);

    if(colCodigoValor && colValorUnitario){

        dadosValores.forEach(v=>{

            const codigo =
            normalizarCodigo(v[colCodigoValor]);

            if(!codigo){

                return;

            }

            mapaValores[codigo] =
            parseNumeroPtBR(v[colValorUnitario]);

        });

    }
    else if(dadosValores.length){

        console.log(
            "Não consegui identificar as colunas do arquivo de valores. Colunas disponíveis:",
            Object.keys(dadosValores[0])
        );

    }

    const mapaApanhas = Object.create(null);

    const mapaPulmoes = Object.create(null);

    dadosPosicoes.forEach(p=>{

        const codigo =
        normalizarCodigo(p.CODIGO);

        if(!codigo){

            return;

        }

        const especie =
        String(p.ESPECIE_END || "")
        .toUpperCase()
        .trim();

        if(

            especie.includes("APANHA") &&
            !mapaApanhas[codigo]

        ){

            mapaApanhas[codigo] = p;

        }

        if(especie.includes("PULM")){

            if(!mapaPulmoes[codigo]){

                mapaPulmoes[codigo] = [];

            }

            mapaPulmoes[codigo].push(p);

        }

    });

    // =====================================
    // SÓ OS ITENS QUE APARECEM NA
    // SEGUNDA PLANILHA (diferença estoque)
    // =====================================

    const vistos = new Set();

    dadosDiferenca.forEach(linha=>{

        const sku =
        normalizarCodigo(linha[colSku]);

        if(!sku || vistos.has(sku)){

            return;

        }

        vistos.add(sku);

        const posicaoApanha =
        mapaApanhas[sku];

        const enderecoApanha =
        posicaoApanha
        ? `${posicaoApanha.CODRUA}.${posicaoApanha.NROPREDIO}.${posicaoApanha.NROAPARTAMENTO}.${posicaoApanha.NROSALA}`
        : null;

        const pulmoesBrutos =
        mapaPulmoes[sku] || [];

        const pulmoes =
        pulmoesBrutos.map(p=>({

            endereco:
            `${p.CODRUA}.${p.NROPREDIO}.${p.NROAPARTAMENTO}.${p.NROSALA}`,

            quantidade:
            Number(p.QTD_END || 0)

        }));

        const valorUnitario =
        mapaValores[sku] ?? null;

        const diferencaNum =
        colDiferenca
        ? parseNumeroPtBR(linha[colDiferenca])
        : null;

        // impacto financeiro da divergência:
        // quantidade divergente (comercial vs CD)
        // multiplicada pelo custo unitário.
        // positivo = ganho (sobra) / negativo = perda (falta)

        const valorDivergencia =
        (valorUnitario !== null && diferencaNum !== null)
        ? diferencaNum * valorUnitario
        : null;

        resultado.push({

            sku,

            descricao:
            colDescricao
            ? String(linha[colDescricao] || "").trim()
            : "",

            diferenca:
            colDiferenca
            ? linha[colDiferenca]
            : null,

            status:
            colStatus
            ? linha[colStatus]
            : null,

            enderecoApanha,

            pulmoes,

            qtdPulmoes: pulmoes.length,

            valorUnitario,

            valorDivergencia

        });

    });

    resultado.sort(
        (a,b)=>a.sku.localeCompare(
            b.sku,
            "pt-BR",
            {numeric:true}
        )
    );

    console.log(
        "Itens no comparativo:",
        resultado.length
    );

    // cada etapa isolada: se uma falhar, avisa no
    // console qual foi (em vez de travar tudo e
    // cair só no "erro genérico"), e as outras
    // etapas continuam rodando normalmente

    try{
        atualizarKPIs();
    }
    catch(erro){
        console.error("Falha em atualizarKPIs():", erro);
    }

    try{
        renderizarCards();
    }
    catch(erro){
        console.error("Falha em renderizarCards():", erro);
        throw erro;
    }

    try{
        salvarResumoPainelGeral();
    }
    catch(erro){
        console.error("Falha em salvarResumoPainelGeral():", erro);
    }

}

// =====================================
// RESUMO PRO PAINEL GERAL (VISÃO GERAL)
// =====================================

function salvarResumoPainelGeral(){

    try{

        const resumo = {

            atualizadoEm: new Date().toISOString(),

            totalItens: resultado.length,

            semApanha: resultado.filter(
                x=>!x.enderecoApanha
            ).length,

            semPulmao: resultado.filter(
                x=>x.qtdPulmoes===0
            ).length,

            totalPulmoes: resultado.reduce(
                (s,x)=>s+x.qtdPulmoes,
                0
            ),

            diferencasNegativas: resultado.filter(
                x=>Number(x.diferenca) < 0
            ).length

        };

        localStorage.setItem(
            "painelGeral_comparativo",
            JSON.stringify(resumo)
        );

    }

    catch(erro){

        console.error(
            "Não consegui salvar o resumo pro painel geral:",
            erro
        );

    }

}

// =====================================
// KPIs
// =====================================

// escreve texto num elemento só se ele existir —
// evita que um elemento faltando (ex: index.html
// desatualizado) quebre o processamento inteiro
// e dispare o alerta de erro mesmo com dados ok

function setTexto(id, valor){

    const elemento =
    document.getElementById(id);

    if(!elemento){

        console.warn(
            `Elemento #${id} não encontrado no HTML (verifique se o index.html está atualizado).`
        );

        return;

    }

    elemento.innerText = valor;

}

// formata moeda completa, sempre com 2 casas
// (usada nos cards de item, impressão e WhatsApp,
// onde tem espaço de sobra)

function formatarMoeda(valor){

    return valor.toLocaleString(
        "pt-BR",
        {style:"currency",currency:"BRL"}
    );

}

// formata moeda compacta ("R$ 1,5 mi", "R$ 468,7 mil")
// usada só nos KPIs do topo, que têm largura fixa
// e estouram com números grandes

function formatarMoedaCompacta(valor){

    return valor.toLocaleString(
        "pt-BR",
        {
            style:"currency",
            currency:"BRL",
            notation:"compact",
            maximumFractionDigits:1
        }
    );

}

// escreve um valor em R$ num KPI já formatado de forma
// compacta, mas guarda o valor cheio no title (tooltip
// ao passar o mouse) pra não perder a precisão

function setTextoMoeda(id, valor){

    const elemento =
    document.getElementById(id);

    if(!elemento){

        console.warn(
            `Elemento #${id} não encontrado no HTML (verifique se o index.html está atualizado).`
        );

        return;

    }

    elemento.innerText =
    formatarMoedaCompacta(valor);

    elemento.title =
    formatarMoeda(valor);

}

function atualizarKPIs(){

    setTexto(
        "kpiTotal",
        resultado.length
    );

    setTexto(
        "kpiSemApanha",
        resultado.filter(x=>!x.enderecoApanha).length
    );

    setTexto(
        "kpiSemPulmao",
        resultado.filter(x=>x.qtdPulmoes === 0).length
    );

    setTexto(
        "kpiTotalPulmoes",
        resultado.reduce((s,x)=>s + x.qtdPulmoes, 0)
    );

    setTexto(
        "kpiUm",
        resultado.filter(x=>x.qtdPulmoes === 1).length
    );

    setTexto(
        "kpiDois",
        resultado.filter(x=>x.qtdPulmoes === 2).length
    );

    setTexto(
        "kpiTres",
        resultado.filter(x=>x.qtdPulmoes === 3).length
    );

    setTexto(
        "kpiQuatroMais",
        resultado.filter(x=>x.qtdPulmoes >= 4).length
    );

    const valorGanho =
    resultado
    .filter(x=>typeof x.valorDivergencia === "number" && !isNaN(x.valorDivergencia) && x.valorDivergencia > 0)
    .reduce((s,x)=>s + x.valorDivergencia, 0);

    const valorPerda =
    resultado
    .filter(x=>typeof x.valorDivergencia === "number" && !isNaN(x.valorDivergencia) && x.valorDivergencia < 0)
    .reduce((s,x)=>s + Math.abs(x.valorDivergencia), 0);

    setTextoMoeda(
        "kpiValorGanho",
        valorGanho
    );

    setTextoMoeda(
        "kpiValorPerda",
        valorPerda
    );

}

// =====================================
// RENDERIZAR CARDS
// =====================================

function renderizarCards(dados = resultado){

    const container =
    document.getElementById("cardsContainer");

    if(!dados.length){

        container.innerHTML =
        `<p style="text-align:center;color:#6b7280;padding:40px;grid-column:1/-1;">
        Nenhum item encontrado com esses filtros.
        </p>`;

        return;

    }

    let html = "";

    dados.forEach(item=>{

        const pulmoesHtml =

        item.pulmoes.length

        ? item.pulmoes.map(p=>

            `<span class="pulmao-chip">${p.endereco} <b>(${p.quantidade})</b></span>`

          ).join("")

        : `<span class="pulmao-chip pulmao-vazio">Sem pulmão</span>`;

        let diferencaHtml = "";

        if(

            item.diferenca !== null &&
            item.diferenca !== undefined &&
            item.diferenca !== ""

        ){

            const valor = Number(item.diferenca);

            const classe =
            valor < 0
            ? "negativa"
            : valor > 0
            ? "positiva"
            : "neutra";

            diferencaHtml =
            `<span class="badge-diferenca ${classe}">Diferença: ${item.diferenca}</span>`;

        }

        let statusClasse = "item-card--ok";

        if(!item.enderecoApanha){

            statusClasse = "item-card--critico";

        }
        else if(item.qtdPulmoes === 0){

            statusClasse = "item-card--atencao";

        }

        html += `
        <div class="item-card ${statusClasse}">

            <div class="item-card-header">

                <div class="item-card-titulo">

                    <span class="item-sku">
                        #${item.sku}
                    </span>

                    <span class="item-descricao">
                        ${item.descricao || "Sem descrição"}
                    </span>

                </div>

                ${diferencaHtml}

            </div>

            <div class="item-card-body">

                <div class="item-linha">

                    <span class="item-label">
                        📍 Apanha
                    </span>

                    <span class="item-valor">
                        ${item.enderecoApanha || "Sem apanha cadastrada"}
                    </span>

                </div>

                <div class="item-linha">

                    <span class="item-label">
                        📦 Pulmões (${item.qtdPulmoes})
                    </span>

                    <div class="pulmoes-lista">
                        ${pulmoesHtml}
                    </div>

                </div>

                ${
                    typeof item.valorUnitario === "number" && !isNaN(item.valorUnitario)
                    ? `
                <div class="item-linha">

                    <span class="item-label">
                        💲 Valor Unitário
                    </span>

                    <span class="item-valor">
                        ${formatarMoeda(item.valorUnitario)}
                    </span>

                </div>
                    `
                    : ""
                }

                ${
                    typeof item.valorDivergencia === "number" && !isNaN(item.valorDivergencia)
                    ? `
                <div class="item-linha">

                    <span class="item-label">
                        ${item.valorDivergencia >= 0 ? "📈 Impacto (Ganho)" : "📉 Impacto (Perda)"}
                    </span>

                    <span class="item-valor ${item.valorDivergencia >= 0 ? "item-valor--ganho" : "item-valor--perda"}">
                        ${formatarMoeda(item.valorDivergencia)}
                    </span>

                </div>
                    `
                    : ""
                }

            </div>

        </div>
        `;

    });

    container.innerHTML = html;

}

// =====================================
// FILTROS
// =====================================

function obterFiltrado(){

    const skuFiltro =
    document
    .getElementById("filtroSKU")
    .value
    .toLowerCase()
    .trim();

    const qtdFiltroRaw =
    document
    .getElementById("filtroQtdPulmoes")
    .value
    .trim();

    const qtdFiltro =
    qtdFiltroRaw === ""
    ? null
    : Number(qtdFiltroRaw);

    const tipoValor =
    document
    .getElementById("filtroTipoValor")
    ?.value || "todos";

    const ordenarPor =
    document
    .getElementById("ordenarPor")
    ?.value || "sku";

    let filtrado = resultado.filter(item=>{

        // SKU: correspondência EXATA — o código
        // precisa ser idêntico ao que foi digitado,
        // não "contém"

        const skuOk =

            skuFiltro === "" ||

            item.sku.toLowerCase() === skuFiltro ||

            (item.descricao || "")
            .toLowerCase()
            .includes(skuFiltro);

        // filtro EXATO — não é "a partir de"

        const qtdOk =

            qtdFiltro === null ||

            item.qtdPulmoes === qtdFiltro;

        // ganho = divergência positiva (sobra) /
        // perda = divergência negativa (falta) —
        // só considera item com valor calculado

        const temValor =
        typeof item.valorDivergencia === "number" &&
        !isNaN(item.valorDivergencia);

        const valorOk =

            tipoValor === "todos" ||

            (tipoValor === "ganho" && temValor && item.valorDivergencia > 0) ||

            (tipoValor === "perda" && temValor && item.valorDivergencia < 0);

        return skuOk && qtdOk && valorOk;

    });

    // ordenação — por padrão já vem por SKU (resultado
    // já está ordenado assim); "maior ganho"/"maior perda"
    // reordenam pelo impacto financeiro. Itens sem valor
    // calculado vão pro final, não pro topo

    if(ordenarPor === "maiorGanho"){

        filtrado = filtrado.slice().sort((a,b)=>{

            const valorA =
            typeof a.valorDivergencia === "number" ? a.valorDivergencia : -Infinity;

            const valorB =
            typeof b.valorDivergencia === "number" ? b.valorDivergencia : -Infinity;

            return valorB - valorA;

        });

    }
    else if(ordenarPor === "maiorPerda"){

        filtrado = filtrado.slice().sort((a,b)=>{

            const valorA =
            typeof a.valorDivergencia === "number" ? a.valorDivergencia : Infinity;

            const valorB =
            typeof b.valorDivergencia === "number" ? b.valorDivergencia : Infinity;

            return valorA - valorB;

        });

    }

    return filtrado;

}

function aplicarFiltros(){

    renderizarCards(
        obterFiltrado()
    );

}

window.addEventListener("load",()=>{

    document
    .getElementById("filtroSKU")
    ?.addEventListener(
        "input",
        aplicarFiltros
    );

    document
    .getElementById("filtroQtdPulmoes")
    ?.addEventListener(
        "input",
        aplicarFiltros
    );

    document
    .getElementById("filtroTipoValor")
    ?.addEventListener(
        "change",
        aplicarFiltros
    );

    document
    .getElementById("ordenarPor")
    ?.addEventListener(
        "change",
        aplicarFiltros
    );

});

// =====================================
// IMPRIMIR
// =====================================

function imprimirComparativo(){

    const dados = obterFiltrado();

    if(!dados.length){

        alert(
            "Nenhum item pra imprimir com os filtros atuais."
        );

        return;

    }

    const janela = window.open("", "_blank");

    if(!janela){

        alert("Permita pop-ups para este site.");

        return;

    }

    let html = `
<!DOCTYPE html>
<html lang="pt-BR">

<head>

<meta charset="UTF-8">

<title>Comparativo de Estoque CD x Comercial</title>

<style>

@page{

    size:A4 portrait;

    margin:10mm;

}

*{

    box-sizing:border-box;

}

body{

    font-family:Arial,Helvetica,sans-serif;

    color:#222;

    margin:0;

}

h1{

    margin:0 0 4px 0;

    text-align:center;

    color:#1e3a8a;

    font-size:18px;

}

.info{

    display:flex;

    justify-content:space-between;

    margin-bottom:14px;

    font-size:12px;

}

.item{

    border:1px solid #d9d9d9;

    border-radius:8px;

    padding:12px;

    margin-bottom:10px;

    page-break-inside:avoid;

}

.item-topo{

    display:flex;

    justify-content:space-between;

    align-items:flex-start;

    border-bottom:1px solid #eee;

    padding-bottom:6px;

    margin-bottom:6px;

}

.sku{

    font-weight:bold;

    font-size:15px;

    color:#1e3a8a;

}

.descricao{

    font-size:12px;

    color:#444;

}

.diferenca{

    font-size:11px;

    font-weight:bold;

    padding:3px 8px;

    border-radius:10px;

    background:#f3f4f6;

    white-space:nowrap;

}

.linha{

    font-size:12px;

    margin-top:4px;

}

.linha b{

    color:#1e3a8a;

}

.pulmoes{

    margin-top:3px;

}

.pulmao-item{

    display:inline-block;

    background:#eef2f7;

    border-radius:5px;

    padding:2px 6px;

    margin:2px 4px 0 0;

    font-size:11px;

}

@media print{

    .item{

        -webkit-print-color-adjust:exact;

        print-color-adjust:exact;

    }

}

</style>

</head>

<body>

<h1>

📊 COMPARATIVO DE ESTOQUE CD LOCUS x COMERCIAL

</h1>

<div class="info">

<div>

<b>Data:</b> ${new Date().toLocaleString("pt-BR")}

</div>

<div>

<b>Total:</b> ${dados.length} itens

</div>

</div>

`;

    dados.forEach(item=>{

        const pulmoesHtml =

        item.pulmoes.length

        ? item.pulmoes.map(
            p=>`<span class="pulmao-item">${p.endereco} (${p.quantidade})</span>`
          ).join("")

        : `<span class="pulmao-item">Sem pulmão</span>`;

        const diferencaHtml =

        (item.diferenca !== null && item.diferenca !== undefined && item.diferenca !== "")

        ? `<span class="diferenca">Diferença: ${item.diferenca}</span>`

        : "";

        html += `

<div class="item">

    <div class="item-topo">

        <div>

            <div class="sku">#${item.sku}</div>

            <div class="descricao">${item.descricao || "Sem descrição"}</div>

        </div>

        ${diferencaHtml}

    </div>

    <div class="linha">

        <b>Apanha:</b> ${item.enderecoApanha || "Sem apanha cadastrada"}

    </div>

    <div class="linha">

        <b>Pulmões (${item.qtdPulmoes}):</b>

        <div class="pulmoes">${pulmoesHtml}</div>

    </div>

    ${
        typeof item.valorUnitario === "number" && !isNaN(item.valorUnitario)
        ? `<div class="linha"><b>Valor Unitário:</b> ${formatarMoeda(item.valorUnitario)}</div>`
        : ""
    }

    ${
        typeof item.valorDivergencia === "number" && !isNaN(item.valorDivergencia)
        ? `<div class="linha"><b>${item.valorDivergencia >= 0 ? "Impacto (Ganho):" : "Impacto (Perda):"}</b> ${formatarMoeda(item.valorDivergencia)}</div>`
        : ""
    }

</div>

`;

    });

    html += `

</body>

</html>

`;

    janela.document.open();

    janela.document.write(html);

    janela.document.close();

    setTimeout(()=>{

        janela.focus();

        janela.print();

    },500);

}

// =====================================
// GERAR IMAGEM PARA WHATSAPP
// =====================================

function montarRelatorioImagem(){

    const container =
    document.getElementById("relatorioImagem");

    const agora =
    new Date().toLocaleString("pt-BR");

    const total = resultado.length;

    const semApanha =
    resultado.filter(x=>!x.enderecoApanha).length;

    const semPulmao =
    resultado.filter(x=>x.qtdPulmoes===0).length;

    const totalPulmoes =
    resultado.reduce((s,x)=>s+x.qtdPulmoes,0);

    const umPulmao =
    resultado.filter(x=>x.qtdPulmoes===1).length;

    const doisPulmoes =
    resultado.filter(x=>x.qtdPulmoes===2).length;

    const tresPulmoes =
    resultado.filter(x=>x.qtdPulmoes===3).length;

    const quatroOuMais =
    resultado.filter(x=>x.qtdPulmoes>=4).length;

    const valorGanho =
    resultado
    .filter(x=>typeof x.valorDivergencia === "number" && !isNaN(x.valorDivergencia) && x.valorDivergencia > 0)
    .reduce((s,x)=>s + x.valorDivergencia, 0);

    const valorPerda =
    resultado
    .filter(x=>typeof x.valorDivergencia === "number" && !isNaN(x.valorDivergencia) && x.valorDivergencia < 0)
    .reduce((s,x)=>s + Math.abs(x.valorDivergencia), 0);

    const valorGanhoFormatado =
    valorGanho.toLocaleString(
        "pt-BR",
        {style:"currency",currency:"BRL"}
    );

    const valorPerdaFormatado =
    valorPerda.toLocaleString(
        "pt-BR",
        {style:"currency",currency:"BRL"}
    );

    function linha(label, valor, classeExtra){

        return `
        <div class="ri-dist-linha">
            <span class="ri-dist-label">${label}</span>
            <span class="ri-dist-valor ${classeExtra || ""}">${valor}</span>
        </div>
        `;

    }

    container.innerHTML = `

    <div class="ri-cabecalho">

        <div class="ri-titulo">
            📊 Relatório Executivo — Comparativo de Estoque
        </div>

        <div class="ri-faixa"></div>

        <div class="ri-data">
            ${agora}
        </div>

    </div>

    <div class="ri-kpis">

        <div class="ri-kpi">
            <div class="ri-kpi-label">Total de Itens</div>
            <div class="ri-kpi-valor">${total}</div>
        </div>

        <div class="ri-kpi">
            <div class="ri-kpi-label">Sem Apanha</div>
            <div class="ri-kpi-valor">${semApanha}</div>
        </div>

        <div class="ri-kpi">
            <div class="ri-kpi-label">Sem Pulmão</div>
            <div class="ri-kpi-valor">${semPulmao}</div>
        </div>

        <div class="ri-kpi">
            <div class="ri-kpi-label">Total de Pulmões</div>
            <div class="ri-kpi-valor">${totalPulmoes}</div>
        </div>

    </div>

    <div class="ri-secao-titulo">
        Distribuição por Nº de Pulmões
    </div>

    <div class="ri-distribuicao">

        ${linha("Itens com 1 pulmão", umPulmao)}
        ${linha("Itens com 2 pulmões", doisPulmoes)}
        ${linha("Itens com 3 pulmões", tresPulmoes)}
        ${linha("Itens com 4 ou mais pulmões", quatroOuMais)}
        ${linha("Itens sem pulmão", semPulmao)}
        ${linha("Itens sem apanha", semApanha)}

    </div>

    <div class="ri-secao-titulo">
        Impacto Financeiro das Divergências
    </div>

    <div class="ri-distribuicao">

        ${linha("Valor Ganho (divergência positiva)", valorGanhoFormatado, "ri-dist-valor--ganho")}
        ${linha("Valor Perda (divergência negativa)", valorPerdaFormatado, "ri-dist-valor--perda")}

    </div>

    <div class="ri-rodape">
        Gerado pelo Comparativo de Estoque CD x Comercial
    </div>

    `;

}

async function gerarImagemRelatorio(){

    if(!resultado.length){

        alert(
            "Processe os arquivos primeiro."
        );

        return;

    }

    montarRelatorioImagem();

    if(document.fonts && document.fonts.ready){

        await document.fonts.ready;

    }

    const elemento =
    document.getElementById("relatorioImagem");

    let canvas;

    try{

        canvas = await html2canvas(elemento, {

            backgroundColor: "#14181C",

            scale: 2

        });

    }

    catch(erro){

        console.error(erro);

        alert(
            "Não consegui gerar a imagem. Veja o console (F12) pra detalhes."
        );

        return;

    }

    canvas.toBlob(async blob=>{

        if(!blob){

            alert("Falha ao gerar a imagem.");

            return;

        }

        try{

            await navigator.clipboard.write([

                new ClipboardItem({
                    "image/png": blob
                })

            ]);

            alert(
                "✅ Imagem copiada! Agora é só abrir a conversa no WhatsApp e colar (Ctrl+V)."
            );

        }

        catch(erro){

            console.error(erro);

            const link = document.createElement("a");

            link.href = URL.createObjectURL(blob);

            link.download =
            `comparativo_estoque_${new Date().toISOString().slice(0,10)}.png`;

            link.click();

            alert(
                "Seu navegador não permitiu copiar direto pro clipboard, então baixei a imagem — é só anexar ela no WhatsApp."
            );

        }

    }, "image/png");

}
