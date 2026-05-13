import { UTApi } from "uploadthing/server";

const utapi = new UTApi();

export async function deleteFilesFromUploadThing(fileKeys: string[]) {
	try {
		const result = await utapi.deleteFiles(fileKeys);
		console.log("Files deleted:", result);
	} catch (error) {
		console.error("Error deleting files from UploadThing:", error);
	}
}

export function extractFileKey(url: string): string | null {
	try {
		const parts = url.split("/");
		return parts[parts.length - 1] || null;
	} catch {
		return null;
	}
}