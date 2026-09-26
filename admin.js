// ============================================================
// NOA DIGIT TRADE
// ADMIN.JS — VERSION COMPLETE
//
// ESPACE ADMINISTRATEUR
//
// - Connexion Supabase
// - Vérification role = admin
// - Tableau de bord
// - Paramètres de l'application
// - Taux achat / vente
// - Minimum / maximum commande
// - Frais TRC20 / BEP20
// - Numéro Orange Money
// - Toutes les commandes
// - Modification des statuts
// - Litiges
// - Modification des statuts de litiges
// - Utilisateurs
// - Statistiques
// - Déconnexion
// ============================================================


// ============================================================
// SUPABASE
// ============================================================

const SUPABASE_URL =
  "https://vowafwsvrjpkhkocptih.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_umIa4749av8722xus6aQHw_1nf8b-PC";


if (!window.supabase) {
  console.error(
    "Supabase JS n'est pas chargé."
  );
}


const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );


// ============================================================
// ETAT GLOBAL
// ============================================================

let currentUser = null;

let currentProfile = null;

let currentSettings = null;

let allOrders = [];

let allDisputes = [];

let allUsers = [];

let selectedOrder = null;

let selectedDispute = null;

let authListenerReady = false;


// ============================================================
// CONFIGURATION PAR DEFAUT
// ============================================================

const DEFAULT_SETTINGS = {

  id: 1,

  country: "Burkina Faso",

  currency: "XOF",

  buy_rate: 600,

  sell_rate: 570,

  min_order_cfa: 2000,

  max_order_cfa: 50000,

  trc20_fee_usdt: 2,

  bp20_fee_usdt: 0,

  orange_money_number: "74602553",

  payment_method: "Orange Money",

  usdt_balance: 0,

  fcfa_balance: 0

};


// ============================================================
// UTILITAIRE DOM
// ============================================================

function extractWalletAddress(order) {

  if (order.wallet_address) {
    return String(order.wallet_address).trim();
  }

  const note =
    String(order.customer_note || "");

  const buyMatch =
    note.match(/Adresse de r[ée]ception USDT\s*:\s*([^\n|]+)/i);

  if (buyMatch) {
    return buyMatch[1].trim();
  }

  const sellMatch =
    note.match(/Adresse de d[ée]p[oô]t NOA\s*:\s*([^\n|]+)/i);

  if (sellMatch) {
    return sellMatch[1].trim();
  }

  return "";
}


function extractPayoutPhone(order) {

  const note =
    String(order.customer_note || "");

  const match =
    note.match(/Num[ée]ro\s+\S+\s*:\s*([^\n|]+)/i);

  return match ? match[1].trim() : "";
}


async function copyToClipboard(text, button) {

  if (!text) return;

  try {

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const temp = document.createElement("textarea");
      temp.value = text;
      temp.style.position = "fixed";
      temp.style.opacity = "0";
      document.body.appendChild(temp);
      temp.select();
      document.execCommand("copy");
      document.body.removeChild(temp);
    }

    if (button) {
      const original = button.textContent;
      button.textContent = "✓ Copié";
      button.classList.add("copied");
      setTimeout(() => {
        button.textContent = original;
        button.classList.remove("copied");
      }, 1500);
    }

  } catch (error) {
    console.error("Erreur copie presse-papier :", error);
  }
}


async function getSignedProofUrl(path) {

  const {
    data,
    error
  } =
    await supabaseClient
      .storage
      .from('payment-proofs')
      .createSignedUrl(
        path,
        300
      );


  if (error) {
    throw error;
  }


  return data.signedUrl;

}


async function loadPaymentProofPreview(path) {

  const box =
    $("proofImageBox");


  if (!box) {
    return;
  }


  try {

    const url =
      await getSignedProofUrl(path);


    box.innerHTML = `

      <div class="wallet-box-label">Preuve de paiement</div>
      <a href="${escapeHtml(url)}" target="_blank" rel="noopener">
        <img src="${escapeHtml(url)}" alt="Preuve de paiement" style="max-width:100%;border-radius:12px;display:block;margin-top:6px">
      </a>
      <div class="small" style="margin-top:6px">Touchez l'image pour l'agrandir.</div>

    `;

  } catch (error) {

    console.error(
      "Erreur chargement preuve :",
      error
    );


    box.innerHTML = `

      <div class="wallet-box-label">Preuve de paiement</div>
      <div class="small" style="color:#c62828">Impossible de charger l'image.</div>

    `;

  }

}


function $(id) {

  return document.getElementById(id);

}


// ============================================================
// ECHAPPEMENT HTML
// ============================================================

function escapeHtml(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


// ============================================================
// FORMAT NOMBRE
// ============================================================

function formatNumber(
  value,
  maximumFractionDigits = 0
) {

  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {

    return "0";

  }


  return number.toLocaleString(
    "fr-FR",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits
    }
  );

}


// ============================================================
// BADGE PWA (icône app - nombre de commandes en attente)
// ============================================================

function updateAppBadge(count) {

  if (!("setAppBadge" in navigator)) {

    return;

  }


  if (count > 0) {

    navigator
      .setAppBadge(count)
      .catch(() => {});

  } else {

    navigator
      .clearAppBadge?.()
      .catch(() => {});

  }

}


// ============================================================
// FORMAT DECIMAL
// ============================================================

function formatDecimal(value) {

  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {

    return "0";

  }


  return number.toFixed(6);

}


// ============================================================
// FORMAT DATE
// ============================================================

function formatDate(value) {

  if (!value) {

    return "-";

  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "-";

  }


  return date.toLocaleString(
    "fr-FR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }
  );

}


// ============================================================
// MESSAGE ERREUR
// ============================================================

function getErrorMessage(error) {

  if (!error) {

    return "Erreur inconnue.";

  }


  return (
    error.message ||
    error.error_description ||
    error.details ||
    error.hint ||
    "Erreur inconnue."
  );

}


// ============================================================
// MESSAGES
// ============================================================

function showLoginMessage(
  message,
  type = "error"
) {

  const box =
    $("loginMessage");


  if (!box) {

    return;

  }


  box.textContent =
    String(message || "");


  box.className =
    "message show " + type;

}


function clearLoginMessage() {

  const box =
    $("loginMessage");


  if (!box) {

    return;

  }


  box.textContent = "";

  box.className =
    "message";

}


function showMessage(
  id,
  message,
  type = "error"
) {

  const box =
    $(id);


  if (!box) {

    return;

  }


  box.textContent =
    String(message || "");


  box.className =
    "message show " + type;

}


function clearMessage(id) {

  const box =
    $(id);


  if (!box) {

    return;

  }


  box.textContent = "";

  box.className =
    "message";

}


// ============================================================
// AFFICHAGE LOGIN / ADMIN
// ============================================================

function showLoginPage() {

  $("adminLoginPage")
    ?.classList
    .remove("hidden");


  $("adminPage")
    ?.classList
    .add("hidden");

}


function showAdminPage() {

  $("adminLoginPage")
    ?.classList
    .add("hidden");


  $("adminPage")
    ?.classList
    .remove("hidden");

}


// ============================================================
// VERIFICATION ADMIN
// ============================================================

async function verifyAdmin() {

  if (!currentUser) {

    return false;

  }


  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .from("profiles")
        .select(
          "id,full_name,phone,country,role"
        )
        .eq(
          "id",
          currentUser.id
        )
        .maybeSingle();


    if (error) {

      throw error;

    }


    if (!data) {

      return false;

    }


    currentProfile =
      data;


    const role =
      String(
        data.role || ""
      )
      .trim()
      .toLowerCase();


    return role === "admin";

  }

  catch (error) {

    console.error(
      "Erreur vérification admin:",
      error
    );

    return false;

  }

}


