import {NextRequest, NextResponse} from "next/server";
import {authenticate} from "@/lib/authenticate";
import {hasRole} from "@/lib/utils";
import {db} from "@/drizzle/db";
import {taskImages} from "@/drizzle/schema";
import {eq} from "drizzle-orm";
import {deleteFilesFromUploadThing, extractFileKey} from "@/app/api/uploadthing/delete-files";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const { user } = await authenticate(req);

	if (!hasRole(user, ["admin", "moderator", "employee"])) {
		return NextResponse.json({ error: "Forbidden 403" }, { status: 403 });
	}

	const image = await db
		.select()
		.from(taskImages)
		.where(eq(taskImages.id, id))
		.then((res) => res[0]);

	if (!image) {
		return NextResponse.json({ error: "Image not found" });
	}

	const imageKey = extractFileKey(image.url);

	await deleteFilesFromUploadThing([imageKey as string])

	await db.delete(taskImages).where(eq(taskImages.id, image.id));
	return NextResponse.json({ message: "Image deleted" });
}
