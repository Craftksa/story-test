"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Check, FileText, Loader2, Mail, MessageSquare, Plus, Send, X } from "lucide-react";
import { uploadFiles } from "@/utils/uploadthing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type Kind = "reports" | "letters" | "notes";
type Item = Record<string, string | null | undefined> & {
	id: string;
	projectId: string;
	status: string;
	recipientType?: "owner" | "client" | null;
	recipientId?: string | null;
	pdfUrl?: string | null;
	pdfFileName?: string | null;
};
type Owner = { id: string; name: string | null; email: string | null };
type Data = { projects: Array<{ id: string; name: string }>; owners: Owner[]; reports: Item[]; letters: Item[]; notes: Item[] };
type Form = { projectId: string; title: string; details: string; subject: string; body: string; content: string; recipientType: "owner" | "client"; recipientId: string; pdfUrl: string; pdfFileName: string };

const emptyForm: Form = { projectId: "", title: "", details: "", subject: "", body: "", content: "", recipientType: "owner", recipientId: "", pdfUrl: "", pdfFileName: "" };
const labels: Record<string, string> = { draft: "مسودة", pending_admin_approval: "بانتظار المراجعة", approved: "معتمد", rejected: "مرفوض", sent: "تم الإرسال" };

export default function CorrespondenceWorkspace() {
	const { data: session } = useSession();
	const role = session?.user?.role ?? "client";
	const reviewer = role === "moderator";
	const staff = reviewer || role === "employee" || role === "admin";
	const [data, setData] = useState<Data>({ projects: [], owners: [], reports: [], letters: [], notes: [] });
	const [tab, setTab] = useState<Kind>("reports");
	const [kind, setKind] = useState<Kind | null>(null);
	const [editing, setEditing] = useState<Item | null>(null);
	const [form, setForm] = useState<Form>(emptyForm);
	const [loading, setLoading] = useState(true);

	const load = async () => {
		setLoading(true);
		const response = await fetch("/api/correspondence", { cache: "no-store" });
		if (response.ok) setData(await response.json());
		setLoading(false);
	};
	useEffect(() => { void load(); }, []);

	const openCreate = (nextKind: Kind) => {
		setEditing(null);
		setForm({ ...emptyForm, projectId: data.projects[0]?.id ?? "" });
		setKind(nextKind);
	};

	const openEdit = (nextKind: Kind, item: Item) => {
		setEditing(item);
		setForm({ ...emptyForm, projectId: item.projectId, title: item.title ?? "", details: item.details ?? "", subject: item.subject ?? "", body: item.body ?? "", content: item.content ?? "", recipientType: item.recipientType ?? "owner", recipientId: item.recipientId ?? "", pdfUrl: item.pdfUrl ?? "", pdfFileName: item.pdfFileName ?? "" });
		setKind(nextKind);
	};

	const save = async (action: "save" | "submit") => {
		const body = { type: kind, action, ...form };
		const response = editing
			? await fetch(`/api/correspondence/${kind}/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
			: await fetch("/api/correspondence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
		const result = await response.json();
		if (!response.ok) return toast.error(result.error ?? "تعذر حفظ المحتوى");
		toast.success(result.message);
		setKind(null);
		await load();
	};

	const review = async (nextKind: Kind, item: Item, action: "approve" | "reject") => {
		const reason = action === "reject" ? window.prompt("سبب الرفض مطلوب")?.trim() : undefined;
		if (action === "reject" && !reason) return;
		const response = await fetch(`/api/correspondence/${nextKind}/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, reason }) });
		const result = await response.json();
		if (!response.ok) return toast.error(result.error);
		toast.success(result.message);
		await load();
	};

	const renderList = (nextKind: Kind, items: Item[]) => <div className="grid gap-3">
		{items.length === 0 ? <Card><CardContent className="py-10 text-center text-muted-foreground">لا توجد عناصر هنا.</CardContent></Card> : items.map((item) => <Card key={item.id} className="gap-3">
			<CardHeader className="flex-row items-start justify-between gap-3">
				<div><CardTitle>{item.title ?? item.subject ?? (item.content ?? "").slice(0, 70)}</CardTitle><CardDescription>{data.projects.find((project) => project.id === item.projectId)?.name ?? "مشروع"} · {item.recipientType === "client" ? "العميل" : item.recipientType === "owner" ? "الأونر" : "مستلم غير محدد"}</CardDescription></div>
				<Badge variant={item.status === "rejected" ? "destructive" : "secondary"}>{labels[item.status] ?? item.status}</Badge>
			</CardHeader>
			<CardContent className="space-y-3"><p className="whitespace-pre-wrap text-sm text-muted-foreground">{item.pdfUrl ? `ملف PDF: ${item.pdfFileName ?? "التقرير.pdf"}` : item.details ?? item.body ?? item.content}</p>
				{nextKind === "reports" && (item.pdfUrl || item.status === "approved" || item.status === "sent") && <a className="text-sm underline" href={item.pdfUrl ? `/api/correspondence/reports/${item.id}/original` : `/api/correspondence/reports/${item.id}/pdf`} target="_blank" rel="noreferrer">معاينة / تنزيل PDF</a>}
				{item.rejectionReason && <p className="border-r-2 border-destructive pr-3 text-sm text-destructive">سبب الرفض: {item.rejectionReason}</p>}
				<div className="flex flex-wrap gap-2">
					{staff && (item.status === "draft" || item.status === "rejected") && <Button size="sm" variant="outline" onClick={() => openEdit(nextKind, item)}>تعديل</Button>}
					{staff && (item.status === "draft" || item.status === "rejected") && <Button size="sm" onClick={() => void fetch(`/api/correspondence/${nextKind}/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "submit" }) }).then(load)}><Send className="ml-2 size-4" />إرسال للمراجعة</Button>}
					{reviewer && item.status === "pending_admin_approval" && <><Button size="sm" onClick={() => void review(nextKind, item, "approve")}><Check className="ml-2 size-4" />اعتماد</Button><Button size="sm" variant="destructive" onClick={() => void review(nextKind, item, "reject")}><X className="ml-2 size-4" />رفض</Button></>}
				</div>
			</CardContent>
		</Card>)}
	</div>;

	return <main className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8" dir="rtl">
		<div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-sm text-muted-foreground">مساحة العمل</p><h1 className="text-3xl font-bold tracking-tight">التقارير والمراسلات</h1></div>{staff && <Button onClick={() => openCreate(tab)}><Plus className="ml-2 size-4" />إضافة</Button>}</div>
		<Tabs value={tab} onValueChange={(value) => setTab(value as Kind)}><TabsList className="w-full justify-start md:w-fit"><TabsTrigger value="reports"><FileText className="ml-2 size-4" />التقارير</TabsTrigger><TabsTrigger value="letters"><Mail className="ml-2 size-4" />الخطابات</TabsTrigger><TabsTrigger value="notes"><MessageSquare className="ml-2 size-4" />الملاحظات</TabsTrigger></TabsList><TabsContent value="reports">{loading ? <Loader2 className="mx-auto animate-spin" /> : renderList("reports", data.reports)}</TabsContent><TabsContent value="letters">{loading ? <Loader2 className="mx-auto animate-spin" /> : renderList("letters", data.letters)}</TabsContent><TabsContent value="notes">{loading ? <Loader2 className="mx-auto animate-spin" /> : renderList("notes", data.notes)}</TabsContent></Tabs>
		{kind && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"><Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto"><CardHeader><CardTitle>{editing ? "تعديل المحتوى" : "إنشاء مسودة"}</CardTitle><CardDescription>اختر المستلم الموثوق قبل الحفظ.</CardDescription></CardHeader><CardContent className="space-y-4"><select className="h-10 w-full border bg-background px-3" value={form.projectId} onChange={(event) => setForm({ ...form, projectId: event.target.value })}><option value="">اختر المشروع</option>{data.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><select className="h-10 w-full border bg-background px-3" value={form.recipientType} onChange={(event) => setForm({ ...form, recipientType: event.target.value as "owner" | "client", recipientId: "" })}><option value="owner">المستلم: الأونر</option><option value="client">المستلم: العميل</option></select>{form.recipientType === "owner" && <select className="h-10 w-full border bg-background px-3" value={form.recipientId} onChange={(event) => setForm({ ...form, recipientId: event.target.value })}><option value="">اختر الأونر</option>{data.owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name || owner.email || owner.id}</option>)}</select>}{kind === "reports" && <><Input placeholder="عنوان التقرير" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /><Textarea placeholder="محتوى التقرير أو وصفه" value={form.details} onChange={(event) => setForm({ ...form, details: event.target.value })} /><Input type="file" accept="application/pdf,.pdf" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; if (file.type !== "application/pdf" || file.size > 16 * 1024 * 1024) return toast.error("اختر ملف PDF صالحًا بحجم أقصى 16MB"); try { const uploaded = await uploadFiles("reportAttachmentUploader", { files: [file] }); const uploadedFile = uploaded[0]; if (uploadedFile) setForm({ ...form, pdfUrl: uploadedFile.ufsUrl, pdfFileName: file.name }); } catch { toast.error("تعذر رفع ملف PDF"); } }} /></>}{kind === "letters" && <><Input placeholder="عنوان الخطاب" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} /><Textarea placeholder="محتوى الخطاب" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></>}{kind === "notes" && <Textarea placeholder="محتوى الملاحظة" value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} />}<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setKind(null)}>إلغاء</Button><Button variant="secondary" onClick={() => void save("save")}>حفظ المسودة</Button><Button onClick={() => void save("submit")}><Send className="ml-2 size-4" />إرسال للمراجعة</Button></div></CardContent></Card></div>}
	</main>;
}
