'use client';

import Image from "next/image";

import { cn } from "@/lib/utils";

type CraftLogoProps = {
	alt?: string;
	className?: string;
	priority?: boolean;
	sizes?: string;
};

const CraftLogo = ({
	alt = "Craft",
	className,
	priority = false,
	sizes = "200px",
}: CraftLogoProps) => {
	return (
		<span className={cn("relative block h-full w-full", className)}>
			<Image
				src="/brand/craft-logo-black.png"
				alt={alt}
				fill
				priority={priority}
				sizes={sizes}
				className="object-contain dark:hidden"
			/>
			<Image
				src="/brand/craft-logo-white.png"
				alt={alt}
				fill
				priority={priority}
				sizes={sizes}
				className="hidden object-contain dark:block"
			/>
		</span>
	);
};

export default CraftLogo;
