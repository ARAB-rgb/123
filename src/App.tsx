/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Home, ClipboardList, FileText, Landmark, TrendingUp, TrendingDown, Briefcase, Users,
  Settings, LogOut, Calendar, MapPin, User, Phone, Shield, Search, Plus,
  Edit2, Trash2, Download, AlertTriangle, Sparkles, Clock, RefreshCw, Key
} from "lucide-react";

import { User as AuthUser, Installment, Quote, Receipt, Payment, Expense, Project, Worker, DbSession } from "./types";
import {
  sb, logSession, getContractTiming, awExtractRegion, awCleanNotes,
  awBuildNotesWithRegion, awBuildNotesWithRegionAndTreasury, awBuildNotesWithRegionAndTreasuryAndCapital, awExtractTreasury, awExtractCapital, generateNextNo,
  awExtractCapitalSource, awExtractCapitalCompany, awExtractCapitalCollection
} from "./db";

import { Toast, ToastItem, ToastType } from "./components/Shared/Toast";
import { Dashboard } from "./components/Dashboard";
import { Installments } from "./components/Installments";
import { Treasury } from "./components/Treasury";

const getStoredTreasuries = (): string[] => {
  const saved = localStorage.getItem("aw_treasuries");
  if (saved) {
    try {
      const arr = JSON.parse(saved);
      if (Array.isArray(arr) && arr.length > 0) return arr;
    } catch {}
  }
  return ["خزنة الشركة", "خزنة التحصيل"];
};

