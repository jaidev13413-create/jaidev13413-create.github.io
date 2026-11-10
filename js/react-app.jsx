/**
 * React 18 Modular Application for "मेरी उधार-बाकी डायरी" (Personal Moneylending Ledger)
 * Built with React 18 Components & Hooks.
 * 100% Original Code, Safe Branding, Zero Trademark Conflicts.
 */

const { useState, useEffect, useMemo, useRef } = React;

// Bilingual Dictionary
const I18N = {
  HI: {
    appTitle: "उधार-बाकी डायरी",
    appSubtitle: "निजी लेन-देन व सैकड़ा ब्याज हिसाब",
    totalOutstanding: "कुल उधार दिया पैसा (लेना बाकी)",
    totalGave: "कुल उधार दिया",
    totalGot: "कुल वापस मिला",
    overdueCount: "वापसी तारीख बीती",
    searchPlaceholder: "नाम, फोन या पता खोजें...",
    tabAll: "सभी खाते",
    tabOverdue: "वापसी तारीख बीती",
    tabDueSoon: "जल्द वापसी",
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

function getAvatarStyle(name) {
  const hue = ((name || "?").charCodeAt(0) * 47) % 360;
  return {
    background: `linear-gradient(140deg, hsl(${hue} 90% 93%), hsl(${hue} 78% 78%))`,
    color: `hsl(${hue} 72% 30%)`,
    boxShadow: `0 6px 14px -8px hsl(${hue} 70% 50% / 0.85)`
  };
}

// ==============================================================================
// MAIN ROOT APP COMPONENT
// ==============================================================================
function App() {
  const [lang, setLang] = useState("HI");
  const [isLocked, setIsLocked] = useState(false);
  const [pinBuffer, setPinBuffer] = useState("");
  const [validPin, setValidPin] = useState("1234");

  const [profile, setProfile] = useState({
    owner_name: "जयदेव सिंह",
    shop_name: "मेरी उधार-बाकी डायरी",
    upi_id: "user@upi"
  });

  const [customers, setCustomers] = useState([]);
  const [totals, setTotals] = useState({ total_gave: 0, total_got: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  // Modals state
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showAddTxModal, setShowAddTxModal] = useState(false);
  const [activeTxType, setActiveTxType] = useState("CREDIT_GIVEN"); // or PAYMENT_RECEIVED
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [showCalcModal, setShowCalcModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);

  const t = I18N[lang];

  // Bootstrap data on mount
  useEffect(() => {
    async function loadInitialData() {
      try {
        await Storage.init();
        await refreshProfile();
        await refreshDashboard();
      } catch (err) {
        console.error("Initialization error:", err);
      }
    }
    loadInitialData();
  }, []);

  async function refreshProfile() {
    try {
      let p = await Storage.getProfile();
      if (!p) {
        const res = await fetch("/api/settings/profile").then((r) => r.json()).catch(() => null);
        if (res && res.profile) {
          p = res.profile;
          await Storage.saveProfile(p);
        }
      }
      if (p) {
        const fullProfile = {
          owner_name: p.owner_name || "जयदेव सिंह",
          shop_name: p.shop_name || "मेरी उधार-बाकी डायरी",
          upi_id: p.upi_id || "user@upi"
        };
        setProfile(fullProfile);
        WhatsAppDispatcher.setMerchantConfig({
          ownerName: fullProfile.owner_name,
          shopName: fullProfile.shop_name,
          upiId: fullProfile.upi_id
        });
      }
    } catch (e) {
      console.log("Profile refresh notice:", e);
    }
  }

  async function refreshDashboard() {
    const custs = await Storage.getCustomersWithSettings();
    setCustomers(custs);

    // Offline-first totals: prefer local IndexedDB transactions, then server totals.
    let localGave = 0;
    let localGot = 0;
    let hasLocalTx = false;
    try {
      const txs = await Storage.getAll("transactions");
      hasLocalTx = txs.length > 0;
      txs.forEach((tx) => {
        const amt = Number(tx.total_amount) || 0;
        if (tx.type === "CREDIT_GIVEN" || tx.type === "INTEREST_APPLIED") localGave += amt;
        else if (tx.type === "PAYMENT_RECEIVED" || tx.type === "DISCOUNT_WAIVED") localGot += amt;
      });
    } catch (e) {
      console.log("Local totals notice:", e);
    }

    if (hasLocalTx) {
      setTotals({ total_gave: localGave, total_got: localGot });
    } else {
      // No local transaction history (fresh install): ask the server, if reachable.
      try {
        const res = await fetch("/api/dashboard").then((r) => r.json());
        if (res && typeof res.total_gave === "number" && typeof res.total_got === "number") {
          setTotals({ total_gave: res.total_gave, total_got: res.total_got });
        }
      } catch (err) {
        console.log("Server totals unavailable:", err);
      }
    }

    if (selectedCustomer) {
      const updated = await Storage.getCustomerFullDetails(selectedCustomer.id);
      if (updated) setSelectedCustomer(updated);
    }
  }

  // Summary Metrics
  const todayLabel = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("hi-IN", { day: "numeric", month: "long", year: "numeric" }).format(new Date());
    } catch (e) {
      return new Date().toLocaleDateString();
    }
  }, []);

  const summaryMetrics = useMemo(() => {
    let outstanding = 0;
    let overdue = 0;

    customers.forEach((c) => {
      if (c.current_balance > 0) outstanding += c.current_balance;
      if (c.due_status === "OVERDUE" && c.current_balance > 0) overdue++;
    });

    return {
      outstanding,
      gave: totals.total_gave > 0 ? totals.total_gave : outstanding,
      got: totals.total_got,
      overdue,
      accounts: customers.length
    };
  }, [customers, totals]);

  // Filter chip counters
  const filterCounts = useMemo(
    () => ({
      all: customers.length,
      overdue: customers.filter((c) => c.due_status === "OVERDUE" && c.current_balance > 0).length,
      due_soon: customers.filter((c) => c.due_status === "DUE_SOON" && c.current_balance > 0).length,
      interest: customers.filter((c) => c.interest_enabled).length
    }),
    [customers]
  );

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return customers.filter((c) => {
      const matchesQ = !q || c.name.toLowerCase().includes(q) || c.phone.includes(q) || (c.village_address && c.village_address.toLowerCase().includes(q));
      if (!matchesQ) return false;

      if (activeFilter === "overdue") return c.due_status === "OVERDUE" && c.current_balance > 0;
      if (activeFilter === "due_soon") return c.due_status === "DUE_SOON" && c.current_balance > 0;
      if (activeFilter === "interest") return c.interest_enabled;
      return true;
    });
  }, [customers, searchQuery, activeFilter]);

  // MPIN Handlers
  function handlePinDigit(digit) {
    if (pinBuffer.length < 4) {
      const newPin = pinBuffer + String(digit);
      setPinBuffer(newPin);
      if (newPin.length === 4) {
        setTimeout(() => {
          if (newPin === validPin) {
            setIsLocked(false);
            setPinBuffer("");
          } else {
            alert("⚠️ गलत पिन! डिफ़ॉल्ट पिन " + validPin + " है।");
            setPinBuffer("");
          }
        }, 150);
      }
    }
  }

  function handleQuickUnlock() {
    setIsLocked(false);
    setPinBuffer("");
  }

  async function handleOpenLedger(cust) {
    const details = await Storage.getCustomerFullDetails(cust.id);
    setSelectedCustomer(details || cust);
    setShowLedgerModal(true);
  }

  function promptDelete(cust) {
    setCustomerToDelete(cust);
    setShowDeleteModal(true);
  }

  async function confirmDeleteCustomer() {
    if (!customerToDelete) return;
    try {
      await fetch("/api/customers/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customerToDelete.id, force: true })
      }).catch(() => {});

      await Storage.deleteCustomer(customerToDelete.id);
      setShowDeleteModal(false);
      setShowLedgerModal(false);
      setCustomerToDelete(null);
      setSelectedCustomer(null);
      await refreshDashboard();
      alert("✅ खाता और सभी लेन-देन सफलतापूर्वक हटा दिए गए!");
    } catch (err) {
      alert("खाता हटाने में त्रुटि हुई!");
    }
  }

  return (
    <div className="app-container">
      {/* Top Header */}
      <header className="top-nav">
        <div className="top-nav-inner">
          <div className="brand-info">
            <div className="brand-logo">₹</div>
            <div className="brand-text">
              <div className="brand-title">{profile.shop_name || t.appTitle}</div>
              <div className="brand-subtitle">{t.appSubtitle}</div>
            </div>
          </div>

          <div className="top-nav-actions">
            {/* Profile Avatar Widget with golden gear badge & Name underneath */}
            <button
              className="nav-profile-btn"
              onClick={() => setShowSettingsModal(true)}
              title="प्रोफाइल व सेटिंग्स"
            >
              <div className="nav-profile-avatar-wrap">
                <div className="nav-profile-avatar">
                  {profile.owner_name ? profile.owner_name.substring(0, 1).toUpperCase() : "👤"}
                </div>
                <div className="nav-profile-gear-badge">⚙️</div>
              </div>
              <div className="nav-profile-name">{profile.owner_name || "जयदेव सिंह"}</div>
            </button>

            <button
              className="nav-icon-btn"
              onClick={() => setIsLocked(true)}
              title="डायरी लॉक करें"
              aria-label="डायरी लॉक करें"
            >
              🔒
            </button>
            <button
              className="nav-icon-btn calc"
              onClick={() => setShowCalcModal(true)}
              title="ब्याज कैलकुलेटर"
              aria-label="ब्याज कैलकुलेटर"
            >
              🧮
            </button>
            <button
              className="nav-lang-btn"
              onClick={() => setLang(lang === "HI" ? "EN" : "HI")}
              title={lang === "HI" ? "Switch to English" : "हिन्दी में देखें"}
            >
              {lang === "HI" ? "EN" : "हि"}
            </button>
          </div>
        </div>
      </header>

      {/* Lock Screen Overlay */}
      {isLocked && (
        <div className="lock-screen-overlay active">
          <div className="lock-brand-box">
            <div className="lock-brand-logo">₹</div>
            <div className="lock-title">{profile.shop_name}</div>
            <div className="lock-subtitle">सुरक्षा पिन दर्ज करें (Enter 4-Digit MPIN)</div>
          </div>

          <div className="pin-dots-container">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={`pin-dot ${i < pinBuffer.length ? "filled" : ""}`} />
            ))}
          </div>

          <div className="pin-keypad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
              <button key={digit} className="pin-key" onClick={() => handlePinDigit(digit)}>
                {digit}
              </button>
            ))}
            <button className="pin-key special" onClick={() => setPinBuffer("")}>C</button>
            <button className="pin-key" onClick={() => handlePinDigit(0)}>0</button>
            <button className="pin-key special" onClick={() => setPinBuffer(pinBuffer.slice(0, -1))}>⌫</button>
          </div>

          <div className="lock-footer-info">
            सुरक्षित निजी बही-खाता • <strong>डिफ़ॉल्ट पिन: {validPin}</strong>
            <br />
            <button
              type="button"
              onClick={handleQuickUnlock}
              style={{
                marginTop: "10px",
                background: "rgba(251, 191, 36, 0.18)",
                border: "1px solid #fbbf24",
                color: "#fbbf24",
                borderRadius: "20px",
                padding: "6px 14px",
                fontSize: "12px",
                cursor: "pointer"
              }}
            >
              ⚡ 1-क्लिक अनलॉक (पिन: {validPin})
            </button>
          </div>
        </div>
      )}

      {/* Dashboard Overview Cards */}
      <section className="summary-container">
        <div className="net-balance-card">
          <div className="net-balance-main">
            <div className="net-balance-top">
              <span className="net-balance-icon">💰</span>
              <span className="net-balance-label">{t.totalOutstanding}</span>
            </div>
            <div className="net-balance-val">
              {RuralInterestEngine.formatINR(summaryMetrics.outstanding)}
            </div>
            <div className="net-balance-date">
              📅 {todayLabel} • {summaryMetrics.accounts} {summaryMetrics.accounts === 1 ? "खाता" : "खाते"}
            </div>
          </div>
          <div className="net-balance-sub">🔒 निजी खाता</div>
        </div>

        <div className="metrics-grid">
          <div className="metric-pill gave">
            <div className="metric-icon">↗</div>
            <div className="metric-title">{t.totalGave}</div>
            <div className="metric-number gave">
              {RuralInterestEngine.formatINR(summaryMetrics.gave)}
            </div>
          </div>
          <div className="metric-pill got">
            <div className="metric-icon">↙</div>
            <div className="metric-title">{t.totalGot}</div>
            <div className="metric-number got">
              {RuralInterestEngine.formatINR(summaryMetrics.got)}
            </div>
          </div>
          <div className="metric-pill overdue">
            <div className="metric-icon">⏰</div>
            <div className="metric-title">{t.overdueCount}</div>
            <div className="metric-number overdue">
              {summaryMetrics.overdue} {lang === "HI" ? (summaryMetrics.overdue === 1 ? "खाता" : "खाते") : "accts"}
            </div>
          </div>
        </div>
      </section>

      {/* Search & Filter Toolbar */}
      <section className="toolbar-section">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-chips">
          {[
            { id: "all", label: t.tabAll },
            { id: "overdue", label: t.tabOverdue },
            { id: "due_soon", label: t.tabDueSoon },
            { id: "interest", label: t.tabInterest }
          ].map((chip) => (
            <button
              key={chip.id}
              className={`chip ${activeFilter === chip.id ? "active" : ""}`}
              onClick={() => setActiveFilter(chip.id)}
            >
              {chip.label}
              <span className="chip-count">{filterCounts[chip.id] || 0}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Customer List */}
      <main className="customers-list">
        {filteredCustomers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📂</div>
            <div className="empty-title">{t.noRecords}</div>
            <p className="empty-desc">
              नीचे <strong>"+ नया उधार खाता जोड़ें"</strong> बटन दबाकर पहला खाता दर्ज करें।
            </p>
          </div>
        ) : (
          filteredCustomers.map((cust) => (
            <div
              key={cust.id}
              className={`customer-card ${cust.current_balance >= 0 ? "is-gave" : "is-got"}`}
              onClick={() => handleOpenLedger(cust)}
            >
              <div className="customer-card-header">
                <div className="cust-name-row">
                  <div className="cust-avatar" style={getAvatarStyle(cust.name)}>
                    {cust.name.substring(0, 1)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="cust-name">{cust.name}</div>
                    <div className="cust-village">
                      📍 {cust.village_address || "पता दर्ज नहीं"} • 📞 {cust.phone}
                    </div>
                  </div>
                </div>
                <div className="cust-balance-col">
                  <div className="cust-balance-label">
                    {cust.current_balance >= 0 ? "बाकी लेना है" : "जमा बाकी"}
                  </div>
                  <div className={`cust-balance-amt ${cust.current_balance >= 0 ? "gave" : "got"}`}>
                    {RuralInterestEngine.formatINR(cust.current_balance)}
                  </div>
                </div>
              </div>

              <div className="customer-badges">
                {cust.interest_enabled ? (
                  <span className="badge badge-purple">🌾 ₹{cust.monthly_rate_pct} सैकड़ा ब्याज</span>
                ) : (
                  <span className="badge badge-neutral">0% बिना ब्याज</span>
                )}
                {cust.due_badge_class && cust.earliest_due_date && (
                  <span className={`badge ${cust.due_badge_class}`}>📅 {cust.due_label}</span>
                )}
              </div>

              <div className="customer-card-actions">
                <button
                  className="btn-sm-whatsapp"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCustomer(cust);
                    setShowWhatsAppModal(true);
                  }}
                >
                  💬 {t.whatsappBtn}
                </button>
                <button
                  className="btn-sm-view"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenLedger(cust);
                  }}
                >
                  📖 {t.viewLedgerBtn}
                </button>
                <button
                  className="btn-sm-delete"
                  title="उधार खाता हटाएं"
                  onClick={(e) => {
                    e.stopPropagation();
                    promptDelete(cust);
                  }}
                >
                  🗑️ {t.deleteBtn}
                </button>
              </div>
            </div>
          ))
        )}
      </main>

      {/* Floating Bottom Button */}
      <div className="floating-bottom-bar">
        <button
          className="btn-big-add-customer"
          onClick={() => setShowAddCustomerModal(true)}
        >
          {t.addCustomerBtn}
        </button>
      </div>

      {/* MODALS */}
      {showAddCustomerModal && (
        <AddCustomerModal
          onClose={() => setShowAddCustomerModal(false)}
          onSuccess={refreshDashboard}
        />
      )}

      {showLedgerModal && selectedCustomer && (
        <LedgerModal
          customer={selectedCustomer}
          onClose={() => setShowLedgerModal(false)}
          onRefresh={refreshDashboard}
          onAddTx={(type) => {
            setActiveTxType(type);
            setShowAddTxModal(true);
          }}
          onSettle={() => setShowSettlementModal(true)}
          onWhatsApp={() => setShowWhatsAppModal(true)}
          onDelete={() => promptDelete(selectedCustomer)}
        />
      )}

      {showAddTxModal && selectedCustomer && (
        <AddTxModal
          customer={selectedCustomer}
          initialType={activeTxType}
          onClose={() => setShowAddTxModal(false)}
          onSuccess={async () => {
            setShowAddTxModal(false);
            await refreshDashboard();
          }}
        />
      )}

      {showSettlementModal && selectedCustomer && (
        <SettlementModal
          customer={selectedCustomer}
          onClose={() => setShowSettlementModal(false)}
          onSuccess={async () => {
            setShowSettlementModal(false);
            await refreshDashboard();
          }}
        />
      )}

      {showCalcModal && (
        <StandaloneCalculatorModal onClose={() => setShowCalcModal(false)} />
      )}

      {showWhatsAppModal && selectedCustomer && (
        <WhatsAppModal
          customer={selectedCustomer}
          onClose={() => setShowWhatsAppModal(false)}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          profile={profile}
          validPin={validPin}
          onClose={() => setShowSettingsModal(false)}
          onSaveProfile={(newProf) => {
            setProfile(newProf);
            refreshProfile();
          }}
          onPinChange={(newPin) => setValidPin(newPin)}
          onClearData={async () => {
            await refreshDashboard();
          }}
        />
      )}

      {showDeleteModal && customerToDelete && (
        <DeleteConfirmModal
          customer={customerToDelete}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={confirmDeleteCustomer}
        />
      )}
    </div>
  );
}

