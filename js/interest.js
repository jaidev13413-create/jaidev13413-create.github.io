/**
 * Rural Interest Engine (ग्रामीण ब्याज कैलकुलेटर) - Client-Side Engine
 * Replicates the exact Indian rural Saikda math in JavaScript for offline-first usage.
 */

const RuralInterestEngine = {
  /**
   * Format Indian Rupee currency with commas: ₹ 1,25,000.00
   */
  formatINR(amount) {
    if (isNaN(amount) || amount === null || amount === undefined) return "₹ 0.00";
    const isNegative = amount < 0;
    const absVal = Math.abs(amount).toFixed(2);
    const parts = absVal.split(".");
    let intPart = parts[0];
    const decPart = parts[1];

    // Indian numbering format: last 3 digits, then groups of 2
    if (intPart.length > 3) {
      const last3 = intPart.substring(intPart.length - 3);
      const remaining = intPart.substring(0, intPart.length - 3);
      intPart = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
    }

    return `${isNegative ? "-" : ""}₹ ${intPart}.${decPart}`;
  },

  /**
   * Calculates duration breakdown into full calendar months and remaining days.
   */
  calculateDurationBreakdown(startDateStr, endDateStr) {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);

    if (end < start) {
      return {
        totalDays: 0,
        fullMonths: 0,
        remainingDays: 0,
        effectiveMonths: 0,
        formattedDuration: "0 दिन"
      };
    }

    const diffTime = Math.abs(end - start);
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let current = new Date(start.getTime());
    let months = 0;

    while (true) {
      // Advance by 1 month
      const targetYear = current.getFullYear() + Math.floor((current.getMonth() + 1) / 12);
      const targetMonth = (current.getMonth() + 1) % 12;
      const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
      const targetDay = Math.min(start.getDate(), daysInTargetMonth);

      const nextMonthDate = new Date(targetYear, targetMonth, targetDay);

      if (nextMonthDate <= end) {
        months++;
        current = nextMonthDate;
      } else {
        break;
      }
    }

    const remainingDays = Math.round((end - current) / (1000 * 60 * 60 * 24));
    const effectiveMonths = months + (remainingDays / 30.0);

    const parts = [];
    if (months > 0) parts.push(`${months} माह`);
    if (remainingDays > 0 || months === 0) parts.push(`${remainingDays} दिन`);
    const formattedDuration = `${parts.join(" ")} (कुल ${totalDays} दिन)`;

    return {
      totalDays,
      fullMonths: months,
      remainingDays,
      effectiveMonths: parseFloat(effectiveMonths.toFixed(4)),
      formattedDuration
    };
  },

  /**
   * Rural Simple Interest: (Principal * Rate * Effective Months) / 100
   */
  calculateSimpleInterest(principal, monthlyRatePct, startDateStr, endDateStr, basis = "30_DAYS_MONTH", graceDays = 0) {
    const p = parseFloat(principal) || 0;
    const r = parseFloat(monthlyRatePct) || 0;
    const dur = this.calculateDurationBreakdown(startDateStr, endDateStr);

    if (p <= 0 || r <= 0 || dur.totalDays <= graceDays) {
      return {
        principal: p,
        monthlyRatePct: r,
        duration: dur,
        simpleInterest: 0,
        compoundAddition: 0,
        totalInterest: 0,
        waivedInterest: 0,
        netPayableInterest: 0,
        totalPayable: p
      };
    }

    let effMonths = dur.effectiveMonths;
    if (basis === "EXACT_CALENDAR_DAYS") {
      effMonths = (dur.totalDays * 12.0) / 365.0;
    }

    const interest = parseFloat(((p * r * effMonths) / 100.0).toFixed(2));
    const total = parseFloat((p + interest).toFixed(2));

    return {
      principal: p,
      monthlyRatePct: r,
      duration: dur,
      simpleInterest: interest,
      compoundAddition: 0,
      totalInterest: interest,
      waivedInterest: 0,
      netPayableInterest: interest,
      totalPayable: total
    };
  },

  /**
   * Rural Compounding Rest Interval Calculation ("खाता पलटी")
   */
  calculateCompoundInterest(principal, monthlyRatePct, startDateStr, endDateStr, compoundingMode = "NONE", basis = "30_DAYS_MONTH", graceDays = 0) {
    if (compoundingMode === "NONE" || !compoundingMode) {
      return this.calculateSimpleInterest(principal, monthlyRatePct, startDateStr, endDateStr, basis, graceDays);
    }

    const intervalMonths = compoundingMode === "6_MONTHS" ? 6 : 12;
    const p = parseFloat(principal) || 0;
    const r = parseFloat(monthlyRatePct) || 0;
    const dur = this.calculateDurationBreakdown(startDateStr, endDateStr);

    if (p <= 0 || r <= 0 || dur.totalDays <= graceDays) {
      return this.calculateSimpleInterest(p, r, startDateStr, endDateStr, basis, graceDays);
    }

    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    let currentPrincipal = p;
    let currentDate = new Date(start.getTime());

    while (true) {
      const targetYear = currentDate.getFullYear() + Math.floor((currentDate.getMonth() + intervalMonths) / 12);
      const targetMonth = (currentDate.getMonth() + intervalMonths) % 12;
      const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
      const targetDay = Math.min(start.getDate(), daysInTargetMonth);

      const nextCycleDate = new Date(targetYear, targetMonth, targetDay);

      if (nextCycleDate <= end) {
        const periodDur = this.calculateDurationBreakdown(currentDate.toISOString().split("T")[0], nextCycleDate.toISOString().split("T")[0]);
        const effM = basis === "30_DAYS_MONTH" ? periodDur.effectiveMonths : (periodDur.totalDays * 12.0) / 365.0;
        const periodInt = (currentPrincipal * r * effM) / 100.0;
        currentPrincipal += periodInt;
        currentDate = nextCycleDate;
      } else {
        if (currentDate < end) {
          const periodDur = this.calculateDurationBreakdown(currentDate.toISOString().split("T")[0], endDateStr);
          const effM = basis === "30_DAYS_MONTH" ? periodDur.effectiveMonths : (periodDur.totalDays * 12.0) / 365.0;
          const periodInt = (currentPrincipal * r * effM) / 100.0;
          currentPrincipal += periodInt;
        }
        break;
      }
    }

    const totalInterest = parseFloat((currentPrincipal - p).toFixed(2));
    const simpleRes = this.calculateSimpleInterest(p, r, startDateStr, endDateStr, basis, graceDays);
    const compoundAddition = Math.max(0, parseFloat((totalInterest - simpleRes.simpleInterest).toFixed(2)));

    return {
      principal: p,
      monthlyRatePct: r,
      duration: dur,
      simpleInterest: simpleRes.simpleInterest,
      compoundAddition,
      totalInterest,
      waivedInterest: 0,
      netPayableInterest: totalInterest,
      totalPayable: parseFloat((p + totalInterest).toFixed(2))
    };
  },

  /**
   * Legal Indian Rule of Appropriation (Interest-First Deduction):
   */
  allocatePartialRepayment(currentPrincipal, accruedInterest, repaymentAmount, discountWaived = 0) {
    const prin = parseFloat(currentPrincipal) || 0;
    const int = parseFloat(accruedInterest) || 0;
    const pay = parseFloat(repaymentAmount) || 0;
    const disc = parseFloat(discountWaived) || 0;

    const effectiveInterest = Math.max(0, int - disc);

    let interestSettled = 0;
    let remainingPayment = 0;
    let remainingAccruedInterest = 0;

    if (pay >= effectiveInterest) {
      interestSettled = effectiveInterest;
      remainingPayment = pay - effectiveInterest;
      remainingAccruedInterest = 0;
    } else {
      interestSettled = pay;
      remainingPayment = 0;
      remainingAccruedInterest = effectiveInterest - pay;
    }

    let principalSettled = 0;
    let remainingPrincipal = 0;

    if (remainingPayment >= prin) {
      principalSettled = prin;
      const advance = remainingPayment - prin;
      remainingPrincipal = -advance;
    } else {
      principalSettled = remainingPayment;
      remainingPrincipal = prin - remainingPayment;
    }

    return {
      interestSettled: parseFloat(interestSettled.toFixed(2)),
      principalSettled: parseFloat(principalSettled.toFixed(2)),
      remainingPrincipal: parseFloat(remainingPrincipal.toFixed(2)),
      remainingAccruedInterest: parseFloat(remainingAccruedInterest.toFixed(2)),
      isFullySettled: remainingPrincipal <= 0 && remainingAccruedInterest <= 0
    };
  },

  /**
   * Determine status relative to target due date.
   */
  determineDueStatus(dueDateStr, asOfDateStr) {
    if (!dueDateStr) return { status: "NO_DUE_DATE", days: 0, label: "कोई तारीख नहीं", badgeClass: "badge-neutral" };

    const due = new Date(dueDateStr);
    const asOf = asOfDateStr ? new Date(asOfDateStr) : new Date();
    // Normalize to date only
    due.setHours(0, 0, 0, 0);
    asOf.setHours(0, 0, 0, 0);

    const diffDays = Math.round((due - asOf) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const overdueDays = Math.abs(diffDays);
      return {
        status: "OVERDUE",
        days: overdueDays,
        label: `${overdueDays} दिन बीता (Overdue)`,
        badgeClass: "badge-danger"
      };
    } else if (diffDays <= 3) {
      return {
        status: "DUE_SOON",
        days: diffDays,
        label: diffDays === 0 ? "आज देय (Due Today)" : `${diffDays} दिन शेष (Due Soon)`,
        badgeClass: "badge-warning"
      };
    } else {
      return {
        status: "ACTIVE",
        days: diffDays,
        label: `${diffDays} दिन शेष (Active)`,
        badgeClass: "badge-success"
      };
    }
  }
};

// Expose globally for browser usage
if (typeof window !== "undefined") {
  window.RuralInterestEngine = RuralInterestEngine;
}
