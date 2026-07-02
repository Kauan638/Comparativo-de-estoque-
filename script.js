// =====================================
// VARIÁVEIS GLOBAIS
// =====================================

let dadosPosicoes = [];
let dadosDiferenca = [];
let resultado = [];

// =====================================
// INICIALIZAÇÃO — NOME DOS ARQUIVOS
// =====================================

document
.getElementById("arquivoPosicoes")
.addEventListener("change", function(){

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
.addEventListener("change", function(){

    const arquivo = this.files[0];

    document
    .getElementById("nomeDiferenca")
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

        if(
            !arquivoPosicoes ||
            !arquivoDiferenca
        ){

            alert(
                "Selecione os dois arquivos."
            );

            ocultarLoading();

            return;

        }

        dadosPosicoes =
        await lerTXT(arquivoPosicoes);

        dadosDiferenca =
        await lerTXT(arquivoDiferenca);

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

        gerarComparativo();

        ocultarLoading();

    }

    catch(erro){

        console.error(erro);

        ocultarLoading();

        alert(
            "Erro ao processar arquivos. Abra o console (F12) pra ver o detalhe."
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

    const mapaApanhas = {};

    const mapaPulmoes = {};

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

            qtdPulmoes: pulmoes.length

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

    atualizarKPIs();

    renderizarCards();

}

// =====================================
// KPIs
// =====================================

function atualizarKPIs(){

    document.getElementById("kpiTotal").innerText =
    resultado.length;

    document.getElementById("kpiSemApanha").innerText =
    resultado.filter(
        x=>!x.enderecoApanha
    ).length;

    document.getElementById("kpiSemPulmao").innerText =
    resultado.filter(
        x=>x.qtdPulmoes === 0
    ).length;

    document.getElementById("kpiTotalPulmoes").innerText =
    resultado.reduce(
        (s,x)=>s + x.qtdPulmoes,
        0
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

    return resultado.filter(item=>{

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

        return skuOk && qtdOk;

    });

}

function aplicarFiltros(){

    renderizarCards(
        obterFiltrado()
    );

}

window.addEventListener("load",()=>{

    document
    .getElementById("filtroSKU")
    .addEventListener(
        "input",
        aplicarFiltros
    );

    document
    .getElementById("filtroQtdPulmoes")
    .addEventListener(
        "input",
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

// limite de itens mostrados na imagem —
// acima disso a lista fica grande demais
// pra ser lida numa foto no celular;
// use os filtros pra recortar antes de gerar

const LIMITE_ITENS_IMAGEM = 40;

function classeStatusItem(item){

    if(!item.enderecoApanha){

        return "ri-item--critico";

    }

    if(item.qtdPulmoes === 0){

        return "ri-item--atencao";

    }

    return "ri-item--ok";

}

function montarRelatorioImagem(dados){

    const container =
    document.getElementById("relatorioImagem");

    const agora =
    new Date().toLocaleString("pt-BR");

    const semApanha =
    dados.filter(x=>!x.enderecoApanha).length;

    const semPulmao =
    dados.filter(x=>x.qtdPulmoes===0).length;

    const totalPulmoes =
    dados.reduce((s,x)=>s+x.qtdPulmoes,0);

    const listaExibida =
    dados.slice(0, LIMITE_ITENS_IMAGEM);

    const restantes =
    dados.length - listaExibida.length;

    let itensHtml = "";

    listaExibida.forEach(item=>{

        const pulmoesTexto =

        item.pulmoes.length

        ? item.pulmoes
            .map(p=>`${p.endereco} (${p.quantidade})`)
            .join(" • ")

        : "Sem pulmão";

        const diferencaTexto =

        (item.diferenca !== null && item.diferenca !== undefined && item.diferenca !== "")

        ? `Dif: ${item.diferenca}`

        : "";

        itensHtml += `

        <div class="ri-item ${classeStatusItem(item)}">

            <div class="ri-item-topo">

                <span class="ri-item-sku">#${item.sku}</span>

                <span class="ri-item-diferenca">${diferencaTexto}</span>

            </div>

            <div class="ri-item-descricao">
                ${item.descricao || "Sem descrição"}
            </div>

            <div class="ri-item-linha">
                <b>Apanha:</b> ${item.enderecoApanha || "Sem apanha cadastrada"}
            </div>

            <div class="ri-item-linha">
                <b>Pulmões (${item.qtdPulmoes}):</b> ${pulmoesTexto}
            </div>

        </div>
        `;

    });

    container.innerHTML = `

    <div class="ri-cabecalho">

        <div class="ri-titulo">
            📊 Comparativo de Estoque CD x Comercial
        </div>

        <div class="ri-faixa"></div>

        <div class="ri-data">
            ${agora}
        </div>

    </div>

    <div class="ri-kpis">

        <div class="ri-kpi">
            <div class="ri-kpi-label">Total Itens</div>
            <div class="ri-kpi-valor">${dados.length}</div>
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
            <div class="ri-kpi-label">Total Pulmões</div>
            <div class="ri-kpi-valor">${totalPulmoes}</div>
        </div>

    </div>

    <div class="ri-secao-titulo">
        Itens ${restantes > 0 ? `(mostrando ${listaExibida.length} de ${dados.length})` : ""}
    </div>

    ${itensHtml}

    ${
        restantes > 0
        ? `<div class="ri-rodape">+ ${restantes} item(ns) não exibido(s) — use os filtros pra reduzir a lista antes de gerar a imagem.</div>`
        : `<div class="ri-rodape">Gerado pelo Comparativo de Estoque CD x Comercial</div>`
    }

    `;

}

async function gerarImagemRelatorio(){

    if(!resultado.length){

        alert(
            "Processe os arquivos primeiro."
        );

        return;

    }

    const dados = obterFiltrado();

    if(!dados.length){

        alert(
            "Nenhum item pra gerar imagem com os filtros atuais."
        );

        return;

    }

    montarRelatorioImagem(dados);

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
