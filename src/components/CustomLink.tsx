import React from 'react';
import Link from "next/link";

interface CustomLinkProps {
	href: string;
	className?: string;
	children: React.ReactNode;
}

const CustomLink = ({href, className, children}: CustomLinkProps) => {
	return (
		<Link href={href} className={`${className} hover:underline hover:text-primary underline-offset-2`}>
			{children}
		</Link>
	);
};

export default CustomLink;