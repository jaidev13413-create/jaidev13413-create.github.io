/**
 * Main Application Controller for Digital Bahi-Khata (डिजिटल बही-खाता)
 * Manages UI interactions, bilingual state, modal sheets, and ledger calculations.
 */

// Multi-lingual dictionary for Personal Money-Lending & Debt Ledger
const I18N = {
  HI: {
    appTitle: "उधार-बाकी डायरी",
    appSubtitle: "निजी लेन-देन व सैकड़ा ब्याज हिसाब",
    totalOutstanding: "कुल उधार दिया पैसा (लेना बाकी)",
    totalGave: "कुल उधार दिया",
    totalGot: "कुल वापस मिला",
    overdueCount: "वापसी तारीख बीती",
    searchPlaceholder: "नाम, फोन या पता खोजें...",
    tabAll: "सभी खाते (All)",
    tabOverdue: "वापसी तारीख बीती (Overdue)",
    tabDueSoon: "जल्द वापसी (Due Soon)",
    tabInterest: "सैकड़ा ब्याज वाले",
    addCustomerBtn: "+ नया उधार खाता जोड़ें",
    calcBtnText: "🧮 ब्याज कैलकुलेटर",
    gaveLabel: "उधार दिया (- Lent)",
    gotLabel: "पैसे वापस मिले (+ Got)",
    dueLabel: "वापस करने की वादा तारीख",
    balanceLabel: "बाकी रकम",
    whatsappBtn: "व्हाट्सएप स्मरण",
    viewLedgerBtn: "खाता देखें",
    noRecords: "कोई उधार खाता नहीं मिला",
    activeBadge: "चालू",
    dueSoonBadge: "जल्द वापसी",
    overdueBadge: "समय पार",
    saikdaRateLabel: "₹/सैकड़ा प्रति माह",
    interestOffLabel: "बिना ब्याज",
    interestOnLabel: "सैकड़ा ब्याज लागू",
    deleteBtn: "हटाएं",
  },
  EN: {
    appTitle: "Personal Debt Ledger",
    appSubtitle: "Personal Lending & Saikda Interest Diary",
    totalOutstanding: "Total Money Lent (To Collect)",
    totalGave: "Total Lent",
    totalGot: "Total Repaid",
    overdueCount: "Overdue Accounts",
    searchPlaceholder: "Search name, phone, address...",
    tabAll: "All Accounts",
    tabOverdue: "Overdue",
    tabDueSoon: "Due Soon",
    tabInterest: "Interest Accounts",
    addCustomerBtn: "+ Add Loan Account",
    calcBtnText: "🧮 Interest Calc",
    gaveLabel: "Money Lent (- Lent)",
    gotLabel: "Repaid (+ Got)",
    dueLabel: "Promised Return Date",
    balanceLabel: "Balance Due",
    whatsappBtn: "WhatsApp Reminder",
    viewLedgerBtn: "View Ledger",
    noRecords: "No loan accounts found",
    activeBadge: "Active",
    dueSoonBadge: "Due Soon",
    overdueBadge: "Overdue",
    saikdaRateLabel: "₹ Saikda / Month",
    interestOffLabel: "Interest Free",
    interestOnLabel: "Saikda Interest Active",
    deleteBtn: "Delete",
  }
};

const AppState = {
  currentLang: "HI",
  activeFilter: "all",
  searchQuery: "",
  customers: [],
  selectedCustomer: null,
  activeTxType: "CREDIT_GIVEN", // or PAYMENT_RECEIVED
};

// Document Ready Bootstrap
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await Storage.init();
    registerServiceWorker();
    initApp();
  } catch (err) {
    console.error("Initialization Error:", err);
  }
});

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js?v=6").then((reg) => {
      reg.update();
    }).catch((err) => {
      console.log("Service Worker Registration Notice:", err);
    });
  }
}

async function initApp() {
  setupEventListeners();
  updateLanguageUI();
  await loadMerchantProfile();
  await loadDashboardData();
}

