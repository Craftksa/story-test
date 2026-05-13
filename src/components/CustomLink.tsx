import React from 'react';
import Link from "next/link";

const CustomLink = ({href, className, children}: any) => {
	return (
		<Link href={href} className={`${className} hover:underline hover:text-primary underline-offset-2`}>
			{children}
		</Link>
	);
};

export default CustomLink;