export default function App() {
  const [activeSection, setActiveSection] = useState<string>("dashboard");
  const [isLoading, setIsLoading] = useState(false);

  // Auth State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem("aw_current_user");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [loginCode, setLoginCode] = useState("");
  const [loginPass, setLoginPass] = useState("");

  // Alert Notifications
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const showToast = (message: string, type: ToastType = "success") => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  };
  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // ERP Datatables State
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [sessions, setSessions] = useState<DbSession[]>([]);

  // Editing state markers
  const [editQuoteId, setEditQuoteId] = useState<string | null>(null);
  const [editReceiptId, setEditReceiptId] = useState<string | null>(null);
  const [editPaymentId, setEditPaymentId] = useState<string | null>(null);
  const [editExpenseId, setEditExpenseId] = useState<string | null>(null);
  const [editProjectId, setEditProjectId] = useState<string | null>(null);
  const [editWorkerId, setEditWorkerId] = useState<string | null>(null);
  const [editUserId, setEditUserId] = useState<string | null>(null);

  // Forms Hooks
  // 1. Quotes Forms
  const [qClient, setQClient] = useState("");
  const [qPhone, setQPhone] = useState("");
  const [qProject, setQProject] = useState("");
  const [qAmount, setQAmount] = useState<number | "">("");
  const [qVat, setQVat] = useState<number | "">(15);
  const [qStatus, setQStatus] = useState<"جديد" | "مرسل" | "مقبول" | "مرفوض">("جديد");
  const [qNotes, setQNotes] = useState("");

  // 2. Receipts Forms
  const [rContractQuery, setRContractQuery] = useState("");
  const [rSelectedInstallment, setRSelectedInstallment] = useState<Installment | null>(null);
  const [rFrom, setRFrom] = useState("");
  const [rAmount, setRAmount] = useState<number | "">("");
  const [rMethod, setRMethod] = useState("مدى");
  const [rDate, setRDate] = useState(new Date().toISOString().slice(0, 10));
  const [rProject, setRProject] = useState("");
  const [rNotes, setRNotes] = useState("");

  // Search/Sort filters for receipts
  const [rSearch, setRSearch] = useState("");
  const [rSort, setRSort] = useState("date_desc");

  // 3. Payments Forms
  const [payTo, setPayTo] = useState("");
  const [payAmount, setPayAmount] = useState<number | "">("");
  const [payMethod, setPayMethod] = useState("تحويل بنكي");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payProject, setPayProject] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [payTreasury, setPayTreasury] = useState("خزنة الشركة");

  // 4. Expenses Forms
  const [eName, setEName] = useState("");
  const [eCategory, setECategory] = useState<"مواد" | "عمالة" | "نقل" | "إيجار" | "وقود" | "أخرى">("مواد");
  const [eAmount, setEAmount] = useState<number | "">("");
  const [eDate, setEDate] = useState(new Date().toISOString().slice(0, 10));
  const [eProject, setEProject] = useState("");
  const [eSupplier, setESupplier] = useState("");
  const [eNotes, setENotes] = useState("");

  // 5. Projects Forms
  const [pName, setPName] = useState("");
  const [pLocation, setPLocation] = useState("");
  const [pEngineer, setPEngineer] = useState("");
  const [pBudget, setPBudget] = useState<number | "">("");
  const [pStart, setPStart] = useState("");
  const [pEnd, setPEnd] = useState("");
  const [pProgress, setPProgress] = useState<number | "">(0);
  const [pStatus, setPStatus] = useState<"نشط" | "متوقف" | "منتهي">("نشط");
  const [pNotes, setPNotes] = useState("");

  // 6. Workers Forms
  const [wName, setWName] = useState("");
  const [wId, setWId] = useState("");
  const [wPhone, setWPhone] = useState("");
  const [wJob, setWJob] = useState<"حداد" | "نجار" | "كهربائي" | "سباك" | "عامل" | "مشرف">("حداد");
  const [wProject, setWProject] = useState("");
  const [wDaily, setWDaily] = useState<number | "">("");
  const [wDays, setWDays] = useState<number | "">("");
  const [wAdvance, setWAdvance] = useState<number | "">(0);
  const [wStatus, setWStatus] = useState<"على رأس العمل" | "إجازة" | "موقوف">("على رأس العمل");
  const [wNotes, setWNotes] = useState("");

  // 7. Users Forms
  const [uName, setUName] = useState("");
  const [uCode, setUCode] = useState("");
  const [uPass, setUPass] = useState("");
  const [uRole, setURole] = useState<"admin" | "employee">("employee");
  const [uRegion, setURegion] = useState("");
  const [uPerms, setUPerms] = useState<Record<string, boolean>>({
    installmentsView: true,
    installmentsAdd: false,
    installmentsEdit: false,
    installmentsDelete: false,
    quotes: false,
    receipts: false,
    payments: false,
    expenses: false,
    treasury: false,
    projects: false,
    workers: false,
    users: false,
    sessions: false,
    print: false,
    dashTopCards: true,
    dashCollection: true,
    dashPulse: true,
    dashLateClients: true,
    dashLastReceipts: true,
    dashUpcomingPaid: true,
  });

  // Auth checker logic
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginCode.trim() || !loginPass.trim()) return;
    setIsLoading(true);

    try {
      const { data, error } = await sb
        .from("users")
        .select("*")
        .eq("code", loginCode.trim())
        .eq("password", loginPass.trim())
        .maybeSingle();

      if (error || !data) {
        showToast("بيانات تصريح الدخول غير صحيحة!", "error");
        setIsLoading(false);
        return;
      }

      const user: AuthUser = data;
      setCurrentUser(user);
      localStorage.setItem("aw_current_user", JSON.stringify(user));
      showToast(`مرحباً بك مجدداً ${user.name}`);
      await logSession(user, "تسجيل دخول للنظام المالي");
      await loadEverything();
    } catch {
      showToast("حدث خطأ في الاتصال بالملقم المالي!", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    if (currentUser) {
      await logSession(currentUser, "تسجيل خروج آمن");
    }
    setCurrentUser(null);
    localStorage.removeItem("aw_current_user");
    showToast("تم تسجيل الخروج بنجاح", "info");
  };

  // Queries sync
  const loadEverything = async () => {
    if (!currentUser) return;
    try {
      const [u, inst, q, rec, pay, exp, pr, w, s] = await Promise.all([
        sb.from("users").select("*").order("created_at", { ascending: false }),
        sb.from("installments").select("*").order("created_at", { ascending: false }),
        sb.from("quotes").select("*").order("created_at", { ascending: false }),
        sb.from("receipts").select("*").order("created_at", { ascending: false }),
        sb.from("payments").select("*").order("created_at", { ascending: false }),
        sb.from("expenses").select("*").order("created_at", { ascending: false }),
        sb.from("projects").select("*").order("created_at", { ascending: false }),
        sb.from("workers").select("*").order("created_at", { ascending: false }),
        sb.from("sessions").select("*").order("created_at", { ascending: false }),
      ]);

      setUsers(u.data || []);
      setInstallments(inst.data || []);
      setQuotes(q.data || []);
      setReceipts(rec.data || []);
      setPayments(pay.data || []);
      setExpenses(exp.data || []);
      setProjects(pr.data || []);
      setWorkers(w.data || []);
      setSessions(s.data || []);
    } catch {
      showToast("تنبيه: فشل في الاتصال بقاعدة البيانات", "error");
    }
  };

  // Background reloading interval block
  useEffect(() => {
    if (currentUser) {
      loadEverything();
      const interval = setInterval(() => {
        loadEverything();
      }, 7000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  // Auth User allowed scope helpers
  const userRegionFilter = currentUser?.perms?.region || "";
  const can = (perm: string) => {
    return currentUser?.role === "admin" || !!currentUser?.perms?.[perm as keyof typeof currentUser.perms];
  };

  const getVisibleReceipts = () => {
    return receipts.filter((item) => {
      if (currentUser && currentUser.role !== "admin" && userRegionFilter) {
        // receipts matching users allowed branch in installment target or manually appended region tags
        const rRegion = awExtractRegion(item.notes || "");
        return rRegion === userRegionFilter;
      }
      return true;
    });
  };

  const getVisiblePayments = () => {
    return payments.filter((item) => {
      if (currentUser && currentUser.role !== "admin" && userRegionFilter) {
        const itemRegion = awExtractRegion(item.notes || "");
        return itemRegion === userRegionFilter;
      }
      return true;
    });
  };

  const getVisibleExpenses = () => {
    return expenses.filter((item) => {
      if (currentUser && currentUser.role !== "admin" && userRegionFilter) {
        const itemRegion = awExtractRegion(item.notes || "");
        return itemRegion === userRegionFilter;
      }
      return true;
    });
  };

  // Safe Recalculation logic for installment amounts
  const recalcLinkedContractFromReceipts = async (installmentId: string) => {
    if (!installmentId) return;

    const { data: rows, error } = await sb
      .from("receipts")
      .select("*")
      .eq("installment_id", installmentId);

    if (error) {
      showToast("تعذر إعادة حساب العقد في الملقم", "error");
      return;
    }

    const linked = installments.find((x) => x.id === installmentId);
    if (!linked) return;

    const paidFromReceipts = (rows || []).reduce((sum, x) => sum + Number(x.amount || 0), 0);
    const newRemaining = Math.max(0, Number(linked.amount || 0) - paidFromReceipts);
    const newStatus = newRemaining <= 0 ? "مكتمل" : "منتظم";

    await sb
      .from("installments")
      .update({ paid: paidFromReceipts, remaining: newRemaining, status: newStatus })
      .eq("id", installmentId);
  };

  // Interactive CRUD operations
  // Save Installments
  const onSaveInstallment = async (row: any, editId: string | null): Promise<boolean> => {
    const userRegion = currentUser?.perms?.region || "";
    const activeRegion = currentUser && currentUser.role !== "admin" && userRegion ? userRegion : row.region_input;
    const activeTreasury = row.treasury_input || "خزنة التحصيل";
    const activeCapital = Number(row.capital_input || 0);
    const capitalSource = row.capital_source_input || "";
    const capitalCompany = Number(row.capital_company_input || 0);
    const capitalCollection = Number(row.capital_collection_input || 0);
    const finalNotes = awBuildNotesWithRegionAndTreasuryAndCapital(
      row.notes, 
      activeRegion, 
      activeTreasury, 
      activeCapital,
      capitalSource,
      capitalCompany,
      capitalCollection
    );

    const payload = {
      ...row,
      notes: finalNotes,
    };
    delete payload.region_input;
    delete payload.treasury_input;
    delete payload.capital_input;
    delete payload.capital_source_input;
    delete payload.capital_company_input;
    delete payload.capital_collection_input;

    setIsLoading(true);
    try {
      const q = editId
        ? sb.from("installments").update(payload).eq("id", editId)
        : sb.from("installments").insert(payload);

      const { error } = await q;
      if (error) {
        showToast(error.message, "error");
        setIsLoading(false);
        return false;
      }

      await logSession(currentUser!, editId ? `تعديل ملف العقد رقم: ${row.no}` : `تسجيل عقد تقسيط جديد رقم: ${row.no}`);
      await loadEverything();
      showToast("تم حفظ مستندات العقد بنجاح!");
      return true;
    } catch {
      showToast("خطأ مجهول في إرسال البيانات الماليّة", "error");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const onDeleteInstallment = async (id: string) => {
    setIsLoading(true);
    try {
      const { error } = await sb.from("installments").delete().eq("id", id);
      if (error) {
        showToast(error.message, "error");
        return;
      }
      await logSession(currentUser!, `حذف ملف عقد تقسيط ID: ${id}`);
      await loadEverything();
      showToast("تم مسح مستندات العقد كاملاً");
    } catch {
      showToast("فشل في استكمال حذف المستند", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Print popup styling logic matching screenshot details
  const onPrintContract = (id: string) => {
    const x = installments.find((a) => a.id === id);
    if (!x) return;

    const clientContracts = installments.filter(
      (a) =>
        (a.identity && x.identity && a.identity === x.identity) ||
        (a.phone && x.phone && a.phone === x.phone) ||
        (a.client && x.client && a.client === x.client)
    );

    const totalAmount = clientContracts.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const totalPaid = clientContracts.reduce((sum, item) => sum + Number(item.paid || 0), 0);
    const totalRemaining = clientContracts.reduce((sum, item) => sum + Number(item.remaining || 0), 0);

    const rowsHtml = clientContracts
      .map(
        (a) => `
      <tr>
        <td>${a.no || ""}</td>
        <td>${a.project || "عام"}</td>
        <td>${a.workplace || "غير محدد"}</td>
        <td>${Number(a.amount || 0).toLocaleString()} ريال</td>
        <td>${Number(a.paid || 0).toLocaleString()} ريال</td>
        <td>${Number(a.remaining || 0).toLocaleString()} ريال</td>
        <td>${Number(a.installment || 0).toLocaleString()} ريال</td>
        <td>${a.periods || 0}</td>
        <td>${a.status || ""}</td>
      </tr>
    `
      )
      .join("");

    const w = window.open("", "_blank");
    if (!w) {
      showToast("تنبيه: ملقم المتصفح حظر نافذة الطباعة التلقائية!", "info");
      return;
    }

    w.document.write(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>اتفاقية عقد عمل - ${x.client}</title>
<style>
*{box-sizing:border-box;font-family:Tahoma,Arial}
body{margin:0;background:#f4f6fa;color:#07153a;padding:24px}
.page{width:210mm;min-height:297mm;margin:auto;background:white;padding:20mm;box-shadow:0 10px 35px #0002;position:relative;border-radius:12px}
.head{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #c9963f;padding-bottom:18px;margin-bottom:20px}
.brand{text-align:center;flex:1}
.brand h1{margin:0;font-size:30px;color:#07153a}
.brand p{margin:8px 0 0;color:#9a6b27;font-weight:bold}
.logo{width:54px;height:65px;position:relative;margin:auto}
.logo:before,.logo:after{content:"";position:absolute;border:5px solid #1f2937;border-left:0;border-bottom:0;transform:skewY(-25deg)}
.logo:before{width:30px;height:55px;right:18px;top:0}
.logo:after{width:16px;height:45px;right:8px;top:10px;border-color:#c9963f}
.title{background:linear-gradient(90deg,#07153a,#c9963f);color:white;text-align:center;padding:12px;border-radius:10px;font-size:20px;margin:20px 0}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px}
.box{border:1px solid #d9dee8;border-radius:10px;padding:9.5px;background:#fbfcff;min-height:54px}
.box b{display:block;color:#8a642d;margin-bottom:4px;font-size:11px}
.box span{font-size:13.5px;font-weight:bold}
table{width:100%;border-collapse:collapse;margin-top:14px;font-size:11px}
th{background:#07153a;color:white;padding:9px;font-weight:bold}
td{border:1px solid #d8dee9;padding:8px;text-align:center;font-weight:600}
.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:18px 0}
.sum{border-top:4px solid #c9963f;background:#f8fafc;border-radius:14px;text-align:center;padding:13px}
.sum b{display:block;color:#07153a;margin-bottom:8px}
.sum span{font-size:20px;color:#c9963f;font-weight:bold}
.signs{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:35px}
.sign{height:90px;border-top:1px dashed #555;padding-top:10px;text-align:center;color:#333;font-weight:bold}
.footer{position:absolute;bottom:12mm;left:20mm;right:20mm;text-align:center;color:#777;font-size:10px;border-top:1px solid #eee;padding-top:8px}
.no-print{position:fixed;top:15px;left:15px;display:flex;gap:8px}
.no-print button{border:0;border-radius:10px;padding:10px 15px;color:white;cursor:pointer;font-weight:bold}
.print{background:#16a34a}.close{background:#64748b}
@media print{body{background:white;padding:0}.page{box-shadow:none;margin:0;width:auto;min-height:auto}.no-print{display:none}}
</style>
</head>
<body>
<div class="no-print">
<button class="print" onclick="window.print()">طباعة / حفظ PDF</button>
<button class="close" onclick="window.close()">إغلاق</button>
</div>
<div class="page">
  <div class="head">
    <div style="width:120px;text-align:center"><div class="logo"></div></div>
    <div class="brand"><h1>شركة عرب وورلد</h1><p>نظام عقود وتقسيط وسندات</p></div>
    <div style="width:120px;font-size:11px;line-height:1.7"><b>التاريخ:</b><br>${new Date().toLocaleDateString("ar-SA")}<br><b>رقم العقد:</b><br>${x.no || ""}</div>
  </div>
  <div class="title">ورقة اتفاقية عقد مالي وسياق التزام</div>
  <div class="grid">
    <div class="box"><b>اسم الطرف المدين</b><span>${x.client}</span></div>
    <div class="box"><b>رقم السجل / الهوية</b><span>${x.identity}</span></div>
    <div class="box"><b>رقم الجوال الاتصالي</b><span>${x.phone}</span></div>
    <div class="box"><b>جنسية السجل</b><span>${x.nationality || "سعودي"}</span></div>
    <div class="box"><b>المشروع المرفق</b><span>${x.project || "عام"}</span></div>
    <div class="box"><b>مقر ووظيفة العمل</b><span>${x.workplace || "غير محدد"}</span></div>
    <div class="box"><b>تاريخ العقد وإيجاده</b><span>${x.start_date}</span></div>
    <div class="box"><b>عدد فترات الدفع</b><span>${x.periods} أيام</span></div>
    <div class="box"><b>القسط اليومي الإجباري</b><span>${Number(x.installment || 0).toLocaleString()} ريال</span></div>
    <div class="box"><b>الفرع الإداري</b><span>${awExtractRegion(x.notes || "") || "غير محدد"}</span></div>
    <div class="box"><b>الكفيل والضامن الغارم</b><span>${x.guarantor || "لا يوجد كفيل"}</span></div>
    <div class="box"><b>وضعية الملف</b><span>${x.status}</span></div>
    <div class="box" style="grid-column: span 3"><b>سياق الملاحظات والشروط</b><span>${awCleanNotes(x.notes || "") || "لا يوجد"}</span></div>
  </div>
  <div class="summary">
    <div class="sum"><b>إجمالي عقود الطرف الكلي</b><span>${totalAmount.toLocaleString()} ريال</span></div>
    <div class="sum"><b>المدفوع والمسلّم قبلاً</b><span>${totalPaid.toLocaleString()} ريال</span></div>
    <div class="sum"><b>المتبقي تحت الذمة</b><span>${totalRemaining.toLocaleString()} ريال</span></div>
  </div>
  <h3>كافة العقود والاتفاقيات الجارية للطرف العميل</h3>
  <table><thead><tr><th>رقم العقد</th><th>مشروع العمل</th><th>موقع المشغل</th><th>المبلغ الكلي</th><th>المستلم</th><th>المتبقي المعلق</th><th>القسط اليومي</th><th>أيام الأقساط</th><th>الوضعية</th></tr></thead><tbody>${rowsHtml}</tbody></table>
  <div class="signs"><div class="sign">بصمة وتوقيع العميل الضامن</div><div class="sign">اعتماد وختم شركة عرب وورلد للحلول العقارية</div></div>
  <div class="footer">تم تحرير مستندات العقد ومراجعته ماليًا في فرع السداد وتوثيق التوقيعات إبراء للذمة</div>
</div>
</body>
</html>`);
    w.document.close();
  };

  // Quotes CRUD
  const saveQuoteLogic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qClient) return;

    const row = {
      no: generateNextNo("AW-Q", quotes, "no"),
      client: qClient.trim(),
      phone: qPhone.trim(),
      project: qProject.trim(),
      amount: Number(qAmount || 0),
      vat: Number(qVat || 0),
      total: Math.round(Number(qAmount || 0) * (1 + Number(qVat || 0) / 100)),
      date: new Date().toISOString().slice(0, 10),
      status: qStatus,
      notes: qNotes,
    };

    setIsLoading(true);
    try {
      const q = editQuoteId
        ? sb.from("quotes").update(row).eq("id", editQuoteId)
        : sb.from("quotes").insert(row);

      const { error } = await q;
      if (error) {
        showToast(error.message, "error");
        return;
      }

      await logSession(currentUser!, editQuoteId ? `تعديل عرض سعر رقم: ${row.no}` : `إنشاء عرض سعر جديد رقم: ${row.no}`);
      setEditQuoteId(null);
      setQClient("");
      setQPhone("");
      setQProject("");
      setQAmount("");
      setQNotes("");
      await loadEverything();
      showToast("تم حفظ عرض السعر بنجاح!");
    } catch {
      showToast("تعذر استكمال حفظ البيانات", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Receipts CRUD with auto updating Linked Installments
  const saveReceiptLogic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rFrom) return;

    let linked = rSelectedInstallment;
    if (!linked && rContractQuery) {
      linked = installments.find(
        (x) =>
          x.no === rContractQuery ||
          x.client.includes(rContractQuery) ||
          x.identity === rContractQuery
      ) || null;
    }

    const amt = Number(rAmount || 0);
    const beforeAmt = linked ? Number(linked.remaining || 0) : 0;
    const afterAmt = linked ? Math.max(0, beforeAmt - amt) : 0;

    const rRegion = linked ? (awExtractRegion(linked.notes || "") || userRegionFilter) : userRegionFilter;
    const notesAppended = awBuildNotesWithRegion(rNotes, rRegion);

    const row = {
      no: generateNextNo("AW-REC", receipts, "no"),
      from_name: rFrom,
      amount: amt,
      method: rMethod,
      date: rDate,
      project: rProject,
      notes: notesAppended,
      installment_id: linked ? linked.id : null,
      contract_no: linked ? linked.no : "",
      identity: linked ? linked.identity : "",
      phone: linked ? linked.phone : "",
      nationality: linked ? linked.nationality : "",
      remaining_before: beforeAmt,
      remaining_after: afterAmt,
    };

    setIsLoading(true);
    try {
      const q = editReceiptId
        ? sb.from("receipts").update(row).eq("id", editReceiptId)
        : sb.from("receipts").insert(row);

      const { error } = await q;
      if (error) {
        showToast(error.message, "error");
        return;
      }

      if (linked) {
        await recalcLinkedContractFromReceipts(linked.id);
      }

      await logSession(currentUser!, editReceiptId ? `تعديل سند قبض مالي رقم: ${row.no}` : `تحرير سند قبض وراد مالي رقم: ${row.no}`);
      
      setEditReceiptId(null);
      setRSelectedInstallment(null);
      setRContractQuery("");
      setRFrom("");
      setRAmount("");
      setRProject("");
      setRNotes("");
      await loadEverything();
      showToast("تم حفظ السند وتحديث العقد التابع بنجاح!");
    } catch {
      showToast("فشل في مزامنة الرصيد المزدوج للعقود", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const deleteReceiptLogic = async (id: string, instId?: string) => {
    if (!confirm("هل أنت متأكد من مسح سند القبض؟ سيتم إعادة تسوية رصيد العقد المتبقي.")) return;
    setIsLoading(true);
    try {
      const { error } = await sb.from("receipts").delete().eq("id", id);
      if (error) {
        showToast(error.message, "error");
        return;
      }
      if (instId) {
        await recalcLinkedContractFromReceipts(instId);
      }
      await logSession(currentUser!, `حذف سند قبض مالي ID: ${id}`);
      await loadEverything();
      showToast("تم الحذف وإعادة حساب دفوعات العقد المالي بنجاح");
    } catch {
      showToast("عطل مزامنة خلال كنس السجل", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Payments CRUD
  const savePaymentLogic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payTo || !payAmount) return;

    const row = {
      no: generateNextNo("AW-PAY", payments, "no"),
      to_name: payTo.trim(),
      amount: Number(payAmount),
      method: payMethod,
      date: payDate,
      project: payProject.trim(),
      notes: awBuildNotesWithRegionAndTreasury(payNotes, userRegionFilter, payTreasury),
    };

    setIsLoading(true);
    try {
      const q = editPaymentId
        ? sb.from("payments").update(row).eq("id", editPaymentId)
        : sb.from("payments").insert(row);

      const { error } = await q;
      if (error) {
        showToast(error.message, "error");
        return;
      }

      await logSession(currentUser!, editPaymentId ? `تعديل سند الصرف رقم: ${row.no}` : `تحرير سند صرف صادر مالي رقم: ${row.no}`);
      setEditPaymentId(null);
      setPayTo("");
      setPayAmount("");
      setPayProject("");
      setPayNotes("");
      setPayTreasury("خزنة الشركة");
      await loadEverything();
      showToast("تم قيّد سند الصرف بنجاح!");
    } catch {
      showToast("خطأ في القيود المحاسبية للصرف", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Expenses CRUD
  const saveExpenseLogic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eName || !eAmount) return;

    const row = {
      no: generateNextNo("AW-EXP", expenses, "no"),
      name: eName.trim(),
      category: eCategory,
      amount: Number(eAmount),
      date: eDate,
      project: eProject.trim(),
      supplier: eSupplier.trim(),
      notes: awBuildNotesWithRegion(eNotes, userRegionFilter),
    };

    setIsLoading(true);
    try {
      const q = editExpenseId
        ? sb.from("expenses").update(row).eq("id", editExpenseId)
        : sb.from("expenses").insert(row);

      const { error } = await q;
      if (error) {
        showToast(error.message, "error");
        return;
      }

      await logSession(currentUser!, editExpenseId ? `تعديل بند المصروف رقم: ${row.no}` : `تحرير بند مصروفات فرعي رقم: ${row.no}`);
      setEditExpenseId(null);
      setEName("");
      setEAmount("");
      setEProject("");
      setESupplier("");
      setENotes("");
      await loadEverything();
      showToast("تم توثيق المصروف في الدفتر المالي!");
    } catch {
      showToast("فشل ترحيل قيد المصروف", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Projects CRUD
  const saveProjectLogic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pName) return;

    const row = {
      name: pName.trim(),
      location: pLocation.trim(),
      engineer: pEngineer.trim(),
      budget: Number(pBudget || 0),
      start_date: pStart,
      end_date: pEnd,
      progress: Number(pProgress || 0),
      status: pStatus,
      notes: pNotes,
    };

    setIsLoading(true);
    try {
      const q = editProjectId
        ? sb.from("projects").update(row).eq("id", editProjectId)
        : sb.from("projects").insert(row);

      const { error } = await q;
      if (error) {
        showToast(error.message, "error");
        return;
      }

      await logSession(currentUser!, editProjectId ? `تعديل معلومات مشروع: ${pName}` : `إنشاء ملف مشروع جديد: ${pName}`);
      setEditProjectId(null);
      setPName("");
      setPLocation("");
      setPEngineer("");
      setPBudget("");
      setPProgress(0);
      setPNotes("");
      await loadEverything();
      showToast("تم حفظ بطاقة المشروع بنجاح!");
    } catch {
      showToast("حدث خلل في ملقم ملفات المشاريع", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Workers CRUD
  const saveWorkerLogic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wName) return;

    const tot = Number(wDaily || 0) * Number(wDays || 0);
    const row = {
      name: wName.trim(),
      worker_id: wId.trim(),
      phone: wPhone.trim(),
      job: wJob,
      project: wProject.trim(),
      daily: Number(wDaily || 0),
      days: Number(wDays || 0),
      advance: Number(wAdvance || 0),
      total: tot,
      balance: Math.max(0, tot - Number(wAdvance || 0)),
      status: wStatus,
      notes: wNotes,
    };

    setIsLoading(true);
    try {
      const q = editWorkerId
        ? sb.from("workers").update(row).eq("id", editWorkerId)
        : sb.from("workers").insert(row);

      const { error } = await q;
      if (error) {
        showToast(error.message, "error");
        return;
      }

      await logSession(currentUser!, editWorkerId ? `تعديل سلفيات العامل: ${wName}` : `تسجيل عامل جديد وسفليات عمل: ${wName}`);
      setEditWorkerId(null);
      setWName("");
      setWId("");
      setWPhone("");
      setWProject("");
      setWDaily("");
      setWDays("");
      setWAdvance(0);
      setWNotes("");
      await loadEverything();
      showToast("تم تحديث سلف مستحقات العمال.");
    } catch {
      showToast("خلل في مستند مجمع السلف عمال", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Users & Perms CRUD
  const saveUserLogic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uName || !uCode || !uPass) return;

    const row = {
      name: uName.trim(),
      code: uCode.trim(),
      password: uPass.trim(),
      role: uRole,
      perms: {
        ...uPerms,
        region: uRegion,
      },
    };

    setIsLoading(true);
    try {
      const q = editUserId
        ? sb.from("users").update(row).eq("id", editUserId)
        : sb.from("users").upsert(row, { onConflict: "code" });

      const { error } = await q;
      if (error) {
        showToast(error.message, "error");
        return;
      }

      await logSession(currentUser!, editUserId ? `تعديل موظف: ${row.name}` : `تهيئة وتصنيف حساب موظف جديد: ${row.name}`);
      setEditUserId(null);
      setUName("");
      setUCode("");
      setUPass("");
      setURegion("");
      setURole("employee");
      setUPerms({
        installmentsView: true,
        installmentsAdd: false,
        installmentsEdit: false,
        installmentsDelete: false,
        quotes: false,
        receipts: false,
        payments: false,
        expenses: false,
        treasury: false,
        projects: false,
        workers: false,
        users: false,
        sessions: false,
        print: false,
        dashTopCards: true,
        dashCollection: true,
        dashPulse: true,
        dashLateClients: true,
        dashLastReceipts: true,
        dashUpcomingPaid: true,
      });

      await loadEverything();
      showToast("تم تحديث سجلات حساب الموظفين المعينين");
    } catch {
      showToast("فشل في تثبيت الصلاحيات الإدارية", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Excel Export logic for Receipts
  const exportReceiptsExcel = () => {
    try {
      const targetRowsArr = getVisibleReceipts().filter((x) => {
        const query = rSearch.toLowerCase().trim();
        const text = `${x.no} ${x.date} ${x.from_name} ${x.contract_no} ${x.identity} ${x.phone} ${x.amount} ${x.remaining_after} ${x.method} ${x.project}`.toLowerCase();
        return !query || text.includes(query);
      });

      let csvContent = "\ufeff"; // BOM for Arabic support
      csvContent += "رقم السند,التاريخ,المستلم من,رقم العقد,الهوية,الجوال,المبلغ,طريقة الدفع,المشروع\n";

      targetRowsArr.forEach((r) => {
        csvContent += `${r.no},${r.date},"${r.from_name}",${r.contract_no},${r.identity},${r.phone},${r.amount},${r.method},"${r.project || "عام"}"\n`;
      });

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "سندات_القبض_المحاسبية_عرب_وورلد.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast("تم تحميل كشوف سندات القبض بصيغة Excel Excel");
    } catch {
      showToast("خلل أثناء تجميع وتحويل ملف CSV", "error");
    }
  };

  // Fill in active inputs of receipts once linked installment matched
  const handleAutoFillReceipt = (val: string) => {
    setRContractQuery(val);
    const linked = installments.find(
      (x) =>
        x.no === val ||
        x.client === val ||
        x.identity === val ||
        `${x.no} | ${x.client} | ${x.identity}` === val
    );
    if (linked) {
      setRSelectedInstallment(linked);
      setRFrom(linked.client);
      setRProject(linked.project || "عام");
      setRAmount(linked.installment || "");
    } else {
      setRSelectedInstallment(null);
    }
  };

  // Nav categories helpers
  const navigationItems = [
    { key: "dashboard", label: "الرئيسية", icon: Home, visible: true },
    { key: "installments", label: "التقسيط والعقود", icon: ClipboardList, visible: can("installmentsView") },
    { key: "quotes", label: "عروض الأسعار", icon: FileText, visible: can("quotes") },
    { key: "receipts", label: "سند قبض", icon: Landmark, visible: can("receipts") },
    { key: "payments", label: "سند صرف", icon: TrendingUp, visible: can("payments") },
    { key: "expenses", label: "المصروفات", icon: TrendingDown, visible: can("expenses") },
    { key: "treasury", label: "الخزنة الفرعية", icon: Shield, visible: can("treasury") },
    { key: "projects", label: "المشاريع الجارية", icon: Briefcase, visible: can("projects") },
    { key: "workers", label: "العمال والسلفيات", icon: Users, visible: can("workers") },
    { key: "users", label: "الموظفين والصلاحية", icon: Settings, visible: can("users") || currentUser?.role === "admin" },
    { key: "sessions", label: "سجل حركات النظام", icon: Clock, visible: can("sessions") || currentUser?.role === "admin" },
  ];

  // Auth Layout rendering check
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center mesh-gradient p-4 text-right" dir="rtl">
        <Toast toasts={toasts} removeToast={removeToast} />
        
        <div className="w-full max-w-md glass-card p-8 rounded-3xl space-y-6">
          <div className="text-center space-y-3">
            <div className="w-14 h-16 bg-gradient-to-tr from-amber-500 to-amber-600 rounded-2xl mx-auto shadow-lg flex items-center justify-center relative">
              <span className="text-slate-950 font-black text-xl">AW</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-wide">نظام مالي عرب وورلد</h1>
            <p className="text-xs font-bold text-slate-400">يرجى تأكيد بيانات الهوية والمصادقة للولوج المالي الآمن</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400">كود المستخدم الخاص</label>
              <div className="relative">
                <User className="absolute right-3.5 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  required
                  type="text"
                  placeholder="رقم الكود"
                  value={loginCode}
                  onChange={(e) => setLoginCode(e.target.value)}
                  className="w-full pl-3 pr-10 py-3 glass-input rounded-2xl text-xs font-bold text-white placeholder-slate-600 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400">الرقم المالي السري</label>
              <div className="relative">
                <Key className="absolute right-3.5 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  required
                  type="password"
                  placeholder="Password"
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  className="w-full pl-3 pr-10 py-3 glass-input rounded-2xl text-xs font-bold text-white placeholder-slate-600 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <button
              disabled={isLoading}
              type="submit"
              className="w-full py-3.5 bg-gradient-to-l from-amber-500 to-amber-600 text-slate-950 font-black rounded-2xl text-xs hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg shadow-amber-500/15 cursor-pointer disabled:opacity-50 glass-btn"
            >
              {isLoading ? "تسجيل مالي آمن جاري..." : "اعتماد وتصديق السجل"}
            </button>
          </form>

          <p className="text-center text-[10px] font-bold text-slate-500">
            مستند مراجعة الفرع محمي بمقتضى سياست الخصوصيّة
          </p>
        </div>
      </div>
    );
  }

  let companyCapitalInContracts = 0;
  let collectionCapitalInContracts = 0;

  installments.forEach((x) => {
    const source = awExtractCapitalSource(x.notes || "");
    const compAmount = awExtractCapitalCompany(x.notes || "");
    const collAmount = awExtractCapitalCollection(x.notes || "");
    const totalCap = awExtractCapital(x.notes || "");

    if (source === "شركة") {
      companyCapitalInContracts += totalCap;
    } else if (source === "تحصيل") {
      collectionCapitalInContracts += totalCap;
    } else if (source === "كلاهما") {
      companyCapitalInContracts += compAmount;
      collectionCapitalInContracts += collAmount;
    }
  });

  return (
    <div className="min-h-screen mesh-gradient text-slate-100 flex flex-col md:flex-row text-right font-sans relative" dir="rtl">
      
      {/* Toast floating notifications */}
      <Toast toasts={toasts} removeToast={removeToast} />

      {/* Modern Sidebar layout */}
      <div className="w-full md:w-64 glass border-l border-white/5 flex flex-col justify-between shrink-0 p-5 z-20">
        <div className="space-y-6">
          
          {/* Main Logo visual */}
          <div className="flex items-center gap-3 border-b border-white/5 pb-5">
            <div className="w-9 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg relative shrink-0">
              <span className="text-slate-950 font-black text-sm">AW</span>
            </div>
            <div>
              <h2 className="text-sm font-black text-white">عرب وورلد آدز</h2>
              <p className="text-[10px] font-bold text-amber-400 leading-normal">الحسابات والتقسيط الذكي</p>
            </div>
          </div>

          {/* Navigation Links with custom triggers */}
          <nav className="space-y-1.5 overflow-y-auto max-h-[60vh] pr-1">
            {navigationItems
              .filter((x) => x.visible)
              .map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      setActiveSection(item.key);
                      // Reset Edit states when moving tabs
                      setEditQuoteId(null);
                      setEditReceiptId(null);
                      setEditPaymentId(null);
                      setEditExpenseId(null);
                      setEditProjectId(null);
                      setEditWorkerId(null);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black transition-all border ${
                      activeSection === item.key
                        ? "bg-amber-500/15 text-amber-300 border-amber-500/25 shadow-lg shadow-amber-500/5 backdrop-blur-md"
                        : "text-slate-400 border-transparent hover:bg-white/5 hover:text-slate-100"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
          </nav>
        </div>

        {/* User Auth Info box and Sign Out trigger */}
        <div className="border-t border-white/5 pt-4 mt-6 space-y-4">
          <div className="bg-white/5 p-3.5 rounded-2xl border border-white/5">
            <span className="block text-[9px] font-bold text-slate-400 mb-1">الموظف المسؤول</span>
            <b className="block text-xs font-black text-amber-300">{currentUser.name}</b>
            <span className="block text-[10px] font-bold text-slate-400 mt-1">
              {currentUser.role === "admin" ? "أدمن الإدارة" : "موظف الفرع"}
              {userRegionFilter && ` • ${userRegionFilter}`}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="w-full py-3 bg-white/5 hover:bg-rose-950/20 text-slate-300 hover:text-rose-400 border border-white/5 hover:border-rose-500/25 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 glass-btn"
          >
            <LogOut className="w-4 h-4" />
            🚪 خروج آمن من النظام
          </button>
        </div>
      </div>

      {/* Main Container Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Responsive Navbar heading with glowing sparkles */}
        <header className="bg-white/5 backdrop-blur-lg border-b border-white/5 p-4 md:p-5 shrink-0 flex flex-col sm:flex-row gap-4 justify-between items-center z-10 text-right">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
            <h1 className="text-sm md:text-base font-black text-white">شركة عرب وورلد للمقاولات العامة والتقسيط</h1>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* رأس مال الشركة في العقود */}
            <div className="bg-slate-900/80 border border-amber-500/20 px-3 py-1.5 rounded-xl flex items-center gap-2 text-right">
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <div>
                <span className="block text-[8px] md:text-[9px] font-bold text-slate-400 leading-normal">رأس مال الشركة بالعقود</span>
                <span className="block text-xs font-black text-blue-300 font-mono">
                  {companyCapitalInContracts.toLocaleString()} <span className="text-[9px] font-normal">ريال</span>
                </span>
              </div>
            </div>

            {/* رأس مال التحصيل في العقود */}
            <div className="bg-slate-900/80 border border-emerald-500/20 px-3 py-1.5 rounded-xl flex items-center gap-2 text-right">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <div>
                <span className="block text-[8px] md:text-[9px] font-bold text-slate-400 leading-normal">رأس مال التحصيل بالعقود</span>
                <span className="block text-xs font-black text-emerald-300 font-mono">
                  {collectionCapitalInContracts.toLocaleString()} <span className="text-[9px] font-normal">ريال</span>
                </span>
              </div>
            </div>

            <span className="text-[10px] font-black font-mono text-slate-300 bg-white/5 px-3.5 py-2 rounded-xl border border-white/10 shrink-0">
              نظام مالي موحد • V27 STABLE
            </span>
          </div>
        </header>

        {/* Interactive Dynamic Layout content wrapper */}
        <main className="flex-1 overflow-y-auto p-6 max-w-7xl w-full mx-auto space-y-8 pb-10">
          
          {/* Loading status bar indicator */}
          {isLoading && (
            <div className="flex items-center gap-2 w-max px-4 py-2 bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400 rounded-full animate-pulse mr-auto">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              جاري مزامنة الدفتر الحسابي التراكمي...
            </div>
          )}

          {/* Section Renderings checks */}
          {activeSection === "dashboard" && (
            <Dashboard
              installments={installments}
              receipts={getVisibleReceipts()}
              payments={getVisiblePayments()}
              expenses={getVisibleExpenses()}
              onNavigateToContracts={() => setActiveSection("installments")}
            />
          )}

          {activeSection === "installments" && (
            <Installments
              currentUser={currentUser}
              installments={installments}
              projects={projects}
              onSaveInstallment={onSaveInstallment}
              onDeleteInstallment={onDeleteInstallment}
              onPrintContract={onPrintContract}
              receipts={getVisibleReceipts()}
            />
          )}

          {activeSection === "treasury" && (
            <Treasury
              installments={installments}
              receipts={getVisibleReceipts()}
              payments={getVisiblePayments()}
              expenses={getVisibleExpenses()}
            />
          )}

          {/* Core Quotes Tab Container */}
          {activeSection === "quotes" && (
            <div className="space-y-6">
              <form onSubmit={saveQuoteLogic} className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
                <div className="border-b border-slate-850 pb-3">
                  <h3 className="text-base font-black text-white flex items-center gap-2"><span>📋</span> تحرير وثيقة عروض الأسعار</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <input required placeholder="اسم العميل" value={qClient} onChange={(e) => setQClient(e.target.value)} className="w-full px-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-blue-500" />
                  <input placeholder="رقم الجوال" value={qPhone} onChange={(e) => setQPhone(e.target.value)} className="w-full px-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none" />
                  <input placeholder="المشروع التابع" value={qProject} onChange={(e) => setQProject(e.target.value)} className="w-full px-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none" />
                  <input type="number" required placeholder="قيمة العرض" value={qAmount} onChange={(e) => setQAmount(e.target.value ? Number(e.target.value) : "")} className="w-full px-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none" />
                  <input type="number" placeholder="الضريبة المقررة %" value={qVat} onChange={(e) => setQVat(e.target.value ? Number(e.target.value) : "")} className="w-full px-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none" />
                  <select value={qStatus} onChange={(e: any) => setQStatus(e.target.value)} className="w-full px-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none">
                    <option value="جديد">جديد</option>
                    <option value="مرسل">مرسل</option>
                    <option value="مقبول">مقبول</option>
                    <option value="مرفوض">مرفوض</option>
                  </select>
                  <textarea placeholder="شروط وملاحظات إضافية" value={qNotes} onChange={(e) => setQNotes(e.target.value)} className="w-full px-3 py-2 h-[41px] bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white sm:col-span-2 focus:outline-none" />
                </div>
                <div className="flex gap-2 justify-end">
                  {editQuoteId && (
                    <button type="button" onClick={() => { setEditQuoteId(null); setQClient(""); setQPhone(""); setQProject(""); setQAmount(""); setQNotes(""); }} className="px-5 py-2.5 bg-slate-800 rounded-xl text-xs font-black">إلغاء</button>
                  )}
                  <button type="submit" className="px-5 py-2.5 bg-amber-500 text-slate-950 rounded-xl text-xs font-black">{editQuoteId ? "تأكيد واستبدال" : "حفظ وحيازة أسعار"}</button>
                </div>
              </form>

              <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-xl overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800">
                      <th className="py-2.5 px-3 font-bold">رقم العرض</th>
                      <th className="py-2.5 px-3 font-bold">العميل</th>
                      <th className="py-2.5 px-3 font-bold">المشروع</th>
                      <th className="py-2.5 px-3 font-bold">القيمة والضريبة</th>
                      <th className="py-2.5 px-3 font-bold">الإجمالي الشامل</th>
                      <th className="py-2.5 px-3 font-bold">الحالة</th>
                      <th className="py-2.5 px-3 font-bold text-center">إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotes.map((q, idx) => (
                      <tr key={idx} className="border-b border-slate-850 hover:bg-slate-800/10 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-slate-300">{q.no}</td>
                        <td className="py-3 px-3 font-black text-white">{q.client}</td>
                        <td className="py-3 px-3">{q.project}</td>
                        <td className="py-3 px-3 font-mono">{q.amount.toLocaleString()} ريال (+{q.vat}%)</td>
                        <td className="py-3 px-3 font-black text-emerald-400 font-mono">{q.total.toLocaleString()} ريال</td>
                        <td className="py-3 px-3">
                          <span className="px-2.5 py-0.5 rounded text-[11px] font-black bg-slate-800 text-slate-100">{q.status}</span>
                        </td>
                        <td className="py-3 px-3 text-center space-x-1">
                          <button onClick={() => { setEditQuoteId(q.id); setQClient(q.client || ""); setQPhone(q.phone || ""); setQProject(q.project || ""); setQAmount(q.amount || ""); setQNotes(q.notes || ""); }} className="p-1 text-blue-400 hover:text-white inline-block"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => { if(confirm("حذف العرض بشكل نهائي؟")) { sb.from("quotes").delete().eq("id", q.id).then(() => loadEverything()); } }} className="p-1 text-rose-400 hover:text-rose-500 inline-block"><Trash2 className="w-3.5 h-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Code Receipts dynamic tab integrations */}
          {activeSection === "receipts" && (
            <div className="space-y-6">
              <form onSubmit={saveReceiptLogic} className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
                <div className="border-b border-slate-850 pb-3">
                  <h3 className="text-base font-black text-white flex items-center gap-2"><span>💰</span> تحرير سند قبض مالي وارد</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] font-black text-slate-400">ربط العقد التابع (رقم العقد أو الاسم المعين لتوليد الحسابات)</label>
                    <input
                      placeholder="ابحث واختر لربط الحساب ومتبقياته تلقائياً..."
                      value={rContractQuery}
                      onChange={(e) => handleAutoFillReceipt(e.target.value)}
                      maxLength={180}
                      list="contractsListDatalist"
                      className="w-full px-3.5 py-2.5 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-amber-400 focus:outline-none"
                    />
                    <datalist id="contractsListDatalist">
                      {installments.map((x, idx) => (
                        <option key={idx} value={`${x.no} | ${x.client} | ${x.identity}`} />
                      ))}
                    </datalist>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400">استلمنا من</label>
                    <input required placeholder="اسم الدافع العميل" value={rFrom} onChange={(e) => setRFrom(e.target.value)} className="w-full px-3 py-2.5 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none" />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400">حجم المبلغ المستلم</label>
                    <input type="number" required placeholder="قيمة السند" value={rAmount} onChange={(e) => setRAmount(e.target.value ? Number(e.target.value) : "")} className="w-full px-3 py-2.5 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none" />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400">طريقة الاستلام</label>
                    <select value={rMethod} onChange={(e) => setRMethod(e.target.value)} className="w-full px-3 py-2.5 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none">
                      <option value="مدى">مدى</option>
                      <option value="تحويل بنكي">تحويل بنكي</option>
                      <option value="نقداً">نقداً</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400">تاريخ القبض ماليًا</label>
                    <input type="date" value={rDate} onChange={(e) => setRDate(e.target.value)} className="w-full px-3 py-2.5 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none" />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400">ماتبقى من العقد (قبل القبض)</label>
                    <input readOnly value={rSelectedInstallment ? `${Number(rSelectedInstallment.remaining).toLocaleString()} ريال` : "غير مرتبط"} className="w-full px-3 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-xs font-bold text-slate-400" />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400">المشروع المرفق بالقيد</label>
                    <input placeholder="المشروع" value={rProject} onChange={(e) => setRProject(e.target.value)} className="w-full px-3 py-2.5 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none" />
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-slate-400">البيان وشرائح الملاحظة</label>
                    <textarea placeholder="شرائح قسط يومي..." value={rNotes} onChange={(e) => setRNotes(e.target.value)} className="w-full px-3 py-1.5 h-[41px] bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none" />
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  {editReceiptId && (
                    <button type="button" onClick={() => { setEditReceiptId(null); setRContractQuery(""); setRSelectedInstallment(null); setRFrom(""); setRAmount(""); setRProject(""); setRNotes(""); }} className="px-5 py-2.5 bg-slate-800 rounded-xl text-xs font-black">إلغاء</button>
                  )}
                  <button type="submit" className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black">{editReceiptId ? "استبدال السند" : "حفظ وقيد سند القبض ماليًا"}</button>
                </div>
              </form>

              {/* Receipts filter & log views */}
              <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                <div className="flex flex-col md:flex-row gap-3 items-center justify-between border-b border-slate-800/60 pb-4">
                  <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                    <input placeholder="بحث في سندات القبض..." value={rSearch} onChange={(e) => setRSearch(e.target.value)} className="px-4 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs font-bold text-white w-full md:w-64" />
                    <select value={rSort} onChange={(e) => setRSort(e.target.value)} className="px-4 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs font-bold text-white">
                      <option value="date_desc">الأحدث أولاً</option>
                      <option value="amount_desc">الأعلى ماليًا</option>
                      <option value="amount_asc">الأقل ماليًا</option>
                    </select>
                  </div>
                  <button onClick={exportReceiptsExcel} className="px-5 py-2.5 bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 hover:text-white rounded-xl text-xs font-black flex items-center gap-1">
                    <Download className="w-3.5 h-3.5" />
                    تحميل كشف Excel
                  </button>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-800">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-950 border-b border-slate-800 text-slate-300">
                        <th className="py-2.5 px-3 font-bold">رقم السند</th>
                        <th className="py-2.5 px-3 font-bold">التاريخ</th>
                        <th className="py-2.5 px-3 font-bold">المستلم من</th>
                        <th className="py-2.5 px-3 font-bold">رقم العقد والفرع</th>
                        <th className="py-2.5 px-3 font-bold">المبلغ المدفوع</th>
                        <th className="py-2.5 px-3 font-bold">المتبقي الكلي</th>
                        <th className="py-2.5 px-3 font-bold">طريقة الاستلام والبيان</th>
                        <th className="py-2.5 px-3 font-bold text-center">إجراء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getVisibleReceipts()
                        .filter((x) => {
                          const query = rSearch.toLowerCase().trim();
                          const text = `${x.no} ${x.date} ${x.from_name} ${x.contract_no} ${x.identity} ${x.phone} ${x.amount} ${x.remaining_after} ${x.method} ${x.project}`.toLowerCase();
                          return !query || text.includes(query);
                        })
                        .sort((a, b) => {
                          if (rSort === "amount_desc") return Number(b.amount || 0) - Number(a.amount || 0);
                          if (rSort === "amount_asc") return Number(a.amount || 0) - Number(b.amount || 0);
                          return String(b.date).localeCompare(String(a.date));
                        })
                        .map((r, idx) => (
                          <tr key={idx} className="border-b border-slate-850 hover:bg-slate-800/10 transition-colors">
                            <td className="py-3 px-3 font-mono font-bold text-slate-300">{r.no}</td>
                            <td className="py-3 px-3 font-mono text-slate-400">{r.date}</td>
                            <td className="py-3 px-3 font-black text-white">{r.from_name}</td>
                            <td className="py-3 px-3 font-mono">
                              <span className="block">{r.contract_no || "عام"}</span>
                              <span className="block text-[9px] text-amber-500 font-sans font-bold">{awExtractRegion(r.notes || "")}</span>
                            </td>
                            <td className="py-3 px-3 font-black text-emerald-400 font-mono">+{Number(r.amount || 0).toLocaleString()} ريال</td>
                            <td className="py-3 px-3 font-black text-slate-300 font-mono">{Number(r.remaining_after || 0).toLocaleString()} ريال</td>
                            <td className="py-3 px-3 text-slate-400 max-w-xs truncate">
                              <b className="text-white text-[11px] block">{r.method}</b>
                              {awCleanNotes(r.notes || "")}
                            </td>
                            <td className="py-3 px-3 text-center space-x-1">
                              <button onClick={() => { setEditReceiptId(r.id); handleAutoFillReceipt(r.contract_no || ""); setRFrom(r.from_name || ""); setRAmount(r.amount || ""); setRMethod(r.method || ""); setRDate(r.date || ""); setRProject(r.project || ""); setRNotes(awCleanNotes(r.notes || "")); }} className="p-1 text-blue-400 hover:text-white"><Edit2 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => deleteReceiptLogic(r.id, r.installment_id)} className="p-1 text-rose-400 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Core Payments Tab Container */}
          {activeSection === "payments" && (
            <div className="space-y-6">
              <form onSubmit={savePaymentLogic} className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
                <div className="border-b border-slate-850 pb-3">
                  <h3 className="text-base font-black text-white flex items-center gap-2"><span>💸</span> تحرير سند صرف صادر للشركة</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400">صرفنا إلى المستفيد</label>
                    <input required placeholder="صرفنا إلى المستفيد" value={payTo} onChange={(e) => setPayTo(e.target.value)} className="w-full px-3 py-2.5 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500 transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400">مبلغ الصرف</label>
                    <input type="number" required placeholder="مبلغ الصرف" value={payAmount} onChange={(e) => setPayAmount(e.target.value ? Number(e.target.value) : "")} className="w-full px-3 py-2.5 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500 transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-amber-500">حساب الخزنة الممول</label>
                    <select
                      value={payTreasury}
                      onChange={(e) => setPayTreasury(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500 transition-colors cursor-pointer bg-slate-955"
                    >
                      {getStoredTreasuries().map((tName) => (
                        <option key={tName} value={tName} className="bg-slate-950 text-white">💰 {tName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400">طريقة الصرف</label>
                    <input placeholder="طريقة الصرف" value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="w-full px-3 py-2.5 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500 transition-colors" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400">تاريخ الصرف</label>
                    <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="w-full px-3 py-2.5 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500 transition-colors hover:text-amber-200" />
                  </div>
                  <div className="space-y-1 sm:col-span-2 md:col-span-3">
                    <label className="text-[10px] font-black text-slate-400">الارتباط بالمشروع</label>
                    <input placeholder="الارتباط بالمشروع" value={payProject} onChange={(e) => setPayProject(e.target.value)} className="w-full px-3 py-2.5 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500 transition-colors" />
                  </div>
                  <div className="space-y-1 sm:col-span-2 md:col-span-4">
                    <label className="text-[10px] font-black text-slate-400">البيان والتفاصيل</label>
                    <textarea placeholder="البيان" value={payNotes} onChange={(e) => setPayNotes(e.target.value)} className="w-full px-3 py-2 h-[45px] bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500 transition-colors" />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  {editPaymentId && (
                    <button type="button" onClick={() => { setEditPaymentId(null); setPayTo(""); setPayAmount(""); setPayProject(""); setPayNotes(""); setPayTreasury("خزنة الشركة"); }} className="px-5 py-2.5 bg-slate-800 rounded-xl text-xs font-black">إلغاء</button>
                  )}
                  <button type="submit" className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black">{editPaymentId ? "استبدال وصيغة السند" : "قيد سند الصرف ماليًا"}</button>
                </div>
              </form>

              <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-xl overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-slate-300">
                      <th className="py-2.5 px-3 font-bold">رقم السند</th>
                      <th className="py-2.5 px-3 font-bold">التاريخ</th>
                      <th className="py-2.5 px-3 font-bold">صرف إلى</th>
                      <th className="py-2.5 px-3 font-bold">مبلغ الصرف الصادر</th>
                      <th className="py-2.5 px-3 font-bold">طريقة الصرف</th>
                      <th className="py-2.5 px-3 font-bold">المشروع والبيان</th>
                      <th className="py-2.5 px-3 font-bold text-center">إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getVisiblePayments().map((p, idx) => (
                      <tr key={idx} className="border-b border-slate-850 hover:bg-slate-800/10 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-slate-300">{p.no}</td>
                        <td className="py-3 px-3 font-mono text-slate-400">{p.date}</td>
                        <td className="py-3 px-3 font-black text-white">{p.to_name}</td>
                        <td className="py-3 px-3 font-black text-rose-400 font-mono">-{p.amount.toLocaleString()} ريال</td>
                        <td className="py-3 px-3 font-bold">
                          <span className="block">{p.method}</span>
                          <span className="block text-[10px] text-amber-400 font-extrabold mt-0.5 font-sans">🏦 {awExtractTreasury(p.notes || "") || "خزنة الشركة"}</span>
                        </td>
                        <td className="py-3 px-3 text-slate-400">
                          <b className="text-white text-[11px] block">{p.project}</b>
                          {awCleanNotes(p.notes || "")}
                        </td>
                        <td className="py-3 px-3 text-center space-x-1">
                          <button onClick={() => { setEditPaymentId(p.id); setPayTo(p.to_name || ""); setPayAmount(p.amount || ""); setPayMethod(p.method || ""); setPayDate(p.date || ""); setPayProject(p.project || ""); setPayNotes(awCleanNotes(p.notes || "")); setPayTreasury(awExtractTreasury(p.notes || "") || "خزنة الشركة"); }} className="p-1 text-blue-400 hover:text-white"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => { if(confirm("تأكيد الحذف؟")) { sb.from("payments").delete().eq("id", p.id).then(() => loadEverything()); } }} className="p-1 text-rose-400 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Core Expenses Tab Container */}
          {activeSection === "expenses" && (
            <div className="space-y-6">
              <form onSubmit={saveExpenseLogic} className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
                <div className="border-b border-slate-850 pb-3">
                  <h3 className="text-base font-black text-white flex items-center gap-2"><span>🧾</span> تسجيل بند مصروف فرعي</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <input required placeholder="اسم المصروف ووصفه" value={eName} onChange={(e) => setEName(e.target.value)} className="w-full px-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none" />
                  <select value={eCategory} onChange={(e: any) => setECategory(e.target.value)} className="w-full px-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none">
                    <option value="مواد">مواد</option>
                    <option value="عمالة">عمالة</option>
                    <option value="نقل">نقل</option>
                    <option value="إيجار">إيجار</option>
                    <option value="وقود">وقود</option>
                    <option value="أخرى">أخرى</option>
                  </select>
                  <input type="number" required placeholder="المبلغ" value={eAmount} onChange={(e) => setEAmount(e.target.value ? Number(e.target.value) : "")} className="w-full px-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none" />
                  <input type="date" value={eDate} onChange={(e) => setEDate(e.target.value)} className="w-full px-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none" />
                  <input placeholder="المشروع التابع" value={eProject} onChange={(e) => setEProject(e.target.value)} className="w-full px-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none" />
                  <input placeholder="المورد أو المستفيد" value={eSupplier} onChange={(e) => setESupplier(e.target.value)} className="w-full px-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none" />
                  <textarea placeholder="ملاحظات" value={eNotes} onChange={(e) => setENotes(e.target.value)} className="w-full px-3 py-1.5 h-[41px] bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white sm:col-span-2 focus:outline-none" />
                </div>
                <div className="flex gap-2 justify-end">
                  {editExpenseId && (
                    <button type="button" onClick={() => { setEditExpenseId(null); setEName(""); setEAmount(""); setEProject(""); setESupplier(""); setENotes(""); }} className="px-5 py-2.5 bg-slate-800 rounded-xl text-xs font-black">إلغاء</button>
                  )}
                  <button type="submit" className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black">{editExpenseId ? "تعديل القيّد" : "قيد المصروف ماليًا"}</button>
                </div>
              </form>

              <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-xl overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-slate-300">
                      <th className="py-2.5 px-3 font-bold">رقم المصروف</th>
                      <th className="py-2.5 px-3 font-bold">التاريخ</th>
                      <th className="py-2.5 px-3 font-bold">اسم المصروف وفئته</th>
                      <th className="py-2.5 px-3 font-bold">المبلغ المدفوع</th>
                      <th className="py-2.5 px-3 font-bold">المورد والمشروع</th>
                      <th className="py-2.5 px-3 font-bold">البيانات الإضافية</th>
                      <th className="py-2.5 px-3 font-bold text-center">إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getVisibleExpenses().map((e, idx) => (
                      <tr key={idx} className="border-b border-slate-850 hover:bg-slate-800/10 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-slate-300">{e.no}</td>
                        <td className="py-3 px-3 font-mono text-slate-400">{e.date}</td>
                        <td className="py-3 px-3">
                          <span className="block font-black text-white">{e.name}</span>
                          <span className="block text-[10px] text-amber-500 mt-0.5 font-bold">فئة: {e.category}</span>
                        </td>
                        <td className="py-3 px-3 font-black text-rose-400 font-mono">-{e.amount.toLocaleString()} ريال</td>
                        <td className="py-3 px-3">
                          <span className="block font-bold text-slate-200">{e.supplier || "مورد كلي"}</span>
                          <span className="block text-[10px] text-slate-400 font-bold mt-0.5">{e.project}</span>
                        </td>
                        <td className="py-3 px-3 text-slate-400 max-w-xs truncate">{awCleanNotes(e.notes || "")}</td>
                        <td className="py-3 px-3 text-center space-x-1">
                          <button onClick={() => { setEditExpenseId(e.id); setEName(e.name || ""); setECategory(e.category || ""); setEAmount(e.amount || ""); setEDate(e.date || ""); setEProject(e.project || ""); setESupplier(e.supplier || ""); setENotes(awCleanNotes(e.notes || "")); }} className="p-1 text-blue-400 hover:text-white"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => { if(confirm("تأكيد الحذف؟")) { sb.from("expenses").delete().eq("id", e.id).then(() => loadEverything()); } }} className="p-1 text-rose-400 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Active Projects Tab Container */}
          {activeSection === "projects" && (
            <div className="space-y-6">
              <form onSubmit={saveProjectLogic} className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
                <div className="border-b border-slate-850 pb-3">
                  <h3 className="text-base font-black text-white flex items-center gap-2"><span>🏗️</span> تسجيل مشروع جديد وبطاقة الموقع</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <input required placeholder="اسم المشروع" value={pName} onChange={(e) => setPName(e.target.value)} className="w-full px-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none" />
                  <input placeholder="الموقع الجغرافي" value={pLocation} onChange={(e) => setPLocation(e.target.value)} className="w-full px-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none" />
                  <input placeholder="المهندس المشرف" value={pEngineer} onChange={(e) => setPEngineer(e.target.value)} className="w-full px-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none" />
                  <input type="number" placeholder="الميزانية المخصصة" value={pBudget} onChange={(e) => setPBudget(e.target.value ? Number(e.target.value) : "")} className="w-full px-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none" />
                  <input type="date" title="تاريخ البدء" value={pStart} onChange={(e) => setPStart(e.target.value)} className="w-full px-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none" />
                  <input type="date" title="تاريخ الانتهاء" value={pEnd} onChange={(e) => setPEnd(e.target.value)} className="w-full px-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none" />
                  <input type="number" placeholder="نسبة الإنجاز %" value={pProgress} onChange={(e) => setPProgress(e.target.value ? Number(e.target.value) : "")} className="w-full px-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none" />
                  <select value={pStatus} onChange={(e: any) => setPStatus(e.target.value)} className="w-full px-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none">
                    <option value="نشط">نشط</option>
                    <option value="متوقف">متوقف</option>
                    <option value="منتهي">منتهي</option>
                  </select>
                </div>
                <div className="flex gap-2 justify-end">
                  {editProjectId && (
                    <button type="button" onClick={() => { setEditProjectId(null); setPName(""); setPLocation(""); setPEngineer(""); setPBudget(""); setPProgress(0); setPNotes(""); }} className="px-5 py-2.5 bg-slate-800 rounded-xl text-xs font-black">إلغاء</button>
                  )}
                  <button type="submit" className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black">{editProjectId ? "حفظ التحديث" : "إنشاء بطاقة المشروع"}</button>
                </div>
              </form>

              <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-xl overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-slate-300">
                      <th className="py-2.5 px-3 font-bold">اسم المشروع والموقع</th>
                      <th className="py-2.5 px-3 font-bold">المهندس المشرف</th>
                      <th className="py-2.5 px-3 font-bold">الميزانية</th>
                      <th className="py-2.5 px-3 font-bold">Progress</th>
                      <th className="py-2.5 px-3 font-bold">الحالة</th>
                      <th className="py-2.5 px-3 font-bold text-center">إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((p, idx) => (
                      <tr key={idx} className="border-b border-slate-850 hover:bg-slate-800/10 transition-colors">
                        <td className="py-3 px-3">
                          <span className="block font-black text-white">{p.name}</span>
                          <span className="block text-[10px] text-slate-400 mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3 text-amber-500" /> {p.location || "غير محدد"}</span>
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-200">{p.engineer || "بإشراف فرقا المقاول"}</td>
                        <td className="py-3 px-3 font-mono text-white font-extrabold">{Number(p.budget || 0).toLocaleString()} ريال</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] font-bold text-amber-400">{p.progress}%</span>
                            <div className="w-20 h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                              <div className="bg-amber-500 h-full" style={{ width: `${p.progress}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-black ${p.status === "نشط" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>{p.status}</span>
                        </td>
                        <td className="py-3 px-3 text-center space-x-1">
                          <button onClick={() => { setEditProjectId(p.id); setPName(p.name || ""); setPLocation(p.location || ""); setPEngineer(p.engineer || ""); setPBudget(p.budget || ""); setPProgress(p.progress !== undefined && p.progress !== null ? p.progress : 0); setPStatus(p.status || "نشط"); setPNotes(p.notes || ""); }} className="p-1 text-blue-400 hover:text-white"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => { if(confirm("حذف ملف المشروع بشكل نهائي؟")) { sb.from("projects").delete().eq("id", p.id).then(() => loadEverything()); } }} className="p-1 text-rose-400 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Workers dynamic tab log integrates */}
          {activeSection === "workers" && (
            <div className="space-y-6">
              <form onSubmit={saveWorkerLogic} className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
                <div className="border-b border-slate-850 pb-3">
                  <h3 className="text-base font-black text-white flex items-center gap-2"><span>👷</span> تسجيل عامل/مشرف وقائمة السلف الجارية</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <input required placeholder="اسم العامل بالكامل" value={wName} onChange={(e) => setWName(e.target.value)} className="w-full px-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none" />
                  <input placeholder="رقم الهوية الإقامة" value={wId} onChange={(e) => setWId(e.target.value)} className="w-full px-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none" />
                  <input placeholder="رقم الجوال" value={wPhone} onChange={(e) => setWPhone(e.target.value)} className="w-full px-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none" />
                  <select value={wJob} onChange={(e: any) => setWJob(e.target.value)} className="w-full px-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none">
                    <option value="حداد">حداد</option>
                    <option value="نجار">نجار</option>
                    <option value="كهربائي">كهربائي</option>
                    <option value="سباك">سباك</option>
                    <option value="عامل">عامل</option>
                    <option value="مشرف">مشرف</option>
                  </select>
                  <input placeholder="المشروع المعين" value={wProject} onChange={(e) => setWProject(e.target.value)} className="w-full px-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none" />
                  <input type="number" placeholder="قيمة اليومية" value={wDaily} onChange={(e) => setWDaily(e.target.value ? Number(e.target.value) : "")} className="w-full px-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none" />
                  <input type="number" placeholder="عدد أيام العمل" value={wDays} onChange={(e) => setWDays(e.target.value ? Number(e.target.value) : "")} className="w-full px-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none" />
                  <input type="number" placeholder="سلفة معجلة" value={wAdvance} onChange={(e) => setWAdvance(e.target.value ? Number(e.target.value) : 0)} className="w-full px-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none" />
                  <select value={wStatus} onChange={(e: any) => setWStatus(e.target.value)} className="w-full px-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none">
                    <option value="على رأس العمل">على رأس العمل</option>
                    <option value="إجازة">إجازة</option>
                    <option value="موقوف">موقوف</option>
                  </select>
                  <textarea placeholder="ملاحظات" value={wNotes} onChange={(e) => setWNotes(e.target.value)} className="w-full px-3 py-1.5 h-[41px] bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white sm:col-span-2 focus:outline-none" />
                </div>
                <div className="flex gap-2 justify-end">
                  {editWorkerId && (
                    <button type="button" onClick={() => { setEditWorkerId(null); setWName(""); setWId(""); setWPhone(""); setWProject(""); setWDaily(""); setWDays(""); setWAdvance(0); setWNotes(""); }} className="px-5 py-2.5 bg-slate-800 rounded-xl text-xs font-black">إلغاء</button>
                  )}
                  <button type="submit" className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black">{editWorkerId ? "تعديل القيّد" : "قيد العامل بالمقاولات"}</button>
                </div>
              </form>

              <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-xl overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-slate-300">
                      <th className="py-2.5 px-3 font-bold">الاسم والمهنة</th>
                      <th className="py-2.5 px-3 font-bold">المشروع المعني</th>
                      <th className="py-2.5 px-3 font-bold text-center">أيام العمل الجارية</th>
                      <th className="py-2.5 px-3 font-bold">إجمالي المستحق اليومي</th>
                      <th className="py-2.5 px-3 font-bold">سلفة مسحوبة</th>
                      <th className="py-2.5 px-3 font-bold">الصافي المعلق</th>
                      <th className="py-2.5 px-3 font-bold">الوضعية</th>
                      <th className="py-2.5 px-3 font-bold text-center">إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workers.map((w, idx) => (
                      <tr key={idx} className="border-b border-slate-850 hover:bg-slate-800/10 transition-colors">
                        <td className="py-3 px-3">
                          <span className="block font-black text-white">{w.name}</span>
                          <span className="block text-[10px] text-slate-400 mt-0.5">مهنة: {w.job} • {w.worker_id || "بدون هوية"}</span>
                        </td>
                        <td className="py-3 px-3 font-bold text-amber-500">{w.project}</td>
                        <td className="py-3 px-3 font-mono font-bold text-center text-white">{w.days} يومًا</td>
                        <td className="py-3 px-3 font-mono text-slate-200">{(w.daily * w.days).toLocaleString()} ريال</td>
                        <td className="py-3 px-3 font-black text-rose-400 font-mono">-{Number(w.advance || 0).toLocaleString()} ريال</td>
                        <td className="py-3 px-3 font-black text-emerald-400 font-mono">{(w.total - w.advance).toLocaleString()} ريال</td>
                        <td className="py-3 px-3">
                          <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-black ${w.status === "على رأس العمل" ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-850 text-slate-400"}`}>{w.status}</span>
                        </td>
                        <td className="py-3 px-3 text-center space-x-1">
                          <button onClick={() => { setEditWorkerId(w.id); setWName(w.name || ""); setWId(w.worker_id || ""); setWPhone(w.phone || ""); setWJob(w.job || "عامل"); setWProject(w.project || ""); setWDaily(w.daily || ""); setWDays(w.days || ""); setWAdvance(w.advance !== undefined && w.advance !== null ? w.advance : 0); setWStatus(w.status || "على رأس العمل"); setWNotes(w.notes || ""); }} className="p-1 text-blue-400 hover:text-white"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => { if(confirm("مسح العامل من قوائم الحساب؟")) { sb.from("workers").delete().eq("id", w.id).then(() => loadEverything()); } }} className="p-1 text-rose-400 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Secure permissions and User configuration block */}
          {activeSection === "users" && (currentUser?.role === "admin" || can("users")) && (
            <div className="space-y-6">
              <form onSubmit={saveUserLogic} className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
                <div className="border-b border-slate-850 pb-3">
                  <h3 className="text-base font-black text-white flex items-center gap-2"><span>👤</span> تهيئة الصلاحيات الإدارية وربط حساب الموظفين</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <input required placeholder="اسم الموظف" value={uName} onChange={(e) => setUName(e.target.value)} className="w-full px-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none" />
                  <input required placeholder="كود تسجيل الدخول" value={uCode} onChange={(e) => setUCode(e.target.value)} className="w-full px-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none" />
                  <input required placeholder="كلمة المرور المالية" value={uPass} onChange={(e) => setUPass(e.target.value)} className="w-full px-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none" />
                  <select value={uRole} onChange={(e: any) => setURole(e.target.value)} className="w-full px-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none">
                    <option value="employee">موظف فرع محدود</option>
                    <option value="admin">أدمن مكتب عام</option>
                  </select>
                  <select value={uRegion} onChange={(e) => setURegion(e.target.value)} className="w-full px-3 py-2 bg-slate-950/40 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none">
                    <option value="">كل الإدارات والفروع</option>
                    <option value="الوسطى">الوسطى</option>
                    <option value="الشرقية">الشرقية</option>
                    <option value="الغربية">الغربية</option>
                    <option value="الجنوب">الجنوب</option>
                    <option value="الشمال">الشمال</option>
                  </select>
                </div>

                {/* Submitting check lists for individual permissions inside erp */}
                <div className="space-y-2">
                  <span className="block text-xs font-extrabold text-amber-400">تشغيل صلاحيات الموظف (Check Permissions Context)</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 bg-slate-950/40 p-4 border border-slate-850 rounded-2xl">
                    {Object.keys(uPerms).map((k) => (
                      <label key={k} className="flex items-center gap-2 px-3 py-2 bg-slate-900/60 rounded-xl border border-slate-850 hover:border-slate-800 hover:text-slate-200 transition-all cursor-pointer text-xs font-bold select-none text-slate-400">
                        <input
                          type="checkbox"
                          checked={uPerms[k]}
                          onChange={(e) => setUPerms((prev) => ({ ...prev, [k]: e.target.checked }))}
                          className="accent-amber-500 w-4 h-4 cursor-pointer"
                        />
                        <span>
                          {k === "installmentsView" && "👁️ التقسيط والعقود"}
                          {k === "installmentsAdd" && "➕ إضافة عقد يومي"}
                          {k === "installmentsEdit" && "📝 تعديل عقود فرعية"}
                          {k === "installmentsDelete" && "❌ حذف العقود الملتزمة"}
                          {k === "quotes" && "📋 عروض الأسعار"}
                          {k === "receipts" && "💰 سندات القبض"}
                          {k === "payments" && "💸 سندات الصرف"}
                          {k === "expenses" && "🧾 المصروفات الدفترية"}
                          {k === "treasury" && "🏦 استعراض الخزائن الموحدة"}
                          {k === "projects" && "🏗️ تتبع المشاريع والمهندسين"}
                          {k === "workers" && "👷 العمال ورواتب السلف"}
                          {k === "users" && "👥 تهيئة وإضافة الموظفين"}
                          {k === "sessions" && "🕰️ استكشاف سجلات التدقيق"}
                          {k === "print" && "🖨️ تفويض طباعة عهود الاتفاق"}
                          {k.startsWith("dash") && `المؤشر: ${k.replace("dash", "")}`}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  {editUserId && (
                    <button type="button" onClick={() => { setEditUserId(null); setUName(""); setUCode(""); setUPass(""); setURegion(""); setURole("employee"); }} className="px-5 py-2.5 bg-slate-800 rounded-xl text-xs font-black">إلغاء</button>
                  )}
                  <button type="submit" className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black">حفظ وإرسال الصلاحية للموظف</button>
                </div>
              </form>

              <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-xl overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-slate-300">
                      <th className="py-2.5 px-3 font-bold">الاسم والكود</th>
                      <th className="py-2.5 px-3 font-bold">الدور الإداري</th>
                      <th className="py-2.5 px-3 font-bold">الفرع / الإدارة المقررة</th>
                      <th className="py-2.5 px-3 font-bold">صلاحيات الولوج النشطة</th>
                      <th className="py-2.5 px-3 font-bold text-center">إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u, idx) => {
                      const permissionsObj = u.perms || {};
                      const names = Object.keys(permissionsObj).filter((k) => k !== "region" && permissionsObj[k]);
                      return (
                        <tr key={idx} className="border-b border-slate-850 hover:bg-slate-800/10 transition-colors">
                          <td className="py-3 px-3">
                            <span className="block font-black text-white">{u.name}</span>
                            <span className="block text-[10px] text-amber-500 select-all font-mono font-bold">كود الموظف: {u.code}</span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2.5 py-0.5 rounded text-[10px] bg-slate-800 text-amber-400 font-bold border border-slate-700">{u.role === "admin" ? "أدمن مكتب عام" : "موظف فرع"}</span>
                          </td>
                          <td className="py-3 px-3 font-bold text-indigo-400">{permissionsObj.region || "كامل فروع المملكة"}</td>
                          <td className="py-3 px-3 text-slate-400 max-w-sm truncate" title={names.join(" - ")}>
                            {names.length > 0 ? names.join(" • ") : "صلاحيات محدودة كافية للعرض فقط"}
                          </td>
                          <td className="py-3 px-3 text-center space-x-1">
                            <button
                              onClick={() => {
                                setEditUserId(u.id);
                                setUName(u.name || "");
                                setUCode(u.code || "");
                                setUPass(u.password || "");
                                setURole(u.role || "employee");
                                setURegion(permissionsObj.region || "");
                                setUPerms({
                                  ...permissionsObj,
                                  region: permissionsObj.region || "",
                                });
                              }}
                              className="p-1 text-blue-400 hover:text-white"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {currentUser.code !== u.code && (
                              <button onClick={() => { if(confirm("مسح حساب الموظف؟")) { sb.from("users").delete().eq("id", u.id).then(() => loadEverything()); } }} className="p-1 text-rose-400 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Audit logs screen displaying sessions logs */}
          {activeSection === "sessions" && (currentUser?.role === "admin" || can("sessions")) && (
            <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <h3 className="text-base font-black text-white flex items-center gap-2"><span>👁️</span> سجل الحركات التراكمي وتدقيق الجلسات الآمنة</h3>
              <div className="overflow-x-auto rounded-2xl border border-slate-800">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-slate-300">
                      <th className="py-2.5 px-3 font-bold">الموظف</th>
                      <th className="py-2.5 px-3 font-bold">كود تسجيله</th>
                      <th className="py-2.5 px-3 font-bold">المرتبة</th>
                      <th className="py-2.5 px-3 font-bold">توقيت الحركة</th>
                      <th className="py-2.5 px-3 font-bold">العملية المتبعة اليوم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850/30">
                    {sessions.map((s, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/10 h-10 transition-colors">
                        <td className="py-2 px-3 font-bold text-white">{s.name}</td>
                        <td className="py-2 px-3 font-mono font-semibold text-slate-400">{s.code}</td>
                        <td className="py-2 px-3"><span className="text-[10px] text-amber-500 font-bold">{s.role}</span></td>
                        <td className="py-2 px-3 font-mono text-slate-400">{s.time}</td>
                        <td className="py-2 px-3 font-black text-slate-200">{s.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