function setupEventListeners() {
  // Language Toggle
  document.getElementById("btn-lang-toggle").addEventListener("click", () => {
    AppState.currentLang = AppState.currentLang === "HI" ? "EN" : "HI";
    updateLanguageUI();
    renderCustomerList();
  });

  // Search input
  document.getElementById("search-input").addEventListener("input", (e) => {
    AppState.searchQuery = e.target.value.toLowerCase().trim();
    renderCustomerList();
  });

  // Filter chips
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      AppState.activeFilter = chip.dataset.filter;
      renderCustomerList();
    });
  });

  // Open Add Customer Modal
  document.getElementById("btn-add-customer").addEventListener("click", () => {
    openModal("modal-add-customer");
  });

  // Standalone Interest Calculator Modal
  document.getElementById("btn-open-calc").addEventListener("click", () => {
    // Set default dates: 1 month interval
    const today = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(today.getMonth() - 1);

    document.getElementById("calc-start-date").value = oneMonthAgo.toISOString().split("T")[0];
    document.getElementById("calc-end-date").value = today.toISOString().split("T")[0];
    runStandaloneCalculator();
    openModal("modal-standalone-calc");
  });

  // Standalone Calculator Inputs Dynamic Recalculation
  ["calc-principal", "calc-rate", "calc-start-date", "calc-end-date", "calc-compound-mode", "calc-basis"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", runStandaloneCalculator);
      el.addEventListener("change", runStandaloneCalculator);
    }
  });

  // Add Customer Form Submit
  document.getElementById("form-add-customer").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("cust-name-input").value.trim();
    const phone = document.getElementById("cust-phone-input").value.trim();
    const village = document.getElementById("cust-village-input").value.trim();
    const limit = document.getElementById("cust-limit-input").value;
    const interestEnabled = document.getElementById("cust-interest-toggle").checked;
    const rate = document.getElementById("cust-rate-input").value;
    const compoundingMode = document.getElementById("cust-compound-select").value;

    if (!name || !phone) {
      alert("कृपया नाम और मोबाइल नंबर भरें!");
      return;
    }

    await Storage.addCustomer({
      name,
      phone,
      village,
      credit_limit: limit,
      interest_enabled: interestEnabled,
      monthly_rate_pct: rate,
      compounding_mode: compoundingMode
    });

    closeModal("modal-add-customer");
    document.getElementById("form-add-customer").reset();
    await loadDashboardData();
  });

  // Add Customer Interest Toggle Checkbox
  document.getElementById("cust-interest-toggle").addEventListener("change", (e) => {
    const intBox = document.getElementById("cust-interest-fields");
    intBox.style.display = e.target.checked ? "block" : "none";
  });

  // Add Transaction Toggle Buttons (Gave vs Got)
  document.getElementById("btn-tx-gave").addEventListener("click", () => {
    selectTxType("CREDIT_GIVEN");
  });
  document.getElementById("btn-tx-got").addEventListener("click", () => {
    selectTxType("PAYMENT_RECEIVED");
  });

  // Add Transaction Form Submit
  document.getElementById("form-add-tx").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!AppState.selectedCustomer) return;

    const amount = parseFloat(document.getElementById("tx-amount-input").value);
    const date = document.getElementById("tx-date-input").value;
    const dueDate = document.getElementById("tx-due-input").value || null;
    const details = document.getElementById("tx-details-input").value.trim();
    const mode = document.getElementById("tx-mode-select").value;

    if (isNaN(amount) || amount <= 0) {
      alert("कृपया वैध रकम भरें!");
      return;
    }

    await Storage.addTransaction({
      customer_id: AppState.selectedCustomer.id,
      type: AppState.activeTxType,
      amount,
      date,
      due_date: dueDate,
      item_details: details,
      payment_mode: mode
    });

    closeModal("modal-add-tx");
    document.getElementById("form-add-tx").reset();
    // Refresh ledger view and dashboard
    await openCustomerLedger(AppState.selectedCustomer.id);
    await loadDashboardData();
  });

  // Ledger Action Buttons
  document.getElementById("ledger-btn-gave").addEventListener("click", () => {
    selectTxType("CREDIT_GIVEN");
    prepareTxModal();
    openModal("modal-add-tx");
  });

  document.getElementById("ledger-btn-got").addEventListener("click", () => {
    selectTxType("PAYMENT_RECEIVED");
    prepareTxModal();
    openModal("modal-add-tx");
  });

  document.getElementById("ledger-btn-whatsapp").addEventListener("click", () => {
    if (AppState.selectedCustomer) {
      openWhatsAppReminderModal(AppState.selectedCustomer);
    }
  });

  document.getElementById("ledger-btn-settle").addEventListener("click", () => {
    if (AppState.selectedCustomer) {
      openSettlementModal(AppState.selectedCustomer);
    }
  });

  document.getElementById("ledger-btn-print").addEventListener("click", () => {
    window.print();
  });

  // Customer Delete Option Handlers
  const handleLedgerDelete = () => {
    if (AppState.selectedCustomer) promptDeleteCustomer(AppState.selectedCustomer);
  };

  const delTop = document.getElementById("ledger-btn-delete");
  if (delTop) delTop.addEventListener("click", handleLedgerDelete);

  const delBottom = document.getElementById("ledger-btn-delete-bottom");
  if (delBottom) delBottom.addEventListener("click", handleLedgerDelete);

  document.getElementById("btn-cancel-delete").addEventListener("click", () => {
    closeModal("modal-delete-customer");
  });

  document.getElementById("btn-confirm-delete").addEventListener("click", async () => {
    if (!AppState.selectedCustomer) return;
    const custId = AppState.selectedCustomer.id;
    const custName = AppState.selectedCustomer.name;

    try {
      // 1. Backend API delete call
      await fetch("/api/customers/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: custId, force: true })
      }).catch((e) => console.log("Backend offline or synced locally"));

      // 2. Client-side IndexedDB delete
      await Storage.deleteCustomer(custId);

      closeModal("modal-delete-customer");
      closeModal("modal-customer-ledger");
      AppState.selectedCustomer = null;
      await loadDashboardData();

      alert(`✅ ${custName} का खाता और लेन-देन सफलतापूर्वक हटा दिए गए।`);
    } catch (err) {
      console.error("Error deleting customer:", err);
      alert("खाता हटाने में त्रुटि हुई!");
    }
  });

  // Lock Screen & MPIN Handlers
  document.getElementById("btn-app-lock").addEventListener("click", () => {
    lockApp();
  });

  document.querySelectorAll(".pin-key[data-digit]").forEach((key) => {
    key.addEventListener("click", () => {
      handlePinDigit(key.dataset.digit);
    });
  });

  document.getElementById("btn-pin-clear").addEventListener("click", () => {
    clearPin();
  });

  document.getElementById("btn-pin-backspace").addEventListener("click", () => {
    backspacePin();
  });

  document.getElementById("btn-quick-unlock").addEventListener("click", () => {
    unlockApp();
  });

  // Settlement Form Dynamic Recalculation
  document.getElementById("settle-payment-input").addEventListener("input", runSettlementCalculation);
  document.getElementById("settle-waiver-input").addEventListener("input", runSettlementCalculation);

  // Settle Account Confirm Submit
  document.getElementById("form-settlement").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!AppState.selectedCustomer) return;

    const paymentAmount = parseFloat(document.getElementById("settle-payment-input").value) || 0;
    const waiverAmount = parseFloat(document.getElementById("settle-waiver-input").value) || 0;
    const todayStr = new Date().toISOString().split("T")[0];

    // Record waiver transaction if any discount given
    if (waiverAmount > 0) {
      await Storage.addTransaction({
        customer_id: AppState.selectedCustomer.id,
        type: "DISCOUNT_WAIVED",
        amount: waiverAmount,
        date: todayStr,
        item_details: "खाता चुकता करने पर ब्याज छूट (Waived Interest)",
        payment_mode: "ADJUSTMENT"
      });
    }

    // Record payment repayment
    if (paymentAmount > 0) {
      await Storage.addTransaction({
        customer_id: AppState.selectedCustomer.id,
        type: "PAYMENT_RECEIVED",
        amount: paymentAmount,
        date: todayStr,
        item_details: "पूर्ण/आंशिक खाता चुकता भुगतान",
        payment_mode: document.getElementById("settle-mode-select").value
      });
    }

    closeModal("modal-settlement");
    await openCustomerLedger(AppState.selectedCustomer.id);
    await loadDashboardData();
  });

  // Close modals on backdrop click or close button
  document.querySelectorAll(".btn-close-modal").forEach((btn) => {
    btn.addEventListener("click", () => {
      const modalId = btn.closest(".modal-backdrop").id;
      closeModal(modalId);
    });
  });

  // Settings Modal Handlers
  const btnSettings = document.getElementById("btn-open-settings");
  if (btnSettings) {
    btnSettings.addEventListener("click", () => {
      openModal("modal-settings");
    });
  }

  // Profile Form Save
  const formProfile = document.getElementById("form-settings-profile");
  if (formProfile) {
    formProfile.addEventListener("submit", async (e) => {
      e.preventDefault();
      const owner_name = document.getElementById("setting-owner-name").value.trim();
      const shop_name = document.getElementById("setting-shop-name").value.trim();
      const upi_id = document.getElementById("setting-upi-id").value.trim();

      const profile = { owner_name, shop_name, upi_id };

      await Storage.saveProfile(profile);
      await fetch("/api/settings/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile)
      }).catch((e) => console.log("Backend offline or synced locally"));

      WhatsAppDispatcher.setMerchantConfig({ ownerName: owner_name, shopName: shop_name, upiId: upi_id });
      const lockNameEl = document.getElementById("lock-shop-name");
      if (lockNameEl) lockNameEl.textContent = shop_name;

      const navOwnerEl = document.getElementById("nav-owner-name");
      if (navOwnerEl) navOwnerEl.textContent = owner_name;
      const navAvatarEl = document.getElementById("nav-profile-avatar");
      if (navAvatarEl && owner_name) {
        navAvatarEl.textContent = owner_name.substring(0, 1).toUpperCase();
      }

      alert("✅ प्रोफाइल जानकारी सफलतापूर्वक सुरक्षित कर दी गई!");
      closeModal("modal-settings");
    });
  }

  // Change MPIN Form
  const formPin = document.getElementById("form-change-pin");
  if (formPin) {
    formPin.addEventListener("submit", async (e) => {
      e.preventDefault();
      const oldPin = document.getElementById("pin-old-input").value.trim();
      const newPin = document.getElementById("pin-new-input").value.trim();

      if (oldPin !== VALID_PIN) {
        alert("⚠️ पुराना पिन गलत है!");
        return;
      }

      if (newPin.length !== 4 || isNaN(newPin)) {
        alert("⚠️ नया पिन ठीक 4 अंकों का होना चाहिए!");
        return;
      }

      VALID_PIN = newPin;
      await fetch("/api/auth/change-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "9876543210", old_pin: oldPin, new_pin: newPin })
      }).catch((e) => console.log("Synced locally"));

      document.getElementById("pin-old-input").value = "";
      document.getElementById("pin-new-input").value = "";
      alert(`✅ सुरक्षा पिन बदलकर ${newPin} कर दिया गया है!`);
    });
  }

  // Clear All Demo Data
  const btnClearAll = document.getElementById("btn-clear-all-demo-data");
  if (btnClearAll) {
    btnClearAll.addEventListener("click", async () => {
      const confirmed = confirm("⚠️ क्या आप सच में सभी सैंपल/डमी खाते हटाना चाहते हैं?\n\nइसके बाद आपकी डायरी एकदम खाली और नए हिसाब के लिए तैयार हो जाएगी।");
      if (!confirmed) return;

      try {
        await fetch("/api/settings/clear-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        }).catch((e) => console.log("Synced locally"));

        await Storage.clearAllData();
        closeModal("modal-settings");
        await loadDashboardData();

        alert("✅ सभी सैंपल खाते हटा दिए गए हैं!\nआपकी उधार-बाकी डायरी अब पूरी तरह खाली और नए हिसाब के लिए तैयार है।");
      } catch (err) {
        console.error("Error clearing demo data:", err);
        alert("डेटा साफ़ करने में त्रुटि हुई!");
      }
    });
  }

  document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        closeModal(backdrop.id);
      }
    });
  });
}

