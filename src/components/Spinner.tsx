import React from 'react';
import {LoaderCircle} from "lucide-react";

const Spinner = ({className}: {className?: string}) => {
	return (
		<LoaderCircle className={`${className} animate-spin duration-500`} />
	);
};

export default Spinner;