// ============================================================
// CONNEXION ADMIN
// ============================================================

async function adminLogin(event) {

  event.preventDefault();


  clearLoginMessage();


  const email =
    $("adminEmail")
      ?.value
      .trim()
      .toLowerCase();


  const password =
    $("adminPassword")
      ?.value || "";


  if (!email || !password) {

    showLoginMessage(
      "Veuillez remplir tous les champs."
    );

    return;

  }


  const button =
    $("adminLoginBtn");


  const oldText =
    button?.textContent;


  if (button) {

    button.disabled = true;

    button.textContent =
      "Connexion...";

  }


  try {

    const {
      data,
      error
    } =
      await supabaseClient.auth
        .signInWithPassword({

          email,

          password

        });


    if (error) {

      throw error;

    }


    if (!data?.user) {

      throw new Error(
        "Connexion impossible."
      );

    }


    currentUser =
      data.user;


    const isAdmin =
      await verifyAdmin();


    if (!isAdmin) {

      await supabaseClient
        .auth
        .signOut();


      currentUser = null;

      currentProfile = null;


      throw new Error(
        "Accès refusé. Ce compte n'est pas administrateur."
      );

    }


    showAdminPage();


    await loadDashboard();

    initNotifUI();
    initRealtimeAlerts();

  }

  catch (error) {

    console.error(
      "Erreur connexion admin:",
      error
    );


    showLoginMessage(
      getErrorMessage(error)
    );

  }

  finally {

    if (button) {

      button.disabled = false;

      button.textContent =
        oldText ||
        "Se connecter";

    }

  }

}


// ============================================================
// SESSION EXISTANTE
// ============================================================

async function checkSession() {

  try {

    const {
      data,
      error
    } =
      await supabaseClient.auth
        .getSession();


    if (error) {

      throw error;

    }


    const session =
      data?.session;


    if (!session?.user) {

      currentUser = null;

      currentProfile = null;

      showLoginPage();

      return;

    }


    currentUser =
      session.user;


    const isAdmin =
      await verifyAdmin();


    if (!isAdmin) {

      await supabaseClient
        .auth
        .signOut();


      currentUser = null;

      currentProfile = null;

      showLoginPage();


      showLoginMessage(
        "Accès refusé. Vous devez être administrateur."
      );


      return;

    }


    showAdminPage();


    await loadDashboard();

    initNotifUI();
    initRealtimeAlerts();

  }

  catch (error) {

    console.error(
      "Erreur session admin:",
      error
    );


    currentUser = null;

    currentProfile = null;

    showLoginPage();


    showLoginMessage(
      "Impossible de vérifier votre session."
    );

  }

}


// ============================================================
// DASHBOARD
// ============================================================

async function loadDashboard() {

  updateAdminHeader();


  await Promise.all([

    loadSettings(),

    loadOrders(),

    loadDisputes(),

    loadUsers()

  ]);


  updateStatistics();

}


// ============================================================
// HEADER ADMIN
// ============================================================

function updateAdminHeader() {

  const element =
    $("adminUserName");


  if (!element) {

    return;

  }


  const name =
    currentProfile?.full_name ||
    currentUser?.email ||
    "Administrateur";


  element.textContent =
    `${name} — ADMIN`;

}


// ============================================================
// PARAMETRES
// ============================================================

function getSettingsField(
  names
) {

  for (
    const name of names
  ) {

    const element =
      $(name);


    if (element) {

      return element;

    }

  }


  return null;

}


// ============================================================
// REMPLIR UN CHAMP
// ============================================================

function setFieldValue(
  names,
  value
) {

  const field =
    getSettingsField(names);


  if (!field) {

    return;

  }


  field.value =
    value ?? "";

}


// ============================================================
// RECUPERER UNE VALEUR
// ============================================================

function getFieldValue(
  names
) {

  const field =
    getSettingsField(names);


  if (!field) {

    return "";

  }


  return String(
    field.value ?? ""
  ).trim();

}


// ============================================================
// CHARGER PARAMETRES
// ============================================================

async function loadSettings() {

  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .from("app_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();


    if (error) {

      throw error;

    }


    currentSettings =
      data || {
        ...DEFAULT_SETTINGS
      };


    fillSettingsForm();


  }

  catch (error) {

    console.error(
      "Erreur chargement paramètres:",
      error
    );


    currentSettings = {
      ...DEFAULT_SETTINGS
    };


    fillSettingsForm();


    showMessage(
      "settingsMessage",
      "Impossible de charger les paramètres : " +
      getErrorMessage(error),
      "error"
    );

  }

}


// ============================================================
// REMPLIR FORMULAIRE PARAMETRES
// ============================================================

function fillSettingsForm() {

  const settings =
    {
      ...DEFAULT_SETTINGS,
      ...(currentSettings || {})
    };


  // ----------------------------------------------------------
  // TAUX ACHAT
  // ----------------------------------------------------------

  setFieldValue(
    [
      "buyRate",
      "adminBuyRate",
      "settingsBuyRate"
    ],
    settings.buy_rate
  );


  // ----------------------------------------------------------
  // TAUX VENTE
  // ----------------------------------------------------------

  setFieldValue(
    [
      "sellRate",
      "adminSellRate",
      "settingsSellRate"
    ],
    settings.sell_rate
  );


  // ----------------------------------------------------------
  // MINIMUM
  // ----------------------------------------------------------

  setFieldValue(
    [
      "minOrderCfa",
      "minOrder",
      "adminMinOrder",
      "settingsMinOrder"
    ],
    settings.min_order_cfa
  );


  // ----------------------------------------------------------
  // MAXIMUM
  // ----------------------------------------------------------

  setFieldValue(
    [
      "maxOrderCfa",
      "maxOrder",
      "adminMaxOrder",
      "settingsMaxOrder"
    ],
    settings.max_order_cfa
  );


  // ----------------------------------------------------------
  // FRAIS TRC20
  // ----------------------------------------------------------

  setFieldValue(
    [
      "trc20Fee",
      "trc20FeeUsdt",
      "adminTrc20Fee",
      "settingsTrc20Fee"
    ],
    settings.trc20_fee_usdt
  );


  // ----------------------------------------------------------
  // FRAIS BEP20 / BP20
  // ----------------------------------------------------------

  setFieldValue(
    [
      "bp20Fee",
      "bep20Fee",
      "bp20FeeUsdt",
      "bep20FeeUsdt",
      "adminBp20Fee",
      "adminBep20Fee",
      "settingsBp20Fee"
    ],
    settings.bp20_fee_usdt
  );


  // ----------------------------------------------------------
  // SOLDES DISPONIBLES
  // ----------------------------------------------------------

  setFieldValue(
    [
      "usdtBalanceInput",
      "usdtBalance",
      "adminUsdtBalance"
    ],
    settings.usdt_balance
  );


  setFieldValue(
    [
      "fcfaBalanceInput",
      "fcfaBalance",
      "adminFcfaBalance"
    ],
    settings.fcfa_balance
  );


  // ----------------------------------------------------------
  // ORANGE MONEY
  // ----------------------------------------------------------

  setFieldValue(
    [
      "orangeMoneyNumber",
      "orangeMoney",
      "orangeMoneyPhone",
      "adminOrangeMoneyNumber",
      "settingsOrangeMoneyNumber"
    ],
    settings.orange_money_number
  );


  // ----------------------------------------------------------
  // PAIEMENT
  // ----------------------------------------------------------

  setFieldValue(
    [
      "paymentMethod",
      "adminPaymentMethod",
      "settingsPaymentMethod"
    ],
    settings.payment_method
  );


  // ----------------------------------------------------------
  // PAYS
  // ----------------------------------------------------------

  setFieldValue(
    [
      "country",
      "settingsCountry"
    ],
    settings.country
  );


  // ----------------------------------------------------------
  // DEVISE
  // ----------------------------------------------------------

  setFieldValue(
    [
      "currency",
      "settingsCurrency"
    ],
    settings.currency
  );


  updateSettingsPreview();

}