async function loadMerchantProfile() {
  try {
    let profile = await Storage.getProfile();
    if (!profile) {
      const res = await fetch("/api/settings/profile").then((r) => r.json()).catch(() => null);
      if (res && res.profile) {
        profile = res.profile;
        await Storage.saveProfile(profile);
      }
    }
    if (profile) {
      const nameInput = document.getElementById("setting-owner-name");
      if (nameInput && profile.owner_name) nameInput.value = profile.owner_name;

      const shopInput = document.getElementById("setting-shop-name");
      if (shopInput && profile.shop_name) {
        shopInput.value = profile.shop_name;
        const lockEl = document.getElementById("lock-shop-name");
        if (lockEl) lockEl.textContent = profile.shop_name;
      }

      const upiInput = document.getElementById("setting-upi-id");
      if (upiInput && profile.upi_id) upiInput.value = profile.upi_id;

      const navOwnerEl = document.getElementById("nav-owner-name");
      if (navOwnerEl && profile.owner_name) {
        navOwnerEl.textContent = profile.owner_name;
      }
      const navAvatarEl = document.getElementById("nav-profile-avatar");
      if (navAvatarEl && profile.owner_name) {
        navAvatarEl.textContent = profile.owner_name.substring(0, 1).toUpperCase();
      }

      WhatsAppDispatcher.setMerchantConfig({
        ownerName: profile.owner_name || "जयदेव सिंह",
        shopName: profile.shop_name || "मेरी उधार-बाकी डायरी",
        upiId: profile.upi_id || "user@upi"
      });
    }
  } catch (err) {
    console.error("Error loading merchant profile:", err);
  }
}

