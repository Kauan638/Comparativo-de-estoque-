// ========================================================
// ========================================================
// SINCRONIZAÇÃO AUTOMÁTICA — File System Access API
//
// Conecta a subpasta "Comparativo de Estoque" (dentro da
// pasta mestre) uma única vez. A partir daí, detecta sozinho
// os 3 arquivos pelo NOME (todos são .txt/.csv, então não dá
// pra usar extensão como no Gerador de Abastecimento):
//   - nome contém "posic"    -> Posição de Endereços
//   - nome contém "diferenc" -> Diferença Estoque CD x Comercial
//   - nome contém "valor"    -> Valor por Unidade (OPCIONAL)
// e reprocessa automaticamente sempre que qualquer um dos
// arquivos monitorados for salvo/atualizado no disco.
//
// Reaproveita 100% da lógica já existente no projeto:
// lerTXT(arquivo), gerarComparativo().
//
// IMPORTANTE: renomeie os arquivos na pasta mestre pra
// conter essas palavras-chave no nome (ex: "Posicao_Enderecos.txt",
// "Diferenca_Estoque.txt", "Valores.txt").
// ========================================================
// ========================================================

const SYNC_DB_NAME = "comparativo-estoque-sync-db";
const SYNC_STORE_NAME = "handles";
const SYNC_HANDLE_KEY = "pastaComparativo";
const SYNC_INTERVALO_MS = 5000; // checa a cada 5s

let syncDirHandle = null;

let syncArquivoPosicoesHandle = null;
let syncArquivoDiferencaHandle = null;
let syncArquivoValoresHandle = null; // opcional

let syncLastModifiedPosicoes = 0;
let syncLastModifiedDiferenca = 0;
let syncLastModifiedValores = 0;

let syncIntervalId = null;

// ---------- IndexedDB: persistir o handle da pasta ----------

function syncAbrirDB(){

    return new Promise((resolve, reject)=>{

        const req = indexedDB.open(SYNC_DB_NAME, 1);

        req.onupgradeneeded = ()=>
        req.result.createObjectStore(SYNC_STORE_NAME);

        req.onsuccess = ()=> resolve(req.result);

        req.onerror = ()=> reject(req.error);

    });

}

async function syncSalvarHandle(handle){

    const db = await syncAbrirDB();

    return new Promise((resolve, reject)=>{

        const tx = db.transaction(SYNC_STORE_NAME, "readwrite");

        tx.objectStore(SYNC_STORE_NAME).put(handle, SYNC_HANDLE_KEY);

        tx.oncomplete = resolve;

        tx.onerror = ()=> reject(tx.error);

    });

}

async function syncCarregarHandle(){

    const db = await syncAbrirDB();

    return new Promise((resolve, reject)=>{

        const tx = db.transaction(SYNC_STORE_NAME, "readonly");

        const req = tx.objectStore(SYNC_STORE_NAME).get(SYNC_HANDLE_KEY);

        req.onsuccess = ()=> resolve(req.result || null);

        req.onerror = ()=> reject(req.error);

    });

}

async function syncLimparHandle(){

    const db = await syncAbrirDB();

    const tx = db.transaction(SYNC_STORE_NAME, "readwrite");

    tx.objectStore(SYNC_STORE_NAME).delete(SYNC_HANDLE_KEY);

}

async function syncGarantirPermissao(handle){

    const opcoes = { mode: "read" };

    if((await handle.queryPermission(opcoes)) === "granted") return true;

    if((await handle.requestPermission(opcoes)) === "granted") return true;

    return false;

}

// ---------- UI ----------

function syncSetStatus(tipo, textoExtra){

    const el = document.getElementById("syncStatus");

    if(!el) return;

    const mapa = {

        off: [
            "sync-off",
            '<span class="sync-dot"></span> Sincronização desligada'
        ],

        scan: [
            "sync-scan",
            '<span class="sync-dot"></span> Procurando arquivos na pasta...'
        ],

        on: [
            "sync-on",
            '<span class="sync-dot"></span> Conectado — monitorando' +
            (textoExtra ? ` (${textoExtra})` : "")
        ]

    };

    el.className = mapa[tipo][0];
    el.innerHTML = mapa[tipo][1];

    const btnConectar = document.getElementById("btnConectarPasta");
    const btnDesconectar = document.getElementById("btnDesconectarPasta");

    if(btnConectar) btnConectar.style.display = tipo === "off" ? "inline-block" : "none";
    if(btnDesconectar) btnDesconectar.style.display = tipo === "off" ? "none" : "inline-block";

}