// ============================================================
// APERCU PARAMETRES
// ============================================================

function updateSettingsPreview() {

  const settings =
    {
      ...DEFAULT_SETTINGS,
      ...(currentSettings || {})
    };


  const buyRate =
    Number(
      getFieldValue([
        "buyRate",
        "adminBuyRate",
        "settingsBuyRate"
      ])
    );


  const sellRate =
    Number(
      getFieldValue([
        "sellRate",
        "adminSellRate",
        "settingsSellRate"
      ])
    );


  const minOrder =
    Number(
      getFieldValue([
        "minOrderCfa",
        "minOrder",
        "adminMinOrder",
        "settingsMinOrder"
      ])
    );


  const maxOrder =
    Number(
      getFieldValue([
        "maxOrderCfa",
        "maxOrder",
        "adminMaxOrder",
        "settingsMaxOrder"
      ])
    );


  const trc20Fee =
    Number(
      getFieldValue([
        "trc20Fee",
        "trc20FeeUsdt",
        "adminTrc20Fee",
        "settingsTrc20Fee"
      ])
    );


  const bp20Fee =
    Number(
      getFieldValue([
        "bp20Fee",
        "bep20Fee",
        "bp20FeeUsdt",
        "bep20FeeUsdt",
        "adminBp20Fee",
        "adminBep20Fee",
        "settingsBp20Fee"
      ])
    );


  const orange =
    getFieldValue([
      "orangeMoneyNumber",
      "orangeMoney",
      "orangeMoneyPhone",
      "adminOrangeMoneyNumber",
      "settingsOrangeMoneyNumber"
    ]);


  const previewBuy =
    $("previewBuyRate");


  if (previewBuy) {

    previewBuy.textContent =
      `${formatNumber(
        Number.isFinite(buyRate)
          ? buyRate
          : settings.buy_rate
      )} FCFA`;

  }


  const previewSell =
    $("previewSellRate");


  if (previewSell) {

    previewSell.textContent =
      `${formatNumber(
        Number.isFinite(sellRate)
          ? sellRate
          : settings.sell_rate
      )} FCFA`;

  }


  const previewMin =
    $("previewMinOrder");


  if (previewMin) {

    previewMin.textContent =
      `${formatNumber(
        Number.isFinite(minOrder)
          ? minOrder
          : settings.min_order_cfa
      )} FCFA`;

  }


  const previewMax =
    $("previewMaxOrder");


  if (previewMax) {

    previewMax.textContent =
      `${formatNumber(
        Number.isFinite(maxOrder)
          ? maxOrder
          : settings.max_order_cfa
      )} FCFA`;

  }


  const previewTrc =
    $("previewTrc20Fee");


  if (previewTrc) {

    previewTrc.textContent =
      `${Number.isFinite(trc20Fee)
        ? trc20Fee
        : settings.trc20_fee_usdt} USDT`;

  }


  const previewBep =
    $("previewBp20Fee") ||
    $("previewBep20Fee");


  if (previewBep) {

    previewBep.textContent =
      `${Number.isFinite(bp20Fee)
        ? bp20Fee
        : settings.bp20_fee_usdt} USDT`;

  }


  const previewOrange =
    $("previewOrangeMoney");


  if (previewOrange) {

    previewOrange.textContent =
      orange ||
      settings.orange_money_number;

  }

}


// ============================================================
// SAUVEGARDER PARAMETRES
// ============================================================

async function saveSettings(event) {

  if (event) {

    event.preventDefault();

  }


  clearMessage(
    "settingsMessage"
  );


  // ----------------------------------------------------------
  // RECUPERATION
  // ----------------------------------------------------------

  const buyRate =
    Number(
      getFieldValue([
        "buyRate",
        "adminBuyRate",
        "settingsBuyRate"
      ])
    );


  const sellRate =
    Number(
      getFieldValue([
        "sellRate",
        "adminSellRate",
        "settingsSellRate"
      ])
    );


  const minOrder =
    Number(
      getFieldValue([
        "minOrderCfa",
        "minOrder",
        "adminMinOrder",
        "settingsMinOrder"
      ])
    );


  const maxOrder =
    Number(
      getFieldValue([
        "maxOrderCfa",
        "maxOrder",
        "adminMaxOrder",
        "settingsMaxOrder"
      ])
    );


  const trc20Fee =
    Number(
      getFieldValue([
        "trc20Fee",
        "trc20FeeUsdt",
        "adminTrc20Fee",
        "settingsTrc20Fee"
      ])
    );


  const bp20Fee =
    Number(
      getFieldValue([
        "bp20Fee",
        "bep20Fee",
        "bp20FeeUsdt",
        "bep20FeeUsdt",
        "adminBp20Fee",
        "adminBep20Fee",
        "settingsBp20Fee"
      ])
    );


  const orangeMoney =
    getFieldValue([
      "orangeMoneyNumber",
      "orangeMoney",
      "orangeMoneyPhone",
      "adminOrangeMoneyNumber",
      "settingsOrangeMoneyNumber"
    ]);


  const usdtBalance =
    Number(
      getFieldValue([
        "usdtBalanceInput",
        "usdtBalance",
        "adminUsdtBalance"
      ])
    );


  const fcfaBalance =
    Number(
      getFieldValue([
        "fcfaBalanceInput",
        "fcfaBalance",
        "adminFcfaBalance"
      ])
    );


  let paymentMethod =
    getFieldValue([
      "paymentMethod",
      "adminPaymentMethod",
      "settingsPaymentMethod"
    ]);


  let country =
    getFieldValue([
      "country",
      "settingsCountry"
    ]);


  let currency =
    getFieldValue([
      "currency",
      "settingsCurrency"
    ]);


  // ----------------------------------------------------------
  // VALEURS PAR DEFAUT
  // ----------------------------------------------------------

  if (!paymentMethod) {

    paymentMethod =
      "Orange Money";

  }


  if (!country) {

    country =
      "Burkina Faso";

  }


  if (!currency) {

    currency =
      "XOF";

  }


  // ----------------------------------------------------------
  // VALIDATION TAUX
  // ----------------------------------------------------------

  if (
    !Number.isFinite(buyRate) ||
    buyRate <= 0
  ) {

    showMessage(
      "settingsMessage",
      "Le taux d'achat doit être supérieur à 0."
    );

    return;

  }


  if (
    !Number.isFinite(sellRate) ||
    sellRate <= 0
  ) {

    showMessage(
      "settingsMessage",
      "Le taux de vente doit être supérieur à 0."
    );

    return;

  }


  // ----------------------------------------------------------
  // VALIDATION LIMITES
  // ----------------------------------------------------------

  if (
    !Number.isFinite(minOrder) ||
    minOrder <= 0
  ) {

    showMessage(
      "settingsMessage",
      "Le montant minimum doit être supérieur à 0."
    );

    return;

  }


  if (
    !Number.isFinite(maxOrder) ||
    maxOrder <= 0
  ) {

    showMessage(
      "settingsMessage",
      "Le montant maximum doit être supérieur à 0."
    );

    return;

  }


  if (
    minOrder >= maxOrder
  ) {

    showMessage(
      "settingsMessage",
      "Le minimum doit être inférieur au maximum."
    );

    return;

  }


  // ----------------------------------------------------------
  // VALIDATION FRAIS
  // ----------------------------------------------------------

  if (
    !Number.isFinite(trc20Fee) ||
    trc20Fee < 0
  ) {

    showMessage(
      "settingsMessage",
      "Le frais TRC20 doit être supérieur ou égal à 0."
    );

    return;

  }


  if (
    !Number.isFinite(bp20Fee) ||
    bp20Fee < 0
  ) {

    showMessage(
      "settingsMessage",
      "Le frais BEP20 doit être supérieur ou égal à 0."
    );

    return;

  }


  // ----------------------------------------------------------
  // VALIDATION ORANGE MONEY
  // ----------------------------------------------------------

  if (!orangeMoney) {

    showMessage(
      "settingsMessage",
      "Veuillez saisir le numéro Orange Money."
    );

    return;

  }


  // ----------------------------------------------------------
  // VALIDATION SOLDES
  // ----------------------------------------------------------

  if (
    !Number.isFinite(usdtBalance) ||
    usdtBalance < 0
  ) {

    showMessage(
      "settingsMessage",
      "Le solde USDT doit être supérieur ou égal à 0."
    );

    return;

  }


  if (
    !Number.isFinite(fcfaBalance) ||
    fcfaBalance < 0
  ) {

    showMessage(
      "settingsMessage",
      "Le solde FCFA doit être supérieur ou égal à 0."
    );

    return;

  }


  // ----------------------------------------------------------
  // BOUTON
  // ----------------------------------------------------------

  const button =
    $("saveSettingsBtn") ||
    $("saveSettingsButton") ||
    $("settingsSaveBtn");


  const oldText =
    button?.textContent;


  if (button) {

    button.disabled = true;

    button.textContent =
      "Enregistrement...";

  }


  // ----------------------------------------------------------
  // DONNEES
  // ----------------------------------------------------------

  const payload = {

    country,

    currency,

    buy_rate:
      buyRate,

    sell_rate:
      sellRate,

    min_order_cfa:
      minOrder,

    max_order_cfa:
      maxOrder,

    trc20_fee_usdt:
      trc20Fee,

    bp20_fee_usdt:
      bp20Fee,

    orange_money_number:
      orangeMoney,

    payment_method:
      paymentMethod,

    usdt_balance:
      usdtBalance,

    fcfa_balance:
      fcfaBalance

  };


  // ----------------------------------------------------------
  // ENREGISTREMENT
  // ----------------------------------------------------------

  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .from("app_settings")
        .update(payload)
        .eq("id", 1)
        .select("*")
        .single();


    if (error) {

      throw error;

    }


    currentSettings =
      data;


    fillSettingsForm();


    showMessage(
      "settingsMessage",
      "Les paramètres ont été enregistrés avec succès.",
      "success"
    );


    console.log(
      "Paramètres enregistrés:",
      data
    );

  }

  catch (error) {

    console.error(
      "Erreur sauvegarde paramètres:",
      error
    );


    showMessage(
      "settingsMessage",
      "Impossible d'enregistrer les paramètres : " +
      getErrorMessage(error)
    );

  }

  finally {

    if (button) {

      button.disabled = false;

      button.textContent =
        oldText ||
        "Enregistrer les paramètres";

    }

  }

}