function updateLanguageUI() {
  const lang = AppState.currentLang;
  const strings = I18N[lang];

  document.getElementById("app-title").textContent = strings.appTitle;
  document.getElementById("app-subtitle").textContent = strings.appSubtitle;
  document.getElementById("btn-lang-toggle").textContent = lang === "HI" ? "English" : "हिन्दी";

  document.getElementById("lbl-total-outstanding").textContent = strings.totalOutstanding;
  document.getElementById("lbl-total-gave").textContent = strings.totalGave;
  document.getElementById("lbl-total-got").textContent = strings.totalGot;
  document.getElementById("lbl-overdue-count").textContent = strings.overdueCount;

  document.getElementById("search-input").placeholder = strings.searchPlaceholder;
  document.getElementById("btn-add-customer-text").textContent = strings.addCustomerBtn;
  document.getElementById("btn-open-calc").textContent = strings.calcBtnText;

  document.getElementById("chip-all").textContent = strings.tabAll;
  document.getElementById("chip-overdue").textContent = strings.tabOverdue;
  document.getElementById("chip-due-soon").textContent = strings.tabDueSoon;
  document.getElementById("chip-interest").textContent = strings.tabInterest;
}

async function loadDashboardData() {
  const customers = await Storage.getCustomersWithSettings();
  AppState.customers = customers;

  // Calculate summary metrics
  let totalOutstanding = 0;
  let totalGave = 0;
  let totalGot = 0;
  let overdueCount = 0;

  const allTxs = await Storage.getAll("transactions");
  allTxs.forEach((tx) => {
    if (tx.type === "CREDIT_GIVEN" || tx.type === "INTEREST_APPLIED") {
      totalGave += tx.total_amount;
    } else if (tx.type === "PAYMENT_RECEIVED" || tx.type === "DISCOUNT_WAIVED") {
      totalGot += tx.total_amount;
    }
  });

  customers.forEach((c) => {
    if (c.current_balance > 0) totalOutstanding += c.current_balance;
    if (c.due_status === "OVERDUE" && c.current_balance > 0) overdueCount++;
  });

  document.getElementById("val-total-outstanding").textContent = RuralInterestEngine.formatINR(totalOutstanding);
  document.getElementById("val-total-gave").textContent = RuralInterestEngine.formatINR(totalGave);
  document.getElementById("val-total-got").textContent = RuralInterestEngine.formatINR(totalGot);
  document.getElementById("val-overdue-count").textContent = `${overdueCount} खाते`;

  renderCustomerList();
}