function syncAtualizarUltimaChecagem(){

    const el = document.getElementById("syncUltimaChecagem");

    if(!el) return;

    el.style.display = "inline";

    el.textContent =
    "Última checagem: " +
    new Date().toLocaleTimeString("pt-BR");

}

// ---------- Varredura da subpasta ----------
// Detecção por PALAVRA-CHAVE no nome do arquivo (sem acentos,
// pra não depender de como o SO normaliza o nome), já que os
// três arquivos usam a mesma extensão (.txt/.csv).

function syncNormalizar(texto){

    return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // remove acentos

}

const SYNC_PALAVRA_POSICOES = "posic";
const SYNC_PALAVRA_DIFERENCA = "diferenc";
const SYNC_PALAVRA_VALORES = "valor";

const SYNC_EXT_VALIDAS = [".txt",".csv"];

function syncTemExtensaoValida(nome){

    const n = nome.toLowerCase();

    return SYNC_EXT_VALIDAS.some(ext=> n.endsWith(ext));

}

async function syncVarrerPasta(){

    syncSetStatus("scan");

    syncArquivoPosicoesHandle = null;
    syncArquivoDiferencaHandle = null;
    syncArquivoValoresHandle = null;

    for await (const [nome, handle] of syncDirHandle.entries()){

        if(handle.kind !== "file") continue;

        if(!syncTemExtensaoValida(nome)) continue;

        const nomeNormalizado = syncNormalizar(nome);

        if(
            !syncArquivoPosicoesHandle &&
            nomeNormalizado.includes(SYNC_PALAVRA_POSICOES)
        ){

            syncArquivoPosicoesHandle = handle;

        }else if(
            !syncArquivoDiferencaHandle &&
            nomeNormalizado.includes(SYNC_PALAVRA_DIFERENCA)
        ){

            syncArquivoDiferencaHandle = handle;

        }else if(
            !syncArquivoValoresHandle &&
            nomeNormalizado.includes(SYNC_PALAVRA_VALORES)
        ){

            syncArquivoValoresHandle = handle;

        }

    }

    // Valores é opcional — só Posições e Diferença são obrigatórios
    const faltando = [];

    if(!syncArquivoPosicoesHandle) faltando.push('"posic..." (Posição de Endereços)');
    if(!syncArquivoDiferencaHandle) faltando.push('"diferenc..." (Diferença Estoque CD x Comercial)');

    if(faltando.length){

        alert(
            "Não encontrei na pasta um arquivo pra cada tipo obrigatório.\n\n" +
            "Faltando (renomeie o arquivo pra conter a palavra-chave):\n" +
            faltando.map(f=>"• " + f).join("\n") +
            '\n\nO arquivo de Valores ("valor...") é opcional.'
        );

        return false;

    }

    return true;

}

// ---------- Processamento automático (reaproveita as funções originais) ----------

async function syncProcessarArquivos(){

    mostrarLoading();

    try{

        const arquivoPosicoes =
        await syncArquivoPosicoesHandle.getFile();

        const arquivoDiferenca =
        await syncArquivoDiferencaHandle.getFile();

        dadosPosicoes =
        await lerTXT(arquivoPosicoes);

        dadosDiferenca =
        await lerTXT(arquivoDiferenca);

        if(syncArquivoValoresHandle){

            const arquivoValores =
            await syncArquivoValoresHandle.getFile();

            dadosValores =
            await lerTXT(arquivoValores);

            document.getElementById("nomeValores").innerText =
            "🔗 " + arquivoValores.name + " (auto)";

        }else{

            dadosValores = [];

        }

        gerarComparativo();

        ocultarLoading();

        // reflete nos campos de nome de arquivo da UI manual também
        document.getElementById("nomePosicoes").innerText =
        "🔗 " + arquivoPosicoes.name + " (auto)";

        document.getElementById("nomeDiferenca").innerText =
        "🔗 " + arquivoDiferenca.name + " (auto)";

        console.log("Sincronização automática concluída");

    }catch(erro){

        console.error(erro);

        ocultarLoading();

    }

}

// ---------- Loop de monitoramento ----------

function syncPararMonitoramento(){

    if(syncIntervalId){

        clearInterval(syncIntervalId);

        syncIntervalId = null;

    }

}

