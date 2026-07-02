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

        html += `
        <div class="item-card">

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

        const skuOk =

            item.sku
            .toLowerCase()
            .includes(skuFiltro) ||

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