function renderCustomerList() {
  const container = document.getElementById("customers-list-container");
  container.innerHTML = "";

  const q = AppState.searchQuery;
  const filter = AppState.activeFilter;

  const filtered = AppState.customers.filter((c) => {
    // Search match
    const matchesQuery = !q || c.name.toLowerCase().includes(q) || c.phone.includes(q) || (c.village_address && c.village_address.toLowerCase().includes(q));
    if (!matchesQuery) return false;

    // Filter match
    if (filter === "overdue") return c.due_status === "OVERDUE" && c.current_balance > 0;
    if (filter === "due_soon") return c.due_status === "DUE_SOON" && c.current_balance > 0;
    if (filter === "interest") return c.interest_enabled;
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: #a1938f;">
        <div style="font-size: 36px; margin-bottom: 8px;">📂</div>
        <div style="font-weight: 600;">${I18N[AppState.currentLang].noRecords}</div>
      </div>
    `;
    return;
  }

  filtered.forEach((cust) => {
    const card = document.createElement("div");
    card.className = "customer-card";

    const isGave = cust.current_balance >= 0;
    const balanceColorClass = isGave ? "gave" : "got";
    const balanceText = RuralInterestEngine.formatINR(cust.current_balance);

    // Badges
    const badgesHtml = [];
    if (cust.interest_enabled) {
      badgesHtml.push(`<span class="badge badge-purple">🌾 ₹${cust.monthly_rate_pct} सैकड़ा ब्याज</span>`);
    } else {
      badgesHtml.push(`<span class="badge badge-neutral">0% ब्याज मुक्त</span>`);
    }

    if (cust.due_badge_class && cust.earliest_due_date) {
      badgesHtml.push(`<span class="badge ${cust.due_badge_class}">📅 ${cust.due_label}</span>`);
    }

    card.innerHTML = `
      <div class="customer-card-header">
        <div class="cust-name-row">
          <div class="cust-avatar">${cust.name.substring(0, 1)}</div>
          <div>
            <div class="cust-name">${cust.name}</div>
            <div class="cust-village">📍 ${cust.village_address || "गांव दर्ज नहीं"} • 📞 ${cust.phone}</div>
          </div>
        </div>
        <div class="cust-balance-col">
          <div class="cust-balance-label">${isGave ? "बाकी लेना है" : "जमा बाकी"}</div>
          <div class="cust-balance-amt ${balanceColorClass}">${balanceText}</div>
        </div>
      </div>
      <div class="customer-badges">
        ${badgesHtml.join("")}
      </div>
      <div class="customer-card-actions">
        <button class="btn-sm-whatsapp" data-id="${cust.id}">
          💬 ${I18N[AppState.currentLang].whatsappBtn}
        </button>
        <button class="btn-sm-view" data-id="${cust.id}">
          📖 ${I18N[AppState.currentLang].viewLedgerBtn}
        </button>
        <button class="btn-sm-delete" data-id="${cust.id}" title="उधार खाता हटाएं">
          🗑️ ${I18N[AppState.currentLang].deleteBtn}
        </button>
      </div>
    `;

    // Click on card or view ledger
    card.querySelector(".btn-sm-view").addEventListener("click", (e) => {
      e.stopPropagation();
      openCustomerLedger(cust.id);
    });

    // Delete customer directly from card
    card.querySelector(".btn-sm-delete").addEventListener("click", (e) => {
      e.stopPropagation();
      promptDeleteCustomer(cust);
    });

    card.addEventListener("click", () => {
      openCustomerLedger(cust.id);
    });

    // WhatsApp quick reminder
    card.querySelector(".btn-sm-whatsapp").addEventListener("click", (e) => {
      e.stopPropagation();
      openWhatsAppReminderModal(cust);
    });

    container.appendChild(card);
  });
}

function promptDeleteCustomer(cust) {
  if (!cust) return;
  AppState.selectedCustomer = cust;
  document.getElementById("delete-cust-name").textContent = cust.name;
  document.getElementById("delete-cust-balance").textContent = RuralInterestEngine.formatINR(cust.current_balance);
  openModal("modal-delete-customer");
}

async function openCustomerLedger(customerId) {
  const details = await Storage.getCustomerFullDetails(customerId);
  if (!details) return;

  AppState.selectedCustomer = details;

  document.getElementById("ledger-cust-name").textContent = details.name;
  document.getElementById("ledger-cust-phone").textContent = `📞 ${details.phone}`;
  document.getElementById("ledger-cust-village").textContent = `📍 ${details.village_address || "गांव दर्ज नहीं"}`;

  // Balance & Accrued Interest
  document.getElementById("ledger-balance-amt").textContent = RuralInterestEngine.formatINR(details.current_balance);
  document.getElementById("ledger-accrued-amt").textContent = RuralInterestEngine.formatINR(details.live_accrued_interest);
  document.getElementById("ledger-total-payable").textContent = RuralInterestEngine.formatINR(details.total_payable_now);

  const interestInfoBox = document.getElementById("ledger-interest-info-tag");
  if (details.interest_settings && details.interest_settings.is_enabled) {
    const compLabel = details.interest_settings.compounding_mode === "6_MONTHS" ? "छमाही खाता पलटी" : (details.interest_settings.compounding_mode === "12_MONTHS" ? "सालाना खाता पलटी" : "साधारण ब्याज");
    interestInfoBox.innerHTML = `🌾 <strong>₹${details.interest_settings.monthly_rate_pct} सैकड़ा/माह</strong> (${compLabel})`;
    interestInfoBox.style.display = "inline-block";
    document.getElementById("ledger-accrued-row").style.display = "flex";
  } else {
    interestInfoBox.innerHTML = `🌾 0% ब्याज मुक्त खाता`;
    interestInfoBox.style.display = "inline-block";
    document.getElementById("ledger-accrued-row").style.display = "none";
  }

  // Render transactions
  const txContainer = document.getElementById("ledger-tx-timeline");
  txContainer.innerHTML = "";

  if (details.transactions.length === 0) {
    txContainer.innerHTML = `<div style="text-align: center; color: #a1938f; padding: 24px;">कोई लेन-देन दर्ज नहीं है।</div>`;
  } else {
    details.transactions.forEach((tx) => {
      const isGave = tx.type === "CREDIT_GIVEN" || tx.type === "INTEREST_APPLIED";
      const row = document.createElement("div");
      row.className = `tx-row ${isGave ? "gave" : "got"}`;

      let typeBadge = "";
      if (tx.type === "CREDIT_GIVEN") typeBadge = "🔴 उधार दिया";
      else if (tx.type === "PAYMENT_RECEIVED") typeBadge = "🟢 वापस मिला";
      else if (tx.type === "INTEREST_APPLIED") typeBadge = "🟣 ब्याज जोड़ा";
      else if (tx.type === "DISCOUNT_WAIVED") typeBadge = "🟡 ब्याज छूट";

      row.innerHTML = `
        <div class="tx-row-details">
          <div class="tx-row-item">${typeBadge}: ${tx.item_details || "लेन-देन विवरण"}</div>
          <div class="tx-row-meta">
            📅 ${tx.transaction_date} ${tx.due_date ? `• वादा तारीख: ${tx.due_date}` : ""} • माध्यम: ${tx.payment_mode}
          </div>
        </div>
        <div class="tx-row-amt">
          <div class="tx-row-amt-val ${isGave ? "gave" : "got"}">
            ${isGave ? "-" : "+"}${RuralInterestEngine.formatINR(tx.total_amount)}
          </div>
        </div>
      `;
      txContainer.appendChild(row);
    });
  }

  openModal("modal-customer-ledger");
}

function selectTxType(type) {
  AppState.activeTxType = type;
  const btnGave = document.getElementById("btn-tx-gave");
  const btnGot = document.getElementById("btn-tx-got");
  const dueGroup = document.getElementById("tx-due-group");
  const submitBtn = document.getElementById("btn-submit-tx");

  if (type === "CREDIT_GIVEN") {
    btnGave.classList.add("selected");
    btnGot.classList.remove("selected");
    dueGroup.style.display = "flex";
    submitBtn.style.background = "var(--gave-red)";
    submitBtn.textContent = "उधार दिया (- Lent) दर्ज करें";
  } else {
    btnGot.classList.add("selected");
    btnGave.classList.remove("selected");
    dueGroup.style.display = "none";
    submitBtn.style.background = "var(--got-green)";
    submitBtn.textContent = "पैसे वापस मिले (+ Received) दर्ज करें";
  }
}

function prepareTxModal() {
  document.getElementById("tx-customer-name").textContent = AppState.selectedCustomer.name;
  document.getElementById("tx-date-input").value = new Date().toISOString().split("T")[0];
  // Default due date to 15 days later
  const due = new Date();
  due.setDate(due.getDate() + 15);
  document.getElementById("tx-due-input").value = due.toISOString().split("T")[0];
}

// Standalone Rural Interest Calculator
function runStandaloneCalculator() {
  const principal = parseFloat(document.getElementById("calc-principal").value) || 0;
  const rate = parseFloat(document.getElementById("calc-rate").value) || 0;
  const start = document.getElementById("calc-start-date").value;
  const end = document.getElementById("calc-end-date").value;
  const compMode = document.getElementById("calc-compound-mode").value;
  const basis = document.getElementById("calc-basis").value;

  if (!start || !end || new Date(end) < new Date(start)) {
    document.getElementById("calc-duration-text").textContent = "अमान्य तारीख सीमा";
    return;
  }

  const result = RuralInterestEngine.calculateCompoundInterest(
    principal,
    rate,
    start,
    end,
    compMode,
    basis
  );

  document.getElementById("calc-duration-text").textContent = result.duration.formattedDuration;
  document.getElementById("calc-simple-interest").textContent = RuralInterestEngine.formatINR(result.simpleInterest);
  document.getElementById("calc-compound-addition").textContent = RuralInterestEngine.formatINR(result.compoundAddition);
  document.getElementById("calc-total-interest").textContent = RuralInterestEngine.formatINR(result.totalInterest);
  document.getElementById("calc-total-payable").textContent = RuralInterestEngine.formatINR(result.totalPayable);
}

// WhatsApp Reminder Modal
function openWhatsAppReminderModal(customer) {
  AppState.selectedCustomer = customer;
  document.getElementById("wa-customer-name").textContent = customer.name;
  document.getElementById("wa-customer-phone").textContent = customer.phone;

  renderWhatsAppPreview();
  openModal("modal-whatsapp-preview");

  // Re-render on language toggle or note change
  document.getElementById("wa-lang-select").onchange = renderWhatsAppPreview;
  document.getElementById("wa-custom-note").oninput = renderWhatsAppPreview;

  // Open WhatsApp Link
  document.getElementById("btn-launch-whatsapp").onclick = () => {
    const previewText = document.getElementById("wa-message-preview").textContent;
    WhatsAppDispatcher.openWhatsApp(customer.phone, previewText);
  };

  // Copy to clipboard
  document.getElementById("btn-copy-wa-text").onclick = () => {
    const previewText = document.getElementById("wa-message-preview").textContent;
    navigator.clipboard.writeText(previewText).then(() => {
      alert("संदेश कॉपी कर लिया गया!");
    });
  };
}

function renderWhatsAppPreview() {
  const cust = AppState.selectedCustomer;
  if (!cust) return;

  const lang = document.getElementById("wa-lang-select").value;
  const note = document.getElementById("wa-custom-note").value;

  const message = WhatsAppDispatcher.composeMessage({
    customerName: cust.name,
    totalBalance: cust.total_payable_now || cust.current_balance,
    principalAmount: cust.current_balance,
    accruedInterest: cust.live_accrued_interest || 0,
    dueDate: cust.earliest_due_date,
    language: lang,
    interestEnabled: cust.interest_enabled,
    customNote: note
  });

  document.getElementById("wa-message-preview").textContent = message;
}

// Settlement & Waiver Modal
function openSettlementModal(customer) {
  AppState.selectedCustomer = customer;
  document.getElementById("settle-cust-name").textContent = customer.name;
  document.getElementById("settle-prin-val").textContent = RuralInterestEngine.formatINR(customer.current_balance);
  document.getElementById("settle-int-val").textContent = RuralInterestEngine.formatINR(customer.live_accrued_interest || 0);

  document.getElementById("settle-waiver-input").value = 0;
  document.getElementById("settle-payment-input").value = customer.total_payable_now || customer.current_balance;

  runSettlementCalculation();
  openModal("modal-settlement");
}

function runSettlementCalculation() {
  const cust = AppState.selectedCustomer;
  if (!cust) return;

  const prin = cust.current_balance || 0;
  const int = cust.live_accrued_interest || 0;
  const waiver = parseFloat(document.getElementById("settle-waiver-input").value) || 0;
  const pay = parseFloat(document.getElementById("settle-payment-input").value) || 0;

  const netPayable = Math.max(0, prin + Math.max(0, int - waiver));
  document.getElementById("settle-net-val").textContent = RuralInterestEngine.formatINR(netPayable);

  const allocation = RuralInterestEngine.allocatePartialRepayment(prin, int, pay, waiver);

  document.getElementById("settle-rem-prin").textContent = RuralInterestEngine.formatINR(allocation.remainingPrincipal);
  document.getElementById("settle-rem-int").textContent = RuralInterestEngine.formatINR(allocation.remainingAccruedInterest);

  const badge = document.getElementById("settle-status-badge");
  if (allocation.isFullySettled) {
    badge.textContent = "✅ पूर्ण खाता चुकता (100% Settled)";
    badge.className = "badge badge-success";
  } else {
    badge.textContent = "⚠️ आंशिक भुगतान (Partial Repayment)";
    badge.className = "badge badge-warning";
  }
}

// Modal Sheet Helpers
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("open");
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("open");
}

// ==============================================================================
// LOCK SCREEN & PIN SYSTEM
// ==============================================================================
let currentPinBuffer = "";
let VALID_PIN = "1234";

function lockApp() {
  currentPinBuffer = "";
  updatePinDots();
  const overlay = document.getElementById("lock-screen-overlay");
  if (overlay) overlay.classList.add("active");
}

function unlockApp() {
  currentPinBuffer = "";
  updatePinDots();
  const overlay = document.getElementById("lock-screen-overlay");
  if (overlay) overlay.classList.remove("active");
}

function handlePinDigit(digit) {
  if (currentPinBuffer.length < 4) {
    currentPinBuffer += String(digit);
    updatePinDots();

    if (currentPinBuffer.length === 4) {
      setTimeout(() => {
        verifyPin();
      }, 150);
    }
  }
}

function verifyPin() {
  if (currentPinBuffer === VALID_PIN) {
    unlockApp();
  } else {
    // Shake animation
    const container = document.querySelector(".pin-dots-container");
    if (container) {
      container.style.transform = "translateX(10px)";
      setTimeout(() => { container.style.transform = "translateX(-10px)"; }, 80);
      setTimeout(() => { container.style.transform = "translateX(6px)"; }, 160);
      setTimeout(() => { container.style.transform = "translateX(0)"; }, 240);
    }
    setTimeout(() => {
      alert("⚠️ गलत पिन! डिफ़ॉल्ट पिन 1234 है।");
      clearPin();
    }, 280);
  }
}

function clearPin() {
  currentPinBuffer = "";
  updatePinDots();
}

function backspacePin() {
  if (currentPinBuffer.length > 0) {
    currentPinBuffer = currentPinBuffer.substring(0, currentPinBuffer.length - 1);
    updatePinDots();
  }
}

function updatePinDots() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById(`pin-dot-${i}`);
    if (dot) {
      if (i < currentPinBuffer.length) {
        dot.classList.add("filled");
      } else {
        dot.classList.remove("filled");
      }
    }
  }
}