// ============================================================
// COMMANDES
// ============================================================

async function loadOrders() {

  const container =
    $("ordersList");


  if (container) {

    container.innerHTML =
      '<div class="empty">Chargement des commandes...</div>';

  }


  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .from("orders")
        .select("*")
        .order(
          "created_at",
          {
            ascending: false
          }
        );


    if (error) {

      throw error;

    }


    allOrders =
      data || [];


    renderOrders();

    updateStatistics();

  }

  catch (error) {

    console.error(
      "Erreur commandes admin:",
      error
    );


    if (container) {

      container.innerHTML =
        '<div class="empty">Impossible de charger les commandes.</div>';

    }

  }

}


// ============================================================
// AFFICHAGE COMMANDES
// ============================================================

function renderOrders() {

  const container =
    $("ordersList");


  if (!container) {

    return;

  }


  const search =
    (
      $("orderSearch")
        ?.value || ""
    )
    .trim()
    .toLowerCase();


  const statusFilter =
    $("orderStatusFilter")
      ?.value || "";


  const typeFilter =
    $("orderTypeFilter")
      ?.value || "";


  const filtered =
    allOrders.filter(
      order => {

        const wallet =
          extractWalletAddress(order);

        const text =
          [

            order.id,

            order.user_id,

            order.side,

            order.network,

            order.status,

            wallet,

            order.payment_method

          ]
          .join(" ")
          .toLowerCase();


        const matchesSearch =
          !search ||
          text.includes(search);


        const matchesStatus =
          !statusFilter ||
          String(
            order.status || ""
          ) ===
          statusFilter;


        const matchesType =
          !typeFilter ||
          String(
            order.side || ""
          ).toLowerCase() ===
          typeFilter;


        return (
          matchesSearch &&
          matchesStatus &&
          matchesType
        );

      }
    );


  if (
    filtered.length === 0
  ) {

    container.innerHTML =
      '<div class="empty">Aucune commande trouvée.</div>';

    return;

  }


  container.innerHTML =
    filtered
      .map(
        order => {

          const isBuy =
            String(
              order.side || ""
            ).toLowerCase() === "buy";


          const type =
            isBuy
              ? "Achat"
              : "Vente";


          const status =
            order.status ||
            "pending";


          const statusLabel =
            getOrderStatusLabel(
              status
            );


          const wallet =
            extractWalletAddress(order);


          const payoutPhone =
            extractPayoutPhone(order);


          const walletLabel =
            isBuy
              ? "Portefeuille client (envoyer les USDT ici)"
              : "Adresse de dépôt NOA utilisée";


          const walletBox =
            wallet
              ? `
                <div class="wallet-box">
                  <div class="wallet-box-label">${escapeHtml(walletLabel)}</div>
                  <div class="wallet-box-row">
                    <span class="wallet-box-value">${escapeHtml(wallet)}</span>
                    <button type="button" class="copy-btn" data-copy-wallet="${escapeHtml(wallet)}">Copier</button>
                  </div>
                  ${
                    payoutPhone
                      ? `<div class="order-card-row" style="margin-top:8px"><span>Orange Money client</span><strong>${escapeHtml(payoutPhone)}</strong></div>`
                      : ""
                  }
                </div>
              `
              : `
                <div class="wallet-box">
                  <div class="wallet-box-label">${escapeHtml(walletLabel)}</div>
                  <div class="wallet-box-value" style="color:#c62828">Adresse non trouvée dans la commande.</div>
                </div>
              `;


          return `

            <div class="order-card">

              <div class="order-card-top">
                <div>
                  <span class="order-type-badge ${isBuy ? "buy" : "sell"}">${escapeHtml(type)} USDT</span>
                  <div class="order-card-id">Commande #${escapeHtml(String(order.id || "").slice(0, 8))}</div>
                  ${
                    order.payment_proof_url
                      ? '<div class="order-card-id" style="color:#168447;font-weight:800">📎 Preuve jointe</div>'
                      : ''
                  }
                </div>
                <span class="status ${escapeHtml(status)}">${escapeHtml(statusLabel)}</span>
              </div>

              <div class="order-card-row">
                <span>Client (ID)</span>
                <strong>${escapeHtml(String(order.user_id || "-"))}</strong>
              </div>

              <div class="order-card-row">
                <span>${isBuy ? "Montant FCFA" : "Montant net à payer"}</span>
                <strong>${formatNumber(isBuy ? order.amount_cfa : (order.receive_cfa ?? order.amount_cfa))} FCFA</strong>
              </div>

              ${
                !isBuy
                  ? `
                    <div class="order-card-row">
                      <span>Montant brut (avant frais)</span>
                      <strong>${formatNumber(order.amount_cfa)} FCFA</strong>
                    </div>
                  `
                  : ""
              }

      <div class="order-card-row">
                <span>USDT</span>
                <strong>${formatDecimal(order.usdt_amount)} USDT</strong>
              </div>
              ${
                isBuy
                  ? `
                    <div class="order-card-row">
                      <span>Frais</span>
                      <strong>${formatDecimal(order.fee_usdt ?? 0)} USDT</strong>
                    </div>

                    <div class="order-card-row">
                      <span>USDT net à créditer</span>
                      <strong>${formatDecimal(order.net_usdt ?? order.usdt_amount)} USDT</strong>
                    </div>
                  `
                  : ""
              }

              <div class="order-card-row">
                <span>Réseau</span>
                <strong>${escapeHtml(order.network || "-")}</strong>
              </div>

              <div class="order-card-row">
                <span>Date</span>
                <strong>${formatDate(order.created_at)}</strong>
              </div>

              ${walletBox}

              <div class="order-card-actions">
                <button type="button" class="btn btn-secondary btn-small" data-view-order="${escapeHtml(order.id)}">Voir / Modifier le statut</button>
              </div>

            </div>

          `;

        }
      )
      .join("");

}


