'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home, Lock } from 'lucide-react';
import { useRouter } from "next/navigation";

export default function UnauthorizedPage() {
	const router = useRouter();
	const searchParams = useSearchParams();

	const reason = searchParams.get("reason") ?? "access_denied";
	const role = searchParams.get("requiredRole") ?? "unknown";
	const attemptedPath = searchParams.get("attemptedPath") ?? "unknown";

	return (
		<div className="min-h-[70svh] flex items-center justify-center p-4">
			<div className="mx-auto text-center relative">
				{/* Background glow effect */}
				<div className="absolute inset-0 bg-gradient-to-r from-red-400/10 to-yellow-300/10 animate-pulse rounded-lg blur-2xl" />

				{/* Main content */}
				<div className="relative">
					<h1 className="text-8xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-yellow-400 animate-gradient mb-4">
						403
					</h1>
					<h2 className="text-2xl font-bold text-foreground mb-4 flex items-center justify-center gap-2">
						<Lock className="w-6 h-6 text-destructive -mt-1" />
						Access Denied
					</h2>
					<p className="text-muted-foreground mb-2">
						You do not have permission to view <code className="font-mono text-sm">{attemptedPath}</code>
					</p>
					<p className="text-sm text-gray-500 mb-6">
						Your role: <strong>{role}</strong> &mdash; Reason: <code>{reason}</code>
					</p>

					{/* Navigation buttons */}
					<div className="flex flex-col sm:flex-row gap-4 justify-center">
						<Button
							onClick={() => router.back()}
							variant="outline"
							size="sm"
							className="group flex items-center gap-2 justify-center hover:border-red-500 transition-all"
						>
							<ArrowLeft className="h-4 w-4 group-hover:text-red-500" />
							Go Back
						</Button>
						<Button
							onClick={() => router.push('/')}
							size="sm"
							className="bg-gradient-to-r flex gap-2 items-center justify-center text-white from-red-500 to-yellow-400 hover:from-red-500 hover:to-yellow-400/70"
						>
							<Home className="h-4 w-4" />
							Return Home
						</Button>
					</div>

					{/* Decorative elements */}
					<div className="absolute -top-20 sm:-left-20 left-0 w-40 h-40 bg-red-500/20 rounded-full blur-3xl" />
					<div className="absolute -bottom-20 sm:-right-20 right-0 w-40 h-40 bg-yellow-400/20 rounded-full blur-3xl" />
				</div>
			</div>
		</div>
	);
}
