'use client';

import React from 'react';
import {useTranslations} from "use-intl";

const Footer = () => {
	const t = useTranslations();

	return (
		<div dir="ltr" className=" text-sm">
				developed by <a href="https://www.craftksa.com" className="text-primary hover:underline"> Craft Ksa </a>
		</div>
	);
};

export default Footer;