// ============================================================
// STATUT COMMANDE
// ============================================================

function getOrderStatusLabel(
  status
) {

  const labels = {

    pending:
      "En attente",

    processing:
      "En traitement",

    payment_declared:
      "Paiement déclaré",

    paid:
      "Paiement déclaré",

    verified:
      "Paiement vérifié",

    completed:
      "Terminée",

    rejected:
      "Rejetée",

    cancelled:
      "Annulée",

    failed:
      "Échec"

  };


  return (
    labels[status] ||
    status ||
    "En attente"
  );

}


// ============================================================
// STATISTIQUES
// ============================================================

function updateStatistics() {

  const total =
    allOrders.length;


  const pending =
    allOrders.filter(
      order =>
        order.status ===
        "pending"
    ).length;


  updateAppBadge(pending);


  const payments =
    allOrders.filter(
      order =>
        order.status ===
          "payment_declared" ||
        order.status ===
          "paid"
    ).length;


  const completed =
    allOrders.filter(
      order =>
        order.status ===
        "completed"
    ).length;


  const disputes =
    allDisputes.filter(
      dispute =>
        dispute.status ===
          "open" ||
        dispute.status ===
          "processing"
    ).length;


  if ($("statTotalOrders")) {

    $("statTotalOrders")
      .textContent =
      formatNumber(total);

  }


  if ($("statPending")) {

    $("statPending")
      .textContent =
      formatNumber(pending);

  }


  if ($("statPayments")) {

    $("statPayments")
      .textContent =
      formatNumber(payments);

  }


  if ($("statCompleted")) {

    $("statCompleted")
      .textContent =
      formatNumber(completed);

  }


  if ($("statDisputes")) {

    $("statDisputes")
      .textContent =
      formatNumber(disputes);

  }


  if ($("statUsers")) {

    $("statUsers")
      .textContent =
      formatNumber(
        allUsers.length
      );

  }

}


// ============================================================
// DETAIL COMMANDE
// ============================================================

function openOrderModal(
  orderId
) {

  selectedOrder =
    allOrders.find(
      order =>
        String(order.id) ===
        String(orderId)
    );


  if (!selectedOrder) {

    return;

  }


  const status =
    selectedOrder.status ||
    "pending";


  const network =
    selectedOrder.network ||
    "-";


  const isBuy =
    String(
      selectedOrder.side || ""
    ).toLowerCase() === "buy";


  const wallet =
    extractWalletAddress(selectedOrder);


  const payoutPhone =
    extractPayoutPhone(selectedOrder);


  const details =
    $("orderDetails");


  if (!details) {

    return;

  }


  details.innerHTML = `

    <div class="detail-row">

      <span>ID</span>

      <strong>
        ${escapeHtml(
          selectedOrder.id
        )}
      </strong>

    </div>


    <div class="detail-row">

      <span>Utilisateur</span>

      <strong>
        ${escapeHtml(
          selectedOrder.user_id || "-"
        )}
      </strong>

    </div>


    <div class="detail-row">

      <span>Type</span>

      <strong>

        ${
          isBuy
            ? "Achat USDT"
            : "Vente USDT"
        }

      </strong>

    </div>


    <div class="detail-row">

      <span>${isBuy ? "Montant FCFA" : "Montant net à payer au client"}</span>

      <strong>

        ${formatNumber(
          isBuy
            ? selectedOrder.amount_cfa
            : (selectedOrder.receive_cfa ?? selectedOrder.amount_cfa)
        )}
        FCFA

      </strong>

    </div>

    ${
      !isBuy
        ? `
          <div class="detail-row">
            <span>Montant brut (avant frais)</span>
            <strong>
              ${formatNumber(selectedOrder.amount_cfa)}
              FCFA
            </strong>
          </div>

          <div class="detail-row">
            <span>Frais prélevés</span>
            <strong>
              ${formatNumber(
                Math.max(
                  (Number(selectedOrder.amount_cfa) || 0) -
                    (Number(selectedOrder.receive_cfa) || 0),
                  0
                )
              )}
              FCFA
            </strong>
          </div>
        `
        : ""
    }


    <div class="detail-row">

      <span>Montant USDT</span>

      <strong>

        ${formatDecimal(
          selectedOrder.usdt_amount
        )}
        USDT

      </strong>

    </div>


    <div class="detail-row">

      <span>USDT net</span>

      <strong>

        ${formatDecimal(
          selectedOrder.net_usdt
        )}
        USDT

      </strong>

    </div>


    <div class="detail-row">

      <span>Frais</span>

      <strong>

        ${formatDecimal(
          selectedOrder.fee_usdt
        )}
        USDT

      </strong>

    </div>


    <div class="detail-row">

      <span>Réseau</span>

      <strong>

        ${escapeHtml(
          network
        )}

      </strong>

    </div>


    <div class="detail-row">

      <span>${isBuy ? "Portefeuille client" : "Adresse de dépôt NOA"}</span>

      <strong>

        ${escapeHtml(
          wallet || "-"
        )}

      </strong>

    </div>

    ${
      wallet
        ? `
          <div class="wallet-box">
            <div class="wallet-box-label">${isBuy ? "Envoyer les USDT à cette adresse" : "Adresse de dépôt utilisée"}</div>
            <div class="wallet-box-row">
              <span class="wallet-box-value">${escapeHtml(wallet)}</span>
              <button type="button" class="copy-btn" data-copy-wallet="${escapeHtml(wallet)}">Copier</button>
            </div>
          </div>
        `
        : ""
    }

    ${
      payoutPhone
        ? `
          <div class="detail-row">
            <span>Orange Money client</span>
            <strong>${escapeHtml(payoutPhone)}</strong>
          </div>
        `
        : ""
    }


    <div class="detail-row">

      <span>Paiement</span>

      <strong>

        ${escapeHtml(
          selectedOrder.payment_method ||
          "Orange Money"
        )}

      </strong>

    </div>


    <div class="detail-row">

      <span>Statut</span>

      <strong>

        ${escapeHtml(
          getOrderStatusLabel(
            status
          )
        )}

      </strong>

    </div>


    <div class="detail-row">

      <span>Date</span>

      <strong>

        ${formatDate(
          selectedOrder.created_at
        )}

      </strong>

    </div>

    ${
      selectedOrder.payment_proof_url
        ? `
          <div class="wallet-box" id="proofImageBox">
            <div class="wallet-box-label">Preuve de paiement</div>
            <div class="small">Chargement de l'image...</div>
          </div>
        `
        : ""
    }

  `;


  if (
    selectedOrder.payment_proof_url
  ) {

    loadPaymentProofPreview(
      selectedOrder.payment_proof_url
    );

  }


  // ----------------------------------------------------------
  // SELECT STATUT
  // ----------------------------------------------------------

  const statusSelect =
    $("orderStatusSelect");


  if (statusSelect) {

    statusSelect.value =
      status;

  }


  clearMessage(
    "orderModalMessage"
  );


  $("orderModal")
    ?.classList
    .add("show");

}


