// ==========================================
// 1. CONFIGURATION & DONNÉES
// ==========================================

const PRONOMS = ['Je', 'Tu', 'Il/Elle', 'Nous', 'Vous', 'Ils/Elles'];

// Définition de TOUS les modes et temps
const STRUCTURE = {
    "Indicatif": ["Présent", "Imparfait", "Futur simple", "Passé simple", "Passé composé", "Plus-que-parfait", "Futur antérieur", "Passé antérieur"],
    "Conditionnel": ["Présent", "Passé (1ère forme)"],
    "Subjonctif": ["Présent", "Imparfait", "Passé", "Plus-que-parfait"],
    "Impératif": ["Présent", "Passé"],
    "Participe": ["Présent", "Passé"],
    "Infinitif": ["Présent", "Passé"]
};

// Terminaisons de base (pour construire le reste)
const TERMINAISONS = {
    G1: { // Aim-er
        pres:  ["e", "es", "e", "ons", "ez", "ent"],
        imp:   ["ais", "ais", "ait", "ions", "iez", "aient"],
        fut:   ["erai", "eras", "era", "erons", "erez", "eront"],
        psimp: ["ai", "as", "a", "âmes", "âtes", "èrent"]
    },
    G2: { // Fin-ir
        pres:  ["is", "is", "it", "issons", "issez", "issent"],
        imp:   ["issais", "issais", "issait", "issions", "issiez", "issaient"],
        fut:   ["irai", "iras", "ira", "irons", "irez", "iront"],
        psimp: ["is", "is", "it", "îmes", "îtes", "irent"]
    }
};

// Exceptions courantes (3e groupe) - On stocke le minimum vital
// Pour un vrai site, cette liste serait un fichier JSON externe de 10 000 lignes
const EXCEPTIONS = {
    "être": {
        aux: "être", pp: "été", groupe: 3,
        pres: ["suis", "es", "est", "sommes", "êtes", "sont"],
        imp: ["étais", "étais", "était", "étions", "étiez", "étaient"],
        fut: ["serai", "seras", "sera", "serons", "serez", "seront"],
        psimp: ["fus", "fus", "fut", "fûmes", "fûtes", "furent"]
    },
    "avoir": {
        aux: "avoir", pp: "eu", groupe: 3,
        pres: ["ai", "as", "a", "avons", "avez", "ont"],
        imp: ["avais", "avais", "avait", "avions", "aviez", "avaient"],
        fut: ["aurai", "auras", "aura", "aurons", "aurez", "auront"],
        psimp: ["eus", "eus", "eut", "eûmes", "eûtes", "eurent"]
    },
    "aller": {
        aux: "être", pp: "allé", groupe: 3,
        pres: ["vais", "vas", "va", "allons", "allez", "vont"],
        fut: ["irai", "iras", "ira", "irons", "irez", "iront"]
    },
    "faire": {
        aux: "avoir", pp: "fait", groupe: 3,
        pres: ["fais", "fais", "fait", "faisons", "faites", "font"],
        fut: ["ferai", "feras", "fera", "ferons", "ferez", "feront"]
    },
    "prendre": {
        aux: "avoir", pp: "pris", groupe: 3,
        pres: ["prends", "prends", "prend", "prenons", "prenez", "prennent"]
    }
};

// ==========================================
// 2. MOTEUR DE CONJUGAISON
// ==========================================

function getConjugation(verbe) {
    let data = {};
    let groupe = 0;
    let radical = "";
    let auxiliaire = "avoir"; // Par défaut
    let participePasse = "";

    // A. Est-ce une exception ?
    if (EXCEPTIONS[verbe]) {
        const exc = EXCEPTIONS[verbe];
        groupe = 3;
        radical = "(irrégulier)";
        auxiliaire = exc.aux;
        participePasse = exc.pp;
        
        // On construit les données à partir des infos stockées
        data = buildFromException(exc);
    } 
    // B. Groupe 1 (-er)
    else if (verbe.endsWith("er")) {
        groupe = 1;
        radical = verbe.slice(0, -2);
        auxiliaire = "avoir";
        participePasse = radical + "é"; // Ex: mangé
        
        data = buildGroup1(radical, verbe);
    } 
    // C. Groupe 2 (-ir)
    else if (verbe.endsWith("ir")) {
        groupe = 2;
        radical = verbe.slice(0, -2);
        auxiliaire = "avoir";
        participePasse = radical + "i"; // Ex: fini
        
        data = buildGroup2(radical, verbe);
    } 
    else {
        return null; // Verbe non reconnu
    }

    return {
        verbe: verbe,
        groupe: groupe,
        radical: radical,
        data: data,
        aux: auxiliaire,
        pp: participePasse
    };
}

// Construire les temps composés dynamiquement
function addCompoundTenses(data, aux, pp) {
    // Récupérer la conjugaison de l'auxiliaire
    const auxConj = getConjugation(aux).data;

    // Passé Composé (Aux Présent + PP)
    data["Indicatif_Passé composé"] = auxConj["Indicatif_Présent"].map((a, i) => {
        // Accord du participe passé si aux = être
        let ppForm = pp;
        if (aux === "être") {
            if (i === 2) ppForm = pp; // Il
            else if (i === 3 || i === 4) ppForm = pp + "s"; // Nous/Vous
            else if (i === 5) ppForm = pp + "s"; // Ils
            if (i === 1 && pp.endsWith("é")) ppForm = pp + "e"; // Elle (simplifié)
        }
        return `${a} ${ppForm}`;
    });
    
    // Plus-que-parfait (Aux Imparfait + PP)
    data["Indicatif_Plus-que-parfait"] = auxConj["Indicatif_Imparfait"].map(a => `${a} ${pp}`);
    
    // Futur Antérieur (Aux Futur + PP)
    data["Indicatif_Futur antérieur"] = auxConj["Indicatif_Futur simple"].map(a => `${a} ${pp}`);

    // Passé Antérieur (Aux passé + PP)
    data["Indicatif_Passé antérieur"] = auxConj["Indicatif_Passé simple"].map(a => `${a} ${pp}`);
}

