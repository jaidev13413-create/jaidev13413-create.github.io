/**
 * Offline-First IndexedDB Repository for Digital Bahi-Khata.
 * Ensures zero-latency, full functionality even in rural areas without internet.
 */

const DB_NAME = "DigitalBahiKhataDB";
const DB_VERSION = 1;

class BahiKhataStorage {
  constructor() {
    this.db = null;
    this.isOnline = navigator.onLine;
    window.addEventListener("online", () => { this.isOnline = true; });
    window.addEventListener("offline", () => { this.isOnline = false; });
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Customers Store
        if (!db.objectStoreNames.contains("customers")) {
          const custStore = db.createObjectStore("customers", { keyPath: "id" });
          custStore.createIndex("phone", "phone", { unique: true });
          custStore.createIndex("current_balance", "current_balance", { unique: false });
        }

        // Transactions Store
        if (!db.objectStoreNames.contains("transactions")) {
          const txStore = db.createObjectStore("transactions", { keyPath: "id" });
          txStore.createIndex("customer_id", "customer_id", { unique: false });
          txStore.createIndex("transaction_date", "transaction_date", { unique: false });
          txStore.createIndex("due_date", "due_date", { unique: false });
        }

        // Interest Settings Store
        if (!db.objectStoreNames.contains("interest_settings")) {
          const intStore = db.createObjectStore("interest_settings", { keyPath: "id" });
          intStore.createIndex("customer_id", "customer_id", { unique: true });
        }

        // Reminders Store
        if (!db.objectStoreNames.contains("reminders")) {
          const remStore = db.createObjectStore("reminders", { keyPath: "id" });
          remStore.createIndex("customer_id", "customer_id", { unique: false });
        }

        // App Meta / Config Store
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta", { keyPath: "key" });
        }
      };

      request.onsuccess = async (event) => {
        this.db = event.target.result;
        await this._syncWithBackendOrClearIfEmpty();
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error("IndexedDB Open Error:", event.target.error);
        reject(event.target.error);
      };
    });
  }

  async _syncWithBackendOrClearIfEmpty() {
    try {
      const res = await fetch("/api/customers").then((r) => r.json());
      if (res && Array.isArray(res.customers)) {
        if (res.customers.length === 0) {
          // Backend has 0 customers (was cleared). Wipe stale demo data from IndexedDB immediately!
          await this.clear("customers");
          await this.clear("transactions");
          await this.clear("interest_settings");
          await this.clear("reminders");
          await this.put("meta", { key: "initialized", value: true });
          return;
        } else {
          // Backend has customers: sync into IndexedDB
          await this.clear("customers");
          for (const c of res.customers) {
            await this.put("customers", c);
          }
        }
      }
    } catch (err) {
      console.log("Offline mode or sync notice:", err);
    }
  }

  // Generic DB Operations
  async get(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getAll(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async put(storeName, value) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.put(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async delete(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async count(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async clear(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async clearAllData() {
    await this.clear("customers");
    await this.clear("transactions");
    await this.clear("interest_settings");
    await this.clear("reminders");
    await this.put("meta", { key: "initialized", value: true });
    return { success: true };
  }

  async getProfile() {
    const item = await this.get("meta", "merchant_profile");
    return item ? item.value : null;
  }

  async saveProfile(profile) {
    await this.put("meta", { key: "merchant_profile", value: profile });
    return { success: true };
  }

  // Domain Queries
  async getCustomersWithSettings() {
    const customers = await this.getAll("customers");
    const settings = await this.getAll("interest_settings");
    const transactions = await this.getAll("transactions");

    const settingsMap = new Map();
    settings.forEach((s) => settingsMap.set(s.customer_id, s));

    return customers.map((c) => {
      const s = settingsMap.get(c.id) || { is_enabled: false, monthly_rate_pct: 0, compounding_mode: "NONE" };
      
      // Calculate earliest due date among unpaid credit
      const custTxs = transactions.filter((t) => t.customer_id === c.id && t.due_date);
      custTxs.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
      const earliestDue = custTxs.length > 0 ? custTxs[0].due_date : null;
      const dueInfo = RuralInterestEngine.determineDueStatus(earliestDue);

      return {
        ...c,
        interest_enabled: s.is_enabled,
        monthly_rate_pct: s.monthly_rate_pct,
        compounding_mode: s.compounding_mode,
        calculation_basis: s.calculation_basis || "30_DAYS_MONTH",
        earliest_due_date: earliestDue,
        due_status: dueInfo.status,
        due_label: dueInfo.label,
        due_badge_class: dueInfo.badgeClass
      };
    });
  }

  async getCustomerFullDetails(customerId) {
    const customer = await this.get("customers", customerId);
    if (!customer) return null;

    const allSettings = await this.getAll("interest_settings");
    const settings = allSettings.find((s) => s.customer_id === customerId) || {
      is_enabled: false,
      monthly_rate_pct: 0,
      compounding_mode: "NONE"
    };

    const allTransactions = await this.getAll("transactions");
    const transactions = allTransactions
      .filter((t) => t.customer_id === customerId)
      .sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));

    // Calculate accrued interest on active credit given
    let accruedTotal = 0;
    const todayStr = new Date().toISOString().split("T")[0];

    if (settings.is_enabled && settings.monthly_rate_pct > 0) {
      transactions.forEach((tx) => {
        if (tx.type === "CREDIT_GIVEN" && tx.transaction_date < todayStr) {
          const calc = RuralInterestEngine.calculateCompoundInterest(
            tx.total_amount,
            settings.monthly_rate_pct,
            tx.transaction_date,
            todayStr,
            settings.compounding_mode,
            settings.calculation_basis || "30_DAYS_MONTH"
          );
          accruedTotal += calc.totalInterest;
        }
      });
    }

    accruedTotal = parseFloat(accruedTotal.toFixed(2));
    const totalPayable = parseFloat((customer.current_balance + accruedTotal).toFixed(2));

    return {
      ...customer,
      interest_settings: settings,
      transactions,
      live_accrued_interest: accruedTotal,
      total_payable_now: totalPayable
    };
  }

  async addTransaction({ customer_id, type, amount, date, due_date, item_details, payment_mode }) {
    const txId = `tx-${Date.now()}`;
    const numAmount = parseFloat(amount) || 0;

    const txRecord = {
      id: txId,
      customer_id,
      type,
      principal_amount: numAmount,
      interest_amount: 0,
      total_amount: numAmount,
      transaction_date: date,
      due_date: due_date || null,
      bill_no: "",
      item_details: item_details || "",
      payment_mode: payment_mode || "CASH"
    };

    await this.put("transactions", txRecord);

    // Update customer running balance
    const customer = await this.get("customers", customer_id);
    if (customer) {
      if (type === "CREDIT_GIVEN" || type === "INTEREST_APPLIED") {
        customer.current_balance += numAmount;
      } else if (type === "PAYMENT_RECEIVED" || type === "DISCOUNT_WAIVED") {
        customer.current_balance -= numAmount;
      }
      customer.current_balance = parseFloat(customer.current_balance.toFixed(2));
      customer.updated_at = new Date().toISOString();
      await this.put("customers", customer);
    }

    return { success: true, transaction: txRecord, updated_balance: customer ? customer.current_balance : 0 };
  }

  async deleteCustomer(customerId) {
    // 1. Delete customer
    await this.delete("customers", customerId);

    // 2. Delete interest settings
    const allSettings = await this.getAll("interest_settings");
    for (const s of allSettings) {
      if (s.customer_id === customerId) {
        await this.delete("interest_settings", s.id);
      }
    }

    // 3. Delete customer transactions
    const allTxs = await this.getAll("transactions");
    for (const t of allTxs) {
      if (t.customer_id === customerId) {
        await this.delete("transactions", t.id);
      }
    }

    // 4. Delete reminders
    const allReminders = await this.getAll("reminders");
    for (const r of allReminders) {
      if (r.customer_id === customerId) {
        await this.delete("reminders", r.id);
      }
    }

    return { success: true };
  }

  async addCustomer({ name, phone, village, credit_limit, notes, interest_enabled, monthly_rate_pct, compounding_mode }) {
    const custId = `cust-${Date.now()}`;
    const customer = {
      id: custId,
      name,
      phone,
      village_address: village || "",
      credit_limit: parseFloat(credit_limit) || 50000,
      current_balance: 0.0,
      notes: notes || "",
      created_at: new Date().toISOString()
    };

    const setting = {
      id: `is-${Date.now()}`,
      customer_id: custId,
      is_enabled: !!interest_enabled,
      monthly_rate_pct: parseFloat(monthly_rate_pct) || 0,
      compounding_mode: compounding_mode || "NONE",
      calculation_basis: "30_DAYS_MONTH",
      grace_period_days: 0
    };

    await this.put("customers", customer);
    await this.put("interest_settings", setting);

    return { success: true, customer_id: custId };
  }
}

// Global storage singleton
const Storage = new BahiKhataStorage();
if (typeof window !== "undefined") {
  window.Storage = Storage;
}