// ============================================================
// MODIFIER STATUT COMMANDE
// ============================================================

async function updateOrderStatus(
  status
) {

  if (!selectedOrder) {

    return;

  }


  const allowedStatuses = [

    "pending",

    "payment_declared",

    "paid",

    "verified",

    "processing",

    "completed",

    "rejected",

    "cancelled"

  ];


  if (
    !allowedStatuses.includes(
      status
    )
  ) {

    showMessage(
      "orderModalMessage",
      "Statut invalide."
    );

    return;

  }


  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .from("orders")
        .update({

          status

        })
        .eq(
          "id",
          selectedOrder.id
        )
        .select("*")
        .single();


    if (error) {

      throw error;

    }


    selectedOrder =
      data;


    const index =
      allOrders.findIndex(
        order =>
          String(order.id) ===
          String(data.id)
      );


    if (index !== -1) {

      allOrders[index] =
        data;

    }


    renderOrders();

    updateStatistics();


    openOrderModal(
      data.id
    );


    showMessage(
      "orderModalMessage",
      "Statut de la commande mis à jour.",
      "success"
    );

  }

  catch (error) {

    console.error(
      "Erreur statut commande:",
      error
    );


    showMessage(
      "orderModalMessage",
      "Impossible de modifier la commande : " +
      getErrorMessage(error)
    );

  }

}


// ============================================================
// LITIGES
// ============================================================

async function loadDisputes() {

  const body =
    $("disputesTableBody");


  if (body) {

    body.innerHTML = `

      <tr>

        <td
          colspan="7"
          style="text-align:center"
        >

          Chargement des litiges...

        </td>

      </tr>

    `;

  }


  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .from("disputes")
        .select("*")
        .order(
          "created_at",
          {
            ascending: false
          }
        );


    if (error) {

      throw error;

    }


    allDisputes =
      data || [];


    renderDisputes();

    updateStatistics();

  }

  catch (error) {

    console.error(
      "Erreur litiges admin:",
      error
    );


    if (body) {

      body.innerHTML = `

        <tr>

          <td
            colspan="7"
            style="text-align:center"
          >

            Impossible de charger les litiges.

          </td>

        </tr>

      `;

    }

  }

}


// ============================================================
// AFFICHAGE LITIGES
// ============================================================

function renderDisputes() {

  const body =
    $("disputesTableBody");


  if (!body) {

    return;

  }


  if (
    allDisputes.length === 0
  ) {

    body.innerHTML = `

      <tr>

        <td
          colspan="7"
          style="text-align:center"
        >

          Aucun litige.

        </td>

      </tr>

    `;

    return;

  }


  body.innerHTML =
    allDisputes
      .map(
        dispute => {

          const status =
            dispute.status ||
            "open";


          return `

            <tr>

              <td>

                ${escapeHtml(
                  String(
                    dispute.id || ""
                  ).slice(0, 8)
                )}

              </td>


              <td>

                ${escapeHtml(
                  String(
                    dispute.order_id || ""
                  ).slice(0, 8)
                )}

              </td>


              <td>

                ${escapeHtml(
                  String(
                    dispute.user_id || ""
                  ).slice(0, 8)
                )}

              </td>


              <td>

                ${escapeHtml(
                  dispute.subject || "-"
                )}

              </td>


              <td>

                <span class="status">

                  ${escapeHtml(
                    getDisputeStatusLabel(
                      status
                    )
                  )}

                </span>

              </td>


              <td>

                ${formatDate(
                  dispute.created_at
                )}

              </td>


              <td>

                <button
                  class="action-btn"
                  type="button"
                  data-view-dispute="${escapeHtml(
                    dispute.id
                  )}"
                >

                  Voir

                </button>

              </td>

            </tr>

          `;

        }
      )
      .join("");

}


// ============================================================
// STATUT LITIGE
// ============================================================

function getDisputeStatusLabel(
  status
) {

  const labels = {

    open:
      "Ouvert",

    processing:
      "En traitement",

    resolved:
      "Résolu",

    closed:
      "Fermé",

    cancelled:
      "Annulé"

  };


  return (
    labels[status] ||
    status ||
    "Ouvert"
  );

}


// ============================================================
// DETAIL LITIGE
// ============================================================

function openDisputeModal(
  disputeId
) {

  selectedDispute =
    allDisputes.find(
      dispute =>
        String(dispute.id) ===
        String(disputeId)
    );


  if (!selectedDispute) {

    return;

  }


  const details =
    $("disputeDetails");


  if (!details) {

    return;

  }


  details.innerHTML = `

    <div class="detail-row">

      <span>ID</span>

      <strong>

        ${escapeHtml(
          selectedDispute.id
        )}

      </strong>

    </div>


    <div class="detail-row">

      <span>Commande</span>

      <strong>

        ${escapeHtml(
          selectedDispute.order_id || "-"
        )}

      </strong>

    </div>


    <div class="detail-row">

      <span>Utilisateur</span>

      <strong>

        ${escapeHtml(
          selectedDispute.user_id || "-"
        )}

      </strong>

    </div>


    <div class="detail-row">

      <span>Sujet</span>

      <strong>

        ${escapeHtml(
          selectedDispute.subject || "-"
        )}

      </strong>

    </div>


    <div class="detail-row">

      <span>Message</span>

      <strong>

        ${escapeHtml(
          selectedDispute.message || "-"
        )}

      </strong>

    </div>


    <div class="detail-row">

      <span>Statut</span>

      <strong>

        ${escapeHtml(
          getDisputeStatusLabel(
            selectedDispute.status
          )
        )}

      </strong>

    </div>


    <div class="detail-row">

      <span>Date</span>

      <strong>

        ${formatDate(
          selectedDispute.created_at
        )}

      </strong>

    </div>

  `;


  const statusSelect =
    $("disputeStatusSelect");


  if (statusSelect) {

    statusSelect.value =
      selectedDispute.status ||
      "open";

  }


  clearMessage(
    "disputeModalMessage"
  );


  $("disputeModal")
    ?.classList
    .add("show");

}


// ============================================================
// MODIFICATION LITIGE
// ============================================================

async function updateDisputeStatus(
  status
) {

  if (!selectedDispute) {

    return;

  }


  const allowed = [

    "open",

    "processing",

    "resolved",

    "closed",

    "cancelled"

  ];


  if (
    !allowed.includes(status)
  ) {

    showMessage(
      "disputeModalMessage",
      "Statut de litige invalide."
    );

    return;

  }


  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .from("disputes")
        .update({

          status

        })
        .eq(
          "id",
          selectedDispute.id
        )
        .select("*")
        .single();


    if (error) {

      throw error;

    }


    selectedDispute =
      data;


    const index =
      allDisputes.findIndex(
        dispute =>
          String(dispute.id) ===
          String(data.id)
      );


    if (index !== -1) {

      allDisputes[index] =
        data;

    }


    renderDisputes();

    updateStatistics();


    openDisputeModal(
      data.id
    );


    showMessage(
      "disputeModalMessage",
      "Statut du litige mis à jour.",
      "success"
    );

  }

  catch (error) {

    console.error(
      "Erreur statut litige:",
      error
    );


    showMessage(
      "disputeModalMessage",
      "Impossible de modifier le litige : " +
      getErrorMessage(error)
    );

  }

}


// ============================================================
// UTILISATEURS
// ============================================================