// ==============================================================================
// MODAL: ADD CUSTOMER
// ==============================================================================
function AddCustomerModal({ onClose, onSuccess }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [village, setVillage] = useState("");
  const [limit, setLimit] = useState("50000");
  const [interestEnabled, setInterestEnabled] = useState(false);
  const [rate, setRate] = useState("2.0");
  const [compoundMode, setCompoundMode] = useState("NONE");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      alert("कृपया नाम और मोबाइल नंबर भरें!");
      return;
    }

    await Storage.addCustomer({
      name: name.trim(),
      phone: phone.trim(),
      village: village.trim(),
      credit_limit: limit,
      interest_enabled: interestEnabled,
      monthly_rate_pct: rate,
      compounding_mode: compoundMode
    });

    onClose();
    onSuccess();
  }

  return (
    <div className="modal-backdrop open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-header">
          <div className="modal-title">👤 नया व्यक्ति / उधार खाता जोड़ें</div>
          <button className="btn-close-modal" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">उधार लेने वाले का नाम *</label>
              <input
                type="text"
                className="form-input"
                placeholder="उदा: रामेश्वर शर्मा"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">मोबाइल नंबर (WhatsApp Phone) *</label>
              <input
                type="tel"
                className="form-input"
                placeholder="उदा: 9829123456"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">गांव / पता / संबंध</label>
              <input
                type="text"
                className="form-input"
                placeholder="उदा: रामपुरा, बस्सी या दोस्त / रिश्तेदार"
                value={village}
                onChange={(e) => setVillage(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">उधार सीमा (Max Loan Limit ₹)</label>
              <input
                type="number"
                className="form-input"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
              />
            </div>

            <div style={{ background: "#fff7ed", border: "1.5px dashed #fdba74", padding: "12px", borderRadius: "8px", marginBottom: "16px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  style={{ width: "18px", height: "18px" }}
                  checked={interestEnabled}
                  onChange={(e) => setInterestEnabled(e.target.checked)}
                />
                <span>🌾 इस खाते पर ग्रामीण सैकड़ा ब्याज लागू करें</span>
              </label>

              {interestEnabled && (
                <div style={{ marginTop: "10px" }}>
                  <div className="form-group" style={{ marginBottom: "8px" }}>
                    <label className="form-label">मासिक दर (₹ सैकड़ा प्रति माह)</label>
                    <input
                      type="number"
                      step="0.25"
                      className="form-input"
                      value={rate}
                      onChange={(e) => setRate(e.target.value)}
                      placeholder="2.0 = ₹2 सैकड़ा (2% प्रतिमाह)"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">खाता पलटी / चक्रवृद्धि चक्र</label>
                    <select
                      className="form-select"
                      value={compoundMode}
                      onChange={(e) => setCompoundMode(e.target.value)}
                    >
                      <option value="NONE">साधारण ब्याज (Simple Interest)</option>
                      <option value="6_MONTHS">छमाही खाता पलटी (6 Months Compound)</option>
                      <option value="12_MONTHS">सालाना खाता पलटी (Annual Compound)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <button type="submit" className="btn-primary-action btn-submit-save">
              खाता सुरक्षित करें
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==============================================================================
// MODAL: ADD TRANSACTION (LENT / REPAID)
// ==============================================================================
function AddTxModal({ customer, initialType, onClose, onSuccess }) {
  const [type, setType] = useState(initialType || "CREDIT_GIVEN");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split("T")[0];
  });
  const [details, setDetails] = useState("");
  const [mode, setMode] = useState("CASH");

  async function handleSubmit(e) {
    e.preventDefault();
    const numAmt = parseFloat(amount);
    if (isNaN(numAmt) || numAmt <= 0) {
      alert("कृपया वैध रकम भरें!");
      return;
    }

    await Storage.addTransaction({
      customer_id: customer.id,
      type,
      amount: numAmt,
      date,
      due_date: type === "CREDIT_GIVEN" ? dueDate : null,
      item_details: details.trim(),
      payment_mode: mode
    });

    onSuccess();
  }

  const isLent = type === "CREDIT_GIVEN";

  return (
    <div className="modal-backdrop open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-header">
          <div className="modal-title">
            लेन-देन दर्ज करें: <span style={{ color: "var(--primary)" }}>{customer.name}</span>
          </div>
          <button className="btn-close-modal" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="tx-type-toggle">
              <button
                type="button"
                className={`tx-type-btn gave ${isLent ? "selected" : ""}`}
                onClick={() => setType("CREDIT_GIVEN")}
              >
                🔴 उधार दिया (- Lent)
              </button>
              <button
                type="button"
                className={`tx-type-btn got ${!isLent ? "selected" : ""}`}
                onClick={() => setType("PAYMENT_RECEIVED")}
              >
                🟢 पैसे वापस मिले (+ Got)
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">रकम (Amount ₹) *</label>
              <input
                type="number"
                step="1"
                className="form-input"
                placeholder="उदा: 10000"
                style={{ fontSize: "20px", fontWeight: 800 }}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">तारीख (Date)</label>
              <input
                type="date"
                className="form-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            {isLent && (
              <div className="form-group">
                <label className="form-label">वापस करने की वादा तारीख (Promised Due Date)</label>
                <input
                  type="date"
                  className="form-input"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">कारण / नोट / विवरण</label>
              <input
                type="text"
                className="form-input"
                placeholder="उदा: खाद-बीज खर्च, घरेलू कार्य हेतु नकद"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">माध्यम (Payment Mode)</label>
              <select className="form-select" value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="CASH">💵 नकद (Cash)</option>
                <option value="UPI">📱 UPI / PhonePe / GPay</option>
                <option value="BANK_TRANSFER">🏦 बैंक ट्रांसफर (NEFT/IMPS)</option>
              </select>
            </div>

            <button
              type="submit"
              className="btn-primary-action"
              style={{ background: isLent ? "var(--gave-red)" : "var(--got-green)" }}
            >
              {isLent ? "उधार दिया (- Lent) दर्ज करें" : "पैसे वापस मिले (+ Received) दर्ज करें"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==============================================================================
// MODAL: CUSTOMER LEDGER (उधार-वापसी खाता विवरण)
// ==============================================================================
function LedgerModal({ customer, onClose, onRefresh, onAddTx, onSettle, onWhatsApp, onDelete }) {
  const isEnabled = customer.interest_settings && customer.interest_settings.is_enabled;
  const compLabel = isEnabled
    ? customer.interest_settings.compounding_mode === "6_MONTHS"
      ? "छमाही खाता पलटी"
      : customer.interest_settings.compounding_mode === "12_MONTHS"
      ? "सालाना खाता पलटी"
      : "साधारण ब्याज"
    : "";

  return (
    <div className="modal-backdrop open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet" style={{ maxWidth: "650px" }}>
        <div className="modal-header">
          <div className="modal-title">📖 उधार-वापसी खाता विवरण</div>
          <button className="btn-close-modal" onClick={onClose}>✕</button>
        </div>

        <div className="ledger-view-header">
          <div className="ledger-customer-box">
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: 800 }}>{customer.name}</h2>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                📍 {customer.village_address || "पता दर्ज नहीं"}
              </div>
              <div style={{ fontSize: "12px", color: "var(--primary)", fontWeight: 600 }}>
                📞 {customer.phone}
              </div>
            </div>
            <div>
              {isEnabled ? (
                <span className="badge badge-purple">
                  🌾 ₹{customer.interest_settings.monthly_rate_pct} सैकड़ा/माह ({compLabel})
                </span>
              ) : (
                <span className="badge badge-neutral">🌾 0% बिना ब्याज</span>
              )}
            </div>
          </div>

          <div className="ledger-balance-box">
            <div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600 }}>
                दिया गया मूलधन (Principal)
              </div>
              <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--gave-red)" }}>
                {RuralInterestEngine.formatINR(customer.current_balance)}
              </div>
            </div>
            {isEnabled && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600 }}>
                  आज तक का ब्याज (Interest)
                </div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--interest-purple)" }}>
                  {RuralInterestEngine.formatINR(customer.live_accrued_interest || 0)}
                </div>
              </div>
            )}
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600 }}>
                आज कुल वापस लेना है (Total)
              </div>
              <div style={{ fontSize: "20px", fontWeight: 800, color: "#b91c1c" }}>
                {RuralInterestEngine.formatINR(customer.total_payable_now || customer.current_balance)}
              </div>
            </div>
          </div>
        </div>

        {/* Action bar */}
        <div className="ledger-action-bar">
          <button className="btn-ledger-gave" onClick={() => onAddTx("CREDIT_GIVEN")}>
            🔴 और उधार दिया (- Lent More)
          </button>
          <button className="btn-ledger-got" onClick={() => onAddTx("PAYMENT_RECEIVED")}>
            🟢 पैसे वापस मिले (+ Got Repayment)
          </button>
        </div>

        <div className="ledger-tools">
          <button className="btn-sm-whatsapp" style={{ flex: "1 1 150px" }} onClick={onWhatsApp}>
            💬 व्हाट्सएप स्मरण
          </button>
          <button className="btn-sm-view" style={{ background: "#fff1f2", color: "#991b1b", borderColor: "#fca5a5" }} onClick={onSettle}>
            🤝 ब्याज हिसाब व चुकता
          </button>
          <button className="btn-sm-view" onClick={() => window.print()}>
            🖨️ पर्ची
          </button>
          <button className="btn-delete-cust" style={{ padding: "8px 12px", fontSize: "12.5px" }} onClick={onDelete}>
            🗑️ हटाएं
          </button>
        </div>

        {/* Transactions timeline */}
        <div className="tx-timeline">
          {!customer.transactions || customer.transactions.length === 0 ? (
            <div style={{ textAlign: "center", color: "#a1938f", padding: "24px" }}>
              कोई लेन-देन दर्ज नहीं है।
            </div>
          ) : (
            customer.transactions.map((tx) => {
              const isGave = tx.type === "CREDIT_GIVEN" || tx.type === "INTEREST_APPLIED";
              let badge = "🔴 उधार दिया";
              if (tx.type === "PAYMENT_RECEIVED") badge = "🟢 वापस मिला";
              else if (tx.type === "INTEREST_APPLIED") badge = "🟣 ब्याज जोड़ा";
              else if (tx.type === "DISCOUNT_WAIVED") badge = "🟡 ब्याज छूट";

              return (
                <div key={tx.id} className={`tx-row ${isGave ? "gave" : "got"}`}>
                  <div className="tx-row-details">
                    <div className="tx-row-item">{badge}: {tx.item_details || "लेन-देन"}</div>
                    <div className="tx-row-meta">
                      📅 {tx.transaction_date} {tx.due_date ? `• वादा तारीख: ${tx.due_date}` : ""} • माध्यम: {tx.payment_mode}
                    </div>
                  </div>
                  <div className="tx-row-amt">
                    <div className={`tx-row-amt-val ${isGave ? "gave" : "got"}`}>
                      {isGave ? "-" : "+"}{RuralInterestEngine.formatINR(tx.total_amount)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom prominent delete button */}
        <div className="delete-warning-box" style={{ margin: "4px 16px 20px", textAlign: "center" }}>
          <div className="delete-warning-title" style={{ justifyContent: "center" }}>
            ⚠️ खाता समाप्त करना चाहते हैं?
          </div>
          <p className="delete-warning-desc">
            इस खाते के सभी लेन-देन और ब्याज इतिहास हमेशा के लिए मिट जाएंगे।
          </p>
          <button
            type="button"
            className="btn-delete-cust"
            style={{ width: "100%", padding: "10px", fontSize: "13.5px" }}
            onClick={onDelete}
          >
            🗑️ {customer.name} का उधार खाता हटाएं
          </button>
        </div>
      </div>
    </div>
  );
}

// ==============================================================================
// MODAL: SETTLEMENT & WAIVER (हिसाब चुकता व ब्याज छूट)
// ==============================================================================
function SettlementModal({ customer, onClose, onSuccess }) {
  const [payment, setPayment] = useState(customer.total_payable_now || customer.current_balance || 0);
  const [waiver, setWaiver] = useState(0);
  const [mode, setMode] = useState("CASH");

  const prin = customer.current_balance || 0;
  const int = customer.live_accrued_interest || 0;

  const netPayable = Math.max(0, prin + Math.max(0, int - waiver));
  const allocation = RuralInterestEngine.allocatePartialRepayment(prin, int, payment, waiver);

  async function handleSubmit(e) {
    e.preventDefault();
    const todayStr = new Date().toISOString().split("T")[0];

    if (waiver > 0) {
      await Storage.addTransaction({
        customer_id: customer.id,
        type: "DISCOUNT_WAIVED",
        amount: waiver,
        date: todayStr,
        item_details: "खाता चुकता करने पर ब्याज छूट (Waived Interest)",
        payment_mode: "ADJUSTMENT"
      });
    }

    if (payment > 0) {
      await Storage.addTransaction({
        customer_id: customer.id,
        type: "PAYMENT_RECEIVED",
        amount: payment,
        date: todayStr,
        item_details: "खाता चुकता / पैसे वापस मिले",
        payment_mode: mode
      });
    }

    onSuccess();
  }

  return (
    <div className="modal-backdrop open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-header">
          <div className="modal-title">🤝 ब्याज हिसाब व खाता चुकता: {customer.name}</div>
          <button className="btn-close-modal" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="settle-summary-box">
              <div className="settle-metric-row">
                <span>दिया गया मूलधन (Principal):</span>
                <strong>{RuralInterestEngine.formatINR(prin)}</strong>
              </div>
              <div className="settle-metric-row">
                <span>आज तक का ब्याज (Accrued Interest):</span>
                <strong style={{ color: "var(--interest-purple)" }}>{RuralInterestEngine.formatINR(int)}</strong>
              </div>
              <div className="settle-metric-row highlight">
                <span>शुद्ध देय राशि (Net Payable):</span>
                <strong>{RuralInterestEngine.formatINR(netPayable)}</strong>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">ब्याज छूट / रियायत (Discount / Waiver ₹)</label>
              <input
                type="number"
                className="form-input"
                value={waiver}
                onChange={(e) => setWaiver(parseFloat(e.target.value) || 0)}
                placeholder="0"
              />
            </div>

            <div className="form-group">
              <label className="form-label">वापस जमा रकम (Payment Amount ₹) *</label>
              <input
                type="number"
                className="form-input"
                style={{ fontSize: "20px", fontWeight: 800, color: "var(--got-green)" }}
                value={payment}
                onChange={(e) => setPayment(parseFloat(e.target.value) || 0)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">भुगतान माध्यम (Mode)</label>
              <select className="form-select" value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="CASH">💵 नकद (Cash)</option>
                <option value="UPI">📱 UPI / PhonePe / GPay</option>
                <option value="BANK_TRANSFER">🏦 बैंक ट्रांसफर</option>
              </select>
            </div>

            <div style={{ background: "#faf8f7", padding: "12px", borderRadius: "8px", marginBottom: "16px", border: "1px solid var(--border-color)" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>भुगतान के बाद शेष:</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                <span>बाकी मूलधन: {RuralInterestEngine.formatINR(allocation.remainingPrincipal)}</span>
                <span>बाकी ब्याज: {RuralInterestEngine.formatINR(allocation.remainingAccruedInterest)}</span>
              </div>
              <div style={{ marginTop: "6px" }}>
                <span className={`badge ${allocation.isFullySettled ? "badge-success" : "badge-warning"}`}>
                  {allocation.isFullySettled ? "✅ पूर्ण खाता चुकता (100% Settled)" : "⚠️ आंशिक भुगतान (Partial Repayment)"}
                </span>
              </div>
            </div>

            <button type="submit" className="btn-primary-action" style={{ background: "var(--got-green)" }}>
              भुगतान सुरक्षित करें व खाता अद्यतन करें
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==============================================================================
// MODAL: STANDALONE RURAL INTEREST CALCULATOR
// ==============================================================================
function StandaloneCalculatorModal({ onClose }) {
  const [principal, setPrincipal] = useState(10000);
  const [rate, setRate] = useState(2.0);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [compMode, setCompMode] = useState("NONE");
  const [basis, setBasis] = useState("30_DAYS_MONTH");

  const calcResult = useMemo(() => {
    if (!startDate || !endDate || new Date(endDate) < new Date(startDate)) {
      return null;
    }
    return RuralInterestEngine.calculateCompoundInterest(
      principal,
      rate,
      startDate,
      endDate,
      compMode,
      basis
    );
  }, [principal, rate, startDate, endDate, compMode, basis]);

  return (
    <div className="modal-backdrop open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-header">
          <div className="modal-title">🧮 ग्रामीण सैकड़ा ब्याज कैलकुलेटर</div>
          <button className="btn-close-modal" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">मूलधन (Principal Amount ₹)</label>
            <input
              type="number"
              className="form-input"
              value={principal}
              onChange={(e) => setPrincipal(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">मासिक दर (₹ सैकड़ा प्रति माह)</label>
            <input
              type="number"
              step="0.25"
              className="form-input"
              value={rate}
              onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div className="form-group">
              <label className="form-label">शुरुआती तारीख</label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">अंतिम तारीख</label>
              <input
                type="date"
                className="form-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div className="form-group">
              <label className="form-label">खाता पलटी (चक्रवृद्धि)</label>
              <select className="form-select" value={compMode} onChange={(e) => setCompMode(e.target.value)}>
                <option value="NONE">साधारण ब्याज</option>
                <option value="6_MONTHS">छमाही खाता पलटी</option>
                <option value="12_MONTHS">सालाना खाता पलटी</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">दिन गणना नियम</label>
              <select className="form-select" value={basis} onChange={(e) => setBasis(e.target.value)}>
                <option value="30_DAYS_MONTH">मंडी 30-दिन नियम</option>
                <option value="EXACT_CALENDAR_DAYS">वास्तविक कैलेंडर दिन</option>
              </select>
            </div>
          </div>

          {calcResult && (
            <div className="calc-result-box">
              <div className="calc-muted" style={{ fontSize: "12px" }}>
                समय अवधि: <strong style={{ color: "#7f1d1d" }}>{calcResult.duration.formattedDuration}</strong>
              </div>
              <div className="calc-row">
                <span>साधारण ब्याज:</span>
                <strong>{RuralInterestEngine.formatINR(calcResult.simpleInterest)}</strong>
              </div>
              <div className="calc-row">
                <span>खाता पलटी वृद्धि:</span>
                <strong>{RuralInterestEngine.formatINR(calcResult.compoundAddition)}</strong>
              </div>
              <div className="calc-row highlight">
                <span>कुल ब्याज:</span>
                <span>{RuralInterestEngine.formatINR(calcResult.totalInterest)}</span>
              </div>
              <div className="calc-row" style={{ fontSize: "17px", fontWeight: 900, color: "#991b1b", marginTop: "4px" }}>
                <span>कुल देय (मूलधन + ब्याज):</span>
                <span style={{ color: "#991b1b" }}>{RuralInterestEngine.formatINR(calcResult.totalPayable)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==============================================================================
// MODAL: WHATSAPP REMINDER DISPATCH
// ==============================================================================
function WhatsAppModal({ customer, onClose }) {
  const [lang, setLang] = useState("HI");
  const [customNote, setCustomNote] = useState("");

  const messageText = useMemo(() => {
    return WhatsAppDispatcher.composeMessage({
      customerName: customer.name,
      totalBalance: customer.total_payable_now || customer.current_balance,
      principalAmount: customer.current_balance,
      accruedInterest: customer.live_accrued_interest || 0,
      dueDate: customer.earliest_due_date,
      language: lang,
      interestEnabled: customer.interest_enabled,
      customNote
    });
  }, [customer, lang, customNote]);

  return (
    <div className="modal-backdrop open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-header">
          <div className="modal-title">
            💬 उधार वापसी स्मरण: <span style={{ color: "var(--primary)" }}>{customer.name}</span>
          </div>
          <button className="btn-close-modal" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>📞 {customer.phone}</span>
            <select
              className="form-select"
              style={{ width: "auto", padding: "4px 8px", fontSize: "13px" }}
              value={lang}
              onChange={(e) => setLang(e.target.value)}
            >
              <option value="HI">शुद्ध हिन्दी (Hindi)</option>
              <option value="EN">Hinglish / English</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">अतिरिक्त नोट (Optional Note)</label>
            <input
              type="text"
              className="form-input"
              placeholder="उदा: भाई साहब, 10 तारीख को पैसे लौटाने का वादा था।"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">संदेश पूर्वावलोकन (Preview):</label>
            <div className="whatsapp-preview-bubble">{messageText}</div>
          </div>

          <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
            <button
              type="button"
              className="btn-sm-whatsapp"
              style={{ padding: "12px", fontSize: "15px" }}
              onClick={() => WhatsAppDispatcher.openWhatsApp(customer.phone, messageText)}
            >
              🚀 व्हाट्सएप पर स्मरण भेजें
            </button>
            <button
              type="button"
              className="btn-sm-view"
              style={{ padding: "12px" }}
              onClick={() => {
                navigator.clipboard.writeText(messageText).then(() => {
                  alert("संदेश कॉपी कर लिया गया!");
                });
              }}
            >
              📋 कॉपी करें
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==============================================================================
// MODAL: SETTINGS & PROFILE
// ==============================================================================
function SettingsModal({ profile, validPin, onClose, onSaveProfile, onPinChange, onClearData }) {
  const [ownerName, setOwnerName] = useState(profile.owner_name || "जयदेव सिंह");
  const [shopName, setShopName] = useState(profile.shop_name || "मेरी उधार-बाकी डायरी");
  const [upiId, setUpiId] = useState(profile.upi_id || "user@upi");

  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");

  async function handleProfileSubmit(e) {
    e.preventDefault();
    const updated = {
      owner_name: ownerName.trim(),
      shop_name: shopName.trim(),
      upi_id: upiId.trim()
    };

    await Storage.saveProfile(updated);
    await fetch("/api/settings/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated)
    }).catch(() => {});

    onSaveProfile(updated);
    alert("✅ प्रोफाइल जानकारी सफलतापूर्वक सुरक्षित कर दी गई!");
    onClose();
  }

  async function handlePinSubmit(e) {
    e.preventDefault();
    if (oldPin !== validPin) {
      alert("⚠️ पुराना पिन गलत है!");
      return;
    }
    if (newPin.length !== 4 || isNaN(newPin)) {
      alert("⚠️ नया पिन ठीक 4 अंकों का होना चाहिए!");
      return;
    }

    await fetch("/api/auth/change-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "9876543210", old_pin: oldPin, new_pin: newPin })
    }).catch(() => {});

    onPinChange(newPin);
    setOldPin("");
    setNewPin("");
    alert(`✅ सुरक्षा पिन बदलकर ${newPin} कर दिया गया है!`);
  }

  async function handleClearAll() {
    const confirmed = confirm("⚠️ क्या आप सच में सभी सैंपल/डमी खाते हटाना चाहते हैं?\n\nइसके बाद आपकी डायरी एकदम खाली और नए हिसाब के लिए तैयार हो जाएगी।");
    if (!confirmed) return;

    await fetch("/api/settings/clear-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    }).catch(() => {});

    await Storage.clearAllData();
    onClose();
    await onClearData();
    alert("✅ सभी खाते साफ़ कर दिए गए हैं!\nआपकी उधार-बाकी डायरी अब पूरी तरह खाली और नए हिसाब के लिए तैयार है।");
  }

  return (
    <div className="modal-backdrop open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet" style={{ maxWidth: "550px" }}>
        <div className="modal-header">
          <div className="modal-title">⚙️ व्यक्तिगत प्रोफाइल व सेटिंग्स</div>
          <button className="btn-close-modal" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleProfileSubmit}>
            <div className="form-group">
              <label className="form-label">आपका नाम (Owner Name)</label>
              <input
                type="text"
                className="form-input"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">डायरी का शीर्षक (Diary Title)</label>
              <input
                type="text"
                className="form-input"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">आपका UPI ID (PhonePe / GPay / Paytm)</label>
              <input
                type="text"
                className="form-input"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
              />
              <small style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                यह UPI ID व्हाट्सएप तगादा संदेश में सीधे भुगतान हेतु जुड़ेगा।
              </small>
            </div>

            <button type="submit" className="btn-primary-action btn-submit-save" style={{ marginBottom: "20px" }}>
              💾 प्रोफाइल जानकारी सुरक्षित करें
            </button>
          </form>

          <hr style={{ border: 0, borderTop: "1px solid var(--border-color)", margin: "16px 0" }} />

          {/* Change MPIN */}
          <div style={{ background: "#faf8f7", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", padding: "14px", marginBottom: "20px" }}>
            <div style={{ fontWeight: 700, marginBottom: "8px", fontSize: "14px" }}>
              🔒 सुरक्षा पिन बदलें (Change 4-Digit MPIN)
            </div>
            <form onSubmit={handlePinSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                <div>
                  <label className="form-label" style={{ fontSize: "12px" }}>पुराना पिन</label>
                  <input
                    type="password"
                    maxLength="4"
                    className="form-input"
                    value={oldPin}
                    onChange={(e) => setOldPin(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: "12px" }}>नया 4-अंकीय पिन</label>
                  <input
                    type="password"
                    maxLength="4"
                    className="form-input"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    required
                  />
                </div>
              </div>
              <button type="submit" className="btn-sm-view" style={{ width: "100%", padding: "8px", fontWeight: 700 }}>
                🔐 नया पिन सेट करें
              </button>
            </form>
          </div>

          <hr style={{ border: 0, borderTop: "1px solid var(--border-color)", margin: "16px 0" }} />

          {/* Danger zone */}
          <div style={{ background: "#fff1f2", border: "1.5px dashed #fecdd3", borderRadius: "var(--radius-md)", padding: "16px", textAlign: "center" }}>
            <div style={{ fontWeight: 800, color: "#e11d48", marginBottom: "4px", fontSize: "14px" }}>
              ⚠️ डेटा साफ़ करें (Danger Zone)
            </div>
            <p style={{ fontSize: "12px", color: "#9f1239", marginBottom: "12px" }}>
              यदि आप सभी खाते हटाकर अपनी डायरी को एकदम खाली और नई शुरू करना चाहते हैं, तो नीचे दिए बटन पर क्लिक करें।
            </p>
            <button
              type="button"
              style={{ background: "#e11d48", color: "white", border: "none", borderRadius: "8px", padding: "10px 18px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
              onClick={handleClearAll}
            >
              🗑️ सभी खाते साफ़ करें (Fresh Start)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==============================================================================
// MODAL: DELETE CONFIRMATION
// ==============================================================================
function DeleteConfirmModal({ customer, onClose, onConfirm }) {
  const hasBalance = Math.abs(customer.current_balance) > 0.01;

  return (
    <div className="modal-backdrop open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet" style={{ maxWidth: "450px" }}>
        <div className="modal-header" style={{ borderBottom: "1px solid #fee2e2", background: "#fff1f2" }}>
          <div className="modal-title" style={{ color: "#e11d48" }}>⚠️ खाता हटाने की पुष्टि</div>
          <button className="btn-close-modal" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ textAlign: "center", padding: "24px 20px" }}>
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>🗑️</div>
          <h3 style={{ fontSize: "17px", fontWeight: 800, marginBottom: "8px" }}>
            {customer.name} का खाता हटाएं?
          </h3>
          {hasBalance && (
            <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: "8px", padding: "10px", margin: "12px 0", color: "#9f1239", fontSize: "13px" }}>
              चेतावनी: इस खाते पर अभी <strong>{RuralInterestEngine.formatINR(customer.current_balance)}</strong> बकाया है!
            </div>
          )}
          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "20px" }}>
            हटाने के बाद इस खाते के सभी लेन-देन और ब्याज इतिहास हमेशा के लिए मिट जाएंगे।
          </p>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              className="btn-sm-view"
              style={{ flex: 1, padding: "12px", background: "#f6f2f1" }}
              onClick={onClose}
            >
              रद्द करें
            </button>
            <button
              type="button"
              className="btn-delete-cust"
              style={{ flex: 1, padding: "12px", fontWeight: 700 }}
              onClick={onConfirm}
            >
              हाँ, खाता हटाएं
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Mount React 18 Application
const rootElement = document.getElementById("root");
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}
