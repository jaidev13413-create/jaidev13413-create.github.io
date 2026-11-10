/**
 * WhatsApp Dispatch & Deep Linking Utility (Client-Side)
 * Digital Bahi-Khata (डिजिटल बही-खाता)
 */

const WhatsAppDispatcher = {
  merchantConfig: {
    shopName: "मेरी उधार-बाकी डायरी",
    ownerName: "जयदेव सिंह",
    upiId: "user@upi",
    phone: "9876543210"
  },

  setMerchantConfig(config) {
    this.merchantConfig = { ...this.merchantConfig, ...config };
  },

  /**
   * Format message in Hindi or English/Hinglish
   */
  composeMessage({
    customerName,
    totalBalance,
    principalAmount,
    accruedInterest = 0,
    dueDate = null,
    language = "HI",
    interestEnabled = false,
    customNote = ""
  }) {
    const formattedTotal = RuralInterestEngine.formatINR(totalBalance);
    const formattedPrin = RuralInterestEngine.formatINR(principalAmount || totalBalance);
    const formattedInt = RuralInterestEngine.formatINR(accruedInterest);

    let dueDateStr = "";
    if (dueDate) {
      const d = new Date(dueDate);
      dueDateStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    }

    const senderName = this.merchantConfig.ownerName || this.merchantConfig.shopName || "सादर";
    const upiId = this.merchantConfig.upiId || "";

    if (language === "HI") {
      const lines = [
        `🙏 *सादर प्रणाम ${customerName} जी,*`,
        `यह संदेश आपके द्वारा लिए गए उधार (कर्ज) के हिसाब हेतु स्मरण के लिए है।`,
        "",
        "📊 *आज तक का कुल हिसाब:*",
      ];

      if (interestEnabled && accruedInterest > 0) {
        lines.push(`▫️ दिया गया मूलधन (Principal): ${formattedPrin}`);
        lines.push(`▫️ आज तक का ब्याज (Interest): ${formattedInt}`);
        lines.push(`▫️ *कुल वापस देय राशि (Total Amount): ${formattedTotal}*`);
      } else {
        lines.push(`▫️ *कुल वापस देय राशि (Total Due): ${formattedTotal}*`);
      }

      if (dueDateStr) {
        lines.push(`📅 वादा की गई वापसी तारीख: *${dueDateStr}*`);
      }

      if (customNote && customNote.trim()) {
        lines.push(`📝 नोट: ${customNote.trim()}`);
      }

      lines.push("");
      lines.push("कृपया समयानुसार हिसाब चुकता कर सहयोग करें।");
      if (upiId) {
        lines.push(`💳 *सीधे UPI द्वारा भुगतान हेतु:* \`${upiId}\``);
      }
      lines.push("");
      lines.push(`सादर धन्यवाद! 🙏\n*${senderName}*`);

      return lines.join("\n");
    } else {
      const lines = [
        `🙏 *Namaste ${customerName} ji,*`,
        `This is a gentle reminder regarding the personal loan / credit balance given to you.`,
        "",
        "📊 *Account Summary till date:*",
      ];

      if (interestEnabled && accruedInterest > 0) {
        lines.push(`▫️ Principal Lent: ${formattedPrin}`);
        lines.push(`▫️ Accrued Interest: ${formattedInt}`);
        lines.push(`▫️ *Total Repayment Due: ${formattedTotal}*`);
      } else {
        lines.push(`▫️ *Total Repayment Due: ${formattedTotal}*`);
      }

      if (dueDateStr) {
        lines.push(`📅 Promised Return Date: *${dueDateStr}*`);
      }

      if (customNote && customNote.trim()) {
        lines.push(`📝 Note: ${customNote.trim()}`);
      }

      lines.push("");
      lines.push("Please arrange to return the pending amount at your earliest convenience.");
      if (upiId) {
        lines.push(`💳 *Pay via UPI:* \`${upiId}\``);
      }
      lines.push("");
      lines.push(`Thank you! 🙏\n*${senderName}*`);

      return lines.join("\n");
    }
  },

  /**
   * Generates direct wa.me deep link URL
   */
  generateDeepLink(phone, messageText) {
    let cleanPhone = String(phone || "").replace(/\D/g, "");
    if (cleanPhone.length === 10) {
      cleanPhone = "91" + cleanPhone;
    }
    const encoded = encodeURIComponent(messageText);
    return `https://wa.me/${cleanPhone}?text=${encoded}`;
  },

  /**
   * Generates UPI payment intent URI
   */
  generateUpiIntent(amount, customerName) {
    const { upiId, shopName } = this.merchantConfig;
    const cleanAmount = (parseFloat(amount) || 0).toFixed(2);
    const note = encodeURIComponent(`Bahi-Khata payment: ${customerName}`);
    const name = encodeURIComponent(shopName);
    return `upi://pay?pa=${upiId}&pn=${name}&am=${cleanAmount}&cu=INR&tn=${note}`;
  },

  /**
   * Triggers WhatsApp deep link launch in browser/app
   */
  openWhatsApp(phone, messageText) {
    const url = this.generateDeepLink(phone, messageText);
    window.open(url, "_blank");
  }
};

if (typeof window !== "undefined") {
  window.WhatsAppDispatcher = WhatsAppDispatcher;
}
