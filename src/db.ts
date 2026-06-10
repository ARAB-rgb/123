/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from "@supabase/supabase-js";
import { User, Installment, Quote, Receipt, Payment, Expense, Project, Worker, DbSession } from "./types";

const SUPABASE_URL = "https://dypyrtmnxaitowaophvx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5cHlydG1ueGFpdG93YW9waHZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0Mjc2NTksImV4cCI6MjA5NTAwMzY1OX0.ReONlt3c3Lp8Aes-sO0G2sANoQn8mYBtCQ4IYkf9i7o";

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Cache helpers
export function awExtractRegion(notes: string): string {
  const text = String(notes || "");
  const m1 = text.match(/\[الإدارة:\s*([^\]]+)\]/);
  if (m1) return m1[1].trim();
  
  // compatibility with potential legacy tags
  const m2 = text.match(/\[\[?AW_BRANCH:\s*([^\]\s]+)\]?\]/i);
  if (m2) {
    const code = m2[1].trim().toLowerCase();
    const map: Record<string, string> = {
      riyadh: "الوسطى", kharj: "الوسطى", dammam: "الشرقية",
      central: "الوسطى", east: "الشرقية", west: "الغربية",
      south: "الجنوب", north: "الشمال"
    };
    return map[code] || code;
  }
  return "";
}

export function awExtractTreasury(notes: string): string {
  const text = String(notes || "");
  const m1 = text.match(/\[الخزنة:\s*([^\]]+)\]/);
  if (m1) return m1[1].trim();
  return "";
}

export function awExtractCapital(notes: string): number {
  const text = String(notes || "");
  const m1 = text.match(/\[رأس_المال:\s*(\d+(\.\d+)?)\]/);
  if (m1) return Number(m1[1]);
  return 0;
}

export function awExtractCapitalSource(notes: string): "شركة" | "تحصيل" | "كلاهما" {
  const text = String(notes || "");
  const m = text.match(/\[رأس_المال_المصدر:\s*([^\]]+)\]/);
  if (m) {
    const val = m[1].trim();
    if (val === "شركة" || val === "تحصيل" || val === "كلاهما") return val;
  }
  return "شركة"; // default
}

export function awExtractCapitalCompany(notes: string): number {
  const text = String(notes || "");
  const source = awExtractCapitalSource(notes);
  if (source === "تحصيل") return 0;
  if (source === "شركة") return awExtractCapital(notes);
  
  const m = text.match(/\[رأس_المال_شركة:\s*(\d+(\.\d+)?)\]/);
  return m ? Number(m[1]) : 0;
}

export function awExtractCapitalCollection(notes: string): number {
  const text = String(notes || "");
  const source = awExtractCapitalSource(notes);
  if (source === "شركة") return 0;
  if (source === "تحصيل") return awExtractCapital(notes);
  
  const m = text.match(/\[رأس_المال_تحصيل:\s*(\d+(\.\d+)?)\]/);
  return m ? Number(m[1]) : 0;
}

export function awCleanNotes(notes: string): string {
  return String(notes || "")
    .replace(/\s*\[الإدارة:\s*[^\]]+\]\s*/g, " ")
    .replace(/\s*\[الخزنة:\s*[^\]]+\]\s*/g, " ")
    .replace(/\s*\[رأس_المال:\s*[^\]]+\]\s*/g, " ")
    .replace(/\s*\[رأس_المال_المصدر:\s*[^\]]+\]\s*/g, " ")
    .replace(/\s*\[رأس_المال_شركة:\s*[^\]]+\]\s*/g, " ")
    .replace(/\s*\[رأس_المال_تحصيل:\s*[^\]]+\]\s*/g, " ")
    .replace(/\s*\[\[?AW_BRANCH:\s*[^\]\s]+\]?\]\s*/gi, " ")
    .trim();
}

export function awBuildNotesWithRegion(notes: string, region: string): string {
  const clean = awCleanNotes(notes);
  if (!region) return clean;
  return `[الإدارة: ${region}]` + (clean ? "\n" : "") + clean;
}

export function awBuildNotesWithRegionAndTreasury(notes: string, region: string, treasury: string): string {
  const clean = awCleanNotes(notes);
  let extraArr = [];
  if (region) extraArr.push(`[الإدارة: ${region}]`);
  if (treasury) extraArr.push(`[الخزنة: ${treasury}]`);
  
  if (extraArr.length === 0) return clean;
  return extraArr.join(" ") + (clean ? "\n" : "") + clean;
}

export function awBuildNotesWithRegionAndTreasuryAndCapital(
  notes: string,
  region: string,
  treasury: string,
  capital: number,
  capitalSource?: string,
  capitalCompany?: number,
  capitalCollection?: number
): string {
  const clean = awCleanNotes(notes);
  let extraArr = [];
  if (region) extraArr.push(`[الإدارة: ${region}]`);
  if (treasury) extraArr.push(`[الخزنة: ${treasury}]`);
  if (capital && capital > 0) extraArr.push(`[رأس_المال: ${capital}]`);
  if (capitalSource) extraArr.push(`[رأس_المال_المصدر: ${capitalSource}]`);
  if (typeof capitalCompany === "number" && capitalCompany > 0) extraArr.push(`[رأس_المال_شركة: ${capitalCompany}]`);
  if (typeof capitalCollection === "number" && capitalCollection > 0) extraArr.push(`[رأس_المال_تحصيل: ${capitalCollection}]`);
  
  if (extraArr.length === 0) return clean;
  return extraArr.join(" ") + (clean ? "\n" : "") + clean;
}

// Generate sequential order code
export function generateNextNo(prefix: string, list: any[], field: string = "no"): string {
  const nums = list
    .map(x => {
      const match = String(x[field] || "").match(/(\d+)$/);
      return match ? Number(match[1]) : 0;
    })
    .filter(Boolean);
  const nextNum = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}-${String(nextNum).padStart(4, "0")}`;
}

// Timing logic matching original codebase
export function getContractTiming(x: Installment) {
  const start = x.start_date ? new Date(x.start_date) : null;
  const daily = Number(x.installment || 0);
  const paid = Number(x.paid || 0);
  const paidDays = daily > 0 ? Math.floor(paid / daily) : 0;
  
  let lastPaid = "غير مسدد";
  if (start && paidDays > 0) {
    const d = new Date(start);
    d.setDate(d.getDate() + paidDays - 1);
    lastPaid = d.toISOString().slice(0, 10);
  }

  let dueDays = 0;
  if (start) {
    const today = new Date();
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    dueDays = Math.max(0, Math.floor((todayOnly.getTime() - startOnly.getTime()) / 86400000) + 1);
  }

  const overdueDays = Math.max(0, dueDays - paidDays);
  const overdueAmount = overdueDays * daily;

  return {
    paidDays,
    lastPaid,
    dueDays,
    overdueDays,
    overdueAmount,
  };
}

// Audit logger
export async function logSession(user: User, action: string) {
  if (!user) return;
  await sb.from("sessions").insert({
    name: user.name,
    code: user.code,
    role: user.role,
    time: new Date().toLocaleString("ar-SA"),
    action
  });
}
