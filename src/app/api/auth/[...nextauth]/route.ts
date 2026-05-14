import { NextRequest } from "next/server";

import {handlers} from "@/auth";

function withDetectedOrigin(req: NextRequest) {
	const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
	const protocolHeader = req.headers.get("x-forwarded-proto");
	const protocol = protocolHeader
		? (protocolHeader.endsWith(":") ? protocolHeader : `${protocolHeader}:`)
		: req.nextUrl.protocol;

	if (!host) return req;

	const url = req.nextUrl.clone();
	url.protocol = protocol;
	url.host = host;

	if (url.origin === req.nextUrl.origin) return req;

	return new NextRequest(url, req);
}

export async function GET(req: NextRequest) {
	return handlers.GET(withDetectedOrigin(req));
}

export async function POST(req: NextRequest) {
	return handlers.POST(withDetectedOrigin(req));
}