async function loadUsers() {

  const body =
    $("usersTableBody");


  if (body) {

    body.innerHTML = `

      <tr>

        <td
          colspan="5"
          style="text-align:center"
        >

          Chargement des utilisateurs...

        </td>

      </tr>

    `;

  }


  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .from("profiles")
        .select(
          "id,full_name,phone,country,role"
        )
        .order(
          "full_name",
          {
            ascending: true
          }
        );


    if (error) {

      throw error;

    }


    allUsers =
      data || [];


    renderUsers();

    updateStatistics();

  }

  catch (error) {

    console.error(
      "Erreur utilisateurs admin:",
      error
    );


    if (body) {

      body.innerHTML = `

        <tr>

          <td
            colspan="5"
            style="text-align:center"
          >

            Impossible de charger les utilisateurs.

          </td>

        </tr>

      `;

    }

  }

}


// ============================================================
// AFFICHAGE UTILISATEURS
// ============================================================

function renderUsers() {

  const body =
    $("usersTableBody");


  if (!body) {

    return;

  }


  const search =
    (
      $("userSearch")
        ?.value || ""
    )
    .trim()
    .toLowerCase();


  const filtered =
    allUsers.filter(
      user => {

        const text =
          [

            user.id,

            user.full_name,

            user.phone,

            user.country,

            user.role

          ]
          .join(" ")
          .toLowerCase();


        return (
          !search ||
          text.includes(search)
        );

      }
    );


  if (
    filtered.length === 0
  ) {

    body.innerHTML = `

      <tr>

        <td
          colspan="5"
          style="text-align:center"
        >

          Aucun utilisateur trouvé.

        </td>

      </tr>

    `;

    return;

  }


  body.innerHTML =
    filtered
      .map(
        user => {

          return `

            <tr>

              <td>

                ${escapeHtml(
                  user.full_name || "-"
                )}

              </td>


              <td>

                ${escapeHtml(
                  user.phone || "-"
                )}

              </td>


              <td>

                ${escapeHtml(
                  user.country || "-"
                )}

              </td>


              <td>

                ${escapeHtml(
                  user.role || "user"
                )}

              </td>


              <td>

                <small>

                  ${escapeHtml(
                    user.id
                  )}

                </small>

              </td>

            </tr>

          `;

        }
      )
      .join("");

}


// ============================================================
// DECONNEXION
// ============================================================

async function adminLogout() {

  try {

    await supabaseClient
      .auth
      .signOut();

  }

  catch (error) {

    console.error(
      "Erreur déconnexion admin:",
      error
    );

  }


  currentUser = null;

  currentProfile = null;

  currentSettings = null;

  allOrders = [];

  allDisputes = [];

  allUsers = [];

  selectedOrder = null;

  selectedDispute = null;


  showLoginPage();

}


// ============================================================
// FERMER MODAL
// ============================================================

function closeOrderModal() {

  $("orderModal")
    ?.classList
    .remove("show");

  selectedOrder = null;

}


function closeDisputeModal() {

  $("disputeModal")
    ?.classList
    .remove("show");

  selectedDispute = null;

}


// ============================================================
// EVENEMENTS
// ============================================================

function setupEvents() {

  // ----------------------------------------------------------
  // LOGIN
  // ----------------------------------------------------------

  $("adminLoginForm")
    ?.addEventListener(
      "submit",
      adminLogin
    );


  // ----------------------------------------------------------
  // LOGOUT
  // ----------------------------------------------------------

  $("adminLogoutBtn")
    ?.addEventListener(
      "click",
      adminLogout
    );


  // ----------------------------------------------------------
  // PARAMETRES
  // ----------------------------------------------------------

  const settingsForm =
    $("settingsForm") ||
    $("adminSettingsForm");


  settingsForm
    ?.addEventListener(
      "submit",
      saveSettings
    );


  $("saveSettingsBtn")
    ?.addEventListener(
      "click",
      saveSettings
    );


  $("saveSettingsButton")
    ?.addEventListener(
      "click",
      saveSettings
    );


  $("settingsSaveBtn")
    ?.addEventListener(
      "click",
      saveSettings
    );


  // ----------------------------------------------------------
  // APERCU EN TEMPS REEL
  // ----------------------------------------------------------

  [

    "buyRate",

    "adminBuyRate",

    "settingsBuyRate",

    "sellRate",

    "adminSellRate",

    "settingsSellRate",

    "minOrderCfa",

    "minOrder",

    "adminMinOrder",

    "settingsMinOrder",

    "maxOrderCfa",

    "maxOrder",

    "adminMaxOrder",

    "settingsMaxOrder",

    "trc20Fee",

    "trc20FeeUsdt",

    "adminTrc20Fee",

    "settingsTrc20Fee",

    "bp20Fee",

    "bep20Fee",

    "bp20FeeUsdt",

    "bep20FeeUsdt",

    "adminBp20Fee",

    "adminBep20Fee",

    "settingsBp20Fee",

    "orangeMoneyNumber",

    "orangeMoney",

    "orangeMoneyPhone",

    "adminOrangeMoneyNumber",

    "settingsOrangeMoneyNumber"

  ]
  .forEach(
    id => {

      $(id)
        ?.addEventListener(
          "input",
          updateSettingsPreview
        );

    }
  );


  // ----------------------------------------------------------
  // ONGLETS
  // ----------------------------------------------------------

  document
    .querySelectorAll(".tab")
    .forEach(
      tab => {

        tab.addEventListener(
          "click",
          () => {

            document
              .querySelectorAll(".tab")
              .forEach(
                item =>
                  item.classList.remove(
                    "active"
                  )
              );


            document
              .querySelectorAll(
                ".admin-section"
              )
              .forEach(
                section =>
                  section.classList.remove(
                    "active"
                  )
              );


            tab.classList.add(
              "active"
            );


            const sectionId =
              tab.dataset.section;


            if (sectionId) {

              $(sectionId)
                ?.classList
                .add("active");

            }

          }
        );

      }
    );


  // ----------------------------------------------------------
  // COMMANDES
  // ----------------------------------------------------------

  $("orderSearch")
    ?.addEventListener(
      "input",
      renderOrders
    );


  $("orderStatusFilter")
    ?.addEventListener(
      "change",
      renderOrders
    );


  $("orderTypeFilter")
    ?.addEventListener(
      "change",
      renderOrders
    );


  $("refreshOrdersBtn")
    ?.addEventListener(
      "click",
      loadOrders
    );


  // ----------------------------------------------------------
  // SELECT STATUT COMMANDE
  // ----------------------------------------------------------

  $("orderStatusSelect")
    ?.addEventListener(
      "change",
      event => {

        updateOrderStatus(
          event.target.value
        );

      }
    );


  // ----------------------------------------------------------
  // SELECT STATUT LITIGE
  // ----------------------------------------------------------

  $("disputeStatusSelect")
    ?.addEventListener(
      "change",
      event => {

        updateDisputeStatus(
          event.target.value
        );

      }
    );


  // ----------------------------------------------------------
  // ACTIONS TABLEAUX
  // ----------------------------------------------------------

  document.addEventListener(
    "click",
    event => {

      const orderButton =
        event.target.closest(
          "[data-view-order]"
        );


      if (orderButton) {

        openOrderModal(
          orderButton.dataset.viewOrder
        );

        return;

      }


      const copyButton =
        event.target.closest(
          "[data-copy-wallet]"
        );


      if (copyButton) {

        copyToClipboard(
          copyButton.dataset.copyWallet,
          copyButton
        );

        return;

      }


      const orderStatusButton =
        event.target.closest(
          "[data-order-status]"
        );


      if (orderStatusButton) {

        updateOrderStatus(
          orderStatusButton
            .dataset
            .orderStatus
        );

        return;

      }


      const disputeButton =
        event.target.closest(
          "[data-view-dispute]"
        );


      if (disputeButton) {

        openDisputeModal(
          disputeButton.dataset.viewDispute
        );

        return;

      }


      const disputeStatusButton =
        event.target.closest(
          "[data-dispute-status]"
        );


      if (disputeStatusButton) {

        updateDisputeStatus(
          disputeStatusButton
            .dataset
            .disputeStatus
        );

      }

    }
  );


  // ----------------------------------------------------------
  // FERMETURE COMMANDE
  // ----------------------------------------------------------

  $("closeOrderModalBtn")
    ?.addEventListener(
      "click",
      closeOrderModal
    );


  $("closeOrderModal")
    ?.addEventListener(
      "click",
      closeOrderModal
    );


  // ----------------------------------------------------------
  // FERMETURE LITIGE
  // ----------------------------------------------------------

  $("closeDisputeModalBtn")
    ?.addEventListener(
      "click",
      closeDisputeModal
    );


  $("closeDisputeModal")
    ?.addEventListener(
      "click",
      closeDisputeModal
    );


  // ----------------------------------------------------------
  // ACTUALISATION LITIGES
  // ----------------------------------------------------------

  $("refreshDisputesBtn")
    ?.addEventListener(
      "click",
      loadDisputes
    );


  // ----------------------------------------------------------
  // UTILISATEURS
  // ----------------------------------------------------------

  $("userSearch")
    ?.addEventListener(
      "input",
      renderUsers
    );


  $("refreshUsersBtn")
    ?.addEventListener(
      "click",
      loadUsers
    );


  // ----------------------------------------------------------
  // FERMETURE MODALS EN DEHORS
  // ----------------------------------------------------------

  $("orderModal")
    ?.addEventListener(
      "click",
      event => {

        if (
          event.target ===
          $("orderModal")
        ) {

          closeOrderModal();

        }

      }
    );


  $("disputeModal")
    ?.addEventListener(
      "click",
      event => {

        if (
          event.target ===
          $("disputeModal")
        ) {

          closeDisputeModal();

        }

      }
    );


  // ----------------------------------------------------------
  // TOUCHE ECHAP
  // ----------------------------------------------------------

  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Escape"
      ) {

        closeOrderModal();

        closeDisputeModal();

      }

    }
  );

}