function syncIniciarMonitoramento(){

    syncPararMonitoramento();

    const nomesDetectados = [

        syncArquivoPosicoesHandle?.name,
        syncArquivoDiferencaHandle?.name,
        syncArquivoValoresHandle?.name

    ].filter(Boolean).join(" + ");

    syncSetStatus("on", nomesDetectados);

    syncIntervalId = setInterval(
        syncChecarMudancas,
        SYNC_INTERVALO_MS
    );

}

async function syncChecarMudancas(){

    try{

        let mudou = false;

        const filePosicoes =
        await syncArquivoPosicoesHandle.getFile();

        if(filePosicoes.lastModified !== syncLastModifiedPosicoes){

            syncLastModifiedPosicoes = filePosicoes.lastModified;

            mudou = true;

        }

        const fileDiferenca =
        await syncArquivoDiferencaHandle.getFile();

        if(fileDiferenca.lastModified !== syncLastModifiedDiferenca){

            syncLastModifiedDiferenca = fileDiferenca.lastModified;

            mudou = true;

        }

        if(syncArquivoValoresHandle){

            const fileValores =
            await syncArquivoValoresHandle.getFile();

            if(fileValores.lastModified !== syncLastModifiedValores){

                syncLastModifiedValores = fileValores.lastModified;

                mudou = true;

            }

        }

        syncAtualizarUltimaChecagem();

        if(mudou){

            await syncProcessarArquivos();

        }

    }catch(erro){

        console.error(
            "Erro ao checar mudanças na pasta:",
            erro
        );

    }

}

// ---------- Ações de UI (botões) ----------

async function conectarPastaComparativo(){

    try{

        syncDirHandle = await window.showDirectoryPicker();

        await syncSalvarHandle(syncDirHandle);

        const encontrou = await syncVarrerPasta();

        if(!encontrou){

            syncSetStatus("off");

            return;

        }

        // primeira carga imediata + marca os lastModified atuais
        await syncProcessarArquivos();

        const filePosicoes = await syncArquivoPosicoesHandle.getFile();
        syncLastModifiedPosicoes = filePosicoes.lastModified;

        const fileDiferenca = await syncArquivoDiferencaHandle.getFile();
        syncLastModifiedDiferenca = fileDiferenca.lastModified;

        if(syncArquivoValoresHandle){

            const fileValores = await syncArquivoValoresHandle.getFile();
            syncLastModifiedValores = fileValores.lastModified;

        }

        syncIniciarMonitoramento();

    }catch(erro){

        if(erro.name !== "AbortError"){

            console.error(erro);

            alert("Erro ao conectar a pasta: " + erro.message);

        }

    }

}

async function desconectarPastaComparativo(){

    syncPararMonitoramento();

    syncDirHandle = null;
    syncArquivoPosicoesHandle = null;
    syncArquivoDiferencaHandle = null;
    syncArquivoValoresHandle = null;
    syncLastModifiedPosicoes = 0;
    syncLastModifiedDiferenca = 0;
    syncLastModifiedValores = 0;

    await syncLimparHandle();

    syncSetStatus("off");

    const elChecagem = document.getElementById("syncUltimaChecagem");

    if(elChecagem) elChecagem.style.display = "none";

}

// ---------- Reconexão automática ao abrir a página ----------

(async function syncTentarReconectar(){

    const handleSalvo = await syncCarregarHandle();

    if(!handleSalvo) return;

    const temPermissao = await syncGarantirPermissao(handleSalvo);

    if(!temPermissao){

        // não força popup de permissão sem interação do usuário;
        // ele clica em "Conectar Pasta" de novo se precisar
        return;

    }

    syncDirHandle = handleSalvo;

    const encontrou = await syncVarrerPasta();

    if(!encontrou) return;

    const filePosicoes = await syncArquivoPosicoesHandle.getFile();
    syncLastModifiedPosicoes = filePosicoes.lastModified;

    const fileDiferenca = await syncArquivoDiferencaHandle.getFile();
    syncLastModifiedDiferenca = fileDiferenca.lastModified;

    if(syncArquivoValoresHandle){

        const fileValores = await syncArquivoValoresHandle.getFile();
        syncLastModifiedValores = fileValores.lastModified;

    }

    await syncProcessarArquivos();

    syncIniciarMonitoramento();

})();
