"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock3, FileEdit } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type SummaryItem = { status: string; title?: string | null; subject?: string | null; content?: string | null };
type SummaryData = { reports: SummaryItem[]; letters: SummaryItem[]; notes: SummaryItem[] };

export default function CorrespondenceSummary({ role }: { role: string }) {
	const [data, setData] = useState<SummaryData>({ reports: [], letters: [], notes: [] });
	useEffect(() => { void fetch("/api/correspondence", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((value) => value && setData(value)); }, []);
	const all = [...data.reports, ...data.letters, ...data.notes];
	const pending = all.filter((item) => item.status === "pending_admin_approval").length;
	const drafts = all.filter((item) => item.status === "draft" || item.status === "rejected").length;
	const recent = all.filter((item) => item.status === "approved" || item.status === "sent").slice(0, 3);
	const isClient = role === "client";
	return <section className="space-y-3" dir="rtl"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">المتابعة السريعة</p><h2 className="text-xl font-semibold">التقارير والمراسلات</h2></div><Link href="/correspondence" className="inline-flex items-center text-sm font-medium hover:underline">فتح المساحة<ArrowLeft className="mr-2 size-4" /></Link></div><div className="grid gap-3 md:grid-cols-3"><Card><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-sm">{isClient ? "أحدث المعتمد" : role === "employee" ? "مسودات ومرفوضات" : "بانتظار المراجعة"}</CardTitle>{isClient ? <CheckCircle2 className="size-4" /> : role === "employee" ? <FileEdit className="size-4" /> : <Clock3 className="size-4" />}</CardHeader><CardContent><p className="text-3xl font-bold">{isClient ? recent.length : role === "employee" ? drafts : pending}</p>{isClient && recent[0] && <Badge variant="secondary" className="mt-2">جديد</Badge>}</CardContent></Card>{isClient && recent.slice(0, 2).map((item, index) => <Card key={`${item.status}-${index}`}><CardContent className="flex min-h-28 flex-col justify-center"><p className="line-clamp-2 font-medium">{item.title ?? item.subject ?? item.content}</p><Badge variant="secondary" className="mt-3 w-fit">معتمد</Badge></CardContent></Card>)}</div></section>;
}