// ============================================================
// AUTH LISTENER
// ============================================================

function setupAuthListener() {

  if (authListenerReady) {

    return;

  }


  authListenerReady = true;


  supabaseClient.auth
    .onAuthStateChange(
      (
        event,
        session
      ) => {

        console.log(
          "ADMIN AUTH:",
          event
        );


        // ----------------------------------------------------
        // DECONNEXION
        // ----------------------------------------------------

        if (
          event ===
          "SIGNED_OUT"
        ) {

          currentUser = null;

          currentProfile = null;

          currentSettings = null;

          showLoginPage();

          return;

        }


        // ----------------------------------------------------
        // CONNEXION
        // ----------------------------------------------------

        if (
          event ===
            "SIGNED_IN" &&
          session?.user
        ) {

          currentUser =
            session.user;


          // Ne pas bloquer le callback Supabase
          setTimeout(
            async () => {

              const isAdmin =
                await verifyAdmin();


              if (!isAdmin) {

                await supabaseClient
                  .auth
                  .signOut();


                currentUser = null;

                currentProfile = null;


                showLoginPage();


                showLoginMessage(
                  "Accès refusé. Ce compte n'est pas administrateur."
                );


                return;

              }


              showAdminPage();

              await loadDashboard();

              initNotifUI();
              initRealtimeAlerts();

            },
            0
          );

        }

      }
    );

}


// ============================================================
// NOTIFICATIONS TEMPS REEL
// ============================================================

let notifItems = [];


function formatNotifTime(date) {

  try {

    return new Date(date).toLocaleString(
      "fr-FR",
      {

        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"

      }
    );

  } catch (error) {

    return "";
  }
}


function renderNotifPanel() {

  const list =
    $("notifList");

  const badge =
    $("notifBadge");


  if (badge) {

    if (notifItems.length > 0) {

      badge.textContent =
        notifItems.length > 9
          ? "9+"
          : String(notifItems.length);

      badge.classList.remove(
        "hidden"
      );

    } else {

      badge.classList.add(
        "hidden"
      );
    }
  }


  if (!list) {

    return;
  }


  if (notifItems.length === 0) {

    list.innerHTML =
      `<div class="notif-empty">Aucune notification pour le moment.</div>`;

    return;
  }


  list.innerHTML =
    notifItems
      .map(
        (item) => `

          <div class="notif-item">

            <div class="notif-item-title">
              ${item.icon} ${escapeHtml(item.title)}
            </div>

            <div>
              ${escapeHtml(item.description)}
            </div>

            <div class="notif-item-time">
              ${formatNotifTime(item.time)}
            </div>

          </div>

        `
      )
      .join("");
}


function pushNotification(
  icon,
  title,
  description
) {

  notifItems.unshift({

    icon,

    title,

    description,

    time: new Date()

  });


  if (notifItems.length > 30) {

    notifItems =
      notifItems.slice(0, 30);
  }


  renderNotifPanel();


  try {

    if (
      "Notification" in window &&
      Notification.permission === "granted"
    ) {

      new Notification(
        title,
        {
          body: description,
          icon: undefined
        }
      );
    }

  } catch (error) {

    console.error(
      "Erreur notification navigateur :",
      error
    );
  }
}


function initNotifUI() {

  const bellBtn =
    $("notifBellBtn");

  const panel =
    $("notifPanel");

  const clearBtn =
    $("notifClearBtn");


  bellBtn?.addEventListener(
    "click",
    () => {

      panel?.classList.toggle(
        "hidden"
      );
    }
  );


  clearBtn?.addEventListener(
    "click",
    () => {

      notifItems = [];

      renderNotifPanel();
    }
  );


  document.addEventListener(
    "click",
    (event) => {

      if (
        !panel ||
        panel.classList.contains("hidden")
      ) {

        return;
      }


      if (
        panel.contains(event.target) ||
        bellBtn?.contains(event.target)
      ) {

        return;
      }


      panel.classList.add(
        "hidden"
      );
    }
  );
}


let realtimeAlertsInitialized = false;


function initRealtimeAlerts() {

  if (realtimeAlertsInitialized) {

    return;
  }

  realtimeAlertsInitialized = true;

  try {

    if (
      "Notification" in window &&
      Notification.permission === "default"
    ) {

      Notification.requestPermission();
    }

  } catch (error) {

    console.error(
      "Erreur permission notification :",
      error
    );
  }


  try {

    supabaseClient
      .channel("admin-orders-alerts")
      .on(
        "postgres_changes",
        {

          event: "INSERT",
          schema: "public",
          table: "orders"

        },
        (payload) => {

          const order =
            payload.new || {};

          const side =
            order.side === "sell"
              ? "Vente"
              : "Achat";

          pushNotification(
            "🛒",
            "Nouvelle commande",
            `${side} — commande #${String(order.id || "").slice(0, 8)}`
          );
        }
      )
      .subscribe();


    supabaseClient
      .channel("admin-users-alerts")
      .on(
        "postgres_changes",
        {

          event: "INSERT",
          schema: "public",
          table: "profiles"

        },
        (payload) => {

          const profile =
            payload.new || {};

          pushNotification(
            "👤",
            "Nouvel utilisateur",
            profile.full_name ||
              profile.email ||
              "Un nouvel utilisateur s'est inscrit."
          );
        }
      )
      .subscribe();

  } catch (error) {

    console.error(
      "Erreur abonnement temps réel :",
      error
    );
  }
}


// ============================================================
// DEMARRAGE
// ============================================================

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    console.log(
      "================================================"
    );

    console.log(
      "NOA DIGIT TRADE ADMIN"
    );

    console.log(
      "Démarrage espace administrateur..."
    );

    console.log(
      "================================================"
    );


    setupEvents();

    setupAuthListener();

    await checkSession();

  }
);