// Génération Groupe 1
function buildGroup1(rad, inf) {
    let d = {};
    // Règle spéciale pour -ger (nous mangeons)
    let termPres = [...TERMINAISONS.G1.pres];
    if (rad.endsWith("g")) termPres[3] = "eons";
    
    d["Indicatif_Présent"] = termPres.map(t => rad + t);
    d["Indicatif_Imparfait"] = TERMINAISONS.G1.imp.map(t => rad + t);
    d["Indicatif_Futur simple"] = TERMINAISONS.G1.fut.map(t => inf + t.slice(1)); // Radical = Infinitif pour futur G1
    d["Indicatif_Passé simple"] = TERMINAISONS.G1.psimp.map(t => rad + t);
    
    // Temps composés (calculés plus tard avec addCompoundTenses)
    return d;
}

// Génération Groupe 2
function buildGroup2(rad, inf) {
    let d = {};
    d["Indicatif_Présent"] = TERMINAISONS.G2.pres.map(t => rad + t);
    d["Indicatif_Imparfait"] = TERMINAISONS.G2.imp.map(t => rad + t);
    d["Indicatif_Futur simple"] = TERMINAISONS.G2.fut.map(t => inf + t.slice(1)); // Radical = Infinitif
    d["Indicatif_Passé simple"] = TERMINAISONS.G2.psimp.map(t => rad + t);
    return d;
}

// Génération Exceptions (partielle)
function buildFromException(exc) {
    let d = {};
    // On remplit ce qu'on a, le reste sera générique ou vide
    d["Indicatif_Présent"] = exc.pres || [];
    d["Indicatif_Imparfait"] = exc.imp || [];
    d["Indicatif_Futur simple"] = exc.fut || [];
    d["Indicatif_Passé simple"] = exc.psimp || [];
    return d;
}

// ==========================================
// 3. INTERFACE & AFFICHAGE
// ==========================================

const input = document.getElementById('verbeInput');
const tabsMenu = document.getElementById('tabsMenu');
const tabContent = document.getElementById('tabContent');
const verbeInfo = document.getElementById('verbe-info');

// Fonction principale de rendu
function render(conjData) {
    if (!conjData) {
        tabContent.innerHTML = "<div class='error'>Verbe non reconnu. Essayez un verbe du 1er groupe (manger), 2e groupe (finir) ou une exception (être).</div>";
        return;
    }

    // Calculer les temps composés maintenant qu'on a tout
    addCompoundTenses(conjData.data, conjData.aux, conjData.pp);

    // Afficher Info
    verbeInfo.innerHTML = `<strong>${conjData.verbe}</strong> | Groupe : ${conjData.groupe} | Auxiliaire : ${conjData.aux}`;

    // Créer les onglets
    tabsMenu.innerHTML = "";
    let firstTab = true;

    for (const mode in STRUCTURE) {
        // Créer le bouton d'onglet
        const btn = document.createElement('button');
        btn.className = `tab-btn ${firstTab ? 'active' : ''}`;
        btn.textContent = mode;
        btn.onclick = () => showMode(mode, conjData);
        tabsMenu.appendChild(btn);

        // Afficher le premier mode par défaut
        if (firstTab) {
            showMode(mode, conjData);
            firstTab = false;
        }
    }
}

function showMode(mode, conjData) {
    // Gestion des onglets actifs
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');

    const tempsList = STRUCTURE[mode];
    let html = '<div class="tenses-grid">';

    tempsList.forEach(temps => {
        const key = `${mode}_${temps}`;
        const formes = conjData.data[key];

        // Cas spéciaux (Impératif, Participe, Infinitif ont des formats différents)
        if (mode === "Impératif") {
            html += generateTenseCard(temps, formes || ["(Non implémenté)"], true);
        } else if (mode === "Participe" || mode === "Infinitif") {
             html += generateSimpleCard(temps, formes || ["-"]);
        } else {
            html += generateTenseCard(temps, formes || ["(Non implémenté)"]);
        }
    });

    html += '</div>';
    tabContent.innerHTML = html;
}

function generateTenseCard(title, formes, isImperatif = false) {
    let rows = "";
    const pronounsLocal = isImperatif ? ["(Tu)", "(Nous)", "(Vous)"] : PRONOMS;
    const startIndex = isImperatif ? 0 : 0;
    const endIndex = isImperatif ? 3 : 6;

    for (let i = 0; i < formes.length; i++) {
        if (i >= endIndex) break; // Sécurité
        rows += `<div class="conj-row">
                    <span class="pronoun">${pronounsLocal[i]}</span>
                    <span class="verb">${formes[i]}</span>
                 </div>`;
    }

    return `
        <div class="tense-card">
            <div class="tense-title">${title}</div>
            ${rows}
        </div>
    `;
}

function generateSimpleCard(title, formes) {
    return `
        <div class="tense-card">
            <div class="tense-title">${title}</div>
            <div class="conj-row"><span class="verb">${formes[0]}</span></div>
        </div>
    `;
}

// Écouteur d'événement
input.addEventListener('input', () => {
    const v = input.value.toLowerCase().trim();
    if (v.length > 1) {
        const res = getConjugation(v);
        render(res);
    } else {
        tabContent.innerHTML = "";
        verbeInfo.innerHTML = "";
    }